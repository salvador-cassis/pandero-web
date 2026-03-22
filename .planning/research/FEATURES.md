# Feature Landscape

**Domain:** Interactive backing track / music practice tool (folk music, single fixed instrument, web)
**Project:** Dairapp Web — Cueca Chilena Pandero
**Researched:** 2026-03-22
**Confidence:** HIGH for table stakes (multiple converging sources); MEDIUM for differentiators (community-specific, less external data)

---

## Context

This is a narrowly scoped tool: one fixed MP3 of a pandero, playable in the browser with independent pitch and tempo control. The audience is the cueca chilena musical community — singers, guitarists, percussionists, accordion players — who need to practice with a rhythmic reference they can tune to their instrument and slow down to their current skill level.

The core insight from ecosystem research: **independent pitch and tempo control is the single most-cited table-stakes feature** in every music practice tool survey, app store category, and competitor analysis. Everything else is secondary.

---

## Table Stakes

Features that users of music practice tools expect. Missing any of these and the tool feels broken or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Play / Pause | Universal audio player primitive | Low | Without this, nothing works. |
| Independent tempo control (time-stretch) | #1 cited feature across all practice apps; allows slowing for beginners without losing pitch | High | Requires time-stretching library (RubberBand WASM or SoundTouchJS). This is the core technical challenge. |
| Independent pitch control (pitch-shift) | Allows transposing to match instrument tuning or voice without changing speed | High | Shares the same DSP engine as tempo control. Not a separate implementation cost. |
| Visible current tempo value (BPM display) | Users need to know where they are, especially when communicating with bandmates ("play at 90 BPM") | Low | A numeric label next to the tempo slider. No extra library needed. |
| Visible current pitch value (semitones or note) | Same communication need — "I need it in A" or "+2 semitones" | Low | Label next to the pitch slider. |
| Loop / continuous repeat | Practice context demands looping; musicians do not want to manually restart | Low | HTML Audio loop attribute or a short JS reset-on-end listener. |
| Volume control | Acoustic environment varies; musicians need to balance the pandero against a live guitar or voice | Low | Native HTML range input on the audio element's gain. |
| Responsive / mobile-usable UI | Most practice happens with a phone propped on a music stand; desktop-first-only is exclusionary | Medium | CSS only, no native app required. Touch targets must be large enough for fingers. |

**Dependency chain:**
```
Audio element (play/pause, loop, volume)
  └─ Time-stretching engine (tempo control without pitch change)
       └─ Pitch-shifting engine (pitch control without tempo change)
            └─ BPM display (reads the tempo value already stored in state)
            └─ Semitone display (reads the pitch value already stored in state)
```

The time-stretching engine is the single hard dependency that everything else builds on. Get this right and the rest is UI.

---

## Differentiators

Features that are not universally expected in generic music practice tools but are specifically valuable for the cueca chilena community.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain-specific default tempo | Cueca has a characteristic tempo range (~85–110 BPM depending on style). Pre-setting the slider to a cueca-appropriate default communicates "this tool is for you" from the first load. | Low | Hardcode the initial BPM on page load. |
| Cueca tempo vocabulary labels | Alongside the numeric BPM, optionally label zones as "lento / normal / animado" in cueca terms. Users from the tradition think in these terms, not in exact BPM. | Low | CSS labels overlaid on the slider range. |
| Named pitch reference points | Instead of just "+2 semitones", indicate the resulting key ("La", "Si bemol"). Singers and guitarists think in keys, not intervals. | Low–Medium | Requires knowing the source key of the recording and calculating from there. |
| Prominent reset-to-default button | Cueca gatherings often involve multiple people taking turns. A one-tap "back to standard" is faster than re-dragging two sliders. | Low | A single button that resets pitch=0 and tempo=original. |
| Embeddable with minimal footprint | The tool lives inside an existing HTML page — if it loads fast, does not require accounts, and needs no build step, it is a differentiator vs. app-store-gated alternatives. | Low (architecture) | This is already required by constraints; calling it out as a differentiator because it is rare in the ecosystem. |

---

## Anti-Features

