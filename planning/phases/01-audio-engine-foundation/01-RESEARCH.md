# Phase 1: Audio Engine Foundation - Research

**Researched:** 2026-03-22
**Domain:** Web Audio API / AudioWorklet / SoundTouchJS v1.0.8 / iOS Safari audio
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Base BPM = 111 BPM
- **D-02:** Time signature: 3/4 — 6/8 (cueca rhythmic feel)
- This value is the denominator for all tempo ratio → BPM display calculations in Phase 2

### Claude's Discretion
- Library delivery mechanism (CDN via importmap, local copy, or minimal build step)
- Local dev server choice (`python3 -m http.server`, `npx serve`, etc.)
- Proof-of-concept page structure (minimal raw HTML controls, no styling)
- SoundTouch WSOLA parameter tuning for percussion material (`setSequenceLengthMs`, `setSeekWindowLengthMs`, `setOverlapLengthMs`)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Pandero MP3 loads and decodes in the browser without a server | `fetch()` + `decodeAudioData()` pattern verified; pandero.mp3 is 52KB, ~6.6s, decodes to ~2.2MB PCM — safe for mobile |
| ENG-02 | Tempo can be changed independently from pitch (real time-stretching) | `SoundTouchNode.tempo` + `source.playbackRate` tandem pattern verified in processor source |
| ENG-03 | Pitch can be changed independently from tempo (real pitch-shifting) | `SoundTouchNode.pitchSemitones` verified in type definitions and README |
| ENG-04 | Audio plays in a continuous loop automatically | `AudioBufferSourceNode.loop = true` — seamless loop for short files verified |
| ENG-05 | AudioContext is created inside a user gesture (browser autoplay policy) | Lazy creation pattern documented in PITFALLS.md and ARCHITECTURE.md |
| ENG-06 | Audio plays on iOS even when the mute switch is engaged | `unmute-ios-audio` v3.3.0 (feross) — call pattern and mechanism verified from source |
</phase_requirements>

---

## Summary

Phase 1 delivers a minimal proof-of-concept HTML page: load `pandero.mp3`, run it through the `@soundtouchjs/audio-worklet` AudioWorklet pipeline, expose raw tempo and pitch controls, and verify everything works on real iOS hardware with the hardware mute switch engaged.

The entire technical risk of the project lives in this phase. If the AudioWorklet pipeline works end-to-end on iOS Safari — with the mute switch on — every subsequent phase is straightforward HTML/CSS work. The prior project research is thorough and HIGH confidence; this phase research digs into the exact API surface, exact file delivery mechanism, and exact code patterns needed to write the implementation without guessing.

**Key findings from phase-specific investigation:** The `@soundtouchjs/audio-worklet` v1.0.8 package ships four dist files. The main-thread API (`SoundTouchNode`) uses relative imports between them — it cannot be used as a single CDN file drop-in. The processor file (`soundtouch-processor.js`) IS fully self-contained (no imports). The recommended delivery is: esm.sh for the main-thread module via importmap, plus a manually copied `soundtouch-processor.js` served locally. The `unmute-ios-audio` v3.3.0 package is CommonJS but is available on esm.sh as an ESM default export. The `pandero.mp3` file is already in the repo root at 52KB / ~6.6s — extremely short, will decode to ~2.2MB PCM (well within mobile limits), and looping will be seamless with `loop = true`.

