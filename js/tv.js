/* =========================================================
   TV bridge – wraps Tizen APIs and Samsung REST endpoints.
   In a desktop browser preview everything is mocked.
   On TV / TizenBrew, apps are launched via local REST
   (or native tizen.application API if present).
   ========================================================= */
var TV = (function () {
  var tizenGlobal = (function () {
    try {
      if (typeof window.tizen !== 'undefined') return window.tizen;
      if (typeof window.parent !== 'undefined' && typeof window.parent.tizen !== 'undefined') return window.parent.tizen;
      if (typeof window.top !== 'undefined' && typeof window.top.tizen !== 'undefined') return window.top.tizen;
    } catch (e) {}
    return null;
  })();

  var isTizen = !!tizenGlobal;
  var isTV = isTizen ||
             /Tizen|SmartTV|SamsungBrowser|Crosswalk/i.test(navigator.userAgent) ||
             (window.location && (window.location.port === '8081' || window.location.port === '8001'));

  var appsCache = null;          // [{id, name}]
  var apiHost = (window.location && window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1';
  var LOCAL_API = 'http://' + apiHost + ':8001/api/v2';

  function log() {
    if (window.console) console.log.apply(console, ['[WiiTV]'].concat([].slice.call(arguments)));
  }

  log('Environment:', isTizen ? 'Tizen-native' : (isTV ? 'TV-Web/TizenBrew' : 'Desktop-Mock'), 'API Host:', apiHost);

  /* ---------- Keys ---------- */
  var KEYS = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };

  function registerKeys() {
    if (!tizenGlobal || !tizenGlobal.tvinputdevice) return;
    ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'].forEach(function (k) {
      try { tizenGlobal.tvinputdevice.registerKey(k); } catch (e) { /* not on this remote */ }
    });
  }

  /* ---------- Installed apps ---------- */
  function loadApps(cb, force) {
    if (appsCache && !force) { cb(appsCache); return; }
    if (!tizenGlobal || !tizenGlobal.application) { appsCache = []; cb(appsCache); return; }
    try {
      tizenGlobal.application.getAppsInfo(function (list) {
        appsCache = list.map(function (a) { return { id: a.id, name: a.name || '', pkg: a.packageId }; });
        log('apps visible:', appsCache.length);
        cb(appsCache);
      }, function (err) {
        log('getAppsInfo failed', err && err.message);
        appsCache = []; cb(appsCache);
      });
    } catch (e) { log('getAppsInfo threw', e.message); appsCache = []; cb(appsCache); }
  }

  function findTizenId(channel) {
    if (!appsCache || !channel.match) return null;
    for (var i = 0; i < appsCache.length; i++) {
      var a = appsCache[i];
      if (channel.match.test(a.name) || channel.match.test(a.id)) return a.id;
    }
    return null;
  }

  /* ---------- Local REST (same API the Samsung remote uses) ---------- */
  function restLaunch(restId, ok, fail) {
    var url = LOCAL_API + '/applications/' + restId;
    log('restLaunch POST:', url);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.timeout = 5000;
    xhr.onload = function () {
      log('restLaunch response:', xhr.status, xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        if (ok) ok();
      } else {
        if (fail) fail('REST ' + xhr.status);
      }
    };
    xhr.onerror = function (e) {
      log('restLaunch error, fallback to 127.0.0.1:', e);
      if (apiHost !== '127.0.0.1') {
        var altUrl = 'http://127.0.0.1:8001/api/v2/applications/' + restId;
        var xhr2 = new XMLHttpRequest();
        xhr2.open('POST', altUrl, true);
        xhr2.timeout = 5000;
        xhr2.onload = function () {
          if (xhr2.status >= 200 && xhr2.status < 300) { if (ok) ok(); }
          else { if (fail) fail('REST ' + xhr2.status); }
        };
        xhr2.onerror = function () { if (fail) fail('REST network error'); };
        xhr2.ontimeout = function () { if (fail) fail('REST timeout'); };
        xhr2.send();
        return;
      }
      if (fail) fail('REST network error');
    };
    xhr.ontimeout = function () {
      log('restLaunch timeout');
      if (fail) fail('REST timeout');
    };
    xhr.send();
  }

  /* ---------- Launch an app channel ---------- */
  function launchApp(channel, ok, fail) {
    // Only mock on desktop browser preview (not running on TV)
    if (!isTV && !isTizen) {
      log('[mock desktop] launch', channel.name);
      setTimeout(ok, 300);
      return;
    }

    var tizenId = findTizenId(channel);
    var tryRest = function (why) {
      log('tizen launch fallback (' + why + '), trying REST id:', channel.restId);
      if (!channel.restId) {
        if (fail) fail(why || 'No app ID configured');
        return;
      }
      restLaunch(channel.restId, ok, fail);
    };

    if (tizenGlobal && tizenGlobal.application && tizenId) {
      try {
        log('launching via tizen.application:', tizenId);
        tizenGlobal.application.launch(tizenId, ok, function (e) {
          tryRest(e && e.message);
        });
        return;
      } catch (e) {
        tryRest(e.message);
        return;
      }
    }

    // Direct REST launch (standard for TizenBrew web modules)
    tryRest('direct REST');
  }

  /* ---------- HDMI sources ---------- */
  function getHdmiSources(cb) {
    if (!tizenGlobal || !tizenGlobal.systeminfo) {
      cb([{ number: 1, connected: true }, { number: 2, connected: false }]);
      return;
    }
    try {
      tizenGlobal.systeminfo.getPropertyValue('VIDEOSOURCE', function (src) {
        var out = [];
        var push = function (arr, connected) {
          (arr || []).forEach(function (s) {
            if (s.type === 'HDMI') out.push({ number: s.number, connected: connected });
          });
        };
        push(src.connected, true);
        push(src.disconnected, false);
        out.sort(function (a, b) { return a.number - b.number; });
        cb(out);
      }, function () { cb([{ number: 1, connected: true }]); });
    } catch (e) { cb([{ number: 1, connected: true }]); }
  }

  function showHdmi(number, ok, fail) {
    if (!tizenGlobal || !tizenGlobal.tvwindow) { log('[mock] show HDMI', number); ok(); return; }
    try {
      tizenGlobal.tvwindow.setSource({ type: 'HDMI', number: number }, function () {
        tizenGlobal.tvwindow.show(function () { ok(); }, function (e) { fail(e && e.message); },
          ['0px', '0px', '1920px', '1080px'], 'MAIN');
      }, function (e) { fail(e && e.message); }, 'MAIN');
    } catch (e) { fail(e.message); }
  }

  function hideHdmi() {
    if (!tizenGlobal || !tizenGlobal.tvwindow) return;
    try { tizenGlobal.tvwindow.hide(function () {}, function () {}, 'MAIN'); } catch (e) { /* ignore */ }
  }

  /* ---------- Remote-control websocket (for Settings / Menu key) ---------- */
  function sendRemoteKey(key, ok, fail) {
    if (!isTV && !isTizen) { log('[mock] remote key', key); ok(); return; }
    var done = false;
    var ws;
    try {
      ws = new WebSocket('ws://' + apiHost + ':8001/api/v2/channels/samsung.remote.control?name=' + btoa('Wii Menu'));
    } catch (e) { fail(e.message); return; }
    var timer = setTimeout(function () { if (!done) { done = true; try { ws.close(); } catch (e) {} fail('timeout'); } }, 6000);
    ws.onmessage = function (m) {
      var data = {};
      try { data = JSON.parse(m.data); } catch (e) {}
      if (data.event === 'ms.channel.connect' && !done) {
        ws.send(JSON.stringify({
          method: 'ms.remote.control',
          params: { Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' }
        }));
        done = true; clearTimeout(timer);
        setTimeout(function () { try { ws.close(); } catch (e) {} }, 400);
        ok();
      } else if (data.event === 'ms.channel.unauthorized' && !done) {
        done = true; clearTimeout(timer); fail('unauthorized');
      }
    };
    ws.onerror = function () { if (!done) { done = true; clearTimeout(timer); fail('ws error'); } };
  }

  function openSettings(ok, fail) {
    sendRemoteKey('KEY_MENU', ok, fail);
  }

  return {
    isTizen: isTizen,
    isTV: isTV,
    KEYS: KEYS,
    registerKeys: registerKeys,
    loadApps: loadApps,
    launchApp: launchApp,
    getHdmiSources: getHdmiSources,
    showHdmi: showHdmi,
    hideHdmi: hideHdmi,
    openSettings: openSettings,
    sendRemoteKey: sendRemoteKey
  };
})();
