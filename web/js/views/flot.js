// Time-series chart view, drawn on a canvas. Keeps the "Flot" type name so
// existing configs load unchanged.
(function() {
    var COLORS = ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed",
                  "#bd9b33", "#8cacc6", "#a23c3c", "#3d853d", "#7633bd",
                  "#57306f", "#6b9c7d", "#de8800", "#2c55ff", "#c91515"];

    var FlotView = function(json) {
      // Extract state from JSON
      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.max = (json.max === undefined || json.max === null || json.max === '') ?
        null : parseFloat(json.max);
      this.min = (json.min === undefined || json.min === null || json.min === '') ?
        null : parseFloat(json.min);
      this.graphType = json.graphType || 'line';
      this.stackMode = json.stackMode || 'false';
      this.lineWidth = json.lineWidth || 1;
      this.tooltips = json.tooltips || 'metric';
      this.timeRange = (json.timeRange * 1000) || 300000;

      var self = this;

      // Set up HTML
      if (this.title) {
        this.el.classList.add('flot');
        this.el.appendChild(util.el('h2', null, this.title));
        this.container = util.el('div', 'container');
        this.el.appendChild(this.container);
      } else {
        this.container = this.el;
      }

      this.canvas = util.el('canvas');
      this.container.appendChild(this.canvas);
      this.tooltip = util.el('div', 'chart-tooltip');
      this.tooltip.style.display = 'none';
      this.container.appendChild(this.tooltip);

      // Create local copies of slurred functions
      this.reflowGraph = util.slur(200, FlotView.prototype.reflowGraph);
      this.setGraphData = util.slur(1000, FlotView.prototype.setGraphData);

      // This view can be clicked to focus on it.
      this.clickFocusable = true;

      // Time series state
      this.series = {};
      this.data = [];
      this.now = Date.now();

      // Screen-space points from the last draw, for tooltip hit tests:
      // [{x, y, label, time, value}]
      this.hitPoints = [];

      if (!json.virtual) {
        this.reflow();

        if (this.tooltips !== 'false') {
          this.canvas.addEventListener('mousemove', function(e) {
            self.onHover(e);
          });
          this.canvas.addEventListener('mouseleave', function() {
            self.tooltip.style.display = 'none';
          });
        }

        this.clockSub = clock.subscribe(function(t) {
          self.now = t;
          self.trimData(t);
          self.draw();
        });

        // Subscribe to our query
        this.sub = subs.subscribe(this.query,
            function(e) {
              self.update(e);
            }
        );
      }
    };

    // Set up our FlotView class and register it with the view system
    view.inherit(view.View, FlotView);
    view.Flot = FlotView;
    view.types.Flot = FlotView;

    // Re-order the data list and series index to be in sorted order by label.
    FlotView.prototype.resortSeries = function() {
      // Shorten labels
      var hostPrefix = strings.commonPrefix(
        this.data.map(function(d) { return d.riemannHost; }));
      var servicePrefix = strings.commonPrefix(
        this.data.map(function(d) { return d.riemannService; }));
      this.data.forEach(function(d) {
        d.label = d.riemannHost.substring(hostPrefix.length) + ' ' +
                  d.riemannService.substring(servicePrefix.length);
        // Empty labels are expanded back to full ones.
        if (d.label === ' ') {
          d.label = d.riemannHost + ' ' + d.riemannService;
        }
      });

      // Sort data series
      this.data.sort(function(a, b) {
        if (a.label === b.label) {
          return 0;
        } else if (a.label > b.label) {
          return 1;
        } else {
          return -1;
        }
      });

      // Rebuild series index
      this.series = {};
      this.data.forEach(function(s, i) {
        this.series[s.riemannKey] = i;
      }, this);
    };

    // Accept events from a subscription and update the dataset.
    FlotView.prototype.update = function(event) {
      // Get series for this host/service
      var key = util.eventKey(event);

      // If this is a new series, add it.
      if (this.series[key] === undefined) {
        this.data.push({
          riemannKey: key,
          riemannHost: event.host || 'nil',
          riemannService: event.service || 'nil',
          data: []
        });
        this.resortSeries();
      }

      var series = this.data[this.series[key]].data;

      // Add event to series
      if (event.state === "expired") {
        series.push(null);
      } else if (event.metric !== undefined) {
        series.push([event.time, event.metric]);
      }

      this.setGraphData();
    };

    // Redraw with the current dataset.
    FlotView.prototype.setGraphData = function() {
      if (this.el) {
        this.draw();
      }
    };

    // Clean up old data points.
    FlotView.prototype.trimData = function(t) {
      t = t - this.timeRange;
      var empties = false;

      this.data.forEach(function(s) {
        // We leave one data point off the edge of the graph for continuity.
        while (1 < s.data.length && (s.data[1] === null || s.data[1][0] < t)) {
          s.data.shift();
        }
        // And clean up single data points if necessary.
        if (1 === s.data.length && (s.data[0] === null || s.data[0][0] < t)) {
          s.data.shift();
        } else if (0 === s.data.length) {
          empties = true;
        }
      });

      // Clean up empty datasets
      if (empties) {
        this.data = this.data.filter(function(s) {
          return s.data.length !== 0;
        });
        this.resortSeries();
      }
    };

    // Serialize current state to JSON
    FlotView.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'Flot',
        title: this.title,
        query: this.query,
        min: this.min,
        max: this.max,
        timeRange: this.timeRange / 1000,
        graphType: this.graphType,
        stackMode: this.stackMode,
        tooltips: this.tooltips
      });
    };

    // Returns the edit form
    FlotView.prototype.editForm = function() {
      var sel = function(current, value) {
        return String(current) === value ? 'selected' : '';
      };
      return '<label for="title">title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="graphType">Graph Type</label>' +
        '<select name="graphType">' +
          '<option value="line" ' + sel(this.graphType, 'line') + '>Line</option>' +
          '<option value="bar" ' + sel(this.graphType, 'bar') + '>Bar</option>' +
        '</select>' +
        '<label for="stackMode">Stack Mode</label>' +
        '<select name="stackMode">' +
          '<option value="true" ' + sel(this.stackMode, 'true') + '>Stacked</option>' +
          '<option value="false" ' + sel(this.stackMode, 'false') + '>Normal</option>' +
        '</select>' +
        '<br />' +
        '<label for="tooltips">Tooltips</label>' +
        '<select name="tooltips">' +
          '<option value="metric" ' + sel(this.tooltips, 'metric') + '>With metric</option>' +
          '<option value="simple" ' + sel(this.tooltips, 'simple') + '>Simple</option>' +
          '<option value="false" ' + sel(this.tooltips, 'false') + '>Disabled</option>' +
        '</select>' +
        '<br />' +
        '<label for="query">query</label>' +
        '<textarea class="query" name="query">' + util.esc(this.query) + '</textarea><br />' +
        '<label for="timeRange">Time range (s)</label>' +
        '<input type="text" name="timeRange" value="' + (this.timeRange / 1000) + '" />' +
        '<br />' +
        '<label for="min">Min</label>' +
        '<input type="text" name="min" value="' + util.esc(this.min) + '" />' +
        '<br />' +
        '<label for="max">Max</label>' +
        '<input type="text" name="max" value="' + util.esc(this.max) + '" />';
    };

    // Resizes graph
    FlotView.prototype.reflowGraph = function() {
      if (! this.el) {
        return;
      }
      var w = this.container.clientWidth;
      var h = this.container.clientHeight;
      var ratio = window.devicePixelRatio || 1;
      this.canvas.width = w * ratio;
      this.canvas.height = h * ratio;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.draw();
    };

    // Called when our parent needs to resize us
    FlotView.prototype.reflow = function() {
      this.reflowGraph();
    };

    // Round to a "nice" tick step.
    var niceStep = function(rough) {
      var mag = Math.pow(10, Math.floor(Math.log10(rough)));
      var norm = rough / mag;
      if (norm <= 1) { return mag; }
      if (norm <= 2) { return 2 * mag; }
      if (norm <= 5) { return 5 * mag; }
      return 10 * mag;
    };

    // Time tick step in ms.
    var timeStep = function(range) {
      var steps = [1000, 2000, 5000, 10000, 15000, 30000,
                   60000, 120000, 300000, 600000, 900000, 1800000,
                   3600000, 7200000, 14400000, 28800000, 86400000];
      var rough = range / 6;
      for (var i = 0; i < steps.length; i++) {
        if (steps[i] >= rough) { return steps[i]; }
      }
      return steps[steps.length - 1];
    };

    var pad2 = function(n) { return (n < 10 ? '0' : '') + n; };

    var timeLabel = function(t, step) {
      var d = new Date(t);
      var label = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      if (step < 60000) {
        label += ':' + pad2(d.getSeconds());
      }
      return label;
    };

    // Linear interpolation of a polyline [[x,y],...] at x. Returns 0 outside.
    var interpolate = function(points, x) {
      if (points.length === 0) { return 0; }
      if (x <= points[0][0]) { return points[0][1]; }
      var last = points[points.length - 1];
      if (x >= last[0]) { return last[1]; }
      for (var i = 1; i < points.length; i++) {
        if (points[i][0] >= x) {
          var p0 = points[i - 1], p1 = points[i];
          var f = (x - p0[0]) / (p1[0] - p0[0]);
          return p0[1] + f * (p1[1] - p0[1]);
        }
      }
      return last[1];
    };

    // Split a series' data (with null gaps) into runs of contiguous points.
    var runs = function(data) {
      var out = [];
      var current = [];
      data.forEach(function(p) {
        if (p === null) {
          if (current.length) { out.push(current); current = []; }
        } else {
          current.push(p);
        }
      });
      if (current.length) { out.push(current); }
      return out;
    };

    // Full chart render.
    FlotView.prototype.draw = function() {
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

      var t = this.now || Date.now();
      var x0 = t - this.timeRange;
      var x1 = t;
      var stacked = this.stackMode === 'true';

      // Build the values to plot (stacking accumulates).
      var plotted = [];  // [{series, points: [[x, y, base]], color}]
      var base = [];     // running stack base polyline
      this.data.forEach(function(s, i) {
        var color = COLORS[i % COLORS.length];
        runs(s.data).forEach(function(run) {
          var pts = run.map(function(p) {
            var b = stacked ? interpolate(base, p[0]) : 0;
            return [p[0], p[1] + b, b];
          });
          plotted.push({series: s, points: pts, color: color});
        });
        if (stacked) {
          // New base: the stacked top of this series over its own xs,
          // merged with the old base outside its range.
          var top = [];
          runs(s.data).forEach(function(run) {
            run.forEach(function(p) {
              top.push([p[0], p[1] + interpolate(base, p[0])]);
            });
          });
          if (top.length) { base = top; }
        }
      });

      // Y range
      var ymin = this.min;
      var ymax = this.max;
      if (ymin === null || ymax === null || isNaN(ymin) || isNaN(ymax)) {
        var lo = Infinity, hi = -Infinity;
        plotted.forEach(function(p) {
          p.points.forEach(function(pt) {
            if (pt[1] < lo) { lo = pt[1]; }
            if (pt[1] > hi) { hi = pt[1]; }
          });
        });
        if (lo === Infinity) { lo = 0; hi = 1; }
        if (lo === hi) { hi = lo + 1; }
        if (ymin === null || isNaN(ymin)) { ymin = Math.min(0, lo); }
        if (ymax === null || isNaN(ymax)) { ymax = hi * 1.05; }
      }

      // Layout: leave room for axis labels.
      var margin = {left: 45, right: 8, top: 6, bottom: 18};
      var pw = w - margin.left - margin.right;
      var ph = h - margin.top - margin.bottom;
      if (pw <= 0 || ph <= 0) { return; }

      var sx = function(x) { return margin.left + (x - x0) / (x1 - x0) * pw; };
      var sy = function(y) { return margin.top + (1 - (y - ymin) / (ymax - ymin)) * ph; };

      // Background and border
      ctx.fillStyle = '#fff';
      ctx.fillRect(margin.left, margin.top, pw, ph);

      ctx.font = '11px sans-serif';

      // Y grid + labels
      var ystep = niceStep((ymax - ymin) / 5);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      var y;
      for (y = Math.ceil(ymin / ystep) * ystep; y <= ymax; y += ystep) {
        var py = sy(y);
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(margin.left, py);
        ctx.lineTo(margin.left + pw, py);
        ctx.stroke();
        ctx.fillStyle = '#444';
        ctx.fillText(String(format.float(y)), margin.left - 4, py);
      }

      // X grid + labels
      var xstep = timeStep(x1 - x0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var x;
      for (x = Math.ceil(x0 / xstep) * xstep; x <= x1; x += xstep) {
        var px = sx(x);
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(px, margin.top);
        ctx.lineTo(px, margin.top + ph);
        ctx.stroke();
        ctx.fillStyle = '#444';
        ctx.fillText(timeLabel(x, xstep), px, margin.top + ph + 3);
      }

      // Border
      ctx.strokeStyle = '#aaa';
      ctx.strokeRect(margin.left, margin.top, pw, ph);

      // Clip to the plot area for the series.
      ctx.save();
      ctx.beginPath();
      ctx.rect(margin.left, margin.top, pw, ph);
      ctx.clip();

      var self = this;
      this.hitPoints = [];
      var barWidth = Math.max(1, pw / (this.timeRange / 1000) * 0.8);

      plotted.forEach(function(p) {
        var pts = p.points;
        if (pts.length === 0) { return; }

        if (self.graphType === 'bar') {
          ctx.fillStyle = p.color;
          pts.forEach(function(pt) {
            var px = sx(pt[0]);
            var top = sy(pt[1]);
            var bottom = sy(Math.max(pt[2], ymin));
            ctx.fillRect(px - barWidth / 2, Math.min(top, bottom),
                         barWidth, Math.abs(bottom - top) || 1);
          });
        } else {
          // Fill under the line when stacked.
          if (stacked) {
            ctx.beginPath();
            ctx.moveTo(sx(pts[0][0]), sy(pts[0][2]));
            pts.forEach(function(pt) { ctx.lineTo(sx(pt[0]), sy(pt[1])); });
            for (var i = pts.length - 1; i >= 0; i--) {
              ctx.lineTo(sx(pts[i][0]), sy(pts[i][2]));
            }
            ctx.closePath();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          ctx.strokeStyle = p.color;
          ctx.lineWidth = self.lineWidth;
          ctx.beginPath();
          pts.forEach(function(pt, i) {
            if (i === 0) {
              ctx.moveTo(sx(pt[0]), sy(pt[1]));
            } else {
              ctx.lineTo(sx(pt[0]), sy(pt[1]));
            }
          });
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Hit points for tooltips (raw values, not stacked).
        pts.forEach(function(pt) {
          self.hitPoints.push({
            x: sx(pt[0]),
            y: sy(pt[1]),
            label: p.series.label,
            time: pt[0],
            value: pt[1] - pt[2]
          });
        });
      });

      ctx.restore();

      // Legend
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      var ly = margin.top + 10;
      this.data.forEach(function(s, i) {
        if (ly > margin.top + ph - 6) { return; }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fillRect(margin.left + 6, ly - 4, 8, 8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillText(s.label || '', margin.left + 18, ly);
        ly += 14;
      });
    };

    // Tooltip hover handler.
    FlotView.prototype.onHover = function(e) {
      var rect = this.canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      var best = null;
      var bestDist = 15 * 15;
      this.hitPoints.forEach(function(p) {
        var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      });

      if (! best) {
        this.tooltip.style.display = 'none';
        return;
      }

      if (this.tooltips === 'metric') {
        this.tooltip.innerHTML = '<b>' + util.esc(best.label) + '</b><br />' +
          util.esc(new Date(best.time).toLocaleTimeString()) + '<br />' +
          util.esc(format.float(best.value));
      } else {
        this.tooltip.innerHTML = '<b>' + util.esc(best.label) + '</b>';
      }
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (best.x + 10) + 'px';
      this.tooltip.style.top = (best.y + 10) + 'px';
    };

    // When the view is deleted, remove our subscription
    FlotView.prototype.delete = function() {
      if (this.clockSub) {
        clock.unsubscribe(this.clockSub);
      }
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    };
})();
