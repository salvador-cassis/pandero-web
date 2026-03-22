# Project Research Summary

**Project:** Dairapp Web — Backing Track Interactivo para Cueca Chilena
**Domain:** Browser-based real-time audio time-stretching / music practice tool
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

Dairapp Web is a narrowly scoped, single-instrument browser tool: play a fixed pandero MP3 with independent pitch and tempo control. The technical core — real-time time-stretching in the browser — is solved by one library choice: `@soundtouchjs/audio-worklet` v1.0.8. This is the recommended engine. It runs off the main thread via AudioWorklet, handles independent pitch and tempo control through `pitchSemitones` and `tempo` AudioParams, requires no WASM binary and no build system, and is actively maintained (released March 18, 2026). Everything else in the stack is native Web API: `fetch()` + `decodeAudioData()` for audio loading, `AudioBufferSourceNode` for playback, and plain HTML/CSS for the UI. No framework, no server, no backend.

The recommended approach is a flat three-layer architecture: an Asset Loader (pre-fetches the MP3 on page load, decodes it on first play), an Audio Graph (wires nodes on the main thread), and the AudioWorklet processor thread (runs SoundTouch processing with zero main-thread pressure). The widget embeds into the existing HTML page as two files: `player.js` (all logic) and `soundtouch-processor.js` (the worklet, self-hosted from the same origin). Feature scope for v1 is intentionally minimal: play/pause, loop, tempo slider, pitch slider, volume slider, BPM/semitone display, reset button, responsive layout.

The primary risks are iOS-specific and well-documented. iOS Safari requires both a user gesture before `AudioContext` creation and the `unmute-ios-audio` library to overcome the hardware mute switch routing bug. The secondary risk is the AudioWorklet gap artifact at high tempos — fully mitigated by the established pattern of driving `playbackRate` on the source node in tandem with `SoundTouchNode.tempo`. Both risks have known, tested solutions. Development must always run over HTTPS or `localhost` because AudioWorklet is a Secure Context API and silently fails on `file://`. Test on a real iOS device early.

---

## Key Findings

### Recommended Stack

The only genuine technical decision in this project is the time-stretching library. `@soundtouchjs/audio-worklet` wins over RubberBand WASM for v1 because it requires no build tooling, no WASM binary to serve, and no COOP/COEP headers — all of which would conflict with embedding in an existing HTML site. The quality difference for a rhythmic mono percussion source at practice tempos (0.5x–1.5x) is small and does not justify RubberBand's integration overhead. RubberBand remains the natural v2 upgrade path if polyphonic instruments (guitar, accordion) demand higher quality at extreme ratios.

**Core technologies:**
- `@soundtouchjs/audio-worklet` v1.0.8: time-stretching and pitch-shifting engine — only library that is pure JS/ESM, AudioWorklet-based (off main thread), actively maintained, and requires no build system
- Web Audio API (native): audio graph, decoding, routing — `decodeAudioData()` handles MP3 natively; `AudioBufferSourceNode` provides clean PCM feed for SoundTouch
- `unmute-ios-audio` (feross): iOS hardware mute switch mitigation — a single call on first user gesture; not optional if iOS users are in scope
- Plain HTML + vanilla JS with `<script type="module">`: UI and widget shell — aligns with project constraint; module type provides clean ESM imports with no bundler

**Versions to lock:**
- `@soundtouchjs/audio-worklet@1.0.8` — verified March 18, 2026 release
- `@soundtouchjs/core@1.0.8` — pulled automatically as a dependency

**What to explicitly reject:**
- `soundtouchjs@0.2.1` (legacy `ScriptProcessorNode`, deprecated, main thread)
- `rubberband-web` (delude88) — last commit September 2022, effectively dead
- Native `preservesPitch + playbackRate` — not true time-stretching, quality varies per browser
- Any server-side audio processing — project is fully static

### Expected Features

The time-stretching engine is the single critical-path dependency. Once it works, every other feature is UI work or a one-liner.

**Must have (table stakes):**
- Play / pause — the minimum viable audio control
- Continuous loop — practice context requires it; absence makes the tool unusable
- Independent tempo control with BPM display — the core product promise
- Independent pitch control with semitone/key display — the core product promise
- Volume control — acoustic environments vary; expected in every audio tool
- Responsive layout with large touch targets — musicians use phones on music stands

