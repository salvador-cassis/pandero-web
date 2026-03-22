---
plan: 02-02
phase: 02-playback-controls-and-core-ui
status: complete
completed: 2026-03-22
key-files:
  created: []
  modified:
    - pandero/poc.js
    - pandero/poc.html
---

## What Was Built

Wired all Phase 2 controls to the audio engine: single toggle button (play/stop), tempo slider with live BPM display, pitch slider with signed semitone display, volume slider via GainNode, and reset button.

## Key Changes

- **poc.html** — Single `toggle-btn` (▶/⏸ icon), tempo slider (0.5–1.5x, shows BPM), pitch slider (−6 to +6, shows signed semitones), volume slider (0–1), reset button. Old play-btn/pause-btn removed.
- **poc.js** — `togglePlayback()`: plays from beginning when stopped, stops completely when playing. `startPlayback()`: creates fresh AudioWorkletNode each call. `handleTempoChange()`: BPM = Math.round(ratio × 111), tandem pattern applied live. `handlePitchChange()`: signed display (0, +N, −N), AudioParam updated live. `handleVolumeChange()`: gainNode.gain.value, persists across restarts. `handleReset()`: tempo + pitch only (volume intentionally excluded). Space key triggers togglePlayback() without requiring prior click.

## User Decisions (overrides from plan)

- **D-04 overridden:** Click-while-playing now stops (not restarts). User found restart behavior cumbersome.
- **Space key:** Works on first press without requiring a prior click (isInitialized guard removed).

## Verification Result

Human confirmed all controls working correctly.

## Commits

- `cd48145` — feat(02-02): rewrite poc.html with toggle button, volume, reset, BPM display
- `36d304a` — feat(02-02): rewrite poc.js with toggle, volume, reset, live display logic
- `3d4b2d2` — fix(02-02): toggle button pauses instead of restarts on click-while-playing
- `6d985aa` — fix(02-02): toggle button stops and resets playback instead of pausing
- `c78ed6c` — fix(02-02): allow Space key to trigger playback before first click
