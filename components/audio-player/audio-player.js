const icon = (name) => {
  const paths = {
    play: '<path d="m8 5 12 7-12 7z"/>',
    pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    previous: '<path d="M6 5h2v14H6zM20 6v12L9 12z"/>',
    next: '<path d="M16 5h2v14h-2zM4 6v12l11-6z"/>',
    shuffle: '<path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2.5c4.5 0 6.5-12 11-12H22M2 6h2.5c1.8 0 3.1 1.5 4.3 3.4M14 14.5c.7 1.6 1.6 3.5 3.5 3.5H22"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4zM17 9l5 6M22 9l-5 6"/>',
    queue: '<path d="M4 6h16M4 11h16M4 16h10M18 15v6m-3-3h6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
};

class DSAudioTrack extends HTMLElement {
  static observedAttributes = ['src', 'title', 'artist', 'album', 'cover'];

  connectedCallback() {
    this.hidden = true;
  }

  get track() {
    return {
      src: this.getAttribute('src') || '',
      title: this.getAttribute('title') || 'Untitled track',
      artist: this.getAttribute('artist') || 'Unknown artist',
      album: this.getAttribute('album') || '',
      cover: this.getAttribute('cover') || ''
    };
  }
}

if (!customElements.get('ds-audio-track')) customElements.define('ds-audio-track', DSAudioTrack);

class DSAudioPlayer extends HTMLElement {
  constructor() {
    super();
    this.tracks = [];
    this.index = 0;
    this.shuffle = false;
    this.repeat = 'off';
    this._listeners = [];
  }

  connectedCallback() {
    if (this.dataset.initialized === 'true') return;
    this.dataset.initialized = 'true';
    this.tracks = [...this.querySelectorAll('ds-audio-track')].map((node) => node.track);
    this.render();
    if (!this.tracks.length) {
      this.querySelector('.ds-player__empty').hidden = false;
      return;
    }
    this.audio = this.querySelector('audio');
    this.bindEvents();
    this.loadTrack(0, false);
    this.setVolume(Number(this.getAttribute('volume') ?? 0.75));
  }

  disconnectedCallback() {
    this._listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler));
    this._listeners = [];
    this.audio?.pause();
  }

  on(target, event, handler) {
    target.addEventListener(event, handler);
    this._listeners.push([target, event, handler]);
  }

  render() {
    this.innerHTML = `
      <section class="ds-player" aria-label="Audio player">
        <audio preload="metadata"></audio>
        <div class="ds-player__track">
          <div class="ds-player__cover" data-cover aria-hidden="true"><span>♪</span></div>
          <div class="ds-player__meta">
            <div class="ds-player__title" data-title>Choose a track</div>
            <div class="ds-player__artist" data-artist>Audio library</div>
          </div>
          <button class="ds-player__icon ds-player__like" type="button" data-action="like" aria-label="Like track" aria-pressed="false" title="Like track">♡</button>
        </div>
        <div class="ds-player__main">
          <div class="ds-player__controls">
            <button class="ds-player__icon" type="button" data-action="shuffle" aria-label="Shuffle" aria-pressed="false" title="Shuffle">${icon('shuffle')}</button>
            <button class="ds-player__icon" type="button" data-action="previous" aria-label="Previous track" title="Previous track">${icon('previous')}</button>
            <button class="ds-player__play" type="button" data-action="play" aria-label="Play" title="Play">${icon('play')}</button>
            <button class="ds-player__icon" type="button" data-action="next" aria-label="Next track" title="Next track">${icon('next')}</button>
            <button class="ds-player__icon" type="button" data-action="repeat" aria-label="Repeat off" aria-pressed="false" title="Repeat">${icon('repeat')}</button>
          </div>
          <div class="ds-player__timeline">
            <span data-current>0:00</span>
            <input data-seek class="ds-player__range ds-player__seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek audio" />
            <span data-duration>0:00</span>
          </div>
        </div>
        <div class="ds-player__extras">
          <button class="ds-player__icon ds-player__queue-toggle" type="button" data-action="queue" aria-label="Show playlist" aria-expanded="false" title="Playlist">${icon('queue')}</button>
          <div class="ds-player__volume-icon">${icon('volume')}</div>
          <input data-volume class="ds-player__range ds-player__volume" type="range" min="0" max="1" step="0.01" value="0.75" aria-label="Volume" />
        </div>
        <div class="ds-player__playlist" data-playlist hidden aria-label="Playlist"></div>
        <p class="ds-player__empty" hidden>No tracks found. Add one or more <code>ds-audio-track</code> elements.</p>
      </section>`;
  }

  bindEvents() {
    const q = (selector) => this.querySelector(selector);
    this.on(this, 'click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      switch (button.dataset.action) {
        case 'play': this.togglePlay(); break;
        case 'previous': this.previous(); break;
        case 'next': this.next(); break;
        case 'shuffle':
          this.shuffle = !this.shuffle;
          button.setAttribute('aria-pressed', String(this.shuffle));
          button.classList.toggle('is-active', this.shuffle);
          break;
        case 'repeat':
          this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
          button.setAttribute('aria-pressed', String(this.repeat !== 'off'));
          button.setAttribute('aria-label', `Repeat ${this.repeat}`);
          button.classList.toggle('is-active', this.repeat !== 'off');
          button.dataset.repeat = this.repeat;
          break;
        case 'like': {
          const liked = button.getAttribute('aria-pressed') !== 'true';
          button.setAttribute('aria-pressed', String(liked));
          button.classList.toggle('is-liked', liked);
          button.textContent = liked ? '♥' : '♡';
          break;
        }
        case 'queue': {
          const playlist = q('[data-playlist]');
          playlist.hidden = !playlist.hidden;
          button.setAttribute('aria-expanded', String(!playlist.hidden));
          break;
        }
      }
    });

    this.on(q('[data-seek]'), 'input', (event) => {
      if (Number.isFinite(this.audio.duration)) this.audio.currentTime = (Number(event.target.value) / 1000) * this.audio.duration;
    });
    this.on(q('[data-volume]'), 'input', (event) => this.setVolume(Number(event.target.value)));
    this.on(this.audio, 'timeupdate', () => this.updateTimeline());
    this.on(this.audio, 'loadedmetadata', () => this.updateTimeline());
    this.on(this.audio, 'play', () => this.updatePlayButton(true));
    this.on(this.audio, 'pause', () => this.updatePlayButton(false));
    this.on(this.audio, 'ended', () => {
      if (this.repeat === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else if (this.repeat === 'all' || this.index < this.tracks.length - 1 || this.shuffle) {
        this.next(true);
      } else {
        this.updatePlayButton(false);
      }
    });
    this.renderPlaylist();
  }

  loadTrack(index, autoplay = false) {
    if (!this.tracks.length) return;
    this.index = (index + this.tracks.length) % this.tracks.length;
    const track = this.tracks[this.index];
    this.audio.src = track.src;
    this.querySelector('[data-title]').textContent = track.title;
    this.querySelector('[data-artist]').textContent = track.artist;
    const cover = this.querySelector('[data-cover]');
    cover.replaceChildren();
    if (track.cover) {
      const image = document.createElement('img');
      image.src = track.cover;
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => { image.remove(); cover.textContent = '♪'; };
      cover.append(image);
    } else {
      cover.textContent = '♪';
    }
    this.querySelectorAll('.ds-player__playlist-item').forEach((item, i) => {
      item.classList.toggle('is-current', i === this.index);
      item.setAttribute('aria-current', i === this.index ? 'true' : 'false');
    });
    this.querySelector('[data-current]').textContent = '0:00';
    this.querySelector('[data-duration]').textContent = '0:00';
    this.querySelector('[data-seek]').value = '0';
    if (autoplay) this.audio.play().catch(() => this.updatePlayButton(false));
    this.dispatchEvent(new CustomEvent('track-change', { bubbles: true, detail: { ...track, index: this.index } }));
  }

  async togglePlay() {
    if (!this.audio || !this.tracks.length) return;
    if (this.audio.paused) {
      try { await this.audio.play(); } catch { this.updatePlayButton(false); }
    } else {
      this.audio.pause();
    }
  }

  previous() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.loadTrack(this.index === 0 ? this.tracks.length - 1 : this.index - 1, true);
  }

  next(fromEnded = false) {
    if (!this.tracks.length) return;
    let nextIndex;
    if (this.shuffle && this.tracks.length > 1) {
      do { nextIndex = Math.floor(Math.random() * this.tracks.length); } while (nextIndex === this.index);
    } else if (this.index < this.tracks.length - 1) {
      nextIndex = this.index + 1;
    } else if (this.repeat === 'all' || !fromEnded) {
      nextIndex = 0;
    } else {
      this.updatePlayButton(false);
      return;
    }
    this.loadTrack(nextIndex, true);
  }

  setVolume(value) {
    if (!this.audio) return;
    this.audio.volume = Math.max(0, Math.min(1, value));
    this.audio.muted = this.audio.volume === 0;
    const input = this.querySelector('[data-volume]');
    if (input) input.value = String(this.audio.volume);
    const volumeIcon = this.querySelector('.ds-player__volume-icon');
    if (volumeIcon) volumeIcon.innerHTML = icon(this.audio.muted ? 'mute' : 'volume');
  }

  updatePlayButton(playing) {
    const button = this.querySelector('[data-action="play"]');
    if (!button) return;
    button.innerHTML = icon(playing ? 'pause' : 'play');
    button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    button.title = playing ? 'Pause' : 'Play';
    this.classList.toggle('is-playing', playing);
  }

  updateTimeline() {
    if (!this.audio) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    const current = this.audio.currentTime || 0;
    this.querySelector('[data-current]').textContent = this.formatTime(current);
    this.querySelector('[data-duration]').textContent = this.formatTime(duration);
    this.querySelector('[data-seek]').value = String(duration ? Math.round((current / duration) * 1000) : 0);
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  renderPlaylist() {
    const list = this.querySelector('[data-playlist]');
    list.innerHTML = this.tracks.map((track, index) => `
      <button type="button" class="ds-player__playlist-item ${index === this.index ? 'is-current' : ''}" data-track-index="${index}" aria-current="${index === this.index ? 'true' : 'false'}">
        <span class="ds-player__playlist-number">${index === this.index ? '♫' : index + 1}</span>
        <span class="ds-player__playlist-copy"><span>${this.escape(track.title)}</span><small>${this.escape(track.artist)}</small></span>
        <span class="ds-player__playlist-album">${this.escape(track.album)}</span>
      </button>`).join('');
    this.on(list, 'click', (event) => {
      const item = event.target.closest('[data-track-index]');
      if (item) this.loadTrack(Number(item.dataset.trackIndex), true);
    });
  }

  escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
}

if (!customElements.get('ds-audio-player')) customElements.define('ds-audio-player', DSAudioPlayer);
