var dash = (function() {
  var defaultWorkspace = {
    name: "Riemann",
    view: {
      type: 'Balloon',
      child: {
        type: 'VStack',
        children: [
          {
            type: 'Title',
            title: "Riemann"
          },
          {
            type: 'Help'
          }
        ]
      }
    }
  };

  var currentWorkspaceId = null;
  var workspaces = [];
  var currentView;

  // Find a workspace's position.
  var workspaceIndex = function(workspace) {
    if (workspace === null || workspace === undefined) {
      return null;
    }

    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === workspace.id) {
        return i;
      }
    }
    return null;
  };

  // Find a workspace by a property value.
  var workspaceByProperty = function(property) {
    return function(match) {
      for (var i = 0; i < workspaces.length; i++) {
        if (workspaces[i][property] === match) {
          return workspaces[i];
        }
      }
      return null;
    };
  };

  var workspace = workspaceByProperty("id");
  var workspaceByName = workspaceByProperty("name");

  // Get current workspace.
  var currentWorkspace = function() {
    return workspace(currentWorkspaceId);
  };

  var currentWorkspaceIndex = function() {
    return workspaceIndex({id: currentWorkspaceId});
  };

  // Preserve current workspace state
  var stash = function() {
    var currentIndex = currentWorkspaceIndex();
    if (currentIndex != null) {
      workspaces[currentIndex] =
        util.merge(currentWorkspace(), {view: currentView.json()});
    }
    toolbar.workspaces(workspaces);
    toolbar.workspace(currentWorkspace());
  };

  // Make a new workspace
  var newWorkspace = function() {
    var w = util.merge({}, defaultWorkspace);
    w.id = util.uniqueId();
    return w;
  };

  var getLocation = function() {
    return decodeURIComponent(window.location.hash.slice(1));
  };

  var toLocation = function(workspace) {
    window.history.pushState(workspace, workspace.name, "#" + workspace.name);
  };

  var switchWorkspaceByName = function(name) {
    var ws = workspaceByName(name) || workspaces[0];
    return switchWorkspace(ws);
  };

  // Switch between workspaces.
  var switchWorkspace = function(workspace) {
    // Shut down current setup
    stash();
    view.unfocus();

    if (currentView) {
      currentView.delete();
    }

    // Switch
    currentWorkspaceId = workspace.id;
    toolbar.workspace(workspace);

    document.title = workspace.name;

    // update URL
    if (getLocation() !== workspace.name) {
      toLocation(workspace);
    }

    // Create new view
    currentView = view.reify(
      util.merge(workspace.view, {container: document.getElementById('view')}));
    currentView.reflow();
  };

  // Delete a workspace.
  var deleteWorkspace = function(workspace) {
    var index = currentWorkspaceIndex();
    workspaces = workspaces.filter(function(w) { return w.id !== workspace.id; });
    if (workspaces.length === 0) {
      workspaces = [newWorkspace()];
      index = 0;
    }
    toolbar.workspaces(workspaces);
    switchWorkspace(workspaces[Math.min(index, workspaces.length - 1)]);
  };

  // Reload the dash.
  var reload = function() {
    persistence.load(function(config) {
      // Server
      var server = config.server || '127.0.0.1:5556';
      var server_type = config.server_type || "ws";
      subs.server(server);
      subs.server_type(server_type);
      toolbar.server(server);
      toolbar.server_type(server_type);

      // Workspaces
      if (config.workspaces && config.workspaces.length > 0) {
        workspaces = config.workspaces;
        workspaces.forEach(function(w) {
          w.id = w.id || util.uniqueId();
        });
        toolbar.workspaces(workspaces);
      }

      // Ensure there's a default workspace.
      if (workspaces.length === 0) {
        workspaces = [newWorkspace()];
        toolbar.workspaces(workspaces);
      }

      var replacement = workspace(currentWorkspaceId);
      currentWorkspaceId = null;

      var currentLocation = getLocation();
      if (currentLocation) { // check URL first
        switchWorkspaceByName(currentLocation);
      } else if (replacement) { // otherwise use replacement
        switchWorkspace(replacement);
      } else { // failing that use the first
        switchWorkspace(workspaces[0]);
      }

    }, function(xhr, msg) {
      toast.error("Error loading config: " + msg);
    });
  };

  // Save everything.
  var save = function() {
    stash();

    persistence.save(
      {
        server: toolbar.server(),
        server_type: toolbar.server_type(),
        workspaces: workspaces
      },
      function() { toast.info("Configuration saved."); },
      function(xhr, msg) {
        console.log("Error saving config", msg);
        toast.error("Error saving config: " + msg);
      }
    );
  };

  var showconfig = function() {
    stash();
    var dialog = util.el('div');
    var pre = util.el('pre', 'config-dump', JSON.stringify({
      server: toolbar.server(),
      server_type: toolbar.server_type(),
      workspaces: workspaces
    }, null, 2));
    dialog.appendChild(pre);
    modal.open(dialog);
  };

  var help = function() {
    var dialog = util.html(
      '<div><h1>Help</h1><ul>' +
      '<li><b>e</b>: edit the view</li>' +
      '<li><b>?</b>: display this help box</li>' +
      '<li><b>s</b>: save the dashboard</li>' +
      '<li><b>w</b>: display the current config</li>' +
      '<li><b>r</b>: reload the dashboard from last saved config</li>' +
      '<li><b>+</b>: increase the size of the view</li>' +
      '<li><b>-</b>: decrease the size of the view</li>' +
      '<li><b>v</b>: split the view vertically</li>' +
      '<li><b>h</b>: split the view horizontally</li>' +
      '<li><b>&#8592;</b>: left arrow move the view to the left</li>' +
      '<li><b>&#8594;</b>: right arrow move the view to the right</li>' +
      '<li><b>&#8593;</b>: up arrow move the view up</li>' +
      '<li><b>&#8595;</b>: down arrow move the view down</li>' +
      '<li><b>pageup</b>: select the parent of the current view</li>' +
      '<li><b>d</b>: delete a view</li>' +
      '<li><b>delete</b>: delete a view</li>' +
      '<li><b>alt-1, alt-2, etc</b>: switch to a different workspace</li>' +
      '<li><b>p</b>: pause/unpause the event stream(s)</li>' +
      '</ul></div>'
    );

    modal.open(dialog);
  };

  // Global keybindings.
  keys.bind(80, subs.toggle); // p
  keys.bind(82, reload);      // r
  keys.bind(83, save);        // s
  keys.bind(87, showconfig);  // w
  keys.bind(191, help);       // ?
  for (var i = 0; i < 9; i++) {
    (function(i) {
      keys.bind(49 + i, function(e) {
        if (e.altKey && workspaces[i]) {
          switchWorkspace(workspaces[i]);
        }
      });
    })(i);
  }

  // Handle server changes from toolbar.
  toolbar.onServerChange(function(server) {
    console.log("Server changed to", server);
    // Notify subscription system
    subs.server(server);
    // Reload view.
    switchWorkspace(currentWorkspace());
  });

  toolbar.onServerTypeChange(function(server_type) {
    console.log("Server type changed to", server_type);
    subs.server_type(server_type);
    // Reload view.
    switchWorkspace(currentWorkspace());
  });

  // Handle toolbar workspace switching.
  toolbar.onWorkspaceSwitch(function(workspace) {
    switchWorkspace(workspace);
  });

  // Workspace *changes*.
  toolbar.onWorkspaceChange(function(w1, w2) {
    workspaces[workspaceIndex(w1)] = w2;
    toolbar.workspaces(workspaces);
    toolbar.workspace(currentWorkspace());
  });

  toolbar.onWorkspaceReorder(function(workspaceIds) {
    workspaces = workspaceIds.map(workspace);
    toolbar.workspaces(workspaces);
    toolbar.workspace(currentWorkspace());
  });

  // Workspace additions.
  toolbar.onWorkspaceAdd(function() {
    var w = newWorkspace();
    workspaces.push(w);
    toolbar.workspaces(workspaces);
    switchWorkspace(w);
  });

  // Workspace deletions
  toolbar.onWorkspaceDelete(function(w) {
    deleteWorkspace(w);
  });

  // Handle resizes.
  window.addEventListener('resize', function() {
    if (currentView) {
      currentView.reflow();
      try {
        view.focused().refocus();
      } catch (e) { }
    }
  });

  return {
    workspaces: function() { return workspaces; },
    currentWorkspace: currentWorkspace,
    workspaceIndex: workspaceIndex,
    switchWorkspace: switchWorkspace,
    reload: reload,
    save: save
  };
})();
