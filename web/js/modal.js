// Modal dialogs. Keybindings are suspended while a modal is open.
var modal = (function() {
  var overlay = null;
  var onClose = null;

  var close = function() {
    if (! overlay) {
      return;
    }
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', escListener, true);
    keys.enable();
    if (onClose) {
      var f = onClose;
      onClose = null;
      f();
    }
  };

  var escListener = function(ev) {
    if (ev.keyCode === 27) {
      ev.stopPropagation();
      close();
    }
  };

  // Show content (a DOM element) in a modal dialog.
  var open = function(content, opts) {
    opts = opts || {};
    close();
    keys.disable();
    onClose = opts.onClose || null;

    overlay = util.el('div', 'modal-overlay');
    var box = util.el('div', 'modal-container');
    var closeButton = util.el('a', 'modal-close', '×');
    closeButton.addEventListener('click', close);
    box.appendChild(closeButton);
    box.appendChild(content);
    overlay.appendChild(box);
    overlay.addEventListener('click', function(ev) {
      if (ev.target === overlay) {
        close();
      }
    });
    document.addEventListener('keydown', escListener, true);
    document.body.appendChild(overlay);
  };

  return {
    open: open,
    close: close,
    isOpen: function() { return overlay !== null; }
  };
})();
