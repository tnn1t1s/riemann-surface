// Provides persistent storage for dashboard configuration.
var persistence = (function() {
  // Saves configuration to persistent store. Calls success() or error() when
  // complete.
  var save = function(config, success, error) {
    fetch('config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(config)
    }).then(function(r) {
      if (! r.ok) {
        throw new Error(r.status + ' ' + r.statusText);
      }
      return r.json();
    }).then(success)
      .catch(function(err) {
        if (error) { error(null, err.message); }
      });
  };

  // Returns configuration from persistent store.
  var load = function(success, error) {
    fetch('config').then(function(r) {
      if (! r.ok) {
        throw new Error(r.status + ' ' + r.statusText);
      }
      return r.json();
    }).then(success)
      .catch(function(err) {
        if (error) { error(null, err.message); }
      });
  };

  return {
    save: save,
    load: load
  };
})();
