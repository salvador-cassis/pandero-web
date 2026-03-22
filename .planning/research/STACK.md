# Technology Stack

**Project:** Dairapp Web — Browser-based independent pitch/tempo control for cueca chilena backing tracks
**Researched:** 2026-03-22

---

## Decision Summary

The central technical decision is which library handles independent pitch-shifting and time-stretching in the browser. Everything else (MP3 loading, playback, UI) is native Web API or trivial vanilla JS.

**Recommendation: `@soundtouchjs/audio-worklet` v1.0.8 as the primary processing engine.**

RubberBand WASM is the quality alternative but carries integration overhead that is not justified for this project's scope (a single fixed MP3, moderate tempo range, no offline export). SoundTouchJS's known gap artifact at extreme tempos is mitigated by the playbackRate workaround and does not apply within the realistic practice range (0.5x–1.5x original tempo).

---

## Recommended Stack

### Core Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@soundtouchjs/audio-worklet` | 1.0.8 | Independent pitch and tempo control | Actively maintained (last release March 18, 2026), off-main-thread AudioWorkletProcessor, JS/TS — no WASM binary to serve, MIT/LGPL-2.1 license. The known gap artifact at high tempos is resolved via the playbackRate workaround. Aligns with the WSOLA algorithm already validated on iOS via the SoundTouch C++ lineage. |
| `@soundtouchjs/core` | 1.0.8 | Dependency of audio-worklet; includes PitchShifter primitives | Bundled automatically when using audio-worklet package |
| Web Audio API (native) | — | Audio graph, decoding, routing | Built into every modern browser. `decodeAudioData()` handles MP3 natively — no external decoder needed. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Plain HTML + vanilla JS | ES2020+ | App shell, UI, event handling | Project constraint. No build step needed for v1; script modules via `<script type="module">` give clean imports without a bundler. |
| `fetch()` + `decodeAudioData()` | native | Load and decode the fixed MP3 | No library needed. Standard pattern: `fetch(url) → arrayBuffer() → audioCtx.decodeAudioData()`. |
| No server | — | Static file hosting | All processing is client-side. Files can be served from the existing HTML site with no backend. |

### Supporting Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unmute-ios-audio` (feross) | latest | Unlock Web Audio on iOS when mute switch is on | Use it. Safari iOS silences Web Audio — not `<audio>` tags — when the hardware mute switch is engaged. A single tiny script call on page load handles this transparently. |

---

## The Time-Stretching Decision in Detail

This is the only genuinely difficult choice in the stack. Three serious candidates exist.

### Option A (Recommended): `@soundtouchjs/audio-worklet`

**What it is:** A JavaScript AudioWorklet wrapping the WSOLA-based SoundTouch algorithm.

**Algorithm:** WSOLA (Waveform Similarity Overlap-Add). Operates in the time domain. Fast, well-understood for rhythmic material like percussion (pandero).

**Strengths:**
- Pure JS/TS — no WASM binary, no special server headers, no SharedArrayBuffer cross-origin isolation requirements
- Runs on the audio rendering thread (AudioWorkletProcessor) — no main-thread blocking
- Actively maintained: monorepo TypeScript rewrite, v1.0.8 released March 18, 2026
- `pitchSemitones`, `tempo`, and `playbackRate` all exposed as AudioParam objects
- The gap-at-high-tempo problem is known and officially mitigated: drive `playbackRate` on the source node and let SoundTouch only handle pitch correction, not full time-stretching in tiny blocks

**Known limitation:** At tempos significantly above 1.0 (e.g., 1.5x–2.0x), SoundTouch running in 128-sample AudioWorklet blocks cannot produce enough output samples per render quantum, which causes audible gaps. The mitigation — using `playbackRate` on the `AudioBufferSourceNode` to feed audio faster, then having SoundTouch correct only the pitch — resolves this cleanly. For a cueca practice tool where 1.5x speed is a realistic maximum, this is a solved problem.

**Licensing:** LGPL-2.1 (new monorepo). No commercial licensing fee.

**Confidence:** HIGH — version and release dates verified against GitHub releases page (March 18, 2026).

---

