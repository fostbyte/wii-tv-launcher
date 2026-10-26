/* =========================================================
   TV bridge – wraps Tizen APIs with graceful fallbacks.
   In a desktop browser (no `tizen` global) everything is
   mocked so the UI can be previewed.
   ========================================================= */
var TV = (function () {
  var isTizen = typeof window.tizen !== 'undefined';
  var appsCache = null;          // [{id, name}]
  var LOCAL_API = 'http://127.0.0.1:8001/api/v2';

  function log() {
    if (window.console) console.log.apply(console, ['[WiiTV]'].concat([].slice.call(arguments)));
  }

  /* ---------- Keys ---------- */
  var KEYS = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };

  function registerKeys() {
    if (!isTizen || !tizen.tvinputdevice) return;
    ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'].forEach(function (k) {
      try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* not on this remote */ }
    });
  }

  /* ---------- Installed apps ---------- */
  function loadApps(cb, force) {
    if (appsCache && !force) { cb(appsCache); return; }
    if (!isTizen) { appsCache = []; cb(appsCache); return; }
    try {
      tizen.application.getAppsInfo(function (list) {
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

  /* ---------- Local REST (same API the phone remote uses) ---------- */
  function restLaunch(restId, ok, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', LOCAL_API + '/applications/' + restId, true);
    xhr.timeout = 4000;
    xhr.onload = function () { (xhr.status >= 200 && xhr.status < 300) ? ok() : fail('REST ' + xhr.status); };
    xhr.onerror = function () { fail('REST network error'); };
    xhr.ontimeout = function () { fail('REST timeout'); };
    xhr.send();
  }

  /* ---------- Launch an app channel ---------- */
  function launchApp(channel, ok, fail) {
    if (!isTizen) { log('[mock] launch', channel.name); setTimeout(ok, 300); return; }

    var tizenId = findTizenId(channel);
    var tryRest = function (why) {
      log('tizen launch failed (' + why + '), trying REST', channel.restId);
      if (!channel.restId) { fail(why); return; }
      restLaunch(channel.restId, ok, fail);
    };

    if (!tizenId) { tryRest('no tizen id'); return; }
    try {
      tizen.application.launch(tizenId, ok, function (e) { tryRest(e && e.message); });
    } catch (e) { tryRest(e.message); }
  }

  /* ---------- HDMI sources ---------- */
  function getHdmiSources(cb) {
    if (!isTizen || !tizen.systeminfo) {
      cb([{ number: 1, connected: true }, { number: 2, connected: false }]);
      return;
    }
    try {
      tizen.systeminfo.getPropertyValue('VIDEOSOURCE', function (src) {
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
    if (!isTizen || !tizen.tvwindow) { log('[mock] show HDMI', number); ok(); return; }
    try {
      tizen.tvwindow.setSource({ type: 'HDMI', number: number }, function () {
        tizen.tvwindow.show(function () { ok(); }, function (e) { fail(e && e.message); },
          ['0px', '0px', '1920px', '1080px'], 'MAIN');
      }, function (e) { fail(e && e.message); }, 'MAIN');
    } catch (e) { fail(e.message); }
  }

  function hideHdmi() {
    if (!isTizen || !tizen.tvwindow) return;
    try { tizen.tvwindow.hide(function () {}, function () {}, 'MAIN'); } catch (e) { /* ignore */ }
  }

  /* ---------- Remote-control websocket (for Settings / Menu key) ---------- */
  function sendRemoteKey(key, ok, fail) {
    if (!isTizen) { log('[mock] remote key', key); ok(); return; }
    var done = false;
    var ws;
    try {
      ws = new WebSocket('ws://127.0.0.1:8001/api/v2/channels/samsung.remote.control?name=' + btoa('Wii Menu'));
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