**Primary recommendation:** Use importmap + esm.sh for the main-thread module import, copy `soundtouch-processor.js` from the npm package into `dairapp/`, and call `unmuteAudio()` once at the top of the module. Run dev with `python3 -m http.server`. Test on a real iPhone early.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@soundtouchjs/audio-worklet` | 1.0.8 | Time-stretching + pitch-shifting engine | Only actively maintained AudioWorklet-based SoundTouch package; March 18, 2026 release; no WASM; LGPL-2.1 |
| Web Audio API | native | AudioContext, AudioBufferSourceNode, decoding | Built into every target browser; `decodeAudioData()` handles MP3 natively |
| `unmute-ios-audio` | 3.3.0 | iOS hardware mute switch mitigation | Feross library; MIT license; single call; widely deployed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| esm.sh CDN | — | Serve `@soundtouchjs/audio-worklet` as ESM without npm install | Phase 1 PoC delivery; avoids any npm/build step on the project itself |
| `python3 -m http.server` | stdlib | Local dev HTTP server | AudioWorklet requires Secure Context; `file://` silently breaks `addModule()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esm.sh importmap | Local copy of all 4 dist files | Local copy is more resilient; importmap is zero-setup. Either works. For Phase 1 PoC, importmap is faster. |
| esm.sh importmap | Minimal `npm install` step + copy | npm step is one command; fine for Phase 1. More reproducible than CDN. |
| `unmute-ios-audio` via esm.sh | Copy `index.js` locally | Both work; esm.sh converts the CommonJS module cleanly |

**Installation (npm approach if chosen):**

```bash
npm install @soundtouchjs/audio-worklet@1.0.8 unmute-ios-audio@3.3.0
# Then copy:
cp node_modules/@soundtouchjs/audio-worklet/dist/soundtouch-processor.js dairapp/
```

**Version verification:** Verified March 22, 2026 against npm registry.

- `@soundtouchjs/audio-worklet@1.0.8` — published 2026-03-18
- `unmute-ios-audio@3.3.0` — current version confirmed from npm registry

---

## Architecture Patterns

### Recommended Project Structure

```
project-root/
├── index.html              (host page — includes the widget)
├── pandero.mp3             (existing — move to dairapp/ during Phase 1)
└── dairapp/
    ├── poc.html            (Phase 1 PoC — standalone proof-of-concept)
    ├── player.js           (Phase 2+ widget)
    ├── soundtouch-processor.js   (copied from npm dist; must be same-origin)
    └── pandero.mp3         (moved here)
```

For Phase 1, a single self-contained `poc.html` file is sufficient — no separate `player.js` needed yet.

### Pattern 1: Library Delivery via importmap + esm.sh

**What:** Use an HTML `<script type="importmap">` block to map the package name to esm.sh's CDN URL. The processor file still needs to be self-hosted.

**When to use:** No npm, no build step — pure PoC in a single HTML file.

```html
<!-- Source: @soundtouchjs/audio-worklet README + esm.sh verification -->
<script type="importmap">
{
  "imports": {
    "@soundtouchjs/audio-worklet": "https://esm.sh/@soundtouchjs/audio-worklet@1.0.8",
    "unmute-ios-audio": "https://esm.sh/unmute-ios-audio@3.3.0"
  }
}
</script>
<script type="module" src="poc.js"></script>
```

The processor file `soundtouch-processor.js` must be served locally — it is passed as a URL string to `SoundTouchNode.register()`, which calls `audioWorklet.addModule()`. Cross-origin loading of worklet modules is blocked by browsers.

**Processor delivery:** Copy `soundtouch-processor.js` from the npm package (or download the dist tarball) and place it in the `dairapp/` directory. It is a fully self-contained 24KB file — no runtime imports, `@soundtouchjs/core` is bundled inline.

### Pattern 2: Full Initialization Sequence

**What:** The complete sequence from page load through first audio output. Order is critical — particularly the placement of `AudioContext` creation.

```js
// Source: @soundtouchjs/audio-worklet README + MDN Autoplay Policy

import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import unmuteAudio from 'unmute-ios-audio';

// Step 1: Call unmute ASAP — registers event listeners for ALL user gestures
unmuteAudio();

// Step 2: Pre-fetch the MP3 immediately (hides network latency)
// Do NOT decode yet — AudioContext doesn't exist
const mp3Promise = fetch('./pandero.mp3').then(r => r.arrayBuffer());

let audioCtx, stNode, source, audioBuffer;
let isInitialized = false;

async function init() {
  if (isInitialized) return;
  isInitialized = true;

  // Step 3: Create AudioContext INSIDE the user gesture handler
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Step 4: Register worklet processor (relative same-origin path)
  await SoundTouchNode.register(audioCtx, './soundtouch-processor.js');

  // Step 5: Decode audio (now that AudioContext exists)
  const arrayBuffer = await mp3Promise;
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
}

async function play() {
  await init();

  // Step 6: Resume if suspended (iOS interrupted state)
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    await audioCtx.resume();
  }

  // Step 7: Wire audio graph
  stNode = new SoundTouchNode(audioCtx);
  stNode.connect(audioCtx.destination);

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;

  // Step 8: Set initial tempo via tandem pattern
  const tempo = 1.0; // 1.0 = original speed
  source.playbackRate.value = tempo;
  source.connect(stNode);
  stNode.playbackRate.value = tempo;

  source.start();
}

document.getElementById('play-btn').addEventListener('click', play);
```

