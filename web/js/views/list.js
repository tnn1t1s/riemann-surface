(function() {
    var List = function(json) {
      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.el.classList.add('list');
      this.el.appendChild(util.el('h2', 'quickfit', this.title || ''));
      this.ul = util.el('ul');
      this.el.appendChild(this.ul);

      this.events = {};

      if (this.query) {
        var me = this;
        this.sub = subs.subscribe(this.query, function(e) {
          me.update.call(me, e);
        });
      }
    };

    view.inherit(view.View, List);
    view.List = List;
    view.types.List = List;

    List.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'List',
        title: this.title,
        query: this.query
      });
    };

    List.prototype.editForm = function() {
      return "<label for='title'>Title</label>" +
        "<input type='text' name='title' value=\"" + util.esc(this.title) + "\" /><br />" +
        "<label for='query'>Query</label>" +
        '<textarea name="query" class="query">' + util.esc(this.query) + '</textarea>';
    };

    List.prototype.reflow = function() {
    };

    List.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };

    List.prototype.update = function(e) {
      var key = [e.host, e.service];
      if (e.state == "expired") {
        delete this.events[key];
      } else {
        this.events[key] = e;
      }
      this.ul.textContent = '';
      for (var row in this.events) {
        var ev = this.events[row];
        var li = util.el('li', 'state ' + ev.state, ev.host + " " + ev.service);
        li.title = ev.description || '';
        this.ul.appendChild(li);
      }
    };
})();
