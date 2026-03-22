# Phase 2: Playback Controls and Core UI - Research

**Researched:** 2026-03-22
**Domain:** SoundTouch WSOLA parameter tuning, Web Audio GainNode integration, play/pause state machine
**Confidence:** HIGH (WSOLA root cause analysis), HIGH (GainNode), HIGH (AudioParam API), MEDIUM (optimal parameter values — derived from algorithm math + community practice, not empirical testing on this asset)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**File strategy**
- D-01: Phase 2 continues in `poc.html` and `poc.js` (not graduating to `player.js` yet — that happens in Phase 3)
- D-02: Add a `GainNode` between `stNode` and `audioCtx.destination` for volume control (CTRL-04)

**Play/pause toggle**
- D-03: Single toggle button — one button, changes between ▶ (icon only) and ⏸ (icon only)
- D-04: Clicking while audio is playing → restart from beginning (stop current source, create new one, call play())
- D-05: Initial button state: ▶ icon only, no text
- D-06: Loading state on first click: button disabled + status text shows "Cargando..." during async init()

**Reset behavior**
- D-07: Reset button returns tempo slider to 1.0 (ratio) and pitch slider to 0 (semitones) simultaneously
- D-08: Volume is NOT reset — only tempo and pitch
- D-09: Reset applies live AudioParam updates (tandem pattern for tempo) even while audio is playing

**BPM display**
- D-10: BPM shown as integer — `Math.round(ratio × 111)` — e.g., 111, 55, 167
- D-11: BPM value appears inline to the right of the tempo slider
- D-12: No percentage label — BPM only

**Semitone display**
- D-13: At zero: show `0` (no sign). For non-zero: show `+2`, `-3` (signed integers)
- D-14: Value updates live on slider input

**Volume slider**
- D-15: Default volume = 1.0 (full). Range: 0.0–1.0, step 0.01
- D-16: Wired to `gainNode.gain.value` directly (no AudioParam scheduling needed)

**SoundTouch WSOLA parameter tuning (non-negotiable requirement)**
- D-17: Default SoundTouch parameters produce robotic artifacts — tested on browser, confirmed unacceptable
- D-18: Researcher MUST investigate optimal WSOLA parameters for percussion material (pandero)
- D-19: Parameter choices must also account for future guitar (polyphonic) — don't over-optimize for percussion
- D-20: Goal: natural, professional, seamless audio across full tempo range (0.5×–1.5×) and pitch range (±6 semitones)

### Claude's Discretion
- Exact HTML structure and element IDs
- Whether to show a "%" label next to the volume slider
- Slider step values for tempo and volume
- Status text wording beyond "Cargando..."

