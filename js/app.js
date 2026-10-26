/* =========================================================
   Wii Menu – main controller
   States: boot → menu ⇄ preview → (launch app | hdmi)
           menu ⇄ options / board
   ========================================================= */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var state = 'boot';
  var channels = [];       // resolved channel list (HDMI expanded)
  var page = 0;
  var pageCount = 1;
  var activeChannel = null;
  var lastMenuFocus = null;
  var toastTimer = null;

  /* ---------- Settings (persisted) ---------- */
  var DEFAULTS = { sound: true, clock24: false, boot: true, cursor: true };
  var settings = (function () {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('wiiSettings') || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();
  function saveSettings() { try { localStorage.setItem('wiiSettings', JSON.stringify(settings)); } catch (e) {} }

  /* ---------- Stage scaling (browser preview) ---------- */
  function fitStage() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
    stage.dataset.scale = s;
    placeCursor();
  }

  /* ---------- Clock ---------- */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function tick() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var ampm = '';
    if (!settings.clock24) { ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
    var hh = settings.clock24 && h < 10 ? '0' + h : String(h);
    $('clockTime').innerHTML = hh + '<span class="colon">:</span>' + (m < 10 ? '0' : '') + m;
    $('clockAmPm').textContent = ampm;
    $('clockDate').textContent = DAYS[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate();
    $('boardDate').textContent = DAYS_LONG[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  /* ---------- Toast ---------- */
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  /* ---------- Build channel list ---------- */
  function resolveChannels(cb) {
    TV.getHdmiSources(function (ports) {
      var list = [];
      WII_CONFIG.channels.forEach(function (ch) {
        if (ch.type === 'hdmi-placeholder') {
          ports.forEach(function (p) {
            list.push({
              key: 'hdmi' + p.number, type: 'hdmi', number: p.number, connected: p.connected,
              name: WII_CONFIG.hdmiNames[p.number] || ('HDMI ' + p.number),
              subtitle: WII_CONFIG.hdmiNames[p.number] && WII_CONFIG.hdmiNames[p.number] !== 'HDMI ' + p.number
                ? WII_CONFIG.hdmiNames[p.number] : null
            });
          });
        } else {
          list.push(ch);
        }
      });
      cb(list);
    });
  }

  function renderGrid() {
    var per = WII_CONFIG.tilesPerPage;
    pageCount = Math.max(1, Math.ceil(channels.length / per));
    var html = '';
    for (var p = 0; p < pageCount; p++) {
      html += '<div class="page" data-page="' + p + '">';
      for (var i = 0; i < per; i++) {
        var idx = p * per + i;
        var ch = channels[idx];
        var delay = 'style="animation-delay:' + (i * 0.035).toFixed(3) + 's"';
        if (ch) {
          html += '<button class="channel" data-idx="' + idx + '" tabindex="-1" aria-label="' + Banners.escapeHtml(ch.name) + '" ' + delay + '>' +
                    '<span class="screen">' + Banners.build(ch) + '<span class="shine"></span></span>' +
                    '<span class="label">' + Banners.escapeHtml(ch.name) + '</span>' +
                  '</button>';
        } else {
          html += '<div class="channel empty" ' + delay + '><span class="screen"></span></div>';
        }
      }
      html += '</div>';
    }
    $('pages').innerHTML = html;
    page = Math.min(page, pageCount - 1);
    setPage(page, true);
  }

  function setPage(p, instant) {
    page = p;
    var pagesEl = $('pages');
    if (instant) pagesEl.style.transition = 'none';
    pagesEl.style.transform = 'translateX(' + (-1920 * p) + 'px)';
    if (instant) { pagesEl.offsetWidth; pagesEl.style.transition = ''; }

    // only the visible page's tiles are navigable
    var tiles = pagesEl.querySelectorAll('.channel[data-idx]');
    for (var i = 0; i < tiles.length; i++) {
      var onPage = tiles[i].parentNode.getAttribute('data-page') === String(p);
      tiles[i].classList.toggle('nav-item', onPage);
    }
    $('arrowLeft').classList.toggle('show', p > 0);
    $('arrowRight').classList.toggle('show', p < pageCount - 1);
  }

  /* ---------- Cursor ---------- */
  function placeCursor() {
    var cur = $('cursor');
    var el = Nav.current();
    if (!settings.cursor || !el || state === 'boot' || state === 'hdmi') { cur.classList.add('hide'); return; }
    var s = parseFloat(stage.dataset.scale || '1');
    var sr = stage.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var x = (r.left - sr.left) / s + (r.width / s) * 0.62;
    var y = (r.top - sr.top) / s + (r.height / s) * 0.52;
    cur.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    cur.classList.remove('hide');
  }

  Nav.onFocus(function (el, silent) {
    if (!silent) WiiSound.hover();
    placeCursor();
  });

  /* ---------- Scopes per state ---------- */
  function scope() {
    if (state === 'preview') return $('preview');
    if (state === 'options') return $('options');
    if (state === 'board') return $('board');
    return $('menu');
  }

  /* ---------- Boot ---------- */
  function finishBoot() {
    if (state !== 'boot') return;
    state = 'menu';
    WiiSound.unlock();
    WiiSound.boot();
    $('boot').classList.add('out');
    setTimeout(function () { $('boot').hidden = true; }, 650);
    var first = $('pages').querySelector('.channel.nav-item');
    Nav.focus(first, true);
  }

  /* ---------- Preview ---------- */
  function openPreview(idx) {
    activeChannel = channels[idx];
    if (!activeChannel) return;
    lastMenuFocus = Nav.current();
    WiiSound.select();
    $('menu').classList.add('zoomed');
    $('previewBanner').innerHTML = Banners.build(activeChannel);
    var pv = $('preview');
    pv.classList.remove('out');
    pv.hidden = false;
    state = 'preview';
    Nav.focus($('btnStart'), true);
  }

  function closePreview(silent) {
    if (state !== 'preview' && state !== 'launching') return;
    if (!silent) WiiSound.back();
    var pv = $('preview');
    pv.classList.add('out');
    $('menu').classList.remove('zoomed');
    state = 'menu';
    setTimeout(function () { pv.hidden = true; pv.classList.remove('out'); $('previewBanner').innerHTML = ''; }, 340);
    if (lastMenuFocus) Nav.focus(lastMenuFocus, true);
  }

  function startChannel() {
    var ch = activeChannel;
    if (!ch) return;
    WiiSound.start();

    if (ch.type === 'app') {
      toast('Starting ' + ch.name + '…');
      state = 'launching';
      TV.launchApp(ch, function () {
        // when we come back from the app, return to the menu
        if (!TV.isTizen) setTimeout(function () { closePreview(true); }, 900);
      }, function (err) {
        state = 'preview';
        WiiSound.error();
        toast('Couldn\'t start ' + ch.name + (err ? ' (' + err + ')' : ''), 4000);
      });
    } else if (ch.type === 'hdmi') {
      TV.showHdmi(ch.number, function () {
        closePreview(true);
        state = 'hdmi';
        document.body.classList.add('hdmi-mode');
        var hint = $('hdmiHint'); hint.hidden = false;
        hint.style.animation = 'none'; hint.offsetWidth; hint.style.animation = '';
        placeCursor();
        if (!TV.isTizen) toast('[preview] HDMI ' + ch.number + ' would show here');
      }, function (err) {
        WiiSound.error();
        toast('HDMI ' + ch.number + ' unavailable' + (err ? ' (' + err + ')' : ''), 4000);
      });
    } else if (ch.type === 'settings') {
      TV.openSettings(function () { closePreview(true); }, function () {
        WiiSound.error();
        toast('Press the ⚙ Menu button on your remote to open Settings', 4500);
      });
    }
  }

  function exitHdmi() {
    TV.hideHdmi();
    document.body.classList.remove('hdmi-mode');
    $('hdmiHint').hidden = true;
    state = 'menu';
    WiiSound.back();
    if (lastMenuFocus) Nav.focus(lastMenuFocus, true);
    placeCursor();
  }

  /* ---------- Panels ---------- */
  function renderOptions() {
    var labels = {
      sound: settings.sound ? 'On' : 'Off',
      clock24: settings.clock24 ? '24-hour' : '12-hour',
      boot: settings.boot ? 'On' : 'Off',
      cursor: settings.cursor ? 'On' : 'Off'
    };
    var vals = document.querySelectorAll('[data-val]');
    for (var i = 0; i < vals.length; i++) vals[i].textContent = labels[vals[i].getAttribute('data-val')];
  }

  function renderBoard() {
    var apps = channels.filter(function (c) { return c.type === 'app'; }).length;
    var hdmi = channels.filter(function (c) { return c.type === 'hdmi'; });
    var live = hdmi.filter(function (c) { return c.connected; }).map(function (c) { return 'HDMI ' + c.number; });
    var notes = [
      ['✉', 'Welcome to <b>' + Banners.escapeHtml(WII_CONFIG.ownerName) + '\'s Wii Menu</b>! ' + apps + ' channels are ready, plus ' + hdmi.length + ' HDMI input' + (hdmi.length === 1 ? '' : 's') + (live.length ? ' (' + live.join(', ') + ' has a signal).' : '.')],
      ['↻', 'To open the Wii Menu when the TV turns on: <b>Settings → General → Smart Features</b> → turn <b>Autorun Smart Hub</b> off and <b>Autorun Last App</b> on. Then leave the Wii Menu open before powering off.'],
      ['◎', 'Use the arrows to move, <b>OK</b> to select, <b>Back</b> to return. Press <b>Back</b> while watching an HDMI channel to come home.']
    ];
    $('boardNotes').innerHTML = notes.map(function (n) {
      return '<div class="note"><span class="note-icon">' + n[0] + '</span><span>' + n[1] + '</span></div>';
    }).join('');
  }

  function openPanel(id) {
    lastMenuFocus = Nav.current();
    WiiSound.select();
    if (id === 'options') renderOptions();
    if (id === 'board') {
      renderBoard();
      try { localStorage.setItem('wiiBoardSeen', new Date().toDateString()); } catch (e) {}
      $('mailDot').classList.add('off');
    }
    $(id).hidden = false;
    state = id;
    Nav.first($(id));
  }

  function closePanel() {
    WiiSound.back();
    $('options').hidden = true;
    $('board').hidden = true;
    state = 'menu';
    if (lastMenuFocus) Nav.focus(lastMenuFocus, true);
  }

  function toggleOption(opt) {
    if (opt === 'rescan') {
      WiiSound.select();
      toast('Rescanning apps & inputs…');
      TV.loadApps(function () { resolveChannels(function (l) { channels = l; renderGrid(); toast('Found ' + channels.length + ' channels'); }); }, true);
      return;
    }
    settings[opt] = !settings[opt];
    saveSettings();
    WiiSound.setEnabled(settings.sound);
    WiiSound.select();
    renderOptions();
    tick();
    placeCursor();
  }

  /* ---------- Activate (OK) ---------- */
  function activate(el) {
    if (!el) return;
    if (el.classList.contains('channel')) { openPreview(+el.getAttribute('data-idx')); return; }
    var action = el.getAttribute('data-action');
    var opt = el.getAttribute('data-opt');
    if (opt) { toggleOption(opt); return; }
    if (action === 'start') startChannel();
    else if (action === 'back') closePreview();
    else if (action === 'options') openPanel('options');
    else if (action === 'board') openPanel('board');
    else if (action === 'close') closePanel();
  }

  /* ---------- Back ---------- */
  function goBack() {
    if (state === 'preview' || state === 'launching') closePreview();
    else if (state === 'options' || state === 'board') closePanel();
    else if (state === 'hdmi') exitHdmi();
    else if (state === 'menu') {
      // This is home – don't exit. Hop focus back to the first channel instead.
      var first = $('pages').querySelector('.channel.nav-item');
      if (first && Nav.current() !== first) Nav.focus(first);
    }
  }

  /* ---------- Keys ---------- */
  function move(dir) {
    if (state === 'hdmi' || state === 'launching') return;
    var moved = Nav.move(scope(), dir);
    if (moved || state !== 'menu') return;
    // grid edge → page turn
    var cur = Nav.current();
    if (!cur || !cur.classList.contains('channel')) return;
    if (dir === 'right' && page < pageCount - 1) { WiiSound.page(); setPage(page + 1); focusPageEdge('left'); }
    else if (dir === 'left' && page > 0) { WiiSound.page(); setPage(page - 1); focusPageEdge('right'); }
  }

  function focusPageEdge(side) {
    var tiles = $('pages').querySelectorAll('.page[data-page="' + page + '"] .channel.nav-item');
    if (!tiles.length) return;
    var el = side === 'left' ? tiles[0] : tiles[Math.min(3, tiles.length - 1)];
    setTimeout(function () { Nav.focus(el); }, 30);
  }

  document.addEventListener('keydown', function (e) {
    var K = TV.KEYS;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (state === 'boot') { e.preventDefault(); finishBoot(); return; }
    switch (e.keyCode) {
      case K.LEFT:  e.preventDefault(); move('left'); break;
      case K.RIGHT: e.preventDefault(); move('right'); break;
      case K.UP:    e.preventDefault(); move('up'); break;
      case K.DOWN:  e.preventDefault(); move('down'); break;
      case K.ENTER: e.preventDefault(); if (state === 'hdmi') return; activate(Nav.current()); break;
      case K.BACK: case K.ESC: case K.BACKSPACE:
        e.preventDefault(); goBack(); break;
      case 406: /* blue  */ if (state === 'menu') openPanel('board'); break;
      case 403: /* red   */ if (state === 'menu') openPanel('options'); break;
    }
  });

  /* ---------- Mouse (browser preview / pointer remotes) ---------- */
  stage.addEventListener('mouseover', function (e) {
    var el = e.target.closest('.nav-item');
    if (el && el !== Nav.current() && state !== 'boot') Nav.focus(el);
  });
  stage.addEventListener('click', function (e) {
    if (state === 'boot') { finishBoot(); return; }
    var el = e.target.closest('.nav-item');
    if (el) { Nav.focus(el, true); activate(el); return; }
    var arrow = e.target.closest('.page-arrow');
    if (arrow) move(arrow.id === 'arrowRight' ? 'right' : 'left');
  });

  /* ---------- Returning from another app ---------- */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      tick();
      if (state === 'launching' || state === 'preview') closePreview(true);
    }
  });

  /* ---------- Init ---------- */
  function init() {
    WiiSound.setEnabled(settings.sound);
    TV.registerKeys();
    $('bootName').textContent = WII_CONFIG.ownerName.toUpperCase();
    try { if (localStorage.getItem('wiiBoardSeen') === new Date().toDateString()) $('mailDot').classList.add('off'); } catch (e) {}

    fitStage();
    window.addEventListener('resize', fitStage);
    tick();
    setInterval(tick, 1000);

    TV.loadApps(function () {
      resolveChannels(function (list) {
        channels = list;
        renderGrid();
        if (!settings.boot) { $('boot').hidden = true; state = 'boot'; finishBoot(); }
      });
    });
  }

  init();
})();