**Should have (cueca-specific differentiators, low complexity):**
- Cueca-appropriate default tempo (~90–100 BPM) — communicates "this is for you" on first load
- Reset-to-default button — community practice involves multiple people taking turns; one-tap reset is faster than re-dragging two sliders
- Named key display alongside semitones — singers and guitarists think in keys ("La", "Si bemol"), not intervals
- Cueca tempo vocabulary labels on slider ("lento / normal / animado") — the community thinks in these terms

**Defer (v2+):**
- Additional instruments (guitar, accordion, voz)
- A-B loop markers — not applicable to a homogeneous drum loop
- Any file upload, export, or account feature — explicitly out of scope per PROJECT.md
- Visual waveform — provides no navigational value in a looping homogeneous track

### Architecture Approach

The architecture is a flat, three-layer browser-only system with no server and no build step. All processing runs client-side. The widget self-initializes by finding its mount point in the host page, injecting its DOM, and registering event listeners — the host page needs two lines of HTML (a `<div>` and a `<script>` tag).

**Major components:**
1. **Asset Loader** — `fetch()` the MP3 on page load into an `ArrayBuffer`; call `decodeAudioData()` only on first user gesture when `AudioContext` exists; cache the resulting `AudioBuffer` in memory for the session lifetime
2. **Audio Graph** — wires `AudioBufferSourceNode → SoundTouchNode → AudioContext.destination` on the main thread; manages play/pause via `audioContext.suspend()/resume()`; translates slider values to `AudioParam` writes; creates `AudioContext` lazily inside the first click handler (browser autoplay policy)
3. **AudioWorklet thread** — `SoundTouchProcessor` runs entirely off the main thread in the audio rendering context; receives 128-sample blocks, applies WSOLA time-stretch and pitch-shift, outputs processed PCM
4. **UI Layer** — plain HTML controls rendered by `player.js`; tempo slider sets both `stNode.tempo.value` and `source.playbackRate.value` in tandem (gap artifact mitigation); pitch slider sets `stNode.pitchSemitones.value` independently

**Critical architectural constraints:**
- `soundtouch-processor.js` must be self-hosted (same origin) — `addModule()` is blocked cross-origin
- `AudioContext` must be created inside a user gesture handler — not on page load
- Single `AudioContext` instance per widget (Safari enforces a maximum of 4 per page)
- HTTPS or localhost required — AudioWorklet is a Secure Context API

### Critical Pitfalls

1. **AudioContext created before user gesture** — browser silently suspends it; no error thrown; complete silence. Prevention: create `AudioContext` inside the first play-button click handler, unconditionally. Also handle `'interrupted'` state on iOS (after screen lock or backgrounding).

2. **iOS hardware mute switch silences Web Audio** — affects all iPhone users who keep their phone on silent (many do). Web Audio routes through the ringer channel by default; `<audio>` elements do not. Prevention: use `unmute-ios-audio` (feross) on first user gesture. Cannot be simulated — test on real hardware.

3. **Tempo gap artifact at high ratios** — SoundTouch in 128-sample AudioWorklet blocks cannot produce enough output samples when tempo > 1.0x, causing audible silence gaps. Prevention: set `source.playbackRate.value = ratio` AND `stNode.tempo.value = ratio` in tandem. SoundTouch then only corrects pitch, not full time-stretch. This is the documented and verified mitigation.

4. **AudioWorklet fails on `file://`** — `addModule()` requires a Secure Context (HTTPS or localhost). Opening `index.html` directly from the filesystem fails with a vague `DOMException`. Prevention: always run a local HTTP server in development (`npx serve .` or `python3 -m http.server`). Check `window.isSecureContext` during init.

5. **Worklet processor loaded cross-origin** — `addModule()` is blocked by same-origin policy; loading `soundtouch-processor.js` from a CDN will fail in most configurations. Prevention: self-host the processor file in the same directory as `player.js`; use a relative path in `addModule()`.

---

## Implications for Roadmap

The dependency chain dictates a clear phase structure. The time-stretching engine is a hard prerequisite for everything else. UI and polish only make sense once audio processing is verified working — especially on iOS.

### Phase 1: Audio Engine Foundation

**Rationale:** The time-stretching engine is the entire technical risk of this project. Everything else is straightforward. Prove the engine works on all target platforms — including real iOS hardware — before building any UI around it. Fail fast on the hard part.

