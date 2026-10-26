/* =========================================================
   Channel banners – returns HTML for each channel's animated
   "screen". Authored at tile size (≈384x196) and scaled up
   for the preview screen.
   ========================================================= */
var Banners = (function () {
  var GEAR = '<svg class="gear" viewBox="0 0 100 100"><path d="M43 4h14l2 12a36 36 0 0 1 9 4l10-7 10 10-7 10a36 36 0 0 1 4 9l12 2v14l-12 2a36 36 0 0 1-4 9l7 10-10 10-10-7a36 36 0 0 1-9 4l-2 12H43l-2-12a36 36 0 0 1-9-4l-10 7-10-10 7-10a36 36 0 0 1-4-9L3 57V43l12-2a36 36 0 0 1 4-9l-7-10 10-10 10 7a36 36 0 0 1 9-4zM50 34a16 16 0 1 0 0 32 16 16 0 0 0 0-32z"/></svg>';

  function stars(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<i style="transform: rotate(' + (i * (360 / n)) + 'deg)"></i>';
    return s;
  }

  var builders = {
    netflix: function () {
      return '<div class="banner b-netflix"><span class="ribbon"></span><span class="ribbon r2"></span><span class="ribbon r3"></span>' +
             '<span class="wm">NETFLIX</span></div>';
    },
    youtube: function () {
      return '<div class="banner b-youtube"><div class="yt"><span class="yt-play"></span><span class="wm">YouTube</span></div></div>';
    },
    prime: function () {
      return '<div class="banner b-prime"><span class="wm">prime video</span><span class="smile"></span></div>';
    },
    disney: function () {
      return '<div class="banner b-disney"><span class="arc"></span><span class="wm">Disney+</span></div>';
    },
    hulu: function () {
      return '<div class="banner b-hulu"><span class="glow"></span><span class="wm">hulu</span></div>';
    },
    peacock: function () {
      return '<div class="banner b-peacock"><span class="wm">peacock</span><span class="dots"><i></i><i></i><i></i><i></i><i></i><i></i></span></div>';
    },
    paramount: function () {
      return '<div class="banner b-paramount"><span class="stars">' + stars(14) + '</span><span class="mountain"></span><span class="wm">Paramount+</span></div>';
    },
    pbskids: function () {
      return '<div class="banner b-pbskids"><span class="pbs-circle"><span class="pbs-face"></span></span><span class="wm">PBS KIDS</span></div>';
    },
    hdmi: function (ch) {
      return '<div class="banner b-hdmi"><span class="scan"></span><span class="signal' + (ch.connected ? '' : ' off') + '"></span>' +
             '<span class="port"></span><span class="wm">HDMI ' + ch.number + '</span>' +
             '<span class="sub">' + escapeHtml(ch.subtitle || (ch.connected ? 'Connected' : 'No signal')) + '</span></div>';
    },
    settings: function () {
      return '<div class="banner b-settings">' + GEAR + '<span class="wm">TV Settings</span></div>';
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build(ch) {
    var key = ch.type === 'hdmi' ? 'hdmi' : ch.key;
    var fn = builders[key];
    return '<div class="banner-inner">' + (fn ? fn(ch) : '<div class="banner b-settings"><span class="wm">' + escapeHtml(ch.name || '') + '</span></div>') + '</div>';
  }

  return { build: build, escapeHtml: escapeHtml };
})();