### Pattern 3: playbackRate Tandem Pattern (ENG-02)

**What:** Setting tempo on `SoundTouchNode.tempo` alone causes audible gaps at ratios above 1.0. Instead, drive the source `playbackRate` and tell the processor the same value via `stNode.playbackRate`. The processor automatically compensates pitch by dividing: `effectivePitch = pitch * 2^(semitones/12) / playbackRate`.

**Verified from processor source:** Line 901 of `soundtouch-processor.js`:
```js
this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12) / playbackRate;
```

**When to use:** Always, for tempo changes. Never set `source.playbackRate` without also setting `stNode.playbackRate` to the same value.

```js
// Source: @soundtouchjs/audio-worklet README + processor source (verified)
function setTempo(ratio) {
  // ratio: 0.5 = half speed, 1.0 = original, 1.5 = 50% faster
  source.playbackRate.value = ratio;
  stNode.playbackRate.value = ratio;  // processor divides pitch by this automatically
  // stNode.tempo is NOT used in the tandem pattern
}
```

### Pattern 4: Pitch Semitones (ENG-03)

**What:** Independent pitch shifting without affecting tempo. Use `pitchSemitones` for musical key changes (integer semitone steps). Keep `stNode.pitch.value = 1.0` for most use cases.

```js
// Source: @soundtouchjs/audio-worklet README (verified from type definitions)
function setPitchSemitones(semitones) {
  // semitones: integer, range -24 to +24
  // For this project: -6 to +6 is the practical UI range
  stNode.pitchSemitones.value = semitones;
  // source.playbackRate is unchanged — tempo is independent
}
```

**Combined formula (from README):**
```
effectivePitch = pitch * 2^(pitchSemitones / 12) / playbackRate
```

For typical use: `pitch = 1.0`, `playbackRate = tempoRatio`, `pitchSemitones = userInput`.

### Pattern 5: Seamless Loop (ENG-04)

**What:** `AudioBufferSourceNode.loop = true` provides zero-gap looping when the buffer ends. The loop wraps immediately at the buffer boundary.

```js
// Source: MDN AudioBufferSourceNode
source.loop = true;
// Optional — only needed if looping a segment, not the whole buffer:
// source.loopStart = 0;
// source.loopEnd = audioBuffer.duration;
source.start();
```

The pandero.mp3 is 6.6 seconds. With `loop = true`, it will loop seamlessly. Because it is a short clean loop, no crossfade or manual restart is needed — the browser handles it.

**Note on AudioBufferSourceNode lifecycle:** Source nodes are fire-and-forget. On pause/resume, use `audioCtx.suspend()` / `audioCtx.resume()` — do NOT call `source.stop()` and restart (that would lose position). On stop/replay from zero, a new source node must be created and `source.start()` called again.

### Pattern 6: iOS Mute Switch Fix (ENG-06)

**What:** `unmuteAudio()` from feross/unmute-ios-audio registers listeners for all user activation events (`click`, `touchend`, etc.). On first activation, it plays a short silent `<audio>` element alongside a silent Web Audio buffer. This routes Web Audio through the media channel instead of the ringer channel.

**Verified from package source:**
- Detects iOS via `navigator.maxTouchPoints > 0 && window.webkitAudioContext != null`
- Creates a looping `<audio>` tag with a 7-byte silent WAV
- Creates a tiny `AudioContext` with a silent 1-frame buffer source
- Cleans up event listeners after success
- MIT license (Feross Aboukhadijeh)

