// Surface: a 3D trail plot on a slowly orbiting camera. Each event
// contributes a point (x, y, height) read from three configurable
// fields, drawn as a fading trail colored by event state — so a stream
// can trace out a surface over time. An optional faint reference
// wireframe draws the two sheets of w = sqrt(z) (height = Re w over
// the z-plane), the picture this view exists to demonstrate.
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

    var reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var Surface = function(json) {
      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.xField = json.xField || 'z-real';
      this.yField = json.yField || 'z-imag';
      this.hField = json.hField || 'w-real';
      this.trail = parseInt(json.trail) || 400;
      this.range = parseFloat(json.range) || 1.4;
      this.wireframe = (json.wireframe === undefined) ? true : !!json.wireframe;
      this.spin = (json.spin === undefined) ? true : !!json.spin;
      this.clickFocusable = true;

      // Camera
      this.azimuth = 0.7;
      this.elevation = 0.45; // radians above the plane

      // Set up HTML
      if (this.title) {
        this.el.classList.add('surface');
        this.el.appendChild(util.el('h2', null, this.title));
        this.container = util.el('div', 'container');
        this.el.appendChild(this.container);
      } else {
        this.container = this.el;
      }
      this.canvas = util.el('canvas');
      this.container.appendChild(this.canvas);

      // trails: eventKey -> [{x, y, h, state}]
      this.trails = new Map();
      this.currentEvent = null;

      var self = this;
      this.canvas.addEventListener('click', function() {
        eventPane.show(self.currentEvent);
      });

      if (!json.virtual) {
        this.reflow();

        if (this.spin && !reducedMotion) {
          this.spinTimer = setInterval(function() {
            self.azimuth += 0.006;
            self.draw();
          }, 50);
        }

        if (this.query) {
          this.sub = subs.subscribe(this.query, function(e) {
            self.update(e);
          });
        }
      }
    };

    view.inherit(view.View, Surface);
    view.Surface = Surface;
    view.types.Surface = Surface;

    Surface.prototype.update = function(e) {
      var key = util.eventKey(e);

      if (e.state === "expired") {
        this.trails.delete(key);
        return;
      }

      var x = parseFloat(e[this.xField]);
      var y = parseFloat(e[this.yField]);
      var h = parseFloat(e[this.hField]);
      if (isNaN(x) || isNaN(y) || isNaN(h)) {
        return;
      }

      var trail = this.trails.get(key);
      if (! trail) {
        trail = [];
        this.trails.set(key, trail);
      }
      trail.push({x: x, y: y, h: h, state: e.state});
      while (trail.length > this.trail) {
        trail.shift();
      }

      this.currentEvent = e;
      if (! this.spinTimer) {
        this.draw();
      }
    };

    // Orthographic projection of a world point under the orbiting camera.
    Surface.prototype.project = function(x, y, h, geom) {
      var u = x * geom.cosA + y * geom.sinA;
      var v = -x * geom.sinA + y * geom.cosA;
      return [
        geom.cx + u * geom.scale,
        geom.cy - (h * geom.cosE - v * geom.sinE) * geom.scale
      ];
    };

    Surface.prototype.draw = function() {
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

      var geom = {
        cx: w / 2,
        cy: h / 2,
        scale: Math.min(w, h) / (2 * this.range) * 0.75,
        cosA: Math.cos(this.azimuth),
        sinA: Math.sin(this.azimuth),
        cosE: Math.cos(this.elevation),
        sinE: Math.sin(this.elevation)
      };
      var self = this;

      var polyline = function(points) {
        ctx.beginPath();
        points.forEach(function(p, i) {
          var s = self.project(p[0], p[1], p[2], geom);
          if (i === 0) { ctx.moveTo(s[0], s[1]); } else { ctx.lineTo(s[0], s[1]); }
        });
        ctx.stroke();
      };

      // Reference wireframe: both sheets of w = sqrt(z) as one surface,
      // parametrized by z = r e^{i phi}, phi in [0, 4pi],
      // height = sqrt(r) cos(phi/2).
      if (this.wireframe) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        var rings = [0.25, 0.5, 0.75, 1.0];
        rings.forEach(function(r) {
          var pts = [];
          for (var phi = 0; phi <= 4 * Math.PI + 0.001; phi += Math.PI / 40) {
            pts.push([r * Math.cos(phi), r * Math.sin(phi),
                      Math.sqrt(r) * Math.cos(phi / 2)]);
          }
          polyline(pts);
        });

        for (var k = 0; k < 8; k++) {
          var phi = k * Math.PI / 2; // covers both sheets over [0, 4pi)
          var pts = [];
          for (var r = 0; r <= 1.0001; r += 0.1) {
            pts.push([r * Math.cos(phi), r * Math.sin(phi),
                      Math.sqrt(r) * Math.cos(phi / 2)]);
          }
          polyline(pts);
        }
      }

      // Axes: the z-plane's real and imaginary directions, and height.
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      polyline([[-this.range, 0, 0], [this.range, 0, 0]]);
      polyline([[0, -this.range, 0], [0, this.range, 0]]);
      polyline([[0, 0, -1.1], [0, 0, 1.1]]);
      ctx.fillStyle = '#999';
      ctx.font = '10px sans-serif';
      var label = function(x, y, hh, text) {
        var s = self.project(x, y, hh, geom);
        ctx.fillText(text, s[0] + 3, s[1] - 3);
      };
      label(this.range, 0, 0, 'Re z');
      label(0, this.range, 0, 'Im z');
      label(0, 0, 1.1, 'Re w');

      // Stream trails
      this.trails.forEach(function(trail) {
        for (var i = 1; i < trail.length; i++) {
          ctx.globalAlpha = 0.15 + 0.85 * (i / trail.length);
          ctx.strokeStyle = stateColors[trail[i].state] || '#2C55FF';
          ctx.lineWidth = 2.5;
          var a = self.project(trail[i - 1].x, trail[i - 1].y, trail[i - 1].h, geom);
          var b = self.project(trail[i].x, trail[i].y, trail[i].h, geom);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        var last = trail[trail.length - 1];
        if (last) {
          // Drop line to the z-plane, then the current point.
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          polyline([[last.x, last.y, 0], [last.x, last.y, last.h]]);
          ctx.setLineDash([]);

          var s = self.project(last.x, last.y, last.h, geom);
          ctx.fillStyle = stateColors[last.state] || '#2C55FF';
          ctx.beginPath();
          ctx.arc(s[0], s[1], 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#444';
          ctx.stroke();
        }
      });
    };

    Surface.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Surface',
        title: this.title,
        query: this.query,
        xField: this.xField,
        yField: this.yField,
        hField: this.hField,
        trail: this.trail,
        range: this.range,
        wireframe: this.wireframe,
        spin: this.spin
      });
    };

    Surface.prototype.editForm = function() {
      return '<label for="title">Title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="query">Query</label>' +
        '<textarea class="query" name="query">' + util.esc(this.query) + '</textarea><br />' +
        '<label for="xField">X field</label>' +
        '<input type="text" name="xField" value="' + util.esc(this.xField) + '" /><br />' +
        '<label for="yField">Y field</label>' +
        '<input type="text" name="yField" value="' + util.esc(this.yField) + '" /><br />' +
        '<label for="hField">Height field</label>' +
        '<input type="text" name="hField" value="' + util.esc(this.hField) + '" /><br />' +
        '<label for="trail">Trail length (points)</label>' +
        '<input type="text" name="trail" value="' + util.esc(this.trail) + '" /><br />' +
        '<label for="range">Axis range (±)</label>' +
        '<input type="text" name="range" value="' + util.esc(this.range) + '" /><br />' +
        '<label for="wireframe">sqrt(z) reference wireframe</label>' +
        '<input type="checkbox" name="wireframe" ' + (this.wireframe ? 'checked' : '') + ' /><br />' +
        '<label for="spin">Orbit the camera</label>' +
        '<input type="checkbox" name="spin" ' + (this.spin ? 'checked' : '') + ' />';
    };

    Surface.prototype.reflow = function() {
      var w = this.container.clientWidth;
      var h = this.container.clientHeight;
      var ratio = window.devicePixelRatio || 1;
      this.canvas.width = w * ratio;
      this.canvas.height = h * ratio;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.draw();
    };

    Surface.prototype.delete = function() {
      if (this.spinTimer) {
        clearInterval(this.spinTimer);
        this.spinTimer = null;
      }
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
