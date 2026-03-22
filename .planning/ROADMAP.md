# Roadmap: Dairapp Web

## Overview

Four phases that build on each other in strict dependency order. Phase 1 proves the entire technical risk of the project (SoundTouch AudioWorklet on iOS) before any UI work begins. Phases 2-4 layer controls, mobile polish, and cueca-specific UX on top of a verified audio pipeline. The tool ships as a self-contained embeddable widget: one `<div>` and one `<script>` tag in the host page.

## Phases

- [ ] **Phase 1: Audio Engine Foundation** - Prove SoundTouch AudioWorklet works end-to-end including real iOS hardware
- [ ] **Phase 2: Playback Controls and Core UI** - All table-stakes controls wired to the audio engine
- [ ] **Phase 3: Mobile Polish and Embedding** - Responsive layout, touch targets, and clean widget embedding
- [ ] **Phase 4: Cueca-Specific UX Refinements** - Default tempo, vocabulary labels, and named key display

## Phase Details

### Phase 1: Audio Engine Foundation
**Goal**: The SoundTouch AudioWorklet pipeline is verified working end-to-end — including on real iOS hardware with the mute switch on — before any UI work begins
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06
**Success Criteria** (what must be TRUE):
  1. Clicking a single button on a minimal HTML page starts the pandero MP3 playing through SoundTouch without silence or gaps
  2. Adjusting a raw tempo input changes playback speed without affecting pitch; adjusting a raw pitch input changes pitch without affecting tempo
  3. The audio loops continuously without audible clicks or restarts between iterations
  4. The same page works on real iOS Safari with the hardware mute switch engaged (audio audible, not silenced)
  5. Setting tempo above 1.0x produces no audible gap artifacts (playbackRate tandem pattern verified)
**Plans**: 3 plans

Plans:
- [ ] 01-01: Project scaffold and local dev server setup (file structure, HTTPS-or-localhost constraint, `isSecureContext` guard, `soundtouch-processor.js` self-hosted at same origin)
- [ ] 01-02: Audio pipeline implementation (`fetch()` + `decodeAudioData()` asset loader, `AudioBufferSourceNode → SoundTouchNode → destination` graph, lazy `AudioContext` creation inside click handler, `playbackRate` tandem pattern for gap mitigation)
- [ ] 01-03: iOS compatibility and loop verification (`unmute-ios-audio` on first gesture, `'interrupted'` state handling, continuous loop implementation, real-device test on iOS Safari with mute switch)

### Phase 2: Playback Controls and Core UI
**Goal**: Every table-stakes control is present and wired to the audio engine — a musician can pick up the tool and use it without instructions
**Depends on**: Phase 1
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, VIS-01, VIS-02
**Success Criteria** (what must be TRUE):
  1. A play/pause button starts and stops the pandero; pressing play again resumes from the correct loop position
  2. The tempo slider adjusts playback speed across the full range (~50%–150%) and the current BPM value updates live alongside the slider
  3. The pitch slider shifts pitch across the full range (±6 semitones) and the current semitone offset updates live alongside the slider
  4. The volume slider controls output level from silence to full without affecting tempo or pitch
  5. A single reset button returns tempo and pitch to their original values simultaneously
**Plans**: 2 plans

Plans:
- [ ] 02-01: Slider controls and AudioParam wiring (tempo slider → `stNode.tempo` + `source.playbackRate` in tandem, pitch slider → `stNode.pitchSemitones`, volume slider → `GainNode.gain`, range definitions matching CTRL-02 and CTRL-03 specs)
- [ ] 02-02: Display values, play/pause toggle, and reset (live BPM calculation from tempo ratio × base BPM, semitone offset display, play/pause button state management, one-click reset to defaults for both sliders)

### Phase 3: Mobile Polish and Embedding
**Goal**: The widget is usable on a phone held on a music stand, and can be dropped into the existing HTML site with two lines
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. The widget layout is fully usable on a 375px-wide screen (iPhone SE) without horizontal scrolling or overlapping elements
  2. All interactive controls (sliders, play/pause, reset) have touch targets of at least 44×44px and respond correctly to finger input
  3. Adding `<div id="dairapp-player"></div>` and `<script src="dairapp/player.js" type="module"></script>` to any HTML page mounts the widget with no further configuration
  4. The widget's CSS and JS do not leak into or conflict with the host page's existing styles or global scope
**Plans**: 2 plans

Plans:
- [ ] 03-01: Responsive layout and touch targets (mobile-first CSS, minimum 44×44px touch targets on all controls, slider thumb sizing, layout verified at 375px / 768px / 1280px breakpoints)
- [ ] 03-02: Widget file structure and isolation (`dairapp/` directory with `player.js`, `player.css`, `pandero.mp3`, `soundtouch-processor.js`; IIFE or ES module scope isolation; scoped CSS selectors prefixed `dairapp-`; auto-mount from `div#dairapp-player`; two-line embed verified in a real host page)