```js
// Source: unmute-ios-audio index.js (verified from package source)
import unmuteAudio from 'unmute-ios-audio';

// Call ONCE, as early as possible — before any user interaction
// It will register itself and fire on the first touch/click
unmuteAudio();

// This is all. No callback needed. It handles everything internally.
// Your AudioContext and SoundTouchNode code is unchanged.
```

**Critical requirement:** `unmuteAudio()` must be called synchronously before any user gesture fires. Call it at module top level or immediately on script load. Do not wait for DOM ready or user events — by then you may have missed the activation window.

### Anti-Patterns to Avoid

- **Creating `AudioContext` on page load:** Results in `state === 'suspended'` in all browsers. Complete silence, no error.
- **Setting tempo via `stNode.tempo.value` alone without the tandem pattern:** Audible silence gaps at ratios above ~1.0x.
- **Loading `soundtouch-processor.js` from a CDN URL in `addModule()`:** Blocked by same-origin policy for worklet modules. CORS headers on jsDelivr are insufficient — browsers impose additional restrictions on worklet module origins.
- **Opening `poc.html` via `file://`:** `addModule()` requires Secure Context. Silent failure with cryptic `DOMException`.
- **Multiple `AudioContext` instances:** Safari enforces max 4 per page. Use a singleton per widget.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-stretching with independent pitch | Custom WSOLA/phase vocoder | `@soundtouchjs/audio-worklet` | WSOLA requires ring buffers, 128-frame alignment, stereo interleaving — all handled by the processor |
| iOS mute switch mitigation | Manual silent audio loop hack | `unmute-ios-audio` | The old `<audio loop>` hack broke in post-2023 Safari; the library uses the current working approach |
| Pitch-from-semitones math | `Math.pow(2, semitones / 12)` inline | `stNode.pitchSemitones.value = n` | The processor handles the conversion and compounds it with `playbackRate` compensation automatically |
| Gap artifact mitigation | Custom rate-compensation math | `stNode.playbackRate.value = ratio` | The processor divides out the rate automatically; no manual math needed |

**Key insight:** The gap artifact mitigation requires setting BOTH `source.playbackRate` AND `stNode.playbackRate` to the same value. The processor then only corrects pitch, not time-stretch — which works cleanly in 128-sample blocks. This is explicitly documented in the README and verified in the processor source.

---

## Common Pitfalls

### Pitfall 1: AudioContext Suspended Before User Gesture

**What goes wrong:** `AudioContext` created at module load returns `state === 'suspended'`. No error. Complete silence.

**Why it happens:** Chrome (2018+), Safari iOS (13+), Firefox enforce autoplay policy unconditionally.

**How to avoid:** Create `AudioContext` inside the click handler. Guard with `isInitialized` flag so it only creates once.

**Warning signs:** `audioCtx.state === 'suspended'` immediately after construction. Log this during dev.

---

### Pitfall 2: iOS `'interrupted'` State After Screen Lock

**What goes wrong:** User locks the phone, unlocks, taps Play — silence. `audioCtx.state === 'interrupted'` (not `'suspended'`).

**Why it happens:** iOS-specific state that occurs after the app is backgrounded or screen locks.

**How to avoid:** Check BOTH states before resuming:

```js
if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
  await audioCtx.resume();
}
```

**Warning signs:** Works on first play, fails after phone lock. Distinct from the autoplay pitfall.

---

### Pitfall 3: `addModule()` Fails on `file://`

**What goes wrong:** `DOMException: The user aborted a request` when calling `SoundTouchNode.register()`. AudioWorklet requires Secure Context.

**How to avoid:** Always develop with `python3 -m http.server` (port 8000 by default) or `npx serve .`. Add a startup check:

```js
if (!window.isSecureContext) {
  console.error('AudioWorklet requires HTTPS or localhost. Open via a local server.');
}
```

---

### Pitfall 4: Tempo Gap at High Ratios Without Tandem Pattern

**What goes wrong:** Setting only `stNode.tempo.value = 1.5` causes audible silence gaps every ~128 samples.

