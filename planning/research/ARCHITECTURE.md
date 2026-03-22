# Architecture Patterns

**Domain:** Browser-based audio player with real-time, independent pitch and tempo control
**Project:** Dairapp Web — Backing Track Interactivo para Cueca Chilena
**Researched:** 2026-03-22
**Confidence:** HIGH (Web Audio API) / MEDIUM (library-specific integration details)

---

## Recommended Architecture

A flat, three-layer architecture running entirely in the browser. No server, no build step, no framework.

```
┌─────────────────────────────────────────────────────────┐
│                     HOST PAGE                           │
│  (existing HTML — embeds the widget via <script>)       │
└────────────────────────┬────────────────────────────────┘
                         │  includes
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  UI LAYER  (main thread)                 │
│  player.js — controls, sliders, play/pause button       │
│  player.css — scoped styles, no global leakage          │
└───────────┬──────────────────────────────┬──────────────┘
            │ AudioContext API             │ fetch()
            ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    AUDIO GRAPH          │   │    ASSET LOADER         │
│    (main thread,        │◄──│  fetch(mp3) →           │
│     managed by          │   │  arrayBuffer() →        │
│     AudioContext)       │   │  decodeAudioData()      │
│                         │   │  → AudioBuffer (cached) │
│  AudioBufferSourceNode  │   └─────────────────────────┘
│       ↓                 │
│  SoundTouchNode         │  ← AudioWorkletNode
│  (tempo + pitch)        │    runs OFF main thread
│       ↓                 │
│  AudioContext.          │
│    destination          │
└─────────────────────────┘
            ▲
            │ addModule()
┌─────────────────────────┐
│  AUDIO WORKLET THREAD   │
│  soundtouch-processor.js│
│  (SoundTouchProcessor   │
│   extends               │
│   AudioWorkletProcessor)│
│  — runs in audio        │
│    rendering thread     │
│  — zero main-thread     │
│    pressure             │
└─────────────────────────┘
```

---

## Component Breakdown

### Component 1: Asset Loader

**Responsibility:** Fetch the MP3 file, decode it to a raw `AudioBuffer`, and cache it in memory for the session.

**Rationale:** `decodeAudioData()` is the only way to get a Web Audio-compatible buffer from an MP3. The result must be cached — calling it on every play would re-allocate a large buffer.

**Lives on:** Main thread (one-time async operation at widget init).

**Key constraint:** Must be triggered after a user gesture (browser autoplay policy). Do NOT call `new AudioContext()` until the user taps the play button. Instantiate both the `AudioContext` and the decoded buffer together inside the first play-button click handler.

---

### Component 2: Audio Graph (Main Thread)

**Responsibility:** Wire together the Web Audio node chain and manage playback state (playing, paused, position).

**Nodes in chain:**

```
AudioBufferSourceNode → SoundTouchNode → AudioContext.destination
```

**AudioBufferSourceNode** is the source. Each play/resume creates a new instance (the API is fire-and-forget — source nodes cannot be restarted). The buffer assigned to it is the decoded `AudioBuffer` from the Asset Loader.

**SoundTouchNode** (`AudioWorkletNode` subclass from `@soundtouchjs/audio-worklet`) handles time-stretching. It exposes `AudioParam` properties for `pitch`, `tempo`, and `pitchSemitones`. Parameter changes are applied in real time — no restart required.

**AudioContext.destination** is the hardware output.

**Lives on:** Main thread (graph topology) — but processing runs off-thread in the Worklet.

---

### Component 3: Audio Worklet Thread

**Responsibility:** Execute the SoundTouch time-stretching algorithm in real time, isolated from the main thread.

**What runs here:** `SoundTouchProcessor`, which extends `AudioWorkletProcessor`. It receives 128-sample blocks from the audio rendering thread, runs SoundTouch pitch/tempo compensation, and returns processed blocks.

**Key architectural constraint:** The worklet processor script must be registered via `audioContext.audioWorklet.addModule(url)` BEFORE constructing a `SoundTouchNode`. The URL passed to `addModule()` must resolve to a JavaScript file from the same origin (or a Blob URL). This is a hard browser security requirement — it is not optional.

**Lives on:** `AudioWorkletGlobalScope` — a separate JS thread managed by the browser's audio rendering engine. No DOM, no `window`, no `fetch`.

---

### Component 4: UI Layer

