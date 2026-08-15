// Subscription manager. Each subscription opens a websocket (or SSE)
// connection directly to the Riemann server and feeds parsed events to a
// callback. TTL expiry is tracked locally: when an event's TTL elapses
// without a fresh event for the same host/service, a synthetic
// state="expired" event is emitted.
var subs = (function() {

  // What server shall we connect to by default?
  var server;

  // What type of connection should we emit ?
  var server_type;

  // Subscription ID counter.
  var id_counter = -1;

  // Subscriptions
  var subscriptions = {};

  // Switch to turn on/off event processing
  var active = true;

  // Error queue for notification
  var errorQueue = [];

  // Instrumentation
  var load1 = profile.load(1000);
  var load5 = profile.load(5000);

  // Get a new subscription ID.
  var newId = function() {
    return id_counter += 1;
  };

  // Closes a subscription and deletes it from the subscription manager.
  var unsubscribe = function(sub) {
    clock.unsubscribe(sub.clockSub);
    delete subscriptions[sub.id];
    return sub.close();
  };

  // Unsubscribe from all subscriptions.
  var unsubscribeAll = function() {
    Object.keys(subscriptions).forEach(function(id) {
      unsubscribe(subscriptions[id]);
    });
  };

  // Emit expired events for a subscription.
  var expire = function(sub, now) {
    sub.expiries.forEach(function(entry, key) {
      if (entry.expiry <= now) {
        sub.expiries.delete(key);
        sub.f({
          host: entry.host,
          service: entry.service,
          state: 'expired',
          time: entry.expiry
        });
      }
    });
  };

  var Subscription = function(id, query, f) {
    this.id = id;
    this.query = query;
    this.f = f;
    // eventKey -> {host, service, expiry (ms)}
    this.expiries = new Map();
    this.clockSub = false;
    this.ws = null;
  };

  Subscription.prototype.isOpen = function() {
    // WebSocket.CLOSED and EventSource.CLOSED are both 2.
    return !!(this.ws && this.ws.readyState !== 2);
  };

  Subscription.prototype.isClosed = function() {
    return ! this.isOpen();
  };

  Subscription.prototype.url = function() {
    var queryString = "query=" + encodeURIComponent(this.query);
    var loc = window.location;

    if (server_type === "sse") {
      return loc.protocol + "//" + server + "/index?" + queryString;
    } else {
      var ws_uri = (loc.protocol === "https:") ? "wss://" : "ws://";
      return ws_uri + server + "/index?subscribe=true&" + queryString;
    }
  };

  Subscription.prototype.open = function() {
    if (this.isOpen()) return this;

    console.log("will open url: " + this.url());

    var self = this;
    var ws;
    if (server_type === "sse") {
      ws = this.ws = new EventSource(this.url());
    } else {
      ws = this.ws = new WebSocket(this.url());
    }

    ws.onopen = function() {
      console.log("Socket opened", self.query);
    };

    ws.onclose = function() {
      console.log("Socket closed", self.query);
      self.ws = null;
    };

    ws.onerror = function(e) {
      console.log("Socket error", self.query);
      errorQueue.push(e);
      self.close();
    };

    ws.onmessage = function(e) {
      var t1 = Date.now();
      if (active) {
        var event = JSON.parse(e.data);
        event.time = Date.parse(event.time);
        clock.advance(event.time);

        // Update the local expiry index. Only live events carry a TTL.
        if (event.state !== "expired") {
          self.expiries.set(util.eventKey(event), {
            host: event.host,
            service: event.service,
            expiry: event.time + ((event.ttl || 60) * 1000)
          });
          self.f(event);
        }
      }
      var t2 = Date.now();
      load1(t1, t2);
      load5(t1, t2);
    };

    return this;
  };

  Subscription.prototype.close = function() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    return this;
  };

  // Add a subscription. Returns a subscription object. Subscriptions are
  // opened immediately.
  var subscribe = function(query, f) {
    var sub = new Subscription(newId(), query, f).open();
    subscriptions[sub.id] = sub;

    sub.clockSub = clock.subscribe(function(now) {
      expire(sub, now);
    });

    return sub;
  };

  // Reconnect all inactive subs.
  var converge = function() {
    Object.keys(subscriptions).forEach(function(id) {
      var sub = subscriptions[id];
      if (sub.isClosed()) {
        sub.open();
      }
    });
  };

  var notifyErrors = function() {
    if (errorQueue.length === 0) {
      return;
    }
    var errorString = (errorQueue.length === 1) ? "error" : "errors";
    toast.warning(errorQueue.length + " socket " + errorString +
                  "; check the server field above.");
    errorQueue.length = 0;
  };

  // Periodically notify of errors.
  window.setInterval(notifyErrors, 100);

  // Periodically converge.
  setInterval(converge, 6000);

  // When terminating, close all connections.
  window.addEventListener('pagehide', unsubscribeAll);

  return {
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    unsubscribeAll: unsubscribeAll,
    converge: converge,
    load1:   load1,
    load5:   load5,
    subs:    function() { return subscriptions; },
    enable:  function() { active = true; console.log("Subs enabled."); },
    disable: function() { active = false; console.log("Subs disabled."); },
    toggle:  function() {
      active = ! active;
      console.log(active ? "Subs enabled." : "Subs disabled.");
    },
    server:  function(s) {
      if (s === undefined) {
        return server;
      } else {
        server = s;
        return s;
      }
    },
    server_type: function(s) {
      if (s === undefined) {
        return server_type;
      } else {
        server_type = s;
        return s;
      }
    }
  };
})();
