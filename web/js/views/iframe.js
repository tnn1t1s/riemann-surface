(function() {
    var iframe = function(json) {
      view.View.call(this, json);
      this.title = json.title;
      this.url = json.url;
      this.clickFocusable = true;
      this.el.classList.add("iframe");
      this.h2 = util.el('h2', null, this.title || '');
      this.el.appendChild(this.h2);
      this.frame = util.el('iframe', 'container quickfit');
      if (this.url) {
        this.frame.src = this.url;
      }
      this.el.appendChild(this.frame);
      this.reflow();
    };

    view.inherit(view.View, iframe);
    view.iframe = iframe;
    view.types.iframe = iframe;

    iframe.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'iframe',
        title: this.title,
        url: this.url
      });
    };

    iframe.prototype.editForm = function() {
      return '<label for="title">Title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="url">URL</label>' +
        '<input type="text" name="url" value="' + util.esc(this.url) + '" />';
    };

    iframe.prototype.reflow = function() {
      this.frame.style.height =
        (this.el.clientHeight - this.h2.offsetHeight) + 'px';
      this.frame.style.width = this.width() + 'px';
    };
})();
