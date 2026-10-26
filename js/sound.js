/* =========================================================
   WiiSound – tiny Web Audio synth for menu blips.
   All sounds are generated on the fly (no audio files, no
   Nintendo assets): soft sine "ticks" and bell-like chimes.
   ========================================================= */
var WiiSound = (function () {
  var ctx = null;
  var master = null;
  var enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { enabled = false; return null; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One bell-ish voice: sine + quiet octave partial, fast attack, exp decay
  function bell(freq, start, dur, vol, type) {
    var c = ensure(); if (!c) return;
    var t = c.currentTime + (start || 0);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.6, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);

    var o1 = c.createOscillator();
    o1.type = type || 'sine';
    o1.frequency.setValueAtTime(freq, t);
    o1.connect(g);

    var g2 = c.createGain();
    g2.gain.value = 0.18;
    g2.connect(g);
    var o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * 2.01, t);
    o2.connect(g2);

    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  return {
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
    unlock: function () { ensure(); },

    // focus move: soft high tick
    hover: function () { bell(1568, 0, 0.09, 0.35); },
    // select: rising two-note chime
    select: function () { bell(988, 0, 0.22, 0.5); bell(1480, 0.07, 0.35, 0.45); },
    // back / close: falling two notes
    back: function () { bell(1175, 0, 0.16, 0.4); bell(784, 0.07, 0.25, 0.38); },
    // channel start: little sparkly arpeggio
    start: function () {
      var n = [784, 988, 1175, 1568, 1976];
      for (var i = 0; i < n.length; i++) bell(n[i], i * 0.055, 0.5, 0.36);
    },
    // page turn: whoosh-ish pair
    page: function () { bell(660, 0, 0.12, 0.3, 'triangle'); bell(990, 0.05, 0.18, 0.3, 'triangle'); },
    // boot: warm major chord bloom
    boot: function () {
      var n = [523, 659, 784, 1047];
      for (var i = 0; i < n.length; i++) bell(n[i], i * 0.09, 1.2, 0.3);
    },
    error: function () { bell(330, 0, 0.18, 0.4, 'triangle'); bell(262, 0.12, 0.3, 0.4, 'triangle'); }
  };
})();
