(function() {
    var fitopts = {min: 6, max: 400};

    var Title = function(json) {
      view.View.call(this, json);
      this.title = json.title;
      this.clickFocusable = true;
      this.el.classList.add("title");
      this.h2 = util.el('h2', null, this.title);
      this.el.appendChild(this.h2);
      this.reflow();
    };

    view.inherit(view.View, Title);
    view.Title = Title;
    view.types.Title = Title;

    Title.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Title',
        title: this.title
      });
    };

    Title.prototype.editForm = function() {
      return '<label for="title">Title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" />';
    };

    Title.prototype.reflow = function() {
      fit.text(this.h2, fitopts);
    };
})();