Features to explicitly NOT build in v1. Each one has a specific reason, not just "we ran out of time."

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User audio file upload | PROJECT.md explicitly rules this out. Adds file handling complexity (format detection, size limits, browser API surface), security concerns, and destroys the "curated for cueca" identity of the tool. | Keep the pandero MP3 fixed and curated. |
| Download / export of modified audio | Ruled out in PROJECT.md. Requires either server-side processing or a large client-side encoding library (e.g., ffmpeg.wasm). The practice use case does not need a file at the end. | Practice in-browser. If users want a modified file, that is a separate workflow. |
| Playlist / multiple tracks | v1 is one instrument. A playlist implies navigation UI, multiple audio files, state management across tracks — none of which is needed when there is one pandero loop. | Add instruments in v2+ as separate embedded widgets or a track-select dropdown. |
| User accounts / login | PROJECT.md rules this out. Friction kills adoption in a community tool that should be instantly usable. | Stateless tool; no persistence needed in v1. |
| A-B loop section markers | Backing track apps (Jamzone, Backtrackit) offer this. But the pandero loop is homogeneous — every beat is the same, so sectional looping adds no value. The full loop IS the practice loop. | Not applicable to this domain; re-evaluate if melodic instruments (guitar, accordion) are added in v2+. |
| Stem separation | Relevant for learning from recordings; not relevant for a curated single-instrument practice track. Adds significant computational cost (e.g., Demucs/Spleeter WASM would be very heavy). | The pandero track is already the stem. |
| Visual waveform display | Provides navigational value in a recording editor. Provides zero value in a looping, homogeneous drum track with no sections to navigate to. | Misleading feature for this use case. |
| EQ / audio effects (reverb, echo, etc.) | Practice tools use these to compensate for poor recordings or small speakers. The pandero track should be recorded well; effects add complexity without improving practice outcomes. | Ensure high-quality source recording instead. |
| BPM tap-detection (microphone) | Interesting feature, but requires microphone permissions — a major friction point on mobile and in community settings. Adds little when the user is setting tempo deliberately via slider. | Slider + numeric display covers the need. |
| Social / sharing features | Leaderboards, session history, share buttons — all require backend, accounts, or external services. The cueca community is small and connects offline and via WhatsApp, not in-app. | Out of scope for v1 and likely v2. |
| Progress tracking / practice analytics | Requires storage, state, and account. Valuable for long-term learners but not for the drop-in, community-use model of this tool. | Not applicable to stateless use case. |
| AI-generated backing tracks | AI generative tools (2026 trend) produce generic patterns; cueca pandero requires specific rhythmic feel. A curated recording is a stronger product. | Curated human recording is the differentiator. |

---

## Feature Dependencies

```
Play/Pause
  └─ Loop (depends on: audio element playing)
  └─ Volume control (depends on: audio element loaded)

Time-stretch engine (RubberBand WASM or SoundTouchJS)
  └─ Tempo control slider (depends on: engine initialized)
       └─ BPM display label (depends on: tempo value in state)
       └─ Reset-to-default button (depends on: knowing original BPM)
  └─ Pitch control slider (depends on: engine initialized)
       └─ Semitone / key display label (depends on: pitch value + source key)
       └─ Reset-to-default button (depends on: knowing original pitch = 0)

Responsive layout
  └─ All controls (touch targets, slider thumb size, spacing)
```

The time-stretch engine is the single critical-path dependency. All other features are either independent (volume, play/pause) or trivially layered on top once the engine works (display labels, reset button).

---

## MVP Recommendation

**Build exactly this, nothing more:**

1. Audio element playing the pandero MP3 in a loop
2. Time-stretch engine initialized (this is the hard work)
3. Tempo slider with BPM display
4. Pitch slider with semitone / key display
5. Volume slider
6. Reset-to-default button (clears both sliders)
7. Responsive layout with large touch targets

**Defer everything else.** The instrument-specific vocabulary labels (cueca tempo names, key labels) are low-complexity and high-value — add them once the engine is working rather than in the first build.

**Do not add** A-B loops, file upload, waveform, effects, accounts, or any feature not in the list above. The feature surface of v1 is intentionally tiny.

---

## Confidence Assessment

| Finding | Confidence | Basis |
|---------|------------|-------|
| Independent pitch/tempo is table stakes | HIGH | Backtrackit, Jamzone, Music Speed Changer, multiple app-store descriptions all cite it as the core feature. |
| Loop / continuous playback is table stakes | HIGH | Every practice tool survey lists it; absence would make the tool unusable for practice. |
| Volume control is table stakes | HIGH | Universal audio player convention; absence is a usability defect. |
| A-B section looping is NOT needed for pandero | MEDIUM | Derived from domain logic (homogeneous loop). No external source compared a homogeneous drum track to melodic track needs specifically. |
| Cueca-specific vocabulary labels are differentiators | MEDIUM | Based on knowledge of the cueca music community conventions (tempo vocabulary is real); no external source confirms this specific UX pattern. |
| File upload, accounts, export are anti-features for v1 | HIGH | Confirmed by PROJECT.md constraints and consistent with complexity/friction analysis across all sources. |

---

## Sources

- [Backtrackit — Musicians Practice Toolkit](https://www.backtrackitapp.com/)
- [Music Speed Changer — Tempo & Pitch Independently](https://musicspeedchanger.com/)
- [Jamzone — Loop Function Explained](https://www.jamzone.com/blog/1483-take-control-of-your-backing-tracks-jamzone-s-loop-function-explained.html)
- [Strum Machine — Browser-Based Backing Track Player](https://strummachine.com/)
- [Worship Backing Band MultiTrack Player](https://www.worshipbackingband.com/multitrack-player-software)
- [Over-Engineering in Frontend: Pitfalls of Excessive Complexity](https://medium.com/@revman1422/over-engineering-in-frontend-the-pitfalls-of-excessive-complexity-cb9c140ed3f8)
- [Usability Assessment of Music App Interfaces — Nature / Humanities & Social Sciences](https://www.nature.com/articles/s41599-025-05424-4)
- [AI Practice Tools for Musicians: 2026 Guide — Soundverse](https://www.soundverse.ai/blog/article/ai-practice-tools-for-musicians)
- [History of the Cueca — Berklee Pulse](https://pulse.berklee.edu/content/public/pub_unit_assets/lessons/cueca/History%20of%20the%20Cueca.pdf)
