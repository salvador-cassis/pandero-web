---
phase: 03-mobile-polish-and-embedding
plan: 02
subsystem: ui
tags: [es-module, audio-worklet, soundtouch, unmute-ios-audio, programmatic-dom, import-meta-url]

# Dependency graph
requires:
  - phase: 03-01
    provides: pandero/player.css — CSS classes (pandero-widget, pandero-play-btn, pandero-controls, pandero-slider, etc.) that the programmatic DOM must emit
  - phase: 01-02
    provides: poc.js audio engine (tandem pattern, WSOLA params, GainNode singleton, loop playback)
provides:
  - pandero/player.js — self-mounting ES module widget with programmatic DOM and no importmap dependency
  - Two-line embed contract: div#pandero-player + script type=module
  - pandero-* prefixed IDs for all interactive elements
affects: [04-01, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import.meta.url for asset resolution relative to widget file, not host page"
    - "Direct CDN URL import (esm.sh) to eliminate importmap dependency from host page"
    - "Programmatic DOM creation via el() and sliderRow() helpers inside buildDOM()"
    - "isSecureContext guard at module top-level — throws before DOM creation if file://"
    - "AudioContext singleton created once inside first user gesture (togglePlayback)"

key-files:
  created:
    - pandero/player.js
  modified: []

key-decisions:
  - "Direct CDN URL (https://esm.sh/unmute-ios-audio@3.3.0) instead of bare specifier — host pages don't need an importmap (UI-03)"
  - "import.meta.url used for both pandero.mp3 and soundtouch-processor.js — resolves relative to widget, not host page"
  - "All DOM created programmatically inside buildDOM() — no HTML template in host page beyond the mount div"
  - "Reset button excluded per D-13 — widget does not expose a reset affordance"
  - "Status paragraph excluded — loading state communicated by disabling the hex button (hexBtn.disabled = true)"
  - "pandero-* ID prefix on all interactive elements to prevent collision with host page IDs"

patterns-established:
  - "Pattern: el(tag, className) helper for concise DOM node creation"
  - "Pattern: sliderRow(id, label, min, max, step, value, valId, valText) for consistent control rows"
  - "Pattern: hexBtn reference captured once from root.querySelector after buildDOM() — not re-queried"

requirements-completed: [UI-03, UI-04]

# Metrics
duration: approx 30min
completed: 2026-03-22
---

# Phase 3 Plan 02: Widget JS Migration and Embedding Summary

**Self-mounting ES module widget (pandero/player.js) with programmatic DOM, pandero-* IDs, and direct CDN unmute-ios-audio import — no importmap needed from host page**

## Performance

- **Duration:** approx 30 min
- **Started:** 2026-03-22T18:00:00Z
- **Completed:** 2026-03-22T18:11:12Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 1

## Accomplishments

- Created `pandero/player.js` as a complete self-mounting ES module that creates all widget DOM inside `#pandero-player` on load
- Preserved the full audio engine from `poc.js` exactly: tandem playbackRate pattern, WSOLA processorOptions, GainNode singleton, seamless loop
- Eliminated the importmap requirement from host pages by replacing the bare `unmute-ios-audio` specifier with a direct esm.sh CDN URL
- Used `import.meta.url` for both the MP3 pre-fetch and worklet `addModule()` call — widget self-locates regardless of host page URL
- Human browser verification passed: hexagon button renders, sliders visible at 375px, audio plays and stops, BPM and semitone values update live, no console errors

## Task Commits

1. **Task 1: Create pandero/player.js** - `a036f77` (feat)
2. **Task 2: Human-verify checkpoint** - approved (no code commit — verification only)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified

- `pandero/player.js` — self-mounting ES module widget; Section A: guards/imports; Section B: programmatic DOM via buildDOM(); Section C: audio engine migrated from poc.js + event wiring

## Decisions Made

- **Direct CDN URL for unmute-ios-audio:** The plan specified `https://esm.sh/unmute-ios-audio@3.3.0` as a bare-specifier replacement. This keeps the host page embed to two lines (div + script) with no importmap block required.
- **import.meta.url for asset resolution:** Host pages may be at `/` while `player.js` is at `/pandero/player.js`. Using `new URL('./pandero.mp3', import.meta.url)` and `new URL('./soundtouch-processor.js', import.meta.url)` makes paths relative to the widget file, not the page, ensuring correct resolution in all embed scenarios.
- **No reset button:** Per decision D-13 from 03-CONTEXT.md, the widget does not include a reset affordance. Removing `handleReset()` and the reset button is intentional scope reduction for the embeddable widget.
- **Button disable instead of status text:** The PoC used a `<p id="status">` for loading feedback. The widget drops this and instead sets `hexBtn.disabled = true` during init, then `false` after — visible feedback without an extra DOM element.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first implementation pass.

## Issues Encountered

None. The human-verify checkpoint (Task 2) was approved without any issues reported.

## User Setup Required

None — no external service configuration required. The dev server (`npx serve .` or `python3 -m http.server`) is sufficient for local embedding verification.

## Next Phase Readiness

Phase 3 is now complete:
- `pandero/player.css` (plan 03-01) — visual identity, earthy palette, hexagon clip-path, 44px touch targets
- `pandero/player.js` (plan 03-02) — self-mounting widget, audio engine, pandero-* IDs, no importmap

The two-line embed contract is fulfilled:
```html
<link rel="stylesheet" href="pandero/player.css">
<div id="pandero-player"></div>
<script src="pandero/player.js" type="module"></script>
```

Phase 4 (Cueca-Specific UX Refinements) can now begin. Plan 04-01 will:
- Set initial tempo to a cueca-appropriate default (~90–100 BPM) on mount
- Add "lento / normal / animado" vocabulary labels to the tempo slider

No blockers. iOS mute-switch hardware verification (ENG-06) remains deferred from Phase 1 but does not block Phase 4.

---
*Phase: 03-mobile-polish-and-embedding*
*Completed: 2026-03-22*