### Deferred Ideas (OUT OF SCOPE)
- `player.js` graduation (embedding contract) — Phase 3
- Cueca tempo labels ("lento / normal / animado") — Phase 4 (CUE-02)
- Default BPM at ~90–100 (CUE-01) — Phase 4
- Touch target sizing for mobile — Phase 3 (UI-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTRL-01 | User can start and pause playback | Play/pause toggle state machine — suspend/resume pattern already in Phase 1 |
| CTRL-02 | User can adjust tempo with a slider (range: ~50%–150%) | Tandem pattern already implemented; BPM display formula: `Math.round(ratio × 111)` |
| CTRL-03 | User can adjust pitch with a slider (range: ±6 semitones) | `stNode.pitchSemitones.value` confirmed available; signed display format researched |
| CTRL-04 | User can adjust volume | GainNode insertion after stNode; `gainNode.gain.value` direct assignment |
| CTRL-05 | User can reset pitch and tempo to original values with one click | Reset applies tandem pattern live; volume excluded per D-08 |
| VIS-01 | Current BPM is shown next to tempo slider | `Math.round(ratio × 111)`, integer display |
| VIS-02 | Current semitones shown next to pitch slider (+2, -1, etc.) | Signed integer display: `0` at zero, `+N`/`-N` otherwise |
</phase_requirements>

---

## Summary

The Phase 1 PoC sounds robotic because SoundTouch's auto-calculated WSOLA sequence length is ~100–120ms — tuned for pop/rock vocals, not percussion. At those lengths, the algorithm manipulates ~4800–5300 samples per processing "chunk," which is far too coarse for transient-rich percussion material like pandero. The fix requires modifying the local `soundtouch-processor.js` to accept WSOLA parameters at construction time and reducing `sequenceMs` to approximately 40ms with a proportionally smaller seek window.

The v1.0.8 `SoundTouchNode` API exposes exactly five `AudioParam` objects: `pitch`, `tempo`, `rate`, `pitchSemitones`, and `playbackRate`. There is no built-in API to pass WSOLA tuning values from the main thread — they are hardcoded inside the `Stretch` class constructor. The solution is to patch the local copy of `soundtouch-processor.js` to read `processorOptions` from the `AudioWorkletProcessor` constructor, where we pass our target `sequenceMs`, `seekWindowMs`, and `overlapMs`.

The remaining Phase 2 controls (GainNode for volume, play/pause toggle, reset button, BPM/semitone display) are straightforward extensions of the Phase 1 architecture — no new libraries needed, no architectural changes beyond inserting the GainNode into the existing graph.

**Primary recommendation:** Patch `soundtouch-processor.js` to accept `processorOptions.sequenceMs = 40`, `processorOptions.seekWindowMs = 15`, `processorOptions.overlapMs = 8`. Pass these via `new AudioWorkletNode(ctx, name, { processorOptions: {...} })` inside the extended `SoundTouchNode` constructor or by using a raw `AudioWorkletNode` directly. All other Phase 2 controls extend existing patterns from Phase 1.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@soundtouchjs/audio-worklet` | 1.0.8 | Time-stretch + pitch-shift via AudioWorklet | Already in place (esm.sh CDN) |
| Web Audio API | Browser native | AudioContext, GainNode, AudioBufferSourceNode, AudioParam | Already in place |
| `unmute-ios-audio` | 3.3.0 | iOS mute switch workaround | Already in place |

No new packages are required for Phase 2. All controls wire into existing architecture.

### Verified AudioParams in v1.0.8

Confirmed directly from `soundtouch-processor.js` source (lines 833–870):

| AudioParam name | Default | Range | Automation rate |
|-----------------|---------|-------|-----------------|
| `pitch` | 1.0 | 0.25–4.0 | k-rate |
| `tempo` | 1.0 | 0.25–4.0 | k-rate |
| `rate` | 1.0 | 0.25–4.0 | k-rate |
| `pitchSemitones` | 0 | -24–24 | k-rate |
| `playbackRate` | 1.0 | 0.25–4.0 | k-rate |

**For Phase 2, only `pitchSemitones` and `playbackRate` are used.** The `tempo` param is NOT used (tandem pattern uses `source.playbackRate` + `stNode.playbackRate` per CLAUDE.md).

---

## Architecture Patterns

### Recommended Project Structure (unchanged from Phase 1)

```
pandero/
  poc.js                     # Phase 2 — extend existing (D-01)
  poc.html                   # Phase 2 — extend existing (D-01)
  pandero.mp3                # unchanged
  soundtouch-processor.js    # PATCHED in Phase 2 — add processorOptions support
```

### Pattern 1: GainNode Insertion (CTRL-04)

**What:** Insert a `GainNode` between `stNode` and `audioCtx.destination`. The gain node sits at the output stage — after SoundTouch processing, before the hardware output. This is the canonical position for a volume control.

**Why not before stNode:** SoundTouch processes at full amplitude regardless of gain; placing gain post-processing avoids any potential interaction with the algorithm's internal level detection.

**When to create:** Inside `init()`, alongside `AudioContext` creation. Store as a module singleton alongside `audioCtx`.

```javascript
// Inside init() — create once, store as singleton
gainNode = audioCtx.createGain();
gainNode.gain.value = 1.0;  // default per D-15

// Graph: source -> stNode -> gainNode -> destination
stNode.connect(gainNode);
gainNode.connect(audioCtx.destination);
```

**Volume update (CTRL-04 + D-16):**
```javascript
// Direct assignment — no AudioParam scheduling needed for volume
function handleVolumeChange(e) {
  if (!gainNode) return;
  gainNode.gain.value = parseFloat(e.target.value);
}
```

### Pattern 2: Play/Pause Toggle State Machine (CTRL-01)

**What:** Single button toggles between play and pause. Click-while-playing restarts from beginning (D-04). Uses `audioCtx.suspend()/resume()` for true pause (preserves position).

**State machine:**

```
[UNINITIALIZED] --click--> [LOADING] --init complete--> [PLAYING]
[PLAYING]       --click--> [PLAYING] (restart — D-04: stop old source, create new, start)
[PAUSED]        --click--> [PLAYING] (resume via audioCtx.resume())
[PLAYING]       --double-handled by toggle logic--> (see below)
```

**IMPORTANT — D-04 implementation:** "Click while playing = restart" means the toggle function must check `isPlaying` and call `play()` directly (which creates a new source node and starts from zero) rather than going through pause first.

```javascript
// Toggle function — replaces separate play() and pause() buttons
async function togglePlayback() {
  if (!isInitialized) {
    // First click — show loading state (D-06)
    toggleBtn.disabled = true;
    document.getElementById('status').textContent = 'Cargando...';
    await init();
    toggleBtn.disabled = false;
  }

  if (!isPlaying) {
    // Was paused (or never started) — resume or start
    await audioCtx.resume();
    if (!source) {
      await startPlayback();  // first play ever
    }
    isPlaying = true;
    toggleBtn.textContent = '⏸';
  } else {
    // Was playing — D-04: restart from beginning
    await startPlayback();  // creates new source, starts from 0
    // isPlaying stays true, button stays ⏸
  }
}

async function pausePlayback() {
  // Called externally if needed (e.g., page visibility change)
  await audioCtx.suspend();
  isPlaying = false;
  toggleBtn.textContent = '▶';
}
```

**Note (from CONTEXT.md specifics):** This deviates from the roadmap success criterion ("pressing play again resumes from correct loop position"). The user has explicitly overridden this — restart is intentional.

### Pattern 3: Reset Button (CTRL-05)

**What:** Resets tempo to 1.0 and pitch to 0 simultaneously (D-07, D-08). Volume is NOT reset (D-08). Applies live if audio is playing.

```javascript
function handleReset() {
  // Reset slider elements
  document.getElementById('tempo').value = 1.0;
  document.getElementById('pitch').value = 0;

  // Update displays
  document.getElementById('tempo-val').textContent = Math.round(1.0 * 111); // 111
  document.getElementById('pitch-val').textContent = '0';

  // Apply live to audio engine — tandem pattern (D-09)
  if (source && stNode) {
    source.playbackRate.value = 1.0;
    stNode.playbackRate.value = 1.0;
    stNode.pitchSemitones.value = 0;
  }
}
```

### Pattern 4: BPM and Semitone Live Display (VIS-01, VIS-02)

**BPM formula (D-10, D-12):**
```javascript
// In handleTempoChange:
const bpm = Math.round(ratio * 111);  // Base BPM = 111 (cueca pandero)
document.getElementById('tempo-val').textContent = bpm;  // integer, no label
```

**Semitone display (D-13, D-14):**
```javascript
// In handlePitchChange:
const semitones = parseInt(e.target.value);
const display = semitones === 0 ? '0' : (semitones > 0 ? `+${semitones}` : `${semitones}`);
document.getElementById('pitch-val').textContent = display;
```

### Anti-Patterns to Avoid

- **Using `stNode.tempo.value` directly for tempo:** Creates silence gaps at ratio > 1.0. Always use tandem: `source.playbackRate.value = ratio; stNode.playbackRate.value = ratio;` (confirmed working in Phase 1).
- **Scheduling `gainNode.gain.linearRampToValueAtTime` for slider interaction:** Over-engineering. Direct `gainNode.gain.value = float` is correct for interactive volume sliders.
- **Creating GainNode on each play() call:** The GainNode must be created once in `init()` and reused. Creating it per-play resets the volume to 1.0 on every restart.
- **Disconnecting GainNode on restart:** When restarting (new source + new stNode), only disconnect the old `source` and `stNode` — reconnect the new stNode to the existing `gainNode`. The gainNode-to-destination connection persists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Volume control | Custom amplitude math | `GainNode` (Web Audio native) | Thread-safe, automatable, zero-overhead |
| BPM conversion | Complex formula | `Math.round(ratio * 111)` | One line — this is the formula |
| Semitone sign formatting | Regex or conditional chain | Ternary: `n === 0 ? '0' : n > 0 ? '+' + n : '' + n` | Two conditions only |
| AudioParam writes | setTimeout-based scheduling | Direct `.value` assignment on `input` event | AudioParams are thread-safe by design |

---

## WSOLA Artifact Elimination (CRITICAL)

This section answers D-17 through D-20 — the primary research question.

### Root Cause: Auto-Calculated Sequence Lengths Are Too Long for Percussion

Source: verified by reading `soundtouch-processor.js` lines 372–596 directly.

The `Stretch` class uses auto-calculation (when `sequenceMs = 0`, `seekWindowMs = 0`) based on these formulas:

```
AUTOSEQ_AT_MIN = 125ms,  AUTOSEQ_AT_MAX = 50ms
AUTOSEEK_AT_MIN = 25ms,  AUTOSEEK_AT_MAX = 15ms
sequenceMs = AUTOSEQ_C + AUTOSEQ_K * tempo  (clamped to [50, 125])
seekWindowMs = AUTOSEEK_C + AUTOSEEK_K * tempo  (clamped to [15, 25])
overlapMs = 8ms  (fixed, never changes)
```

**Computed actual values across the Phase 2 tempo range:**

| Tempo ratio | BPM (cueca) | sequenceMs | seekWindowMs | overlapMs |
|-------------|-------------|------------|--------------|-----------|
| 0.5× | 56 | 120ms | 24ms | 8ms |
| 0.7× | 78 | 116ms | 24ms | 8ms |
| 1.0× | 111 | 110ms | 23ms | 8ms |
| 1.2× | 133 | 106ms | 22ms | 8ms |
| 1.5× | 167 | 100ms | 22ms | 8ms |

**Why this sounds robotic on percussion:** The SoundTouch README states defaults were chosen for pop/rock music (vocals, melodic instruments). For percussion, each ~110ms sequence chunk contains 1–2 full pandero beats — the algorithm is repeating/compressing entire rhythmic patterns. Transient doubling and smearing occur because the overlap regions span the exact attack regions of drum hits. Academic TSM literature (ResearchGate, WSOLA Enhanced paper) confirms: for purely percussive signals, sequence lengths of ~10-40ms are required to avoid transient doubling.

### The API Gap: No Exposed WSOLA Controls in v1.0.8

Confirmed from source code analysis:

- `SoundTouchNode` constructor: `new SoundTouchNode(audioCtx)` — no options parameter passed to worklet.
- `SoundTouchProcessor` constructor: `super()` with no `processorOptions` handling — the `Stretch` is always initialized with defaults.
- No `port.onmessage` handler in the processor — no runtime parameter update path.
- README confirms: only `pitch`, `tempo`, `rate`, `pitchSemitones`, `playbackRate` are exposed.

**Conclusion:** WSOLA parameters cannot be changed via the public API. The local `soundtouch-processor.js` must be patched.

### Solution: Patch Local soundtouch-processor.js

The `AudioWorkletProcessor` specification supports `processorOptions` — a plain object passed through the `AudioWorkletNode` constructor options that is available in the processor's constructor as `options.processorOptions`.

**Step 1 — Patch the processor constructor** (modify local `soundtouch-processor.js`):

The `SoundTouchProcessor` constructor at line 875 currently:
```javascript
constructor() {
  super();
  this._pipe = new SoundTouch();
  // ...
}
```

Must become (receiving processorOptions):
```javascript
constructor(options) {
  super(options);
  this._pipe = new SoundTouch();
  const po = (options && options.processorOptions) || {};
  if (po.sequenceMs || po.seekWindowMs || po.overlapMs) {
    this._pipe.stretch.setParameters(
      sampleRate,  // AudioWorkletGlobalScope provides sampleRate
      po.sequenceMs   || 0,  // 0 = keep auto if not specified
      po.seekWindowMs || 0,
      po.overlapMs    || 8
    );
  }
  // ...
}
```

**Step 2 — Pass options when creating the node** (in `poc.js`):

Instead of `new SoundTouchNode(audioCtx)`, create an `AudioWorkletNode` directly with options:
```javascript
// Option A: Use raw AudioWorkletNode (avoids needing to modify SoundTouchNode.js)
stNode = new AudioWorkletNode(audioCtx, 'soundtouch-processor', {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  processorOptions: {
    sequenceMs:   40,  // percussion target
    seekWindowMs: 15,
    overlapMs:    8
  }
});
// Then attach AudioParams manually — or use the SoundTouchNode as reference
```

**Option B (cleaner):** Extend `SoundTouchNode` to forward `processorOptions`:
```javascript
// In poc.js — create SoundTouchNode then immediately use its port to pass params
stNode = new SoundTouchNode(audioCtx);
stNode.port.postMessage({ type: 'setParameters', sequenceMs: 40, seekWindowMs: 15, overlapMs: 8 });
// (Requires adding port.onmessage to the processor as well)
```

**Recommended approach for Phase 2:** Option A (raw `AudioWorkletNode`) is simpler — no port.onmessage handler needed, no SoundTouchNode subclassing. The AudioParams (`pitchSemitones`, `playbackRate`) are still accessible via `stNode.parameters.get('pitchSemitones')` and `stNode.parameters.get('playbackRate')`.

### Recommended WSOLA Parameter Values

**Source:** SoundTouch C++ README (primary), academic TSM literature (secondary), algorithm math (verified).

| Parameter | Percussion target (pandero) | Polyphonic target (future guitar) | Why different |
|-----------|----------------------------|-----------------------------------|---------------|
| `sequenceMs` | **40ms** | **80ms** | Percussion: short chunks avoid transient doubling; polyphonic: longer chunks give pitch algorithm more context |
| `seekWindowMs` | **15ms** | **20ms** | Proportional to sequenceMs; smaller = less "drifting" |
| `overlapMs` | **8ms** | **8ms** | Default is fine; changing rarely improves results |

**Confidence:** MEDIUM. The SoundTouch README confirms "short sequence sizes give best results for percussion" with community examples citing 40ms/15ms/8ms. The exact optimal values for this specific pandero recording require empirical testing — these are strong starting points, not guaranteed final values.

**Adaptive tuning (D-20 consideration):** The original auto-calculation varies sequenceMs with tempo. A simple adaptive approach for v1 (optional): use the same fixed percussion values across the full 0.5×–1.5× range. The variation in auto-calculated values is only 20ms total (100–120ms) — the improvement from 110ms → 40ms dominates by far. Fixed 40ms is appropriate for Phase 2.

**Future guitar (v2, INST-01):** When guitar is added, a separate SoundTouchNode instance for the guitar track should use 80ms/20ms/8ms. The `QUAL-01` requirement already calls for evaluating RubberBand WASM for polyphonic instruments if SoundTouch shows artifacts — that evaluation can happen in v2.

### A Single Parameter Set for Both (D-19)?

The question "can one set work for both percussion and guitar?" has a nuanced answer:

- **40ms** works reasonably well for guitar (slightly less natural than 80ms but acceptable)
- **80ms** on percussion is still better than the current 110ms auto default, but audibly inferior to 40ms
- **Recommendation:** Use 40ms for Phase 2 (pandero only). When guitar is added in v2, evaluate a dedicated guitar node with 80ms. If forced to a single value: 50ms is a reasonable compromise.

---

## Common Pitfalls

### Pitfall 1: GainNode Created Inside play() — Volume Resets on Restart

**What goes wrong:** GainNode created inside `play()` (alongside the new source + stNode). Every restart reinitializes gain to 1.0, ignoring the user's volume slider setting.

**Prevention:** Create GainNode once in `init()`. On restart, disconnect only the old `source` and old `stNode` — leave `gainNode` connected to `destination`. New `stNode.connect(gainNode)` on each play.

**Pattern:**
```javascript
// init():
gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);  // permanent connection