**Root cause:** SoundTouch cannot produce enough output frames per 128-sample render quantum at tempo ratios above 1.0.

**How to avoid:** Use the tandem pattern — ALWAYS set both:
```js
source.playbackRate.value = ratio;
stNode.playbackRate.value = ratio;
```
Never use `stNode.tempo.value` in the tandem pattern — it serves a different use case (fine-tuning inside the processor).

---

### Pitfall 5: Processor Script Not Found / Wrong MIME Type

**What goes wrong:** `addModule()` silently fails or throws if the processor URL returns 404, or if the server sends it with `Content-Type: text/plain`.

**How to avoid:** Verify the processor file is in place before testing. Python's `http.server` serves `.js` as `text/javascript` correctly. Log the processor URL before calling `register()`.

---

### Pitfall 6: `AudioBufferSourceNode` Cannot Be Restarted

**What goes wrong:** After calling `source.stop()`, calling `source.start()` again throws `InvalidStateError`.

**Root cause:** `AudioBufferSourceNode` is a one-shot object by spec.

**How to avoid:** For pause/resume: use `audioCtx.suspend()` / `audioCtx.resume()`. For restart from zero: create a new `AudioBufferSourceNode`, assign the same `audioBuffer`, reconnect to `stNode`, and call `start()`. Keep a reference to `source` as a module-level variable to replace it.

---

## Code Examples

### Complete PoC (verified patterns)

```html
<!-- Source: @soundtouchjs/audio-worklet README + MDN Autoplay + unmute-ios-audio source -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dairapp PoC — Phase 1</title>
  <script type="importmap">
  {
    "imports": {
      "@soundtouchjs/audio-worklet": "https://esm.sh/@soundtouchjs/audio-worklet@1.0.8",
      "unmute-ios-audio": "https://esm.sh/unmute-ios-audio@3.3.0"
    }
  }
  </script>
</head>
<body>
  <button id="play-btn">Play</button>
  <button id="pause-btn">Pause</button>
  <label>Tempo: <input id="tempo" type="range" min="0.5" max="1.5" step="0.01" value="1.0"></label>
  <label>Pitch (semitones): <input id="pitch" type="range" min="-6" max="6" step="1" value="0"></label>
  <script type="module" src="poc.js"></script>
</body>
</html>
```

```js
// poc.js
// Source: @soundtouchjs/audio-worklet README + processor source inspection

import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import unmuteAudio from 'unmute-ios-audio';

// Must be called as early as possible, before any user gesture fires
unmuteAudio();

// Pre-fetch MP3 immediately (hides network latency; no AudioContext needed)
const mp3Promise = fetch('./pandero.mp3').then(r => r.arrayBuffer());

let audioCtx = null;
let stNode = null;
let source = null;
let audioBuffer = null;
let isInitialized = false;

async function init() {
  if (isInitialized) return;
  isInitialized = true;

  // Create AudioContext inside user gesture
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Register worklet processor (self-hosted, same origin)
  await SoundTouchNode.register(audioCtx, './soundtouch-processor.js');

  // Decode audio (AudioContext now exists)
  const arrayBuffer = await mp3Promise;
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
}

async function play() {
  await init();

  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    await audioCtx.resume();
  }

  if (source) {
    source.disconnect();
  }

  stNode = new SoundTouchNode(audioCtx);
  stNode.connect(audioCtx.destination);

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;

  const tempo = parseFloat(document.getElementById('tempo').value);
  source.playbackRate.value = tempo;
  source.connect(stNode);
  stNode.playbackRate.value = tempo;
  stNode.pitchSemitones.value = parseInt(document.getElementById('pitch').value);

  source.start();
}

async function pause() {
  if (!audioCtx) return;
  if (audioCtx.state === 'running') {
    await audioCtx.suspend();
  }
}

document.getElementById('play-btn').addEventListener('click', play);
document.getElementById('pause-btn').addEventListener('click', pause);

document.getElementById('tempo').addEventListener('input', (e) => {
  if (!source || !stNode) return;
  const ratio = parseFloat(e.target.value);
  source.playbackRate.value = ratio;   // feed samples faster
  stNode.playbackRate.value = ratio;   // processor divides pitch by this
});

document.getElementById('pitch').addEventListener('input', (e) => {
  if (!stNode) return;
  stNode.pitchSemitones.value = parseInt(e.target.value);  // independent of tempo
});
```

