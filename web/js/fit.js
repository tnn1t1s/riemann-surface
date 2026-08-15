// Fits an element's text to its box by adjusting font size.
var fit = (function() {
  var text = function(el, opts) {
    opts = opts || {};
    var min = opts.min || 6;
    var max = opts.max || 1000;

    if (! el || ! el.isConnected) {
      return;
    }

    var fits = function(size) {
      el.style.fontSize = size + 'px';
      return el.scrollWidth <= el.clientWidth &&
             el.scrollHeight <= el.clientHeight;
    };

    // Largest size in [min, max] that fits.
    var lo = min;
    var hi = max;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = lo + 'px';
  };

  return { text: text };
})();
