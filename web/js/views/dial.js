(function() {
    var fitopts = {min: 6, max: 1000};

    var Dial = function(json) {
      // Init
      view.View.call(this, json);
      this.clickFocusable = true;

      // Config
      this.query = json.query;
      this.title = json.title;
      this.commaSeparateThousands = json.commaSeparateThousands;
      this.max = json.max;

      // State
      this.currentEvent = null;
      this.currentValue = 0;
      this.shownValue = 0;

      // HTML
      this.el.classList.add('dial');
      this.el.appendChild(util.html(
        '<div class="box">' +
          '<canvas></canvas>' +
          '<div class="quickfit metric value">?</div>' +
          '<h2 class="quickfit"></h2>' +
          '</div>'
      ));

      this.box = this.el.querySelector('.box');
      this.canvas = this.el.querySelector('canvas');
      this.el.querySelector('h2').textContent = this.title || '';

      // When clicked, display event
      var self = this;
      this.box.addEventListener('click', function() {
        eventPane.show(self.currentEvent);
      });

      if (this.query && !json.virtual) {
        var reflowed = false;
        var me = this;
        var value = this.el.querySelector('.value');
        var max = me.max ? parseFloat(me.max) : null;
        this.dialMax = max;

        this.sub = subs.subscribe(this.query, function(e) {
          self.currentEvent = e;
          me.box.className = 'box state ' + e.state;

          if (e.metric) {
            if (!me.max && (self.dialMax === null || e.metric > self.dialMax)) {
              // Update maximum to highest value encountered so far
              self.dialMax = e.metric;
            }
            self.currentValue = e.metric;
            self.animate();
          }
          value.textContent =
            format.float(e.metric, 2, me.commaSeparateThousands) +
            "/" + format.float(self.dialMax, 2, me.commaSeparateThousands);
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

    view.inherit(view.View, Dial);
    view.Dial = Dial;
    view.types.Dial = Dial;

    // Ease the needle toward the current value.
    Dial.prototype.animate = function() {
      var self = this;
      if (this.animating) { return; }
      this.animating = true;
      var step = function() {
        if (! self.el) { return; }
        var delta = self.currentValue - self.shownValue;
        if (Math.abs(delta) < Math.abs(self.currentValue) * 0.001 + 1e-9) {
          self.shownValue = self.currentValue;
          self.drawDial();
          self.animating = false;
          return;
        }
        self.shownValue += delta * 0.2;
        self.drawDial();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // Draw a semicircular gauge.
    Dial.prototype.drawDial = function() {
      var canvas = this.canvas;
      if (! canvas || ! canvas.isConnected) { return; }
      var ratio = window.devicePixelRatio || 1;
      var w = canvas.width / ratio;
      var h = canvas.height / ratio;
      if (w === 0 || h === 0) { return; }

      var ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var cx = w / 2;
      var cy = h - 6;
      var r = Math.min(w / 2, h) - 8;
      if (r <= 0) { return; }

      // Track
      ctx.lineWidth = Math.max(4, r * 0.18);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.stroke();

      // Value arc
      var max = this.dialMax || 1;
      var fraction = Math.max(0, Math.min(1, this.shownValue / max));
      if (fraction > 0) {
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, Math.PI * (1 + fraction));
        ctx.stroke();
      }

      // Needle
      var angle = Math.PI * (1 + fraction);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c91515';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r * 0.85,
                 cy + Math.sin(angle) * r * 0.85);
      ctx.stroke();
    };

    Dial.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Dial',
        title: this.title,
        query: this.query,
        commaSeparateThousands: this.commaSeparateThousands,
        max: this.max
      });
    };

    Dial.prototype.editForm = function() {
      return "<label for='title'>Title</label>" +
        "<input type='text' name='title' value=\"" + util.esc(this.title) + "\" /><br />" +
        "<label for='query'>Query</label>" +
        '<textarea name="query" class="query">' + util.esc(this.query) + '</textarea>' +
        "<label for='commaSeparateThousands'>Comma Separate Thousands</label>" +
        "<input type='checkbox' name='commaSeparateThousands' " +
        (this.commaSeparateThousands ? "checked='checked'" : "") + " /><br />" +
        "<label for='max'>Maximum</label>" +
        "<input type='text' name='max' value=\"" + util.esc(this.max) + "\" /><br />";
    };

    Dial.prototype.reflow = function() {
      // Size metric
      fit.text(this.el.querySelector('.value'), {min: 6, max: 1000});

      // Size title
      fit.text(this.el.querySelector('h2'), fitopts);

      // Size canvas, force 1/2 aspect ratio
      var parent = this.canvas.parentNode;
      var height = Math.floor(parent.clientHeight - 10);
      var width = Math.floor(parent.clientWidth - 10);
      var h, w;
      if (width > (2 * height)) {
        h = height;
        w = 2 * height;
      } else {
        h = width / 2;
        w = width;
      }
      var ratio = window.devicePixelRatio || 1;
      this.canvas.width = w * ratio;
      this.canvas.height = h * ratio;
      this.canvas.style.height = h + 'px';
      this.canvas.style.width = w + 'px';
      this.canvas.style.marginTop = "-" + (h / 2) + "px";
      this.canvas.style.marginLeft = "-" + (w / 2) + "px";
      this.drawDial();
    };

    Dial.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