### Processor File Setup

```bash
# One-time setup: get the processor file
# Option A: minimal npm (recommended — most reproducible)
npm install @soundtouchjs/audio-worklet@1.0.8
cp node_modules/@soundtouchjs/audio-worklet/dist/soundtouch-processor.js dairapp/

# Option B: download tarball directly without npm
curl -L https://registry.npmjs.org/@soundtouchjs/audio-worklet/-/audio-worklet-1.0.8.tgz | \
  tar -xzO package/dist/soundtouch-processor.js > dairapp/soundtouch-processor.js
```

The `soundtouch-processor.js` file is 24KB, fully self-contained, and has zero runtime imports. It bundles `@soundtouchjs/core` inline.

### SoundTouchNode Full API Surface

```js
// Source: @soundtouchjs/audio-worklet v1.0.8 type definitions (verified from .d.ts)

// Registration (once per AudioContext)
await SoundTouchNode.register(audioCtx, processorUrl);  // processorUrl: string | URL

// Construction
const stNode = new SoundTouchNode(audioCtx);

// AudioParam properties (all support .value assignment and Web Audio automation)
stNode.pitch.value           // default 1.0, range 0.25–4.0 (multiplier)
stNode.tempo.value           // default 1.0, range 0.25–4.0 (multiplier) — NOT used in tandem pattern
stNode.rate.value            // default 1.0, range 0.25–4.0 (affects both pitch and tempo)
stNode.pitchSemitones.value  // default 0,   range -24–24  (key shift)
stNode.playbackRate.value    // default 1.0, range 0.25–4.0 (USED in tandem pattern)

// Combined formula (from README):
// effectivePitch = pitch * 2^(pitchSemitones / 12) / playbackRate
```

---

## Audio Asset Notes

**pandero.mp3 (verified 2026-03-22):**
- Location: project root (move to `dairapp/pandero.mp3` in Phase 1 scaffold)
- Format: MPEG Layer III, 64 kbps, 44.1 kHz, Stereo, ID3 v2.4
- File size: 52KB compressed
- Duration: ~6.6 seconds (CBR estimate at 64kbps)
- Decoded PCM size: ~2.2MB (stereo float32 at 44.1kHz) — well within mobile limits
- Loop behavior: at 6.6s, seamless looping is trivial with `source.loop = true`
- Memory: 2.2MB decoded is safe to cache for the session lifetime on any mobile device

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `soundtouchjs` legacy (`ScriptProcessorNode`) | `@soundtouchjs/audio-worklet` (AudioWorklet) | v0.2.0 rewrite, March 2025 | Off main thread; AudioParam automation; ESM only |
| Silent `<audio loop>` hack for iOS mute | `unmute-ios-audio` library call | Post-2023 Safari broke silent loop | Library approach is the current working fix |
| `ScriptProcessorNode` (deprecated 2018) | `AudioWorkletProcessor` | Chrome 66, Safari 14.5 | Off main thread; spec-compliant; required for `@soundtouchjs/audio-worklet` |

**Deprecated/outdated — do not use:**
- `soundtouchjs@0.2.1` (legacy npm package): Uses `ScriptProcessorNode`, runs on main thread, will eventually be removed from browsers
- Manual iOS mute fix via permanently-looping silent `<audio>` element: Broken in post-2023 Safari (plays 1 second then stops)
- `rubberband-web` (delude88): Last commit September 2022, effectively unmaintained

---

## Open Questions

1. **SoundTouch WSOLA parameter tuning for pandero**
   - What we know: SoundTouch exposes `setSequenceLengthMs`, `setSeekWindowLengthMs`, `setOverlapLengthMs`. Defaults are not optimized for percussion.
   - What's unclear: The `@soundtouchjs/audio-worklet` processor — does it expose these parameters as `AudioParam` or as postMessage properties? The README does not mention them.
   - Recommendation: Defer to Phase 1 empirical testing. The PoC works without tuning; optimize if artifacts are audible. This is not a blocker.

