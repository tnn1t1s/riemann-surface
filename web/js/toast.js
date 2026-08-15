// Corner notifications.
var toast = (function() {
  var container = null;

  var ensureContainer = function() {
    if (! container) {
      container = util.el('div', 'toast-container');
      document.body.appendChild(container);
    }
    return container;
  };

  var show = function(level, message) {
    var el = util.el('div', 'toast ' + level, message);
    ensureContainer().appendChild(el);
    el.addEventListener('click', function() { el.remove(); });
    setTimeout(function() {
      el.classList.add('fade');
      setTimeout(function() { el.remove(); }, 500);
    }, 4000);
  };

  return {
    info:    function(m) { show('info', m); },
    warning: function(m) { show('warning', m); },
    error:   function(m) { show('error', m); }
  };
})();
