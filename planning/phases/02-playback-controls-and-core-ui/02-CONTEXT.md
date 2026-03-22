# Phase 2: Playback Controls and Core UI - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all table-stakes controls to the Phase 1 audio engine: play/pause toggle, tempo slider, pitch slider, volume slider, reset button, live BPM display, live semitone display. No visual polish — functional controls that work correctly on desktop and mobile touch.

</domain>

<decisions>
## Implementation Decisions

### File strategy
- **D-01:** Phase 2 continues in `poc.html` and `poc.js` (not graduating to `player.js` yet — that happens in Phase 3 when embedding contract is implemented)
- **D-02:** Add a `GainNode` between `stNode` and `audioCtx.destination` for volume control (CTRL-04)

### Play/pause toggle
- **D-03:** Single toggle button — one button, changes between ▶ (icon only) and ⏸ (icon only)
- **D-04:** Clicking while audio is playing → **restart from beginning** (stop current source, create new one, call play())
- **D-05:** Initial button state: ▶ icon only, no text
- **D-06:** Loading state on first click: button disabled + status text shows "Cargando..." during the async init() call

### Reset behavior
- **D-07:** Reset button returns tempo slider to 1.0 (ratio) and pitch slider to 0 (semitones) simultaneously
- **D-08:** Volume is NOT reset — only tempo and pitch (per CTRL-05 requirement)
- **D-09:** Reset applies live AudioParam updates (tandem pattern for tempo) even while audio is playing

### BPM display
- **D-10:** BPM shown as **integer** — `Math.round(ratio × 111)` — e.g., 111, 55, 167
- **D-11:** BPM value appears inline to the right of the tempo slider (compact, same pattern as current poc.html)
- **D-12:** No percentage label — BPM only (musicians care about BPM, not ratios)

### Semitone display
- **D-13:** At zero: show `0` (no sign). For non-zero: show `+2`, `-3` (signed integers)
- **D-14:** Value updates live on slider input, same as tempo

### Volume slider
- **D-15:** Default volume = 1.0 (full). Range: 0.0–1.0, step 0.01
- **D-16:** Wired to `gainNode.gain.value` directly (no AudioParam scheduling needed — direct assignment on input event)

### Claude's Discretion
- Exact HTML structure and element IDs
- Whether to show a "%" label next to the volume slider
- Slider step values for tempo and volume
- Status text wording beyond "Cargando..."

</decisions>

<specifics>
## Specific Ideas

- **Restart on play-while-playing** contradicts the roadmap success criterion ("pressing play again resumes from the correct loop position") — this is a deliberate user override. Planner should note this deviation.
- The play button should use icon only (▶/⏸), no text — clean minimal look

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing implementation (read first)
- `dairapp/poc.js` — Phase 1 audio engine: singleton pattern, tandem playbackRate, suspend/resume, SoundTouchNode wiring
- `dairapp/poc.html` — Current HTML structure: importmap, isSecureContext guard, existing slider/button IDs

### Phase 2 requirements
- `.planning/REQUIREMENTS.md` §Controles de Reproducción — CTRL-01 through CTRL-05
- `.planning/REQUIREMENTS.md` §Visualización — VIS-01, VIS-02

### Audio engine rules (non-negotiable)
- `CLAUDE.md` §Critical Implementation Rules — tandem playbackRate pattern, single AudioContext per widget, suspend/resume for pause
- `.planning/phases/01-audio-engine-foundation/01-CONTEXT.md` — Base BPM = 111, D-06 tandem pattern, D-07 suspend/resume

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dairapp/poc.js`: `handleTempoChange()` already implements tandem pattern — extend, don't rewrite
- `dairapp/poc.js`: `play()` and `pause()` functions — refactor play() into toggle, reuse pause() logic
- `dairapp/poc.html`: existing importmap + isSecureContext guard — keep as-is

### Established Patterns
- Tandem pattern: `source.playbackRate.value = ratio; stNode.playbackRate.value = ratio;` — MUST be replicated in reset button
- `audioCtx.suspend()/resume()` for pause — do not use `source.stop()`
- New `SoundTouchNode` on each play() call — stale node avoidance pattern

### Integration Points
- Volume GainNode inserts between stNode and destination: `stNode.connect(gainNode); gainNode.connect(audioCtx.destination)`
- GainNode must be created in `init()` alongside AudioContext, stored as module singleton

</code_context>

<deferred>
## Deferred Ideas

- `player.js` graduation (embedding contract) — Phase 3
- Cueca tempo labels ("lento / normal / animado") — Phase 4 (CUE-02)
- Default BPM at ~90–100 (CUE-01) — Phase 4
- Touch target sizing for mobile — Phase 3 (UI-02)

</deferred>

---

*Phase: 02-playback-controls-and-core-ui*
*Context gathered: 2026-03-22*