**Responsibility:** Render controls (play/pause button, pitch slider, tempo slider), translate user input into AudioParam updates, manage visual state (playing indicator, slider display values).

**Constraint:** All AudioParam writes must happen on the main thread (they are transmitted to the worklet automatically by the browser). No direct worklet manipulation from the UI.

**Pitch slider** maps a semitone range (e.g., -6 to +6) to `SoundTouchNode.pitchSemitones.value`.

**Tempo slider** maps a percentage range (e.g., 50% to 150%) to `SoundTouchNode.tempo.value` AND to `AudioBufferSourceNode.playbackRate.value`. Both must be set together (see Data Flow below for why).

**Lives on:** Main thread.

---

## Data Flow: MP3 File to Audio Output

```
1. INIT (page load)
   ├─ Download MP3:
   │   fetch('pandero.mp3')
   │   → response.arrayBuffer()
   │   [store rawBuffer, do NOT create AudioContext yet]
   └─ Register worklet processor URL (blob or file path)

2. USER TAPS PLAY (first interaction — inside click handler)
   ├─ new AudioContext()    [must be inside gesture handler]
   ├─ await audioContext.audioWorklet.addModule(processorURL)
   ├─ audioContext.decodeAudioData(rawBuffer) → AudioBuffer
   └─ Build audio graph:
       source = audioContext.createBufferSource()
       source.buffer = decodedAudioBuffer
       stNode = new SoundTouchNode(audioContext)
       source → stNode → audioContext.destination
       source.loop = true
       source.start()

3. REAL-TIME PLAYBACK (audio rendering thread, every 128 samples)
   source feeds PCM samples →
   SoundTouchProcessor receives block →
   applies tempo stretch + pitch shift →
   outputs processed block →
   hardware DAC

4. USER MOVES TEMPO SLIDER
   stNode.tempo.value = newTempoRatio       [e.g., 0.8 for 80%]
   source.playbackRate.value = newTempoRatio
   [SoundTouchNode auto-compensates pitch for rate change]

5. USER MOVES PITCH SLIDER
   stNode.pitchSemitones.value = semitones  [e.g., +2 or -3]
   [tempo unchanged — independent control achieved]

6. USER PAUSES
   audioContext.suspend()    [freezes rendering thread]
   [position is preserved via AudioContext clock]

7. USER RESUMES
   audioContext.resume()
   [rendering thread restarts from exact position]
```

---

## Threading Model

| Thread | What Runs There | Interaction |
|--------|----------------|-------------|
| Main thread | UI, DOM, Asset Loader, Audio Graph wiring, AudioParam writes | Communicates with Worklet via AudioParam automation (lock-free) |
| Audio Worklet thread (`AudioWorkletGlobalScope`) | `SoundTouchProcessor` — the actual SoundTouch algorithm | Receives 128-sample blocks from audio engine; writes to output buffer |
| No WebWorker needed | — | WebWorker is for compute offload unrelated to audio rendering; AudioWorklet is the correct primitive here |

**Verdict on threading:** Use AudioWorklet, not WebWorker. The reason is architectural: WebWorker has no direct path into the audio rendering pipeline. Routing audio through a WebWorker requires SharedArrayBuffer + custom ring buffers — significant complexity for no gain. AudioWorklet IS the audio rendering thread. Use it.

**Do not use ScriptProcessorNode.** It runs on the main thread, introducing UI jank under load. It is deprecated in the Web Audio spec. The `@soundtouchjs/audio-worklet` package is the correct replacement.

---

## Integration Pattern: Embedding in an Existing HTML Page

The widget must integrate into an existing HTML/JS site with zero build tooling. This creates one hard constraint: the AudioWorklet processor script (`soundtouch-processor.js`) must be loadable by `addModule()`.

**Recommended pattern: two-file widget**

```
/your-website/
  ├── index.html           (existing page)
  ├── dairapp/
  │   ├── player.js        (widget — all logic)
  │   ├── player.css       (scoped styles)
  │   ├── pandero.mp3      (the fixed audio asset)
  │   └── soundtouch-processor.js   (worklet processor — copied from npm dist)
```

The host page includes the widget with two lines:

```html
<link rel="stylesheet" href="/dairapp/player.css">
<div id="dairapp-player"></div>
<script src="/dairapp/player.js"></script>
```

`player.js` self-initializes: it finds `#dairapp-player`, injects its DOM, and registers event listeners. It loads the processor with a relative path:

