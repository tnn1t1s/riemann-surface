var toolbar = (function() {
  // Build UI
  var bar = document.getElementById('toolbar');
  var form = util.el('form');
  bar.appendChild(form);
  form.addEventListener('submit', function(e) { e.preventDefault(); });

  // Method to adjust the position of the view div
  var sizeAdjust = function() {
    document.getElementById('view').style.top = bar.offsetHeight + "px";
  };
  window.addEventListener('resize', sizeAdjust);

  var pager = util.el('div', 'pager');
  var load = util.html(
    '<div class="load"><div class="bar load1"></div><div class="bar load5"></div>' +
    '<span title="1- and 5-second subscription manager load averages">Load</span></div>');
  var server = util.html('<input class="server" type="text" name="text">');
  var serverType = util.html(
    '<div class="server server-type">' +
    '<label><input type="radio" id="ws" name="server_type" value="ws" checked>websockets</label>' +
    '<label><input type="radio" id="sse" name="server_type" value="sse">sse</label>' +
    '</div>');
  form.appendChild(pager);
  form.appendChild(serverType);
  form.appendChild(server);
  form.appendChild(load);

  var checkedServerType = function() {
    return form.querySelector('input[name=server_type]:checked').value;
  };

  // Load /////////////////////////////////////////////////////////////////////

  window.setInterval(function() {
    load.querySelector('span').textContent = "Load " +
      format.float(subs.load1()) + ', ' +
      format.float(subs.load5());
    load.querySelector(".load1").style.width = Math.min(100, subs.load1() * 100) + "%";
    load.querySelector(".load5").style.width = Math.min(100, subs.load5() * 100) + "%";
  }, 1000);

  // Server ///////////////////////////////////////////////////////////////////

  // Callbacks
  var onServerChangeCallbacks = [];
  var onServerTypeChangeCallbacks = [];

  var onServerChange = function(callback) {
    onServerChangeCallbacks.push(callback);
  };

  var onServerTypeChange = function(callback) {
    onServerTypeChangeCallbacks.push(callback);
  };

  // When server is set, call callbacks.
  server.addEventListener('change', function() {
    onServerChangeCallbacks.forEach(function(f) {
      f(server.value);
    });
    server.blur();
  });

  // When server_type is set, call callbacks.
  serverType.querySelectorAll('input').forEach(function(radio) {
    radio.addEventListener('change', function() {
      onServerTypeChangeCallbacks.forEach(function(f) {
        f(checkedServerType());
      });
      server.blur();
    });
  });

  // Suppress keybindings while typing.
  server.addEventListener('focus', keys.disable);
  server.addEventListener('blur', keys.enable);

  // Pager ////////////////////////////////////////////////////////////////////

  var onWorkspaceChangeCallbacks = [];
  var onWorkspaceReorderCallbacks = [];
  var onWorkspaceSwitchCallbacks = [];
  var onWorkspaceAddCallbacks = [];
  var onWorkspaceDeleteCallbacks = [];
  var onWorkspaceChange = function(callback) {
    onWorkspaceChangeCallbacks.push(callback);
  };
  var onWorkspaceReorder = function(callback) {
    onWorkspaceReorderCallbacks.push(callback);
  };
  var onWorkspaceSwitch = function(callback) {
    onWorkspaceSwitchCallbacks.push(callback);
  };
  var onWorkspaceAdd = function(callback) {
    onWorkspaceAddCallbacks.push(callback);
  };
  var onWorkspaceDelete = function(callback) {
    onWorkspaceDeleteCallbacks.push(callback);
  };

  // Drag state for reordering tiles.
  var dragged = null;

  // Set workspaces.
  var workspaces = function(wss) {
    pager.textContent = '';

    // Workspaces
    var workspaceList = util.el('ol');
    pager.appendChild(workspaceList);

    wss.forEach(function(workspace) {
      workspaceList.appendChild(workspaceTile(workspace));
    });

    // New button
    var add = util.el('div', 'add button', '+');
    add.addEventListener('click', function() {
      onWorkspaceAddCallbacks.forEach(function(f) {
        f();
      });
    });

    pager.appendChild(add);
    sizeAdjust();
  };

  // Returns a tile for a workspace.
  var workspaceTile = function(workspace) {
    var tile = util.el('li', 'button', workspace.name);
    tile.dataset.workspaceId = workspace.id;
    tile.draggable = true;

    // Switch to this workspace.
    tile.addEventListener('click', function() {
      if (! tile.classList.contains("current")) {
        onWorkspaceSwitchCallbacks.forEach(function(f) {
          f(workspace);
        });
      }
    });

    // Edit this workspace name.
    tile.addEventListener('dblclick', function() {
      var namer = workspaceNamer(workspace);
      keys.disable();
      tile.replaceWith(namer);
      namer.focus();
      namer.select();
    });

    // Reorder by dragging.
    tile.addEventListener('dragstart', function(e) {
      dragged = tile;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', workspace.id);
    });
    tile.addEventListener('dragover', function(e) {
      if (! dragged || dragged === tile) { return; }
      e.preventDefault();
      var rect = tile.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) {
        tile.parentNode.insertBefore(dragged, tile);
      } else {
        tile.parentNode.insertBefore(dragged, tile.nextSibling);
      }
    });
    tile.addEventListener('dragend', function() {
      if (! dragged) { return; }
      dragged = null;
      var ids = Array.prototype.map.call(
        pager.querySelectorAll('li'),
        function(li) { return li.dataset.workspaceId; });
      onWorkspaceReorderCallbacks.forEach(function(f) {
        f(ids);
      });
    });

    // Delete
    var del = util.el('div', 'delete', '×');
    del.addEventListener('click', function(e) {
      e.stopPropagation();
      onWorkspaceDeleteCallbacks.forEach(function(f) {
        f(workspace);
      });
    });
    tile.appendChild(del);

    return tile;
  };

  // A box to rename a workspace.
  var workspaceNamer = function(workspace) {
    var field = util.html('<input type="text" />');
    field.value = workspace.name;
    var done = false;

    // Change the workspace, firing callbacks and replacing the pager tile.
    var submit = function(w2) {
      if (done) { return; }
      done = true;
      onWorkspaceChangeCallbacks.forEach(function(f) {
        f(workspace, w2);
      });
      keys.enable();
    };

    // When we leave focus, commit if changed; otherwise revert.
    field.addEventListener('blur', function() {
      if (field.value !== workspace.name && field.value !== '') {
        var newWorkspace = util.merge(workspace, {name: field.value});
        submit(newWorkspace);
      } else {
        submit(workspace);
      }
    });
    field.addEventListener('keydown', function(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        field.blur();
      } else if (e.keyCode === 27) {
        field.value = workspace.name;
        field.blur();
      }
    });

    return field;
  };

  // Focus a workspace.
  var workspace = function(ws) {
    pager.querySelectorAll('li').forEach(function(li) {
      li.classList.remove('current');
    });
    if (ws === null || ws === undefined) {
      return;
    }

    pager.querySelectorAll('li').forEach(function(li) {
      if (li.dataset.workspaceId === String(ws.id)) {
        li.classList.add('current');
      }
    });
  };

  return {
    server: function(s) {
      if (s === undefined) {
        return server.value;
      } else {
        server.value = s;
        return s;
      }
    },
    server_type: function(s) {
      if (s === undefined) {
        return checkedServerType();
      } else {
        var radio = serverType.querySelector('input[value="' + s + '"]');
        if (radio) {
          radio.checked = true;
        }
        return s;
      }
    },

    onServerChange: onServerChange,
    onServerTypeChange: onServerTypeChange,
    onWorkspaceChange: onWorkspaceChange,
    onWorkspaceReorder: onWorkspaceReorder,
    onWorkspaceSwitch: onWorkspaceSwitch,
    onWorkspaceAdd:    onWorkspaceAdd,
    onWorkspaceDelete: onWorkspaceDelete,
    workspaces: workspaces,
    workspace: workspace
  };
})();