### Phase 4: Cueca-Specific UX Refinements
**Goal**: The tool communicates from first load that it is built for cueca — the default tempo, the vocabulary, and the key display speak directly to the target community
**Depends on**: Phase 3
**Requirements**: VIS-03, CUE-01, CUE-02
**Success Criteria** (what must be TRUE):
  1. On first load (before any interaction), the tempo slider is set to the cueca default (90–100 BPM confirmed with project owner) and the BPM display reflects that value
  2. The tempo slider shows vocabulary labels at meaningful positions: "lento", "normal", "animado" aligned to their approximate BPM positions
  3. The pitch display shows both the semitone offset and the resulting key name in Spanish notation (e.g., "La", "Si♭") calculated from the pandero recording's source key
**Plans**: 2 plans

Plans:
- [ ] 04-01: Default tempo and vocabulary labels (set initial tempo to cueca default on mount, add "lento / normal / animado" labels to tempo slider at ~70 / ~95 / ~120 BPM positions — exact positions confirmed with project owner)
- [ ] 04-02: Named key display (determine source key of pandero MP3, build semitone-to-key-name lookup table for Spanish notation, display calculated key name alongside semitone offset in pitch display, verify correct names at all ±6 semitone positions)

## Progress

**Execution Order:**
Phases execute in strict numeric order. Phase 1 must be verified on real iOS hardware before Phase 2 begins.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Engine Foundation | 0/3 | Not started | - |
| 2. Playback Controls and Core UI | 0/2 | Not started | - |
| 3. Mobile Polish and Embedding | 0/2 | Not started | - |
| 4. Cueca-Specific UX Refinements | 0/2 | Not started | - |

---

## Coverage

| Requirement | Phase | Category |
|-------------|-------|----------|
| ENG-01 | Phase 1 | Audio Engine |
| ENG-02 | Phase 1 | Audio Engine |
| ENG-03 | Phase 1 | Audio Engine |
| ENG-04 | Phase 1 | Audio Engine |
| ENG-05 | Phase 1 | Audio Engine |
| ENG-06 | Phase 1 | Audio Engine |
| CTRL-01 | Phase 2 | Controls |
| CTRL-02 | Phase 2 | Controls |
| CTRL-03 | Phase 2 | Controls |
| CTRL-04 | Phase 2 | Controls |
| CTRL-05 | Phase 2 | Controls |
| VIS-01 | Phase 2 | Visualizacion |
| VIS-02 | Phase 2 | Visualizacion |
| UI-01 | Phase 3 | UI y Embedding |
| UI-02 | Phase 3 | UI y Embedding |
| UI-03 | Phase 3 | UI y Embedding |
| UI-04 | Phase 3 | UI y Embedding |
| VIS-03 | Phase 4 | Visualizacion |
| CUE-01 | Phase 4 | Cueca UX |
| CUE-02 | Phase 4 | Cueca UX |

**v1 requirements mapped: 20/20. No orphans.**

---

## Key Technical Decisions (for plan-phase reference)

- **Time-stretching engine**: `@soundtouchjs/audio-worklet` v1.0.8. Reject legacy `soundtouchjs@0.2.1` (ScriptProcessorNode), `rubberband-web` (dead), and native `preservesPitch` (not true time-stretching).
- **Gap artifact mitigation**: Set `source.playbackRate.value = ratio` AND `stNode.tempo.value = ratio` in tandem. SoundTouch corrects pitch only; source node handles speed. Non-negotiable.
- **iOS mute switch**: Use `unmute-ios-audio` (feross) on first user gesture. Cannot be simulated — test on real hardware in Phase 1.
- **AudioContext creation**: Always inside a user gesture handler, never on page load. Handle `'interrupted'` state (iOS screen lock / backgrounding).
- **Self-hosted worklet**: `soundtouch-processor.js` must be served from the same origin as `player.js`. `addModule()` is blocked cross-origin.
- **Development server**: AudioWorklet requires a Secure Context. Always run `npx serve .` or `python3 -m http.server` — never open `file://` directly. Check `window.isSecureContext` during init.
- **Content dependency (Phase 4)**: The pandero MP3 source key must be confirmed by the project owner before the named key display can be implemented. Not a blocker for Phases 1-3.

---
*Roadmap created: 2026-03-22*
*Based on: REQUIREMENTS.md (20 v1 requirements), research/SUMMARY.md (HIGH confidence)*
