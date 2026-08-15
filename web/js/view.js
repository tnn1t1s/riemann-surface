var view = (function() {
  var types = {};
  var focused = null;
  var focusOverlay = util.el('div', 'focusOverlay');
  focusOverlay.style.display = 'none';
  document.body.appendChild(focusOverlay);

  // Unfocus all views.
  var unfocus = function() {
    if (focused) {
      focused.unfocus();
    }
  };

  function createObject(parent) {
    function TempClass() {}
    TempClass.prototype = parent;
    return new TempClass();
  }

  function inherit(sup, sub) {
    var newSubPrototype = createObject(sup.prototype);
    newSubPrototype.constructor = sub;
    sub.prototype = newSubPrototype;
  }

  // Create *some* type of view from json
  var reify = function(json) {
    var t = types[json.type];
    if (! t) {
      console.log("Unknown view type", json.type);
      toast.error("Unknown view type: " + json.type);
      t = types.View;
    }
    return new t(json);
  };

  // Initialize keybindings
  function setKeyBindings() {
    var focusedBindings = {
      // left
      37: function(ev) {
        if (ev.ctrlKey === true) {
          focused.split('HStack', -1);
        } else {
          focused.moveHorizontal(-1);
        }
      },

      // up
      38: function(ev) {
        if (ev.ctrlKey === true) {
          focused.split('VStack', -1);
        } else {
          focused.moveVertical(-1);
        }
      },

      // right
      39: function(ev) {
        if (ev.ctrlKey === true) {
          focused.split('HStack', 1);
        } else {
          focused.moveHorizontal(1);
        }
      },

      // down
      40: function(ev) {
        if (ev.ctrlKey === true) {
          focused.split('VStack', 1);
        } else {
          focused.moveVertical(1);
        }
      },

      27: function() { focused.unfocus() },           // escape
      33: function() { if (focused.parent) {          // pgup
          focused.parent.focus();
      } },
      46: function() { focused.delete() },            // delete
      68: function() { focused.delete() },            // d

      69: function() { focused.edit() },              // e
      86: function() { focused.split('VStack', 1) },  // v
      72: function() { focused.split('HStack', 1) },  // h

      187: function() { focused.grow(); },             // +
      189: function() { focused.shrink(); },           // -
      107: function() { focused.grow(); },             // + (NumPad)
      109: function() { focused.shrink(); }            // - (NumPad)
    };

    Object.keys(focusedBindings).forEach(function(code) {
      var f = focusedBindings[code];
      keys.bind(code, function(ev) {
        if (focused) { f(ev); }
      });
    });
  }
  setKeyBindings();

  // View ////////////////////////////////////////////////////////////////////

  var View = function(json) {
    this.id = json.id || util.uniqueId();
    this.version = json.version || 0;
    this.type = json.type;
    this.el = util.el('div', 'view');
    this.weight = json.weight || 1;

    var self = this;
    this.clickFocusable = true;
    this.el.addEventListener('click', function(e) {
      if (e.ctrlKey || e.metaKey) {
        if (self.clickFocusable) {
          self.focus();
          e.stopPropagation();
        }
      }
    });
  };
  types.View = View;

  View.prototype.width = function(w) {
    if (w !== undefined) {
      this.el.style.width = w + 'px';
      return this;
    } else {
      return this.el.getBoundingClientRect().width;
    }
  };

  View.prototype.height = function(h) {
    if (h !== undefined) {
      this.el.style.height = h + 'px';
      return this;
    } else {
      return this.el.getBoundingClientRect().height;
    }
  };

  View.prototype.top = function(t) {
    if (t !== undefined) {
      this.el.style.top = t + 'px';
      return this;
    } else {
      return this.el.style.top;
    }
  };

  View.prototype.left = function(l) {
    if (l !== undefined) {
      this.el.style.left = l + 'px';
      return this;
    } else {
      return this.el.style.left;
    }
  };

  View.prototype.bumpVersion = function() {
    this.version = (this.version + 1) || 1;
    if (this.parent) {
      this.parent.bumpVersion();
    }
  };

  View.prototype.reflow = function() {
  };

  View.prototype.grow = function() {
    this.weight *= 2;
    this.parent.reflow();
    focused.refocus();
    this.bumpVersion();
  };

  View.prototype.shrink = function() {
    this.weight *= 0.5;
    this.parent.reflow();
    focused.refocus();
    this.bumpVersion();
  };

  // Replace this view with a different one. Returns replacement.
  View.prototype.replace = function(replacement) {
    var p = this.parent;

    if (p == null) {
      throw "Sorry, can't replace top-level views.";
    }

    if (p.replaceChild == null) {
      throw "Sorry, can't replace unless parent can replace child.";
    }

    p.replaceChild(this, replacement);

    return replacement;
  };

  // Unfocus this view and delete it permanently.
  View.prototype.delete = function() {
    this.unfocus();
    var p = this.parent;
    if (p) {
      if (p.removeChild) {
        p.removeChild(this);
      }
      p.reflow();
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  };

  // Remove us from our parent, and have them reflow.
  View.prototype.removeFromParent = function() {
    this.unfocus();
    var oldParent = this.parent;
    if (oldParent && oldParent.removeChild) {
      oldParent.removeChild(this);
      oldParent.reflow();
    }
  };

  // Split in a parent stack that already exists. i is either -1 (place the
  // new view before us) or +1 (place the new view after us).
  View.prototype.splitParentStack = function(i) {
    if (i === null) { i = 0; }
    var index = this.parent.indexOf(this) - Math.min(i, 0);
    this.parent.insertChild(
      index,
      reify({type: 'View'})
    );
    this.parent.reflow();
    this.refocus();
  };

  // Split into a stackType. i is either -1 (place the new view before us) or
  // +1 (place the new view after us).
  View.prototype.split = function(stackType, i) {
    var parent = this.parent;
    if (parent) {
      if (parent.type === stackType) {
        this.splitParentStack(i);
      } else if (parent.replaceChild) {
        // Replace self with stack
        var stack = reify({
          type: stackType,
          weight: this.weight
        });
        parent.replaceChild(this, stack);

        // Add self to stack
        this.weight = 1;
        if (i === -1) {
          stack.addChild(this);
          stack.addChild(new View({type: 'View'}));
        } else {
          stack.addChild(new View({type: 'View'}));
          stack.addChild(this);
        }

        // Redraw
        parent.reflow();
        this.refocus();
      } else {
        console.log("Can't split: parent can't replace child.");
      }
    } else {
      console.log("Can't split: no parent");
    }
  };

  // Redraw the focus indicator
  View.prototype.refocus = function() {
    var rect = this.el.getBoundingClientRect();
    focusOverlay.style.width = rect.width + 'px';
    focusOverlay.style.height = rect.height + 'px';
    focusOverlay.style.top = (rect.top + window.scrollY) + 'px';
    focusOverlay.style.left = (rect.left + window.scrollX) + 'px';
    focusOverlay.style.display = 'block';
  };

  // Focus this view
  View.prototype.focus = function() {
    if (focused !== null) {
      focused.unfocus();
    }
    this.el.classList.add("focused");
    this.refocus();
    focused = this;
  };

  // Unfocus this view
  View.prototype.unfocus = function() {
    focusOverlay.style.display = 'none';
    if (this.el) {
      this.el.classList.remove("focused");
    }
    if (focused === this) {
      focused = null;
    }
  };

  // Returns the nearest parent hstack
  View.prototype.enclosingHStack = function() {
    try {
      if (this.parent.isHStack) {
        return {
          i: this.parent.indexOf(this),
          stack: this.parent
        };
      } else {
        return this.parent.enclosingHStack();
      }
    } catch(e) {
      return null;
    }
  };

  // Returns the nearest parent vstack
  View.prototype.enclosingVStack = function() {
    try {
      if (this.parent.isVStack) {
        return {
          i: this.parent.indexOf(this),
          stack: this.parent
        };
      } else {
        return this.parent.enclosingVStack();
      }
    } catch(e) {
      return null;
    }
  };

  // Move a view, by delta (-1 or +1) within the enclosing stack.
  View.prototype.move = function(parentFinder, delta) {
    var enclosing = this[parentFinder]();

    if (enclosing) {
      var stack = enclosing.stack;
      var i = enclosing.i;

      var newI = i + delta;
      if (newI < 0) {
        newI = 0;
      } else if (newI >= stack.children.length) {
        newI = stack.children.length;
      } else {
        // What's there now?
        var neighbor = stack.children[newI];
        if (neighbor && neighbor.addChild) {
          // We can enter our neighbor
          this.removeFromParent();
          neighbor.addChild(this);
          neighbor.reflow();
          this.focus();
          this.bumpVersion();
          return;
        }
      }

      if (this.parent === stack &&
        stack.children.length === 1) {
          // A special case: we can't leave our parent and then re-enter it,
          // because removeFromParent() would *destroy* our parent after we
          // left. Nothing *needs* to happen, so we return immediately.
        return;
      }

      // We're moving to a new position inside the enclosing stack.
      this.removeFromParent();
      stack.insertChild(newI, this);
      stack.reflow();
      this.focus();
      this.bumpVersion();
    } else {
      console.log("Sorry, not yet");
    }
  };

  View.prototype.moveHorizontal = function(delta) {
    this.move('enclosingHStack', delta);
  };

  View.prototype.moveVertical = function(delta) {
    this.move('enclosingVStack', delta);
  };

  // A DOM node inserted into the edit modal, for changing the
  // properties of a view. Subclasses return an HTML string or element.
  View.prototype.editForm = function() {
    return null;
  };

  // Show a dialog for changing this view.
  View.prototype.edit = function() {
    var dialog = util.html(
      '<div><h1></h1><form>' +
      '<select name="type"></select>' +
      '<div class="edit-form"></div>' +
      '<button name="apply">Apply</button>' +
      '</form></div>');
    dialog.querySelector('h1').textContent = "Edit " + this.type;

    // The serialized representation of a view that we're editing.
    // Carried between various view types; when Apply is clicked, projected
    // into an actual view.
    var replacementJson = this.json();
    replacementJson.virtual = true;

    // Build type selector.
    var typeSelector = dialog.querySelector('select[name=type]');
    var editForm = dialog.querySelector('.edit-form');
    Object.keys(types).forEach(function(type) {
      var option = util.el('option', null, type);
      if (type === replacementJson.type) {
        option.selected = true;
      }
      typeSelector.appendChild(option);
    });

    // Update the replacement structure with the current values.
    var mergeCurrentValues = function() {
      dialog.querySelectorAll('input[name], select[name], textarea[name]')
        .forEach(function(input) {
          if (input.type === 'checkbox') {
            replacementJson[input.name] = input.checked;
          } else {
            replacementJson[input.name] = input.value;
          }
        });
    };

    var renderEditForm = function() {
      editForm.textContent = '';
      var contents = reify(replacementJson).editForm();
      if (typeof contents === 'string') {
        var wrapper = util.el('div');
        wrapper.innerHTML = contents;
        contents = wrapper;
      }
      if (contents) {
        editForm.appendChild(contents);
      }
    };

    // Add the edit form itself.
    renderEditForm();

    // Handle type changes.
    typeSelector.addEventListener('change', function() {
      mergeCurrentValues();
      renderEditForm();
    });

    // Apply button.
    var me = this;
    dialog.querySelector('button[name=apply]').addEventListener('click', function(e) {
      // Don't submit the form.
      e.preventDefault();

      // Read fields
      mergeCurrentValues();

      // Replace view.
      delete replacementJson.virtual;
      var replacement = me.replace(reify(replacementJson));
      replacement.bumpVersion();

      // Reflow
      replacement.parent.reflow();

      // Clean up view
      me.delete();
      replacement.focus();

      // Close dialog.
      modal.close();
    });

    // Show dialog.
    modal.open(dialog);
  };

  // Serialize this view to JSON.
  View.prototype.json = function() {
    return {type:     'View',
            weight:   this.weight,
            id:       this.id,
            version:  this.version};
  };

  // Balloon /////////////////////////////////////////////////////////////////

  var Balloon = function(json) {
    View.call(this, json);
    this.container = json.container;
    this.clickFocusable = false;
    this.el.remove();
    this.container.appendChild(this.el);

    this.child = reify(json.child);
    this.child.parent = this;
    this.el.appendChild(this.child.el);
  };
  inherit(View, Balloon);
  types.Balloon = Balloon;

  Balloon.prototype.json = function() {
    return util.merge(View.prototype.json.call(this), {
      type: 'Balloon',
      child: this.child.json()
    });
  };

  Balloon.prototype.replaceChild = function(v1, v2) {
    this.child.parent = null;
    this.child.el.remove();

    this.child = v2;
    v2.parent = this;
    this.el.appendChild(this.child.el);
  };

  Balloon.prototype.removeChild = function(c) {
    this.child = null;
  };

  Balloon.prototype.reflow = function() {
    var rect = this.container.getBoundingClientRect();
    this.width(rect.width);
    this.height(rect.height);
    if (this.child) {
      this.child.width(rect.width);
      this.child.height(rect.height);
      this.child.reflow();
    }
  };

  Balloon.prototype.delete = function() {
    if (this.child) {
      this.child.delete();
    }
    View.prototype.delete.call(this);
  };

  // Fullscreen //////////////////////////////////////////////////////////////

  var Fullscreen = function(json) {
    Balloon.call(this, json);
    this.el.remove();
    this.el.style.position = 'fixed';
    document.body.appendChild(this.el);
    this.parent = null;
  };
  inherit(Balloon, Fullscreen);
  types.Fullscreen = Fullscreen;

  Fullscreen.prototype.json = function() {
    return util.merge(
      Balloon.prototype.json.call(this),
      {type: 'Fullscreen'});
  };

  Fullscreen.prototype.reflow = function() {
    this.width(window.innerWidth);
    this.height(window.innerHeight);
    this.child.width(window.innerWidth);
    this.child.height(window.innerHeight);
    this.child.reflow();
  };

  // Stack ///////////////////////////////////////////////////////////////////

  var Stack = function(json) {
    View.call(this, json);
    this.clickFocusable = false;
    this.children = [];
    var self = this;
    if (json.children !== undefined) {
      json.children.map(reify).forEach(function(c) {
        self.addChild(c);
      });
    }
  };
  inherit(View, Stack);

  Stack.prototype.json = function() {
    return util.merge(View.prototype.json.call(this), {
      type: 'Stack',
      children: this.children.map(function(x) { return x.json(); })
    });
  };

  Stack.prototype.addChild = function(v) {
    v.parent = this;
    this.children.push(v);
    this.el.appendChild(v.el);
  };

  Stack.prototype.insertChild = function(i, v) {
    v.parent = this;
    this.children.splice(i, 0, v);
    this.el.appendChild(v.el);
  };

  // Replace v1 with v2
  Stack.prototype.replaceChild = function(v1, v2) {
    v1.parent = null;
    v2.parent = this;
    v1.el.remove();
    var i = this.children.indexOf(v1);
    this.children[i] = v2;
    this.el.appendChild(v2.el);
  };

  Stack.prototype.removeChild = function(v) {
    v.parent = null;
    var i = this.children.indexOf(v);
    v.el.remove();
    this.children.splice(i, 1);

    // Delete self if empty
    if (this.children.length === 0) {
      this.delete();
    }
  };

  Stack.prototype.indexOf = function(child) {
    return this.children.indexOf(child);
  };

  Stack.prototype.delete = function() {
    this.children.slice().forEach(function(c) {
      c.delete();
    });
    View.prototype.delete.call(this);
  };

  // HStack //////////////////////////////////////////////////////////////////

  var HStack = function(json) {
    Stack.call(this, json);
  };
  inherit(Stack, HStack);
  types.HStack = HStack;

  HStack.prototype.json = function() {
    return util.merge(Stack.prototype.json.call(this), {type: 'HStack'});
  };

  HStack.prototype.isHStack = true;

  HStack.prototype.reflow = function() {
    if (this.el === null) {
      // We're gone.
      return;
    }

    var width = this.width();
    var height = this.height();
    var left = 0;
    var weightSum = this.children.reduce(function(acc, c) {
      return acc + c.weight;
    }, 0);

    this.children.forEach(function(c) {
      c.height(height);
      c.width(width * (c.weight / weightSum));
      c.top(0);
      c.left(left);
      left = left + c.width();
      c.reflow();
    });
  };

  // VStack //////////////////////////////////////////////////////////////////

  var VStack = function(json) {
    Stack.call(this, json);
  };
  inherit(Stack, VStack);
  types.VStack = VStack;

  VStack.prototype.json = function() {
    return util.merge(Stack.prototype.json.call(this), {type: 'VStack'});
  };

  VStack.prototype.isVStack = true;

  VStack.prototype.reflow = function() {
    if (this.el === null) {
      // We're gone.
      return;
    }

    var width = this.width();
    var height = this.height();
    var top = 0;
    var weightSum = this.children.reduce(function(acc, c) {
      return acc + c.weight;
    }, 0);

    this.children.forEach(function(c) {
      c.width(width);
      c.height(height * (c.weight / weightSum));
      c.left(0);
      c.top(top);
      top = top + c.height();
      c.reflow();
    });
  };

  return util.merge({
      types: types,
      reify: reify,
      inherit: inherit,
      unfocus: unfocus,
      focused: function() { return focused; }
  }, types);
})();