**Delivers:** A working proof-of-concept: a single HTML page that loads the pandero MP3, initializes the SoundTouch AudioWorklet, and exposes raw tempo/pitch controls. No styling. No polish. Just the audio pipeline verified end-to-end.

**Addresses:** Independent tempo control, independent pitch control (core product promise)

**Avoids:** AudioContext autoplay pitfall (create in click handler), iOS mute switch pitfall (add unmute-ios-audio here), gap artifact pitfall (implement playbackRate tandem pattern here), file:// pitfall (set up local dev server from day one)

**Stack elements:** `@soundtouchjs/audio-worklet` v1.0.8, Web Audio API, `unmute-ios-audio`

**Research flag:** None — patterns are well-documented and verified. Skip `/gsd:research-phase`.

---

### Phase 2: Playback Controls and Core UI

**Rationale:** With the audio engine working, the remaining feature work is straightforward HTML/CSS. Build all v1 controls in one pass: play/pause, loop, tempo slider with BPM display, pitch slider with semitone display, volume slider, reset button.

**Delivers:** A fully functional practice tool. All table-stakes features present. Usable by a real cueca musician.

**Addresses:** Play/pause, loop, BPM display, semitone display, volume, reset button

**Avoids:** Scope creep — no A-B loops, no waveform, no upload. Ship the minimal feature set.

**Architecture component:** UI Layer (player.js, player.css); AudioParam writes from slider events

**Research flag:** None — standard Web Audio API patterns. Skip `/gsd:research-phase`.

---

### Phase 3: Mobile Polish and Embedding

**Rationale:** The tool is designed for mobile use on music stands and for embedding in an existing HTML site. Both require explicit attention that goes beyond "it works on desktop." Responsive layout, touch target sizing, iOS-specific testing, and clean embedding integration are the deliverables.

**Delivers:** Embeddable widget file structure (`dairapp/` directory with `player.js`, `player.css`, `pandero.mp3`, `soundtouch-processor.js`); verified responsive layout; large touch targets; two-line host page integration; confirmed iOS behavior on real hardware with mute switch testing.

**Addresses:** Responsive/mobile-usable UI, embeddable with minimal footprint

**Avoids:** CSS global leakage into host page (use scoped selectors or IIFE); namespace pollution (wrap all JS in module or IIFE); multiple AudioContext instances (singleton pattern)

**Research flag:** None — embedding patterns are standard. iOS testing needs a real device, not research.

---

### Phase 4: Cueca-Specific UX Refinements

**Rationale:** The differentiating features — cueca default tempo, vocabulary labels, key display, reset button — are all low-complexity and high-value for the target community. They require knowing the source key of the pandero recording, which is determined by the audio asset. These are post-engine polish, not pre-launch blockers.

**Delivers:** Named key display (e.g., "La", "Si bemol") alongside semitone values; cueca-appropriate default tempo pre-set on load; optional vocabulary labels on tempo slider ("lento / normal / animado"); confirmed reset button restores defaults instantly.

**Addresses:** Domain-specific default tempo, cueca vocabulary labels, named pitch reference points, reset-to-default

**Research flag:** None for implementation. However, the correct default BPM and source key of the pandero recording need to be confirmed with the project owner — this is a content decision, not a technical one.

---

### Phase Ordering Rationale

- Phase 1 before anything else: the engine is the entire technical risk. Validating it on iOS is more important than any UI work.
- Phase 2 follows naturally: once the audio pipeline is proven, all control features are straightforward HTML event handlers writing to AudioParams.
- Phase 3 after Phase 2: mobile and embedding polish is meaningless until controls exist to polish.
- Phase 4 last: cueca-specific UX is additive, non-blocking, and requires knowing the audio asset's actual key — content information that may not be available at project start.

### Research Flags

Phases needing deeper research during planning:
- None of the four phases require a `/gsd:research-phase` call. The technical patterns for all phases are well-documented in official MDN and Chrome Developers sources. The iOS behavior is verified and has known mitigations.

Phases with standard patterns (skip research-phase):
- **All four phases** — the research done here is sufficient to execute without additional investigation.

