(function() {
    var fitopts = {min: 6, max: 1000};

    var Gauge = function(json) {
      // Init
      view.View.call(this, json);
      this.clickFocusable = true;

      // Config
      this.query = json.query;
      this.title = json.title;
      this.commaSeparateThousands = json.commaSeparateThousands;

      // State
      this.currentEvent = null;

      // HTML
      this.el.classList.add('gauge');
      this.el.appendChild(util.html(
        '<div class="box">' +
          '<div class="quickfit metric value">?</div>' +
          '<h2 class="quickfit"></h2>' +
          '</div>'
      ));

      this.box = this.el.querySelector('.box');
      this.el.querySelector('h2').textContent = this.title || '';

      // When clicked, display event
      var self = this;
      this.box.addEventListener('click', function() {
        eventPane.show(self.currentEvent);
      });

      if (this.query) {
        var reflowed = false;
        var me = this;
        var value = this.el.querySelector('.value');
        this.sub = subs.subscribe(this.query, function(e) {
          self.currentEvent = e;
          me.box.className = 'box state ' + e.state;
          if (e.metric != undefined) {
            value.textContent = format.float(e.metric, 2, me.commaSeparateThousands);
          } else if (e.state != undefined) {
            value.textContent = e.state;
          }
          value.title = e.description || '';

          // The first time, do a full-height reflow.
          if (reflowed) {
            fit.text(value, fitopts);
          } else {
            me.reflow();
            reflowed = true;
          }
        });
      }
    };

    view.inherit(view.View, Gauge);
    view.Gauge = Gauge;
    view.types.Gauge = Gauge;

    Gauge.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Gauge',
        title: this.title,
        query: this.query,
        commaSeparateThousands: this.commaSeparateThousands
      });
    };

    Gauge.prototype.editForm = function() {
      return "<label for='title'>Title</label>" +
        "<input type='text' name='title' value=\"" + util.esc(this.title) + "\" /><br />" +
        "<label for='query'>Query</label>" +
        '<textarea name="query" class="query">' + util.esc(this.query) + '</textarea>' +
        "<label for='commaSeparateThousands'>Comma Separate Thousands</label>" +
        "<input type='checkbox' name='commaSeparateThousands' " +
        (this.commaSeparateThousands ? "checked='checked'" : "") + " />";
    };

    Gauge.prototype.reflow = function() {
      // Size metric
      fit.text(this.el.querySelector('.value'), {min: 6, max: 1000});

      // Size title
      fit.text(this.el.querySelector('h2'), fitopts);
    };

    Gauge.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
