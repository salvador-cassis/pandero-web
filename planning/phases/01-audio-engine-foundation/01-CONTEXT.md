# Phase 1: Audio Engine Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Proof-of-concept page: load `pandero.mp3`, initialize `@soundtouchjs/audio-worklet` AudioWorklet pipeline, expose raw tempo and pitch controls, verify independent control works end-to-end including on real iOS Safari with hardware mute switch engaged. No UI polish — just the engine verified working.

</domain>

<decisions>
## Implementation Decisions

### Pandero recording metadata
- **D-01:** Base BPM = **111 BPM**
- **D-02:** Time signature: **3/4 — 6/8** (cueca rhythmic feel)
- This value is the denominator for all tempo ratio → BPM display calculations in Phase 2

### Claude's Discretion
- Library delivery mechanism (CDN via importmap, local copy, or minimal build step)
- Local dev server choice (`python3 -m http.server`, `npx serve`, etc.)
- Proof-of-concept page structure (minimal raw HTML controls, no styling)
- SoundTouch WSOLA parameter tuning for percussion material (`setSequenceLengthMs`, `setSeekWindowLengthMs`, `setOverlapLengthMs`)

</decisions>

<specifics>
## Specific Ideas

- Previous iOS version used RubberBand — the user is familiar with the time-stretching concept and expects the same independent-control behavior
- The proof-of-concept only needs to prove the pipeline works — it doesn't need to look good

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `planning/ROADMAP.md` §Phase 1 — Success criteria, 3 plan breakdown, technical decisions
- `planning/REQUIREMENTS.md` §Audio Engine — ENG-01 through ENG-06 (requirements this phase covers)
- `planning/research/SUMMARY.md` — Full stack recommendation, critical pitfalls, architecture overview

### Critical pitfalls (must read before writing any code)
- `planning/research/PITFALLS.md` — 16 documented browser audio pitfalls; most critical for Phase 1:
  - AudioContext before user gesture → complete silence (no error)
  - iOS hardware mute switch silences Web Audio (not HTML audio)
  - AudioWorklet fails on `file://` — must use HTTPS or localhost
  - SoundTouchJS v0.2.0+ is ESM-only (no `<script src>`)
  - Tempo gap artifact at ratios > 1.0x — requires `playbackRate` tandem pattern

### Architecture
- `planning/research/ARCHITECTURE.md` — Three-layer architecture, data flow, AudioWorklet threading model

### Stack
- `planning/research/STACK.md` — `@soundtouchjs/audio-worklet` v1.0.8, `unmute-ios-audio` (feross), rejected alternatives

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pandero.mp3` — Already at project root. Move to `pandero/pandero.mp3` during scaffold.

### Established Patterns
- None yet — greenfield project

### Integration Points
- Phase 1 output (`pandero/` directory with `player.js` + `soundtouch-processor.js`) becomes the foundation for Phase 2 UI controls

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-audio-engine-foundation*
*Context gathered: 2026-03-22*