One content dependency (not a research gap): The source key of the pandero MP3 recording must be known before Phase 4 can implement the named key display. This is a question for the project owner, not a research task.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SoundTouchJS v1.0.8 release verified March 18, 2026; gap artifact mitigation documented officially; all Web Audio API patterns sourced from MDN and Chrome Developers |
| Features | HIGH | Table stakes confirmed across multiple competitor tools; anti-features confirmed by PROJECT.md constraints; cueca-specific differentiators are MEDIUM (community conventions, no external benchmark) |
| Architecture | HIGH | Three-layer architecture follows documented Web Audio API design patterns; same-origin constraint on addModule() documented in spec issue tracker; lazy AudioContext pattern sourced from MDN autoplay guide |
| Pitfalls | HIGH | All critical pitfalls sourced from official browser docs, MDN, WebKit bug tracker; iOS mute switch behavior is a confirmed WebKit bug (237322); HTTPS requirement is spec-mandated |

**Overall confidence:** HIGH

### Gaps to Address

- **SoundTouch percussion tuning parameters**: SoundTouch exposes `setSequenceLengthMs`, `setSeekWindowLengthMs`, and `setOverlapLengthMs` for algorithm tuning. Default values are not optimized for percussion. The correct values for pandero material are unknown and will require empirical testing during Phase 1. This is an audio quality tuning task, not a research task.

- **iOS AudioWorklet stability in iOS 17-18**: Apple Developer Forums reports AudioWorklet bugs in recent iOS versions. The specifics are not confirmed in official WebKit release notes. Real-device testing in Phase 1 will surface any blocking issues early.

- **Pandero MP3 source key**: Required for Phase 4 named key display. Must be confirmed by the project owner (or measured from the recording). Not a blocker for Phases 1-3.

- **Pandero MP3 file length and format**: The file should be mono and under 2 minutes to avoid memory issues on mobile (a 3-minute mono file at 44.1kHz decodes to ~30MB of PCM — acceptable but should be validated on target devices). Longer files should use a shorter loop segment.

---

## Conflicts Between Research Findings

One apparent conflict was identified and resolved:

**STACK.md vs ARCHITECTURE.md on library version naming**: STACK.md refers to `@soundtouchjs/audio-worklet` v1.0.8 throughout. ARCHITECTURE.md references "v0.1.x from the monorepo" in one place — this appears to be an error in that document; the verified release is v1.0.8 per the GitHub releases page. Use v1.0.8.

No other conflicts between research files. All four files recommend the same core decisions: SoundTouch over RubberBand, AudioWorklet over ScriptProcessorNode, AudioBufferSourceNode over MediaElementAudioSourceNode, lazy AudioContext creation over page-load creation.

---

## Sources

### Primary (HIGH confidence)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — AudioContext, AudioWorklet, AudioBuffer, decodeAudioData patterns
- [Chrome Developers: Audio Worklet Design Pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern/) — threading model, WASM compilation pattern, ring buffer pattern
- [Chrome Developers: Autoplay Policy](https://developer.chrome.com/blog/autoplay) — user gesture requirements
- [SoundTouchJS GitHub releases](https://github.com/cutterbl/SoundTouchJS/releases) — v1.0.8 release date March 18, 2026 verified
- [WebKit Bug #237322](https://bugs.webkit.org/show_bug.cgi?id=237322) — iOS mute switch Web Audio routing bug confirmed
- [Web Audio API Issue #776](https://github.com/WebAudio/web-audio-api/issues/776) — addModule() same-origin constraint documented

### Secondary (MEDIUM confidence)
- [npm: @soundtouchjs/audio-worklet](https://www.npmjs.com/package/@soundtouchjs/audio-worklet) — package API and known limitations
- [feross/unmute-ios-audio](https://github.com/feross/unmute-ios-audio) — iOS mute switch mitigation library
- [Apple Developer Forums: AudioWorklet not playing on iOS 18](https://developer.apple.com/forums/thread/768347) — iOS 17-18 AudioWorklet instability reports
- [rubberband-wasm (jsDelivr)](https://www.jsdelivr.com/package/npm/rubberband-wasm) — v3.3.0 December 2024, considered and rejected
- [Backtrackit](https://www.backtrackitapp.com/), [Strum Machine](https://strummachine.com/), [Music Speed Changer](https://musicspeedchanger.com/) — competitor feature analysis

### Tertiary (LOW confidence — not blocking any v1 decision)
- SoundTouch parameter tuning for percussion material — no browser-specific benchmark found; empirical testing required
- RubberBand quality advantage for percussion specifically — general DSP knowledge; not benchmarked in browser context

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
