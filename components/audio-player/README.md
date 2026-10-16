# Audio Player

A responsive, Spotify-inspired audio player implemented as lightweight Web Components. It uses the browser's native audio engine and does not require a framework or streaming-service account.

## Files

- `audio-player.js` — `<ds-audio-player>` and `<ds-audio-track>` custom elements.
- `audio-player.css` — responsive player and playlist styles.

## Usage

Load the stylesheet and module, then declare tracks as children:

```html
<link rel="stylesheet" href="/components/audio-player/audio-player.css">
<script type="module" src="/components/audio-player/audio-player.js"></script>

<ds-audio-player volume="0.75">
  <ds-audio-track
    src="/audio/track-one.mp3"
    title="Track One"
    artist="Artist Name"
    album="Album Name"
    cover="/images/album-cover.jpg">
  </ds-audio-track>
  <ds-audio-track
    src="/audio/track-two.mp3"
    title="Track Two"
    artist="Another Artist"
    album="Another Album">
  </ds-audio-track>
</ds-audio-player>
```

Track attributes:

- `src` (required): URL of an audio file supported by the browser.
- `title`, `artist`, `album`, `cover`: optional display metadata.
- `volume` on the player: initial volume from `0` to `1`, default `0.75`.

## Features

- Play and pause, previous and next track.
- Seek bar with current time and duration.
- Volume control, mute at zero.
- Shuffle, repeat-all, repeat-one, and playlist selection.
- Like button UI state.
- Responsive layout, keyboard focus indicators, accessible labels, and reduced-motion support.
- Emits a bubbling `track-change` event with the track metadata and index.

Audio playback may require a user gesture depending on browser autoplay policies. Use audio URLs you have permission to distribute.