### Option B (Not Recommended for v1): `rubberband-wasm`

**What it is:** The Rubber Band C++ library (used in the iOS version) compiled to WebAssembly.

**Algorithm:** Phase vocoder with high-quality pitch mode. Produces perceptibly higher quality output than WSOLA/SoundTouch, especially on complex polyphonic material and at extreme ratios.

**Why not for v1:**
1. **Integration overhead.** The Daninet package (`rubberband-wasm@3.3.0`, last published December 23, 2024) provides only the WASM core — no AudioWorklet wrapper is included. You must write the AudioWorklet + WebWorker scaffolding yourself, or use `rubberband-web` (delude88), which was last committed around September 2022 and is effectively unmaintained.
2. **WASM serving requirements.** The `.wasm` binary must be fetched separately. WASM with SIMD (for quality performance) requires appropriate MIME types. Some CDN configurations need attention.
3. **SharedArrayBuffer / COOP headers.** High-performance WASM communication between AudioWorklet and main thread benefits from `SharedArrayBuffer`, which requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. These are non-trivial to configure on an existing static HTML site.
4. **Quality delta is minor for this material.** The pandero (frame drum) is a rhythmic mono/stereo percussion source. SoundTouch's WSOLA performs well on rhythmic material. The perceptual quality gap vs Rubber Band at the tempo ratios used for practice (0.5x–1.5x) is small.
5. **GPL-2.0 license.** Commercial use requires a paid license from Breakfast Quay. The project is free/public, but this adds a compliance question.

**When to reconsider:** If v2 adds polyphonic instruments (guitar, accordion) and user feedback identifies quality artifacts at extreme ratios, Rubber Band WASM becomes the right upgrade path. The iOS precedent makes this a natural migration.

**Confidence:** HIGH on the described limitations. MEDIUM on the quality gap for percussion material specifically.

---

### Option C (Do Not Use): Native Web Audio API only

**What it is:** `AudioBufferSourceNode.playbackRate` changes tempo but also changes pitch proportionally. `HTMLMediaElement.preservesPitch` (on `<audio>` elements) decouples pitch from `playbackRate`, but uses the browser's internal algorithm (quality varies wildly; typically low-quality in Safari).

**Why not:** Does not provide independent control. `preservesPitch` quality is browser-dependent and not configurable. This is not time-stretching — it is simply rate transposition with a pitch correction hack. Unsuitable.

---

### Option D (Do Not Use): `soundtouchjs` (legacy, `soundtouchjs@0.2.1`)

The legacy single-package `soundtouchjs` uses `ScriptProcessorNode`, which is deprecated in the Web Audio spec and performs processing on the main thread, causing jank. Use the new monorepo packages instead.

---

## Installation

### Via npm (if using a bundler or import map)

```bash
npm install @soundtouchjs/audio-worklet @soundtouchjs/core
```

### Via CDN (no build step — fits the project constraint)

```html
<!-- Audio Worklet processor — must be served as a separate file -->
<!-- Copy node_modules/@soundtouchjs/audio-worklet/dist/soundtouch-worklet.js
     to your public assets, then register it: -->
<script type="module">
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Unlock on iOS (mute switch + user gesture)
  document.addEventListener('click', () => audioCtx.resume(), { once: true });

  await audioCtx.audioWorklet.addModule('/assets/soundtouch-worklet.js');

  const response = await fetch('/audio/pandero.mp3');
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // SoundTouchNode wraps AudioBufferSourceNode + the worklet
  // See @soundtouchjs/audio-worklet README for full instantiation pattern
</script>
```

Note: `@soundtouchjs/audio-worklet` v1.0.8 is ESM-only. If serving from a CDN without a bundler, use an import map or esm.sh. Example with esm.sh:

```html
<script type="importmap">
{
  "imports": {
    "@soundtouchjs/audio-worklet": "https://esm.sh/@soundtouchjs/audio-worklet@1.0.8",
    "@soundtouchjs/core": "https://esm.sh/@soundtouchjs/core@1.0.8"
  }
}
</script>
```

The worklet processor file still needs to be self-hosted (AudioWorklet modules cannot be loaded cross-origin from most CDNs due to CORS and worklet module constraints).