// play() (each restart):
stNode = new SoundTouchNode(audioCtx);  // or AudioWorkletNode
stNode.connect(gainNode);  // connects to existing gainNode
// gainNode stays connected to destination
```

### Pitfall 2: Toggle Button State Out of Sync with AudioContext State

**What goes wrong:** The button shows ⏸ but `audioCtx.state` is `'suspended'`, or vice versa. Can happen if iOS interrupts the context (`'interrupted'` state) without user action.

**Prevention:** Always derive button state from `isPlaying` (the JS variable), not `audioCtx.state`. On `audioCtx.onstatechange`, update `isPlaying` and button accordingly.

### Pitfall 3: Reset While Paused Applies AudioParam Values That Take Effect on Resume

**What goes wrong:** User clicks Reset while paused. `source.playbackRate.value` is set to 1.0. This is actually correct behavior — the new value applies immediately when `resume()` is called. But if the sliders were reset to 1.0 / 0 visually without updating the AudioParams, the audio plays at the old values on resume.

**Prevention:** D-09 explicitly says reset applies live AudioParam updates even while paused. The `audioCtx.suspend()` state does not block AudioParam value changes — they are applied when the context resumes. So the pattern is correct: always update AudioParam values on reset, regardless of `isPlaying`.

### Pitfall 4: WSOLA Processor Patch — `sampleRate` Access in Worklet Constructor

**What goes wrong:** Inside `AudioWorkletProcessor`, `sampleRate` is a global in `AudioWorkletGlobalScope` — it is accessible directly as `sampleRate` (not `this.sampleRate`). Using `audioCtx.sampleRate` (main thread value) in a message-passing approach would work fine, but in the constructor it must come from the worklet global.

**Why it matters:** `stretch.setParameters(sampleRate, ...)` requires the actual sample rate. In `AudioWorkletGlobalScope`, `sampleRate` is always available as a global at construction time.

**Prevention:** In the patched processor constructor, use `sampleRate` (global) directly, not any property from the options.

### Pitfall 5: Semitone Display — `+0` Edge Case

**What goes wrong:** A naive implementation of signed integer display shows `+0` when pitch is at center. D-13 specifies `0` (no sign) at zero.

**Prevention:**
```javascript
const n = parseInt(e.target.value);
const display = n === 0 ? '0' : (n > 0 ? `+${n}` : `${n}`);
```

---

## Code Examples

Verified patterns from source analysis and Web Audio API specification.

### Complete Graph With GainNode

```javascript
// init() — called once on first user gesture
async function init() {
  if (isInitialized) return;
  isInitialized = true;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await SoundTouchNode.register(audioCtx, './soundtouch-processor.js');

  const arrayBuffer = await mp3Promise;
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Create GainNode once — permanent connection to destination
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.0;
  gainNode.connect(audioCtx.destination);
}

