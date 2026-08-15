// TimeSeries renders via the same chart engine as Flot. Its scrolling-speed
// options map onto a time range; other smoothie-specific options are kept in
// the config but not rendered.
(function() {
    var TimeSeriesView = function(json) {
      this.speed = json.speed;
      this.delay = json.delay;
      this.opacity = json.opacity;

      // speed is milliseconds per pixel; approximate the visible window of a
      // ~600px chart.
      var msPerPixel = parseFloat(json.speed || 100);
      view.Flot.call(this, util.merge(json, {
        type: 'TimeSeries',
        timeRange: (msPerPixel * 600) / 1000,
        graphType: 'line',
        lineWidth: json.lineWidth || 2
      }));
    };

    view.inherit(view.Flot, TimeSeriesView);
    view.TimeSeries = TimeSeriesView;
    view.types.TimeSeries = TimeSeriesView;

    TimeSeriesView.prototype.json = function() {
      return util.merge(view.View.prototype.json.call(this), {
        type: 'TimeSeries',
        title: this.title,
        delay: this.delay,
        speed: this.speed,
        query: this.query,
        opacity: this.opacity,
        lineWidth: this.lineWidth
      });
    };

    TimeSeriesView.prototype.editForm = function() {
      return '<label for="title">title</label>' +
        '<input type="text" name="title" value="' + util.esc(this.title) + '" /><br />' +
        '<label for="query">query</label>' +
        '<textarea class="query" name="query">' + util.esc(this.query) + '</textarea><br />' +
        '<label for="lineWidth">line width</label>' +
        '<input type="text" name="lineWidth" value="' + util.esc(this.lineWidth) + '" /><br />' +
        '<label for="speed">scroll speed (ms per pixel)</label>' +
        '<input type="text" name="speed" value="' + util.esc(this.speed) + '" />';
    };
})();
