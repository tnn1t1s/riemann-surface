// Plays a click per matching event. The click is synthesized with WebAudio,
// so no sound files are needed. Browsers keep audio suspended until the
// first user gesture on the page.
(function() {
  var audioContext = null;
  var clickBuffer = null;

  var ensureAudio = function() {
    if (! audioContext) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (! AC) { return null; }
      audioContext = new AC();

      // Short decaying noise burst: a geiger-style click.
      var length = Math.floor(audioContext.sampleRate * 0.03);
      clickBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
      var data = clickBuffer.getChannelData(0);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }

      var resume = function() {
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
      };
      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);
    }
    return audioContext;
  };

  var Geiger = function(json) {
    // Init
    view.View.call(this, json);

    this.clickFocusable = true;

    var self = this;

    // Config
    this.title = json.title;
    this.query = json.query;
    this.volume = parseFloat(json.volume || 0.2);
    this.sound = json.sound;
    this.muted = json.muted || false;

    // State
    this.currentEvent = null;

    // HTML
    this.el.appendChild(util.html(
        '<div class="box">' +
        '<h2 class="quickfit"></h2>' +
        '<button class="sound-mute" type="button">Mute</button><br />' +
        '</div>'
        ));

    this.box = this.el.querySelector('.box');
    this.el.querySelector('h2').textContent = this.title || '';

    this.mute_button = this.el.querySelector('.sound-mute');
    this.mute_button.textContent = this.muted ? 'Unmute' : 'Mute';
    this.mute_button.addEventListener('click', function() {
      self.muted = !self.muted;
      self.mute_button.textContent = self.muted ? 'Unmute' : 'Mute';
    });

    if (!json.virtual) {
      var ctx = ensureAudio();
      if (ctx) {
        this.gainer = ctx.createGain();
        this.gainer.gain.value = Math.pow(this.volume, 2);
        this.gainer.connect(ctx.destination);

        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = 0;
        this.compressor.knee.value = 0;
        this.compressor.ratio.value = 20;
        this.compressor.attack.value = 0;
        this.compressor.release.value = 2;
        this.compressor.connect(this.gainer);
      }

      if (this.query) {
        this.sub = subs.subscribe(this.query, function(e) {
          self.playSound();
          self.currentEvent = e;
        });
      }
    }
  };

  view.inherit(view.View, Geiger);
  view.Geiger = Geiger;
  view.types.Geiger = Geiger;

  Geiger.prototype.json = function() {
    return util.merge(view.View.prototype.json.call(this), {
      type: 'Geiger',
      title: this.title,
      query: this.query,
      volume: this.volume,
      sound: this.sound,
      muted: this.muted
    });
  };

  Geiger.prototype.playSound = function() {
    if (this.muted || ! audioContext || ! this.compressor) {
      return;
    }

    var source = audioContext.createBufferSource();
    source.buffer = clickBuffer;
    source.connect(this.compressor);
    source.start();
  };

  Geiger.prototype.editForm = function() {
    return "<label for='title'>Title</label>" +
      "<input type='text' name='title' value=\"" + util.esc(this.title) + "\" /><br />" +
      "<label for='query'>Query</label>" +
      '<textarea name="query" class="query">' + util.esc(this.query) + '</textarea>' +
      "<label for='volume'>Volume</label>" +
      "<input type='range' name='volume' min='0' max='1' step='0.05' value='" +
      util.esc(this.volume) + "' />";
  };

  Geiger.prototype.shutdownSound = function() {
    if (this.gainer) {
      this.gainer.disconnect();
      this.gainer = null;
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
  };

  Geiger.prototype.delete = function() {
    if (this.sub) {
      subs.unsubscribe(this.sub);
    }

    this.shutdownSound();
    return view.View.prototype.delete.call(this);
  };
})();
