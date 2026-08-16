// Plane: an x-y plot of the complex plane (or any phase plane). Each
// event contributes a point read from two configurable fields; points
// accumulate into a fading trail per host/service, with the current
// point drawn as a dot colored by event state.
(function() {
    var stateColors = {
      ok:       "#06FA23",
      okay:     "#06FA23",
      warning:  "#FFC712",
      warn:     "#FFC712",
      critical: "#FF6513",
      failure:  "#FF6513",
      err:      "#FF6513"
    };

    var Plane = function(json) {
      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.xField = json.xField || 'x';
      this.yField = json.yField || 'y';
      this.trail = parseInt(json.trail) || 150;
      this.range = parseFloat(json.range) || 1.5;
      this.clickFocusable = true;

      // Set up HTML
      if (this.title) {
        this.el.classList.add('plane');
        this.el.appendChild(util.el('h2', null, this.title));
        this.container = util.el('div', 'container');
        this.el.appendChild(this.container);
      } else {
        this.container = this.el;
      }
      this.canvas = util.el('canvas');
      this.container.appendChild(this.canvas);

      // trails: eventKey -> [{x, y, state}]
      this.trails = new Map();
      this.currentEvent = null;

      this.redraw = util.slur(100, Plane.prototype.draw);

      var self = this;
      this.canvas.addEventListener('click', function() {
        eventPane.show(self.currentEvent);
      });

      if (this.query && !json.virtual) {
        this.reflow();
        this.sub = subs.subscribe(this.query, function(e) {
          self.update(e);
        });
      }
    };

    view.inherit(view.View, Plane);
    view.Plane = Plane;
    view.types.Plane = Plane;

    Plane.prototype.update = function(e) {
      var key = util.eventKey(e);

      if (e.state === "expired") {
        this.trails.delete(key);
        this.redraw();
        return;
      }

      var x = parseFloat(e[this.xField]);
      var y = parseFloat(e[this.yField]);
      if (isNaN(x) || isNaN(y)) {
        return;
      }

      var trail = this.trails.get(key);
      if (! trail) {
        trail = [];
        this.trails.set(key, trail);
      }
      trail.push({x: x, y: y, state: e.state});
      while (trail.length > this.trail) {
        trail.shift();
      }

      this.currentEvent = e;
      this.redraw();
    };

    Plane.prototype.draw = function() {
      if (! this.el || ! this.canvas.isConnected) {
        return;
      }
      var ratio = window.devicePixelRatio || 1;
      var w = this.canvas.width / ratio;
      var h = this.canvas.height / ratio;
      if (w === 0 || h === 0) {
        return;
      }

      var ctx = this.canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var cx = w / 2;
      var cy = h / 2;
      var scale = (Math.min(w, h) / 2 - 12) / this.range;
      if (scale <= 0) {
        return;
      }
      var sx = function(x) { return cx + x * scale; };
      var sy = function(y) { return cy - y * scale; };

      // Axes
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
      ctx.stroke();

      // Unit circle
      ctx.strokeStyle = '#ddd';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Unit marks
      ctx.fillStyle = '#999';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('+1', sx(1) + 3, cy + 3);
      ctx.fillText('+i', cx + 3, sy(1) + 3);

      // Trails and current points
      var self = this;
      this.trails.forEach(function(trail) {
        for (var i = 1; i < trail.length; i++) {
          ctx.globalAlpha = 0.15 + 0.85 * (i / trail.length);
          ctx.strokeStyle = stateColors[trail[i].state] || '#2C55FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx(trail[i - 1].x), sy(trail[i - 1].y));
          ctx.lineTo(sx(trail[i].x), sy(trail[i].y));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        var last = trail[trail.length - 1];
        if (last) {
          ctx.fillStyle = stateColors[last.state] || '#2C55FF';
          ctx.beginPath();
          ctx.arc(sx(last.x), sy(last.y), 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Current-value readout
      if (this.currentEvent) {
        ctx.fillStyle = '#444';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        var cur = this.currentEvent;
        ctx.fillText(
          this.xField + ' = ' + format.float(parseFloat(cur[this.xField]), 3) +
          '   ' +
          this.yField + ' = ' + format.float(parseFloat(cur[this.yField]), 3),
          8, 6);
      }
    };

    Plane.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Plane',
        title: this.title,
        query: this.query,
        xField: this.xField,
        yField: this.yField,
        trail: this.trail,
        range: this.range
      });
    };

    Plane.prototype.editForm = function() {
      return '<label for="title">Title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="query">Query</label>' +
        '<textarea class="query" name="query">' + util.esc(this.query) + '</textarea><br />' +
        '<label for="xField">X field</label>' +
        '<input type="text" name="xField" value="' + util.esc(this.xField) + '" /><br />' +
        '<label for="yField">Y field</label>' +
        '<input type="text" name="yField" value="' + util.esc(this.yField) + '" /><br />' +
        '<label for="trail">Trail length (points)</label>' +
        '<input type="text" name="trail" value="' + util.esc(this.trail) + '" /><br />' +
        '<label for="range">Axis range (±)</label>' +
        '<input type="text" name="range" value="' + util.esc(this.range) + '" />';
    };

    Plane.prototype.reflow = function() {
      var w = this.container.clientWidth;
      var h = this.container.clientHeight;
      var ratio = window.devicePixelRatio || 1;
      this.canvas.width = w * ratio;
      this.canvas.height = h * ratio;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.draw();
    };

    Plane.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
