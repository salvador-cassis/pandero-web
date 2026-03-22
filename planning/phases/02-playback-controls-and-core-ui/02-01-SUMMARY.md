---
plan: 02-01
phase: 02-playback-controls-and-core-ui
status: complete
completed: 2026-03-22
key-files:
  created: []
  modified:
    - pandero/soundtouch-processor.js
    - pandero/poc.js
    - pandero/poc.html
---

## What Was Built

Patched the SoundTouch processor to accept WSOLA tuning parameters at construction time and refactored the audio graph to use a raw `AudioWorkletNode` with `processorOptions`, replacing the `SoundTouchNode` wrapper. Inserted a `GainNode` singleton into the signal chain as the foundation for volume control.

## Key Changes

- `soundtouch-processor.js` constructor now accepts `options.processorOptions` and calls `this._pipe.stretch.setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs)` — reducing the WSOLA sequence window from ~110ms (auto) to 40ms for tighter percussion transients
- `poc.js` audio graph: `source → AudioWorkletNode(processorOptions) → gainNode → destination`
- All `AudioParam` access migrated to `stNode.parameters.get()` (required for raw `AudioWorkletNode`)
- `gainNode` created once in `init()`, persists across play/restart cycles
- `SoundTouchNode` wrapper and `@soundtouchjs/audio-worklet` CDN import removed
- `poc.html` importmap cleaned (only `unmute-ios-audio` remains)

## Verification Result

Human confirmed audio quality acceptable across 0.5x–1.5x tempo range and ±6 semitone range.

## Known Limitation

At slower tempos (0.5x and below) some robotic artifacts remain. WSOLA parameters (sequenceMs=40) improve but do not fully eliminate artifacts at extreme slow tempos. This is a known SoundTouch limitation — further tuning or algorithm changes would be needed to fully resolve. Noted for potential future gap-closure phase.

## Commits

- `b69e103` — feat(02-01): patch SoundTouchProcessor constructor to accept WSOLA processorOptions
- `2457314` — feat(02-01): refactor poc.js with GainNode singleton and raw AudioWorkletNode