// startPlayback() — called on each play/restart
async function startPlayback() {
  if (source) source.disconnect();
  if (stNode) stNode.disconnect();

  // Create SoundTouchNode (or patched AudioWorkletNode) with WSOLA params
  stNode = new SoundTouchNode(audioCtx);
  // After processor patch: stNode = new AudioWorkletNode(audioCtx, 'soundtouch-processor', {
  //   numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
  //   processorOptions: { sequenceMs: 40, seekWindowMs: 15, overlapMs: 8 }
  // });

  stNode.connect(gainNode);  // stNode -> gainNode -> destination (gainNode already connected)

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;

  const ratio = parseFloat(document.getElementById('tempo').value);
  source.playbackRate.value = ratio;
  source.connect(stNode);
  stNode.playbackRate.value = ratio;  // tandem pattern
  stNode.pitchSemitones.value = parseInt(document.getElementById('pitch').value);

  source.start();
}
```

### BPM Display Update

```javascript
function handleTempoChange(e) {
  if (!source || !stNode) return;
  const ratio = parseFloat(e.target.value);
  source.playbackRate.value = ratio;
  stNode.playbackRate.value = ratio;
  document.getElementById('tempo-val').textContent = Math.round(ratio * 111);
}
```

### Semitone Signed Display

```javascript
function handlePitchChange(e) {
  if (!stNode) return;
  const n = parseInt(e.target.value);
  stNode.pitchSemitones.value = n;
  document.getElementById('pitch-val').textContent = n === 0 ? '0' : (n > 0 ? `+${n}` : `${n}`);
}
```

### Reset Handler

```javascript
function handleReset() {
  document.getElementById('tempo').value = 1.0;
  document.getElementById('pitch').value = 0;
  document.getElementById('tempo-val').textContent = '111';
  document.getElementById('pitch-val').textContent = '0';
  if (source && stNode) {
    source.playbackRate.value = 1.0;
    stNode.playbackRate.value = 1.0;
    stNode.pitchSemitones.value = 0;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode (main thread) | AudioWorklet (audio thread) | Chrome 66, 2018 | No UI jank; required for v1.0.x |
| stNode.tempo for tempo control | Tandem: source.playbackRate + stNode.playbackRate | Documented in @soundtouchjs README | Eliminates silence gaps at high tempos |
| Auto WSOLA parameters (pop/rock defaults) | Manual WSOLA override via processorOptions | Phase 2 patch | Eliminates robotic sound on percussion |
| Separate play/pause buttons | Single toggle button | Phase 2 (D-03) | Simpler UI; restart-on-click is deliberate |

---

## Open Questions

1. **Exact optimal WSOLA values for this specific pandero recording**
   - What we know: 40ms/15ms/8ms is well-supported by SoundTouch documentation and academic TSM research for percussion
   - What's unclear: Whether this specific recording (111 BPM, 3/4–6/8 time, close-mic'd pandero) might benefit from slightly different values (e.g., 30ms or 50ms)
   - Recommendation: Implement 40ms/15ms/8ms as starting point. Add a verification step in the plan: play test at 0.5×, 0.75×, 1.0×, 1.25×, 1.5× and adjust if still robotic.

2. **AudioWorkletNode vs SoundTouchNode for processorOptions**
   - What we know: `SoundTouchNode` constructor does not currently pass `processorOptions`; raw `AudioWorkletNode` does
   - What's unclear: Whether subclassing `SoundTouchNode` (to extend the constructor) or switching to raw `AudioWorkletNode` is cleaner for this codebase
   - Recommendation: Use raw `AudioWorkletNode` with explicit parameter names — avoids modifying the SoundTouchNode import and keeps the patch localized to poc.js and soundtouch-processor.js only

3. **stNode AudioParam access on raw AudioWorkletNode**
   - What we know: On a raw `AudioWorkletNode`, AudioParams are accessed via `node.parameters.get('pitchSemitones')` instead of `node.pitchSemitones`
   - What's unclear: Whether `SoundTouchNode`'s getter properties (`node.pitchSemitones`, `node.playbackRate`) are indispensable or easy to replicate
   - Recommendation: Use `SoundTouchNode` with a patched processor (pass processorOptions in the `SoundTouchNode` subclass, or post-construct via `stNode.port.postMessage`). This preserves the convenient property access pattern from Phase 1.

---

## Sources

### Primary (HIGH confidence)

- Local `pandero/soundtouch-processor.js` (v1.0.8 bundled source) — WSOLA defaults, auto-calculation formulas, AudioParam list, constructor structure. Lines 372–929 read directly.
- MDN Web Audio API — `GainNode`, `AudioWorkletProcessor`, `AudioWorkletNode`, `processorOptions` specification.
- SoundTouch C++ README (www.surina.net/soundtouch/README.html) — authoritative WSOLA parameter documentation from original algorithm author. Confirmed: defaults are for pop/rock; percussion benefits from shorter sequence lengths.

### Secondary (MEDIUM confidence)

- @soundtouchjs/audio-worklet v1.0.8 README (unpkg.com) — confirmed AudioParam list and absence of WSOLA configuration options.
- Academic: "Time-Scale Modification of Audio Signals Using Enhanced WSOLA With Management of Transients" (ResearchGate) — confirms WSOLA transient doubling problem; supports short sequence lengths for percussion.
- SoundTouchJS GitHub issues (cutterbl/SoundTouchJS) — confirmed no closed issues with percussion-specific WSOLA tuning guidance.

### Tertiary (LOW confidence — flag for empirical validation)

- Community-cited values of 40ms/15ms/8ms for percussion — sourced from web search synthesis, not a single authoritative document. Must be validated by listening test on actual pandero recording.

---

## Metadata

**Confidence breakdown:**
- Root cause of robotic artifacts: HIGH — verified by reading processor source and computing actual values
- WSOLA parameter API gap: HIGH — confirmed by reading SoundTouchNode.js source directly
- Patch approach (processorOptions): HIGH — standard AudioWorklet spec feature
- Recommended parameter values (40ms/15ms): MEDIUM — well-supported but requires empirical validation on this recording
- GainNode integration: HIGH — standard Web Audio pattern, fully specified in CONTEXT.md
- Toggle/reset patterns: HIGH — straightforward extension of Phase 1 patterns

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable domain; only risk is a @soundtouchjs major version change)