2. **iOS AudioWorklet stability in iOS 17-18**
   - What we know: Apple Developer Forums reports instability in some AudioWorklet configurations on iOS 17-18. Not confirmed in official WebKit release notes.
   - What's unclear: Whether `@soundtouchjs/audio-worklet` v1.0.8 is specifically affected.
   - Recommendation: Test on a real iPhone (iOS 17 or 18) during Phase 1. This is the primary risk item — real-device testing cannot be deferred.

3. **importmap browser support on older iOS**
   - What we know: Import maps are supported in Safari 16.4+ (iOS 16.4+), Chrome 89+.
   - What's unclear: What percentage of target users are on iOS < 16.4.
   - Recommendation: For Phase 1 PoC, importmap is fine. For Phase 3 production embedding, consider switching to local file copy for wider compatibility.

---

## Validation Architecture

> No automated test framework is applicable for this phase. The primary verification is manual, on-device testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | Notes |
|--------|----------|-----------|---------|-------|
| ENG-01 | MP3 loads and plays | Manual smoke | Open poc.html in browser, click Play | Verify audio plays |
| ENG-02 | Tempo control changes speed without pitch change | Manual functional | Move tempo slider; verify perceived rate changes | Listen — no pitch change |
| ENG-03 | Pitch control changes key without tempo change | Manual functional | Move pitch slider; verify perceived key changes | Listen — no tempo change |
| ENG-04 | Loop plays continuously | Manual functional | Let audio run past 6.6s; verify no gap | Monitor ~7s mark |
| ENG-05 | AudioContext in user gesture | Manual + console | Reload page; check `audioCtx.state` before/after click | Must be `'suspended'` then `'running'` |
| ENG-06 | iOS mute switch | Manual on-device | Real iPhone, mute switch ON, click Play | Must produce audio |

### Wave 0 Gaps

- No test framework to install — this phase is manual verification only
- The `window.isSecureContext` check should be asserted in the PoC init function (console.error if false)
- Log `audioCtx.state` at every state transition during development

---

## Sources

### Primary (HIGH confidence)

- `@soundtouchjs/audio-worklet` v1.0.8 package source — `SoundTouchNode.d.ts`, `SoundTouchNode.js`, `README.md`, `soundtouch-processor.js` — inspected directly from npm tarball March 22, 2026
- `unmute-ios-audio` v3.3.0 `index.js` and `README.md` — inspected directly from npm tarball March 22, 2026
- [MDN: AudioBufferSourceNode.loop](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop)
- [MDN: AudioContext.suspend()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend)
- [MDN: AudioWorklet addModule](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule)
- `planning/research/PITFALLS.md` — 16 documented pitfalls, all HIGH confidence
- `planning/research/STACK.md` — stack decision rationale, all HIGH confidence
- `planning/research/ARCHITECTURE.md` — three-layer architecture patterns

### Secondary (MEDIUM confidence)

- [esm.sh CDN](https://esm.sh/@soundtouchjs/audio-worklet@1.0.8) — verified 200 response and correct ESM re-export, March 22, 2026
- [jsDelivr CDN](https://cdn.jsdelivr.net/npm/unmute-ios-audio@3.3.0/index.js) — verified 200 response for CommonJS fallback

### Tertiary (LOW confidence — not blocking Phase 1)

- WSOLA tuning parameters for percussion — no browser-specific benchmark; empirical testing only
- iOS 17-18 AudioWorklet stability — Apple Developer Forums reports, not confirmed in official release notes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry and tarball inspection
- Architecture: HIGH — patterns verified from official package README and processor source
- Pitfalls: HIGH — all from official MDN, browser vendor docs, or verified from package source
- iOS mute fix: HIGH — mechanism verified from `unmute-ios-audio` source code

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (90 days for stable Web Audio API; 30 days if `@soundtouchjs/audio-worklet` releases a new version)