```js
await audioContext.audioWorklet.addModule('/dairapp/soundtouch-processor.js');
```

**Why not a Blob URL for the processor?**

A Blob URL approach (inlining the processor code as a string and converting to `URL.createObjectURL(blob)`) WOULD work and would reduce the widget to a single JS file. However, it is blocked by strict Content Security Policies (`script-src` directive must include `blob:`) and it obscures the worklet code, making debugging harder. Since the project owns the hosting environment, the two-file approach is cleaner and more robust. If single-file is later required (e.g., for third-party embedding), the Blob URL technique is the fallback.

**HTTPS / localhost requirement:** AudioWorklet only runs in Secure Contexts (HTTPS or http://localhost). This is a browser-enforced constraint, not a library limitation. The existing website must already be on HTTPS for this to work.

**Single AudioContext rule:** The widget must not create multiple `AudioContext` instances. Safari enforces a maximum of 4 per page. Use a module-scoped singleton variable.

**Namespace isolation:** The widget must not pollute the host page's global scope. Wrap all logic in an IIFE or use a `<script type="module">`. If `type="module"` is used, note that it defers execution — the widget must handle cases where `#dairapp-player` may not exist at parse time.

---

## Key Architectural Decisions

### Decision 1: SoundTouchJS AudioWorklet over RubberBand WASM

**Recommendation:** Use `@soundtouchjs/audio-worklet` (v0.1.x from the monorepo).

**Rationale:**
- SoundTouchJS is a direct JS descendant of the SoundTouch C++ algorithm — the same family used in the iOS app (RubberBand being the iOS choice, SoundTouch being the canonical JS choice).
- The `@soundtouchjs/audio-worklet` package ships a self-contained, pre-bundled processor file with no runtime import dependencies. It can be used from CDN + a served processor file without any build tooling.
- `rubberband-web` (WASM-based) requires npm installation, build tooling, and manually copying WASM binary assets — no CDN path exists. Its 97.9% WASM composition means a heavier cold-load payload.
- Both libraries achieve independent pitch and tempo control — the core requirement. SoundTouchJS is simpler to integrate in a no-build context.
- LOW confidence caveat: SoundTouchJS documentation specifically notes that at higher tempos the 128-sample block size constraint can cause audible gaps. The mitigation is to drive tempo via `source.playbackRate` + `stNode.playbackRate` in tandem (the library auto-compensates pitch). This is a known pattern and documented workaround.

**Reject:** `ScriptProcessorNode` (deprecated, main-thread, causes jank). `danigb/timestretch` (OLA-only, no pitch shifting). `phaze` (pitch-only, no tempo).

---

### Decision 2: `AudioBufferSourceNode` over `MediaElementAudioSourceNode`

**Recommendation:** Decode the MP3 to an `AudioBuffer` using `decodeAudioData()` and use `AudioBufferSourceNode`.

**Rationale:**
- `MediaElementAudioSourceNode` wraps an `<audio>` element. It is simpler to set up but has a critical limitation: `<audio>` elements have their own internal rate/pitch compensation (`preservesPitch`) that conflicts with SoundTouch's processing. While `preservesPitch = false` can disable it, the interaction is fragile and browser-specific.
- `AudioBufferSourceNode` feeds raw PCM directly into the Web Audio graph. SoundTouchJS was designed for this path. Control is clean and deterministic.
- The MP3 file is fixed and short enough (a cueca backing track loop — likely 30-120 seconds) to fit comfortably in memory as a decoded AudioBuffer.
- MDN notes `AudioBuffer` is designed for audio assets under ~45 seconds. If the track is longer, this decision should be revisited — but for v1 (pandero loop), this is the correct choice.

---

### Decision 3: Lazy AudioContext Creation (On First User Gesture)

**Recommendation:** Do not create `AudioContext` on page load. Create it inside the first play-button click handler.

**Rationale:**
- All modern browsers (Chrome, Firefox, Safari iOS) block AudioContext autoplay outside a user gesture. Creating early and calling `.resume()` later is fragile — on iOS Safari it does not always work.
- The correct pattern is to create the `AudioContext` AND decode the buffer inside the same click handler. Pre-fetch the MP3 `arrayBuffer()` on page load (network, not audio decode), then decode it synchronously when the context exists.
- This also avoids wasting a Safari AudioContext slot (max 4 per page) if the user never interacts.

---

### Decision 4: MP3 Pre-fetch Strategy

**Recommendation:** Start `fetch('pandero.mp3')` immediately on widget init (page load), but only call `decodeAudioData()` when the user first clicks play.

**Rationale:**
- This hides network latency: by the time the user clicks play, the file is likely already in memory as an `ArrayBuffer`.
- `decodeAudioData()` itself is fast (milliseconds for a short file) and does not require a user gesture — only `AudioContext` creation does.
- The `ArrayBuffer` must be stored in a module-scoped variable, ready to decode on demand.

---

## Scalability Considerations

| Concern | For v1 (single instrument) | For v2+ (multiple instruments) |
|---------|---------------------------|-------------------------------|
| Multiple tracks | N/A | Each track is a separate widget instance with its own AudioContext. Do not share AudioContext across tracks — independent tempo/pitch per instrument. |
| Memory | One AudioBuffer in memory — negligible | Pre-fetch all instrument buffers in parallel on page load. Safari's 4-AudioContext limit means v2 may need a shared AudioContext with multiple SoundTouchNodes. |
| Mobile performance | SoundTouch CPU usage is low for a single stream. AudioWorklet runs off main thread. | Monitor for heat/throttling on older iPhones with multiple simultaneous streams. |
| File size | pandero.mp3 + soundtouch-processor.js (~50KB bundled). Total widget under 100KB. | Add one MP3 per instrument. No additional JS. |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating AudioContext at Page Load
**What goes wrong:** Chrome and especially iOS Safari will immediately suspend the context. The app fights browser policy on every page load.
**Instead:** Create inside the first play-button click handler, unconditionally.

### Anti-Pattern 2: Using ScriptProcessorNode
**What goes wrong:** Deprecated. Runs on main thread. Under CPU load, audio processing starves the main thread (or vice versa), causing audible glitches and UI jank simultaneously.
**Instead:** `@soundtouchjs/audio-worklet` — off-thread by design.

### Anti-Pattern 3: Setting Tempo via SoundTouchNode.tempo Alone
**What goes wrong:** At large tempo ratios, SoundTouch cannot produce enough output samples per 128-sample block, creating silence gaps.
**Instead:** Set BOTH `source.playbackRate.value = ratio` AND `stNode.playbackRate.value = ratio`. This feeds samples faster into the processor, which then only corrects pitch — a much lighter operation.

### Anti-Pattern 4: Multiple AudioContext Instances
**What goes wrong:** Safari caps at 4. Creates multiple audio rendering threads, wasting CPU and memory.
**Instead:** One `AudioContext` per widget instance, stored as a singleton in the widget's closure.

### Anti-Pattern 5: Referencing the Worklet Processor via CDN URL
**What goes wrong:** `addModule()` is subject to same-origin restrictions. Loading the processor from a CDN cross-origin will be blocked by CORS unless the CDN serves the file with the correct CORS headers AND the browser allows it. jsDelivr serves with CORS headers, but behavior varies by browser version and security configuration.
**Instead:** Host `soundtouch-processor.js` on the same origin as the page, in the same directory as the widget. Use a relative path.

---

## Sources

- [MDN: BaseAudioContext.decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) — HIGH confidence
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) — HIGH confidence
- [MDN: Web Audio API Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — HIGH confidence
- [Chrome Developers: Audio Worklet Design Pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern/) — HIGH confidence
- [GitHub: cutterbl/SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) — MEDIUM confidence (active as of 2026-03-18, v1.0.8)
- [npm: @soundtouchjs/audio-worklet](https://www.npmjs.com/package/@soundtouchjs/audio-worklet) — MEDIUM confidence
- [GitHub: delude88/rubberband-web](https://github.com/delude88/rubberband-web) — MEDIUM confidence (considered and rejected)
- [GitHub: g200kg/audioworklet-in-one-file](https://github.com/g200kg/audioworklet-in-one-file) — MEDIUM confidence (Blob URL patterns)
- [Web Audio API Issue #776: AudioWorklet module loading](https://github.com/WebAudio/web-audio-api/issues/776) — HIGH confidence (same-origin constraint documented)
- [Time Stretching & Pitch Shifting with the Web Audio API (Georgia Tech)](https://repository.gatech.edu/handle/1853/54587) — HIGH confidence (algorithm survey)
