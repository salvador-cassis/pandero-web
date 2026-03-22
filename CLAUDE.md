# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pandero Web is an embeddable backing track widget for practicing cueca chilena. It plays a fixed pandero MP3 with independent pitch and tempo control (no framework, no server, no build step). The widget drops into any existing HTML page with two lines.

**Current state:** Pre-code. Phase 1 (Audio Engine Foundation) not yet started. All technical decisions are documented in `planning/`.

## Development Server

AudioWorklet requires a Secure Context — **never open `file://` directly**. Always serve via localhost:

```sh
npx serve .
# or
python3 -m http.server
```

Verify the context is secure on init: `window.isSecureContext` must be `true`. If not, the worklet will fail with a vague `DOMException`.

## Architecture

Three-layer, single-thread-friendly design:

```
HOST PAGE
  └── player.js (UI + Audio Graph, main thread)
        ├── Asset Loader: fetch(mp3) → ArrayBuffer on page load
        │   then decodeAudioData() on first user gesture
        ├── Audio Graph:
        │   AudioBufferSourceNode → SoundTouchNode → AudioContext.destination
        └── AudioWorklet thread: soundtouch-processor.js
            (SoundTouchProcessor — off main thread, handles pitch/tempo)
```

**Threading rule:** Main thread wires the graph and writes `AudioParam` values. The AudioWorklet thread runs the SoundTouch algorithm on 128-sample blocks. No WebWorker needed — AudioWorklet IS the audio rendering thread.

## File Layout (target after Phase 1)

```
pandero/
  player.js                  # widget logic (Phase 2+)
  player.css                 # scoped styles (Phase 3)
  poc.js                     # Phase 1 PoC only
  poc.html                   # Phase 1 PoC shell
  pandero.mp3                # fixed audio asset (move from root in Phase 1)
  soundtouch-processor.js    # AudioWorklet processor (copied from npm dist)
planning/                    # GSD workflow — roadmap, plans, research
```

## Critical Implementation Rules

**AudioContext creation:** Always inside a user gesture handler (click/tap). Never on page load. iOS Safari does not reliably resume a context created early.

**Gap artifact mitigation (non-negotiable):** When changing tempo, set BOTH:
```js
source.playbackRate.value = ratio;
stNode.playbackRate.value = ratio;   // NOT stNode.tempo.value
```
SoundTouch corrects pitch only; the source node feeds samples at the right rate. Using `stNode.tempo` alone creates audible silence gaps at ratios > 1.0.

**Self-hosted worklet:** `soundtouch-processor.js` must be served from the same origin. `addModule()` is blocked cross-origin — CDN URLs will fail.

**Single AudioContext per widget:** Safari caps at 4 per page. Store as a closure singleton; never create a second one.

**iOS mute switch:** Use `unmute-ios-audio` (feross) on first user gesture. Cannot be simulated in browser DevTools — requires real iOS hardware for Phase 1 verification.

**MP3 pre-fetch strategy:** Start `fetch('pandero.mp3')` at widget init (before user gesture) to hide network latency. Only call `decodeAudioData()` after `new AudioContext()` is created inside the click handler.

**Pandero base BPM:** 111 BPM, time signature 3/4–6/8. Use as denominator for all tempo ratio → BPM display calculations in Phase 2.

## Library

`@soundtouchjs/audio-worklet` v1.0.8 — do not use legacy `soundtouchjs@0.2.1` (ScriptProcessorNode, deprecated, main-thread). Do not use `rubberband-web` (dead, WASM-heavy, no CDN path).

## Embedding Contract (Phase 3 target)

```html
<link rel="stylesheet" href="/pandero/player.css">
<div id="pandero-player"></div>
<script src="/pandero/player.js"></script>
```

`player.js` self-initializes on `#pandero-player`. All CSS selectors prefixed `pandero-`. No global scope pollution (IIFE or ES module).

## Planning Documents

- `planning/PROJECT.md` — scope, constraints, out-of-scope
- `planning/ROADMAP.md` — 4 phases with success criteria and plan list
- `planning/research/ARCHITECTURE.md` — full architecture rationale and anti-patterns
- `planning/research/PITFALLS.md` — 16+ documented browser audio pitfalls
- `planning/phases/01-*/` — executable plans for Phase 1