---

## Browser Compatibility

| Browser | Web Audio API | AudioWorklet | Notes |
|---------|--------------|-------------|-------|
| Chrome 66+ | Full | Full | Reference implementation. No issues. |
| Firefox 76+ | Full | Full | No issues. |
| Edge 79+ (Chromium) | Full | Full | No issues. |
| Safari 14.1+ (macOS) | Full | Full | Requires user gesture to resume AudioContext. |
| iOS Safari 14.5+ | Full | Partial/buggy | AudioWorklet supported since 14.5. Known bugs reported in iOS 17–18 (2024). Must call `audioCtx.resume()` inside user gesture. Max 4 AudioContext instances per page. |
| iOS Safari < 14.5 | Partial | None | Do not target. Too old for current deployment. |

**iOS-specific requirements (HIGH confidence — widely documented):**
1. `AudioContext` must be created or resumed inside a user gesture handler (click/touchend). Create on first tap; do not auto-play.
2. Apply `unmute-ios-audio` to handle the hardware mute switch (the ringer switch silences Web Audio but not `<audio>` elements — this is a Safari quirk).
3. Keep a single `AudioContext` instance for the lifetime of the page.
4. Test on a real iOS device. iOS Simulator does not accurately reproduce Web Audio behavior.

---

## What NOT to Use

| Option | Reason to Avoid |
|--------|----------------|
| `soundtouchjs@0.2.1` (legacy) | Uses deprecated `ScriptProcessorNode` (main thread). Abandoned in favor of the monorepo. |
| `rubberband-web` (delude88) | Last commit September 2022. Effectively unmaintained. No releases published. |
| Native `preservesPitch` + `playbackRate` | Not true time-stretching. Quality is browser-defined (very poor in Safari). No independent pitch control. |
| Phase vocoder in raw JS | DIY implementations (e.g., `danigb/timestretch`) are research-grade, unmaintained, and lack production AudioWorklet integration. |
| Superpowered SDK | Commercial license required. Overkill for a single fixed MP3 use case. |
| Any server-side processing | Project constraint: no backend. All audio must process client-side. |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| SoundTouchJS v1.0.8 version/date | HIGH | GitHub releases page verified March 18, 2026 |
| rubberband-wasm v3.3.0 version/date | HIGH | jsDelivr npm metadata verified December 23, 2024 |
| SoundTouchJS gap artifact + mitigation | HIGH | Official npm package documentation |
| iOS AudioContext user gesture requirement | HIGH | Multiple official sources, MDN, Apple Developer Forums |
| iOS mute switch Web Audio behavior | HIGH | Multiple independent sources |
| AudioWorklet iOS 17-18 bugs | MEDIUM | Apple Developer Forums reports; not confirmed in official WebKit release notes |
| Rubber Band quality advantage for percussion specifically | MEDIUM | General DSP knowledge; no browser-specific benchmark for pandero |
| rubberband-web (delude88) maintenance status | HIGH | Last commit date public on GitHub |

---

## Sources

- [SoundTouchJS GitHub releases](https://github.com/cutterbl/SoundTouchJS/releases) — version and date verified
- [SoundTouchJS npm — @soundtouchjs/audio-worklet](https://www.npmjs.com/package/@soundtouchjs/audio-worklet)
- [rubberband-wasm on jsDelivr](https://www.jsdelivr.com/package/npm/rubberband-wasm) — v3.3.0, December 2024
- [Daninet/rubberband-wasm GitHub](https://github.com/Daninet/rubberband-wasm)
- [delude88/rubberband-web GitHub](https://github.com/delude88/rubberband-web)
- [MDN: BaseAudioContext.decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [MDN: HTMLMediaElement.preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)
- [AudioWorklet not playing on iOS 18 — Apple Developer Forums](https://developer.apple.com/forums/thread/768347)
- [feross/unmute-ios-audio](https://github.com/feross/unmute-ios-audio)
- [pitchtech.ch — Audio Time Stretching Algorithm Comparison](https://pitchtech.ch/tstest/index.html)
- [Rubber Band Library official site](https://breakfastquay.com/rubberband/)
