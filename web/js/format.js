var format = (function() {

  var formatFloat = function(number, precision, commas) {
    if (number == null) {
      return null;
    }
    precision = precision || 2;
    var val;
    if (Math.round(number) == number)
      val = number;
    else
      val = number.toFixed(precision);

    if (!commas) {
      return val;
    }

    var parts = (val + '').split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  var metric = function(e, max) {
    max = (max || 1);
    return '<div class="bar ' + util.esc(e.state) + '" style="width: ' +
      (e.metric / max * 100) + '%">' + util.esc(formatFloat(e.metric)) + '</div>';
  };

  // Human-readable TTL.
  var ttl = function(t) {
    if (parseInt(t) != t) {
      return t;
    }
    if (t > 3600 * 48) {
      return (t / 3600 / 24).toFixed(1) + " days";
    } else if (t > 3600 * 2) {
      return (t / 3600).toFixed(1) + " hours";
    } else if (t > 60 * 2) {
      return (t / 60).toFixed(1) + " minutes";
    }
    return t + " seconds";
  };

  return {
    'float': formatFloat,
    'metric': metric,
    'ttl': ttl
  };
})();
