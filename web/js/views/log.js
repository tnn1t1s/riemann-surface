(function() {
    // Reify a log view from JSON
    var LogView = function(json) {
      // Extract state from JSON
      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.lines = json.lines || 1000;

      var self = this;

      // Set up HTML
      this.el.classList.add('log');
      this.el.appendChild(util.el('h2', null, this.title || ''));
      this.el.appendChild(util.html(
        '<div class="scroll"><table><thead><tr>' +
        '<th>host</th>' +
        '<th>service</th>' +
        '<th>state</th>' +
        '<th>metric</th>' +
        '<th>description</th>' +
        '</tr></thead><tbody></tbody></table></div>'));
      this.scroll = this.el.querySelector('.scroll');
      this.log = this.el.querySelector('tbody');

      // Are we currently following the bottom of the log?
      this.tracking = true;

      // When scrolling occurs, toggle tracking state.
      this.scroll.addEventListener('scroll', function() {
        self.tracking = self.atBottom();
      });

      // This view can be clicked to focus on it.
      this.clickFocusable = true;

      if (this.query) {
        // Subscribe to our query
        this.sub = subs.subscribe(
            this.query,
            function(e) {
              self.update(e);
            }
        );
      }
    };

    // Set up our LogView class and register it with the view system
    view.inherit(view.View, LogView);
    view.Log = LogView;
    view.types.Log = LogView;

    // Scroll to bottom of log.
    LogView.prototype.scrollToBottom = function() {
      this.scroll.scrollTo({
        top: this.scroll.scrollHeight,
        behavior: 'smooth'
      });
    };

    // Are we at the bottom of the log?
    LogView.prototype.atBottom = function() {
      return (this.scroll.scrollTop + this.scroll.clientHeight >=
              this.scroll.scrollHeight - 20);
    };

    // Accept events from a subscription and update the log.
    LogView.prototype.update = function(event) {
      var tr = util.el('tr');
      ['host', 'service', 'state', 'metric', 'description'].forEach(function(field) {
        tr.appendChild(util.el('td', null,
          event[field] === undefined ? '' : String(event[field])));
      });
      this.log.appendChild(tr);
      while (this.log.children.length > this.lines) {
        this.log.deleteRow(0);
      }
      if (this.tracking) { this.scrollToBottom(); }
    };

    // Serialize current state to JSON
    LogView.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Log',
        title: this.title,
        query: this.query,
        lines: this.lines
      });
    };

    // Returns the edit form
    LogView.prototype.editForm = function() {
      return '<label for="title">title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="query">query</label>' +
        '<textarea class="query" name="query">' + util.esc(this.query) + '</textarea><br />' +
        '<label for="lines">Maximum lines (number of events)</label>' +
        '<input type="text" name="lines" value="' + util.esc(this.lines) + '" />';
    };

    // Called when our parent needs to resize us
    LogView.prototype.reflow = function() {
    };

    // When the view is deleted, remove our subscription
    LogView.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
