// Pane at the bottom of the dashboard for displaying events in context.
var eventPane = (function() {
  var el = document.getElementById('event-pane');
  var fixedFields = ['host', 'service', 'time', 'state', 'metric', 'ttl',
                     'description', 'tags'];

  // Hide the pane
  var hide = function() {
    if (el.classList.contains("active")) {
      el.textContent = '';
      el.classList.remove("active");
    }
  };

  // Show an event in the pane
  var show = function(event) {
    if (! event) {
      return;
    }
    hide();
    el.classList.add("active");

    var e = Object.assign({
      host: "nil",
      service: "nil",
      state: "nil",
      metric: "nil",
      ttl: "nil",
      tags: "nil",
      description: "nil"
    }, event, {time: new Date(event.time)});

    el.appendChild(util.html(
      '<div>' +
      '<span class="host">' + util.esc(e.host) + '</span>' +
      '<span class="service">' + util.esc(e.service) + '</span>' +
      '<span class="state ' + util.esc(e.state) + '">' + util.esc(e.state) + '</span>' +
      '<span class="metric">' + util.esc(e.metric) + '</span>' +
      '<time class="absolute">' + util.esc(e.time) + '</time>' +
      '<span class="ttl">' + util.esc(format.ttl(e.ttl)) + '</span>' +
      '<span class="tags">' + util.esc(e.tags) + '</span>' +
      '</div>'));
    el.appendChild(util.html(
      '<pre class="description">' + util.esc(e.description) + '</pre>'));

    // Remaining fields
    var table = util.el('table');
    Object.keys(event).forEach(function(field) {
      if (fixedFields.indexOf(field) === -1) {
        var tr = util.el('tr');
        tr.appendChild(util.el('td', 'field-name', field));
        tr.appendChild(util.el('td', null, String(event[field])));
        table.appendChild(tr);
      }
    });
    el.appendChild(table);
  };

  // Hide on escape.
  keys.bind(27, hide);

  return {show: show,
          hide: hide};
})();
