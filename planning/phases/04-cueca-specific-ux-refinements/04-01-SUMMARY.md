---
phase: 04-cueca-specific-ux-refinements
plan: 01
subsystem: ui
tags: [font, woff2, lora, css-tokens, audio-widget, dom]

# Dependency graph
requires:
  - phase: 03-mobile-polish-and-embedding
    provides: player.js and player.css with Caveat font, three sliders, full widget DOM
provides:
  - Single-slider tempo widget at 112 BPM default with Lora font self-hosted
  - Simplified DOM: no pitch or volume elements
  - Updated CSS tokens for Lora family, 1rem / 1.25rem font sizes
affects: [05-any-future-phase, embedding-docs]

# Tech tracking
tech-stack:
  added: [lora-regular.woff2 (Google Fonts, self-hosted)]
  patterns: [conditional label rendering in sliderRow (null = no label)]

key-files:
  created: [pandero/lora-regular.woff2]
  modified: [pandero/player.js, pandero/player.css]

key-decisions:
  - "Default tempo set to 1.009 ratio (112/111 BPM) — cueca performance tempo per D-01"
  - "Pitch and volume sliders permanently removed — widget is single focused control per D-02/D-03"
  - "GainNode kept at fixed 1.0 gain even without volume slider — avoids rewiring audio graph per D-03"
  - "Tempo label removed (null passed to sliderRow) — only live BPM value displayed per D-05"
  - "Lora font replaces Caveat — calligraphic warmth with legibility per D-06/D-07"
  - "sliderRow conditionally creates label element only when label param is truthy"

patterns-established:
  - "sliderRow(id, null, ...) pattern: pass null for label to render value-only header"
  - "tandem playbackRate pattern preserved: source.playbackRate + stNode.parameters.get('playbackRate')"

requirements-completed: [CUE-01]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 4 Plan 01: Cueca-Specific UX Refinements Summary

**Single-slider tempo widget at 112 BPM default with self-hosted Lora font replacing Caveat, pitch and volume controls permanently removed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T00:28:09Z
- **Completed:** 2026-03-23T00:30:03Z
- **Tasks:** 3 of 3 complete (Tasks 1-2 auto, Task 3 human-verify — user approved)
- **Files modified:** 3 (lora-regular.woff2 created, player.css modified, player.js modified)

## Accomplishments
- Downloaded and self-hosted Lora Regular 400 woff2 from Google Fonts CDN
- Updated @font-face, --pandero-font, --pandero-size-label, --pandero-size-value CSS tokens
- Removed Caveat woff2 and all Caveat references from CSS
- Simplified buildDOM() to single tempo sliderRow at 112 BPM (ratio 1.009) with no label text
- Removed pitch slider, handlePitchChange(), pitchSlider event wiring, and pitchSemitones from startPlayback()
- Removed volume slider, handleVolumeChange(), volumeSlider event wiring
- GainNode preserved in audio graph at fixed gain 1.0 per CLAUDE.md rule
- Tandem playbackRate pattern untouched — gap-free tempo change preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Download Lora font and update CSS typography** - `3806fbe` (feat)
2. **Task 2: Simplify player.js — remove pitch/volume, set 112 BPM default, remove Tempo label** - `c00d200` (feat)
3. **Task 3: Verify simplified widget in browser** - human-verify checkpoint approved by user (no code commit)

## Files Created/Modified
- `pandero/lora-regular.woff2` - Self-hosted Lora Regular 400 font (12560 bytes, from Google Fonts CDN)
- `pandero/player.css` - Updated @font-face to Lora, token values for font/sizes, removed Caveat
- `pandero/player.js` - Single tempo slider at 112 BPM, no label, pitch/volume removed, GainNode preserved

## Decisions Made
- Default tempo ratio set to 1.009 (112/111) — slightly above 1.0 so BPM display shows exactly 112 BPM
- GainNode intentionally kept in init() even though volume slider is removed — rewiring audio graph is unnecessary complexity per D-03
- sliderRow function now conditionally renders label element: `if (label) { ... }` — null triggers value-only header
- Caveat woff2 file deleted (nothing references it after this phase)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- macOS `grep -P` (PCRE) not available for extracting the woff2 URL — used standard `grep -o` with bracket pattern instead. URL extracted successfully.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — single slider with live BPM display fully wired. Default 112 BPM rendered from initial sliderRow valText parameter.

## Next Phase Readiness

Phase 4 Plan 01 is complete. Phase 4 is complete. CUE-01 satisfied.

- Widget verified in browser — Lora font renders, single tempo slider shows 112 BPM, audio plays and updates live
- CUE-02 (vocabulary labels) deferred by user decision — no further Phase 4 plans are needed
- The widget is a self-contained embeddable cueca backing track tool, ready for production use
- Only remaining open item: ENG-06 iOS mute-switch verification on real hardware (from plan 01-03) — unrelated to this phase

## Self-Check: PASSED

All files exist on disk. Both task commits verified in git history.

---
*Phase: 04-cueca-specific-ux-refinements*
*Completed: 2026-03-23*
