# Phase 4: Cueca-Specific UX Refinements - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify and refine the widget for the cueca musician: a single tempo slider at a cueca-appropriate default BPM, a more legible and tasteful typeface, and removal of pitch and volume controls. The audio engine is untouched — only the DOM structure, CSS, and initial values change.

</domain>

<decisions>
## Implementation Decisions

### Default tempo
- **D-01:** Initial tempo slider value = 112 BPM (ratio = 112/111 ≈ 1.009). Change `player.js` sliderRow default from `1.0` to `1.009` and initial display from `'111 BPM'` to `'112 BPM'`.

### Control simplification (permanent)
- **D-02:** Remove pitch (Tono) slider — permanently. Not deferred. Delete `sliderRow('pitch', ...)` from `buildDOM()`, remove `handlePitchChange()`, remove `pitchSlider` event listener, remove `stNode.parameters.get('pitchSemitones')` call from `startPlayback()`.
- **D-03:** Remove volume slider — permanently. Not deferred. Delete `sliderRow('volume', ...)` from `buildDOM()`, remove `handleVolumeChange()`, remove `volumeSlider` event listener. GainNode can remain in `init()` at fixed `1.0` gain (no harm keeping it; removing it would require rewiring the audio graph).
- **D-04:** Only one slider remains in the widget: Tempo.

### Slider label
- **D-05:** No "Tempo" label — the slider row header shows only the live BPM value (e.g. `112 BPM`). Remove the `<label>` element from the tempo slider row, keep only the `<span class="pandero-value">` with BPM.

### Typography
- **D-06:** Replace Caveat with **Lora** (Google Fonts, self-hosted woff2). Download Lora Regular (400) woff2 to `pandero/lora-regular.woff2`.
- **D-07:** Update `@font-face` in `player.css` to reference `lora-regular.woff2`. Update `--pandero-font` token.
- **D-08:** Increase label/value sizes for legibility: `--pandero-size-label: 1rem` (up from 0.9rem), `--pandero-size-value: 1.25rem` (up from 1.1rem).

### Spanish labels
- **D-09:** "Pitch" → "Tono" (moot — slider removed). No other label changes needed: "Tempo" label is removed per D-05, "Volumen" slider is removed per D-03.

### Claude's Discretion
- Exact Lora woff2 URL (fetch from Google Fonts API if the direct URL has changed, same approach used for Caveat in Phase 3)
- Whether to remove the Caveat `@font-face` declaration or keep it as a fallback
- Whether to remove Caveat woff2 file from `pandero/` (safe to remove — nothing references it after this phase)
- CSS cleanup of now-unused slider-related styles (pitch/volume rows are gone, but `.pandero-slider` styles remain valid for the tempo slider — keep them)

</decisions>

<specifics>
## Specific Ideas

- "The widget should feel like a single focused instrument control — not a DAW"
- Vocabulary labels (lento / normal / animado) were considered but deferred — the simplified single-slider layout already communicates purpose through BPM alone
- The font change is about the widget feeling crafted and legible, not cheap — Lora's calligraphic warmth fits the earthy identity established in Phase 3

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files to modify
- `pandero/player.js` — Source of truth for DOM creation and audio engine; sliderRow calls, event wiring, startPlayback() pitch params
- `pandero/player.css` — @font-face, CSS custom property tokens (--pandero-font, --pandero-size-label, --pandero-size-value)

### Prior phase decisions (locked, do not regress)
- `planning/phases/03-mobile-polish-and-embedding/03-CONTEXT.md` — D-01 through D-19: visual identity, hexagon button, CSS isolation, embedding contract (all still apply)
- `planning/phases/01-audio-engine-foundation/01-CONTEXT.md` — Base BPM = 111; tandem playbackRate pattern; single AudioContext; GainNode singleton

### Non-negotiable audio rules
- `CLAUDE.md` §Critical Implementation Rules — tandem pattern, single AudioContext, suspend/resume for pause; do not remove GainNode even if volume slider is gone

### Requirements coverage
- `planning/REQUIREMENTS.md` — CUE-01 (default tempo ~90–100 BPM — user set 112 BPM, slightly above range but this is the right musical value)

</canonical_refs>

<code_context>
## Existing Code Insights

### What changes in player.js
- `buildDOM()` lines 73–77: remove `sliderRow('pitch', ...)` and `sliderRow('volume', ...)` calls; remove `<label>` from tempo row
- `startPlayback()` line 167: remove `stNode.parameters.get('pitchSemitones').value = ...` (no pitch slider)
- Event wiring lines 235–242: remove `pitchSlider` and `volumeSlider` declarations and listeners
- `handlePitchChange()` and `handleVolumeChange()` functions: delete entirely
- `handleTempoChange()` line 206: `document.getElementById('pandero-tempo-val')` — still valid, keep as-is

### What changes in player.css
- `@font-face`: change to Lora, update `src` URL and family name
- `--pandero-font`: update value
- `--pandero-size-label` and `--pandero-size-value`: increase values

### What does NOT change
- Audio graph wiring (GainNode stays)
- Hexagon button, clip-path, colors, touch targets
- Tandem playbackRate pattern in startPlayback()
- Space key handler
- isSecureContext guard
- import.meta.url asset resolution

</code_context>

<deferred>
## Deferred Ideas

- Vocabulary labels ("lento / normal / animado") on the tempo slider — discussed, not needed yet
- Re-adding pitch or volume controls — user confirmed permanent removal for v1

</deferred>

---

*Phase: 04-cueca-specific-ux-refinements*
*Context gathered: 2026-03-22*
