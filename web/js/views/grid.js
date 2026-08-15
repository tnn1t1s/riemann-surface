(function() {
  var Grid = function(json) {
    // We want a per-grid slurred rendering.
    this.render = util.slur(500, Grid.prototype.render);

    view.View.call(this, json);
    this.query = json.query;
    this.title = json.title;
    this.max = json.max;
    this.rows_str = json.rows;
    this.cols_str = json.cols;
    this.max_fn = util.max_fn(json.max);
    this.row_sort = json.row_sort || "lexical";
    this.col_sort = json.col_sort || "lexical";
    this.row_fn = util.extract_fn(json.rows) || util.extract_fn('host');
    this.col_fn = util.extract_fn(json.cols) || util.extract_fn('service');
    this.description = json.description;
    this.clickFocusable = true;

    // Initial display
    this.el.classList.add('grid');
    this.el.appendChild(util.el('h2', null, this.title || ''));
    this.el.appendChild(util.html('<div class="container"><table></table></div>'));
    this.table = this.el.querySelector('table');

    // State
    this.cols = [];
    this.rows = [];
    // events[row_key][col_key] = event
    this.events = {};
    // maxima[maxima_value] = 500
    this.maxima = {};

    // Subscribe
    if (this.query) {
      var me = this;
      this.sub = subs.subscribe(this.query, function(e) {
        me.update.call(me, e);
      });
    }
  };

  view.inherit(view.View, Grid);
  view.Grid = Grid;
  view.types.Grid = Grid;

  Grid.prototype.json = function() {
    return util.merge(view.View.prototype.json.call(this), {
      type: 'Grid',
      title: this.title,
      query: this.query,
      max: this.max,
      rows: this.rows_str,
      cols: this.cols_str,
      row_sort: this.row_sort,
      col_sort: this.col_sort,
      description: this.description
    });
  };

  Grid.prototype.editForm = function() {
    var sel = function(current, value) {
      return current === value ? 'selected' : '';
    };
    return "<label for='title'>Title</label>" +
      "<input type='text' name='title' value=\"" + util.esc(this.title) + "\" /><br />" +
      "<label for='query'>Query</label><br />" +
      "<textarea name='query' class='query'>" + util.esc(this.query) + "</textarea><br />" +
      "<label for='rows'>Rows</label>" +
      "<input type='text' name='rows' value=\"" + util.esc(this.rows_str) + "\" /><br />" +
      "<label for='cols'>Columns</label>" +
      "<input type='text' name='cols' value=\"" + util.esc(this.cols_str) + "\" /><br />" +
      "<span class='desc'>'host' or 'service'</span><br />" +
      "<label for='row_sort'>Sort rows</label>" +
      "<select name='row_sort'>" +
        "<option value='lexical' " + sel(this.row_sort, 'lexical') + ">Lexically</option>" +
        "<option value='metric' " + sel(this.row_sort, 'metric') + ">By metric</option>" +
      "</select><br />" +
      "<label for='col_sort'>Sort columns</label>" +
      "<select name='col_sort'>" +
        "<option value='lexical' " + sel(this.col_sort, 'lexical') + ">Lexically</option>" +
        "<option value='metric' " + sel(this.col_sort, 'metric') + ">By metric</option>" +
      "</select><br />" +
      "<label for='max'>Max</label>" +
      "<input type='text' name='max' value=\"" + util.esc(this.max) + "\" /><br />" +
      "<span class='desc'>'all', 'host', 'service', or any number.</span><br />" +
      "<label for='description'>Description</label>" +
      "<textarea name='description'>" + util.esc(this.description) + "</textarea><br />";
  };

  // What is the maximum for this event?
  Grid.prototype.eventMax = function(event) {
    if (typeof(this.max_fn) === "number") {
      // Absolute numeric value
      return this.max_fn;
    } else {
      // Use fn to group maxima
      return this.maxima[this.max_fn(event)] || 1/0;
    }
  };

  // Recomputes all maxima.
  Grid.prototype.refreshMaxima = function() {
    if (typeof(this.max_fn) === "number") {
      // We're done; no need to update a fixed maximum.
      return;
    }

    this.maxima = {};
    var e;
    var max_key;
    var current_max;
    for (var row in this.events) {
      for (var col in this.events[row]) {
        e = this.events[row][col];
        if (e.metric) {
          max_key = this.max_fn(e);
          current_max = this.maxima[max_key];
          if ((current_max === undefined) || (current_max < e.metric)) {
            this.maxima[max_key] = e.metric;
          }
        }
      }
    }
  };

  // Update cached maxima with a new event. Returns true if maxima changed.
  Grid.prototype.updateMax = function(event) {
    if (typeof(this.max_fn) === "number") {
      // Absolute maximum; no need to recompute anything.
      return false;
    }

    if (event.metric === undefined) {
      // No metric present
      return false;
    }

    var max_key = this.max_fn(event);

    if (this.maxima[max_key] && (event.metric <= this.maxima[max_key])) {
      // We haven't bumped our max; no change.
      return false;
    }

    // Traverse all events looking for a match.
    var e;
    var currentMax = -1/0;
    for (var name in this.events) {
      for (var subName in this.events[name]) {
        e = this.events[name][subName];
        if (e.metric && this.max_fn(e) === max_key) {
          currentMax = Math.max(currentMax, e.metric);
        }
      }
    }

    // Set new maximum.
    this.maxima[max_key] = currentMax;

    return true;
  };

  // Full refresh of column list
  Grid.prototype.refreshCols = function() {
    var cols = {};
    for (var row in this.events) {
      for (var col in this.events[row]) {
        cols[col] = Math.max(
            (cols[col] || -1/0), this.events[row][col].metric);
      }
    }
    if (this.col_sort === "lexical") {
      this.cols = Object.keys(cols).sort();
    } else {
      this.cols = Object.keys(cols).sort(function(a, b) {
        return cols[b] - cols[a];
      });
    }
  };

  // Full refresh of row list
  Grid.prototype.refreshRows = function() {
    if (this.row_sort === "lexical") {
      this.rows = Object.keys(this.events).sort();
    } else {
      var rows = {};
      for (var row in this.events) {
        for (var col in this.events[row]) {
          rows[row] = Math.max(
              (rows[row] || -1/0), this.events[row][col].metric);
        }
      }
      this.rows = Object.keys(rows).sort(function(a, b) {
        return rows[b] - rows[a];
      });
    }
  };

  // Returns a td for the given event.
  Grid.prototype.renderElement = function(event) {
    if (event === undefined) {
      // Nuke element
      return util.el('td');
    }

    var td = util.html('<td><span class="bar"><span class="metric"></span></span></td>');
    var bar = td.querySelector('.bar');
    var metric = td.querySelector('.metric');

    // Event pane
    td.addEventListener('click', function() { eventPane.show(event); });

    // State
    td.className = "state box " + event.state;

    // Description
    var list = [];
    if (this.description != undefined) {
      list = String(this.description).split(',');
    }
    var description = "";
    list.forEach(function(input) {
      if (input === "all") {
        for (var k in event) {
          description += k + ': ' + event[k] + '\n';
        }
      }
      if (event[input] != undefined) {
        description += input + ": " + event[input] + '\n';
      }
    });
    td.title = event.host + ' ' + event.service + "\n" + event.state + '\n' +
      description +
      "received at " + new Date(event.time).toString() +
      "\nexpiring at " + new Date(event.time + event.ttl * 1000).toString() +
      (event.description ? ("\n\n" + event.description) : "");

    // Metric
    if (event.metric != undefined) {
      metric.textContent = format.float(event.metric);
    } else if (event.state != undefined) {
      metric.textContent = event.state;
    }

    // Bar chart
    if (event.metric === null ||
        event.metric === undefined ||
        event.metric <= 0) {
      bar.style.width = 0;
    } else {
      // Positive
      bar.style.width =
        (event.metric / this.eventMax(event) * 100) + "%";
    }

    return td;
  };

  // A full re-rendering of the table.
  Grid.prototype.render = function() {
    if (! this.el) {
      // Deleted before a queued render fired.
      return;
    }

    // Update data model
    this.refreshMaxima();
    this.refreshRows();
    this.refreshCols();

    var table = this.table;
    table.textContent = '';

    var shortColNames = strings.shorten(strings.commonPrefix, this.cols);
    var shortRowNames = strings.shorten(strings.commonPrefix, this.rows);

    // Header
    var thead = util.el('thead');
    var headRow = util.el('tr');
    headRow.appendChild(util.el('th'));
    shortColNames.forEach(function(name) {
      headRow.appendChild(util.el('th', null, name || 'nil'));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = util.el('tbody');
    this.rows.forEach(function(rowName, i) {
      var row = util.el('tr');
      row.appendChild(util.el('th', null, shortRowNames[i] || 'nil'));
      this.cols.forEach(function(colName) {
        row.appendChild(this.renderElement(this.events[rowName][colName]));
      }, this);
      tbody.appendChild(row);
    }, this);
    table.appendChild(tbody);
  };

  // Stores an event in the internal state tables. Returns true if we
  // haven't seen this host/service before.
  Grid.prototype.saveEvent = function(e) {
    var row_key = this.row_fn(e);
    var col_key = this.col_fn(e);

    // Update events map
    if (this.events[row_key] === undefined) {
      // New row
      this.events[row_key] = {};
    }
    var newEvent = (this.events[row_key][col_key] === undefined);

    // Store event
    this.events[row_key][col_key] = e;

    return newEvent;
  };

  // Add an event.
  Grid.prototype.add = function(e) {
    this.saveEvent(e);
    this.updateMax(e);
    this.render();
  };

  // Remove an event.
  Grid.prototype.remove = function(e) {
    var row_key = this.row_fn(e);
    var col_key = this.col_fn(e);

    // Remove from events table.
    if (this.events[row_key]) {
      delete this.events[row_key][col_key];
      if (Object.keys(this.events[row_key]).length === 0) {
        delete this.events[row_key];
      }
    }

    this.render();
  };

  // Accept an event.
  Grid.prototype.update = function(e) {
    if (e.state === "expired") {
      this.remove(e);
    } else {
      this.add(e);
    }
  };

  Grid.prototype.delete = function() {
    if (this.sub !== undefined) {
      subs.unsubscribe(this.sub);
    }
    this.update = function() {};
    view.View.prototype.delete.call(this);
  };
})();
