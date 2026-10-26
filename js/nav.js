/* =========================================================
   Spatial navigation (D-pad).
   Edge-based direction filter, perpendicular-overlap
   preference, then weighted fallback — computed from live
   geometry on every keypress. Roving tabindex + `.focused`.
   ========================================================= */
var Nav = (function () {
  var current = null;
  var TOL = 2;     // px tolerance for sub-pixel rounding
  var W = 3;       // perpendicular weight for fallback scoring
  var onFocusCb = null;

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.closest('[hidden]')) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function candidates(scope) {
    var list = scope.querySelectorAll('.nav-item');
    var out = [];
    for (var i = 0; i < list.length; i++) if (isVisible(list[i])) out.push(list[i]);
    return out;
  }

  function focus(el, silent) {
    if (!el) return;
    if (current && current !== el) {
      current.classList.remove('focused');
      current.setAttribute('tabindex', '-1');
    }
    current = el;
    el.classList.add('focused');
    el.setAttribute('tabindex', '0');
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (onFocusCb) onFocusCb(el, silent);
  }

  function find(scope, dir) {
    if (!current) return null;
    var c = current.getBoundingClientRect();
    var horizontal = dir === 'left' || dir === 'right';
    var best = null, bestGap = Infinity, bestOff = Infinity;
    var fb = null, fbScore = Infinity;
    var cands = candidates(scope);

    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (el === current) continue;
      var r = el.getBoundingClientRect();
      var gap;
      if (dir === 'right') { if (r.left < c.right - TOL) continue; gap = r.left - c.right; }
      else if (dir === 'left') { if (r.right > c.left + TOL) continue; gap = c.left - r.right; }
      else if (dir === 'down') { if (r.top < c.bottom - TOL) continue; gap = r.top - c.bottom; }
      else { if (r.bottom > c.top + TOL) continue; gap = c.top - r.bottom; }
      gap = Math.max(0, gap);

      var overlap, off;
      if (horizontal) {
        overlap = r.top < c.bottom && r.bottom > c.top;
        off = Math.abs((r.top + r.height / 2) - (c.top + c.height / 2));
      } else {
        overlap = r.left < c.right && r.right > c.left;
        off = Math.abs((r.left + r.width / 2) - (c.left + c.width / 2));
      }

      if (overlap) {
        if (gap < bestGap || (gap === bestGap && off < bestOff)) { best = el; bestGap = gap; bestOff = off; }
      } else {
        var score = gap + W * off;
        if (score < fbScore) { fb = el; fbScore = score; }
      }
    }
    return best || fb;
  }

  return {
    focus: focus,
    current: function () { return current; },
    move: function (scope, dir) {
      var next = find(scope, dir);
      if (next) { focus(next); return true; }
      return false;
    },
    first: function (scope) {
      var c = candidates(scope);
      if (c.length) focus(c[0], true);
    },
    onFocus: function (cb) { onFocusCb = cb; }
  };
})();
