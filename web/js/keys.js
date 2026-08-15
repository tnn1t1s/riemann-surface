var keys = (function() {
  var active = true;

  var bindings = {};

  // Disable bindings.
  var disable = function() {
    active = false;
  };

  // Enable bindings.
  var enable = function() {
    active = true;
  };

  // Bind a key by keyCode.
  var bind = function(code, fn) {
    if (bindings[code] === undefined) {
      bindings[code] = [];
    }
    bindings[code].push(fn);
  };

  // React to key presses.
  document.addEventListener('keydown', function(ev) {
    if (active === false) {
      return;
    }

    var fns = bindings[ev.keyCode];
    if (fns !== undefined) {
      fns.forEach(function(fn) { fn(ev); });
    }
  });

  return {
    active: function() { return active; },
    bindings: function() { return bindings; },
    bind: bind,
    enable: enable,
    disable: disable
  };
})();
