var util = (function() {
  // Takes the value of x as a string, or if x is undefined/null, a special
  // marker string. Used because JS maps can't contain nil.
  var nullableKey = function(x) {
    return x || "\uffff";
  };

  var escapeDiv = document.createElement('div');

  return {
    nullableKey: nullableKey,

    // A string key uniquely identifying an event by host and service.
    eventKey: function(e) {
      return nullableKey(e.host) + "\ufffe" + nullableKey(e.service);
    },

    // Takes a string and returns a function that extracts a value from an
    // event. Strings starting with "fn " are compiled as a function body
    // taking a single argument `e`.
    extract_fn: function(str) {
      if (! str) {
        return str;
      }
      if (str.match(/^fn /)) {
        return Function.apply(null, ['e', str.substring(3)]);
      }
      return function(e) {
        return e[str];
      };
    },

    // Takes a string and returns either:
    // - a function which extracts a maximum value from an event.
    // - a number to be used as the constant maximum.
    max_fn: function(str) {
      if ((!str) || str === "all") {
        return function(e) { return "all"; };
      }
      if (isNaN(parseFloat(str))) {
        return function(e) { return e[str]; };
      }
      return parseFloat(str);
    },

    // Merge two maps nondestructively.
    merge: function(m1, m2) {
      return Object.assign({}, m1, m2);
    },

    // Wraps a function in another, which calls f at most once every period
    // milliseconds. Tries to minimize latency.
    slur: function(period, f) {
      var lastRun = 0;
      var queued = false;
      var execute = function(context, args) {
        var t1 = Date.now();
        f.apply(context, args);
        lastRun = Date.now();
        subs.load1(t1, lastRun);
        subs.load5(t1, lastRun);
        queued = false;
      };

      return function() {
        if (queued) {
          return;
        }
        var dt = Date.now() - lastRun;
        if (period <= dt) {
          execute(this, arguments);
        } else {
          queued = true;
          window.setTimeout(execute, period - dt, this, arguments);
        }
      };
    },

    // Unique-ish IDs as a length sized string of hex.
    uniqueId: function(length) {
      var id = '', hex = '0123456789abcdef';
      for (var i = 0; i < (length || 40); i++) {
        id += hex[Math.floor(Math.random() * 16)];
      }
      return id;
    },

    // Escape a value for interpolation into HTML.
    esc: function(s) {
      escapeDiv.textContent = (s === undefined || s === null) ? '' : String(s);
      return escapeDiv.innerHTML;
    },

    // Build a DOM element from an HTML string. Returns the first element.
    html: function(html) {
      var t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },

    // Build a DOM element with a tag, optional class, and optional text.
    el: function(tag, className, text) {
      var e = document.createElement(tag);
      if (className) { e.className = className; }
      if (text !== undefined) { e.textContent = text; }
      return e;
    }
  };
})();
