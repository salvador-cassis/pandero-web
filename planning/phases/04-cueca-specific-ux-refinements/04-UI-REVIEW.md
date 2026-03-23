# Phase 4 — UI Review

**Audited:** 2026-03-22
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md for this phase)
**Screenshots:** Not captured (no dev server reachable — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Single BPM display is clean; aria-label is static and does not reflect play state |
| 2. Visuals | 3/4 | Clear hexagon focal point with intentional asymmetry; no focus ring defined for keyboard users |
| 3. Color | 4/4 | Five tokens cover all surfaces; accent appears only on slider thumb — correct 60/30/10 discipline |
| 4. Typography | 4/4 | Two sizes, one weight, one family — minimal and purposeful |
| 5. Spacing | 4/4 | Token-driven throughout; all spacing values are intentional and consistent |
| 6. Experience Design | 2/4 | Button is disabled during init; but no audio error recovery, no loading feedback, no aria-pressed toggle |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Static aria-label on play/pause button** — Screen reader users hear "Reproducir / Detener" on every interaction regardless of state. Impact: blind and low-vision users cannot know whether pressing the button will play or pause. Fix: Update `togglePlayback()` to call `hexBtn.setAttribute('aria-label', isPlaying ? 'Detener' : 'Reproducir')` and add `hexBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false')` after each state change.

2. **No keyboard focus ring** — The play button and slider receive no visible focus indicator; `player.css` defines no `:focus` or `:focus-visible` rule for `.pandero-play-btn` or `.pandero-slider`. Impact: keyboard-only users cannot see which element is active, failing WCAG 2.1 SC 2.4.7. Fix: Add `.pandero-play-btn:focus-visible { outline: 2px solid var(--pandero-accent); outline-offset: 4px; }` and `.pandero-slider:focus-visible { outline: 2px solid var(--pandero-accent); }`.

3. **No audio init error handling** — `init()` is async and calls `audioWorklet.addModule()`, `mp3Promise`, and `decodeAudioData()` without a try/catch. If any step fails (network offline, worklet unavailable), `hexBtn.disabled` is set to `false` but the widget silently stops working with no user-visible message. Impact: users see a button that does nothing. Fix: Wrap the body of `init()` in a try/catch that re-enables the button, sets `isInitialized = false`, and renders a short error message into the widget root (e.g., "No se pudo cargar el audio. Recarga la página.").

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**What works well:**
- The BPM value display ("112 BPM") is the sole text in the widget — unambiguous, domain-specific, not generic.
- The decision to remove the "Tempo" label (D-05) was correct: the BPM number is self-explanatory in context.
- The isSecureContext error message (`player.js` line 16) is developer-facing and appropriately technical — not user copy.
- The aria-label "Reproducir / Detener" is in the correct language (Spanish) and matches the widget's cultural identity.

**Issues:**
- `player.js` line 71: `aria-label` reads "Reproducir / Detener" — a static slash-separated string that does not distinguish current state. Assistive technologies will read this on every interaction. The convention is a toggle label that reflects what will happen ("Reproducir" when stopped, "Detener" when playing), or an `aria-pressed` attribute on a `<button type="button">` to signal toggle state.
- `player.js` line 16 error text: `[Pandero] Must be served via HTTPS or localhost — not file://` mixes English into a Spanish-context widget. This is developer-facing, but if it ever renders in a host page it is incongruent. Minor.

**No generic strings found:** No "Submit", "Click Here", "OK", "Cancel", "Save", "No results", or "went wrong" patterns present in either file.

---

### Pillar 2: Visuals (3/4)

**What works well:**
- The hexagon button is the clear visual focal point — dominant size (120px), dark surface against the warm off-white background, centered in the column layout.
- The handmade clip-path polygon (`polygon(51% 1%, 99% 24%, 100% 76%, 49% 99%, 1% 77%, 0% 25%)`) gives an intentionally imperfect, craft feel that suits cueca's artisanal identity.
- The ▶ / ⏸ unicode glyphs communicate play state through recognizable iconography.
- The single slider below the button creates a clear primary/secondary hierarchy — button first, control second.
- `font-display: swap` on `@font-face` prevents invisible text during Lora font load.

**Issues:**
- No `:focus-visible` ring defined for `.pandero-play-btn` or `.pandero-slider`. Tab navigation reveals no indicator of focused element. This is both a visual issue and an accessibility issue (scored under Experience Design).
- The `.pandero-play-btn:active` state (`opacity: 0.75`) is the only interactive feedback. There is no `:hover` style, so pointer users get no affordance that the element is interactive before clicking. Adding a subtle hover (e.g., `opacity: 0.9`) would improve perceived affordance.
- `poc.html` still carries a `<title>Pandero PoC — Phase 2</title>` (line 4) — outdated phase reference. Minor, as this is a dev shell not the production embed.

---

### Pillar 3: Color (4/4)

**What works well:**
- The five CSS custom properties define a coherent palette: `--pandero-bg` (60%), `--pandero-surface` (30%), `--pandero-accent` (10%), `--pandero-text`, `--pandero-track`.
- Accent color (`#c4702b`, warm ochre) appears in exactly one place: the slider thumb (`::-webkit-slider-thumb` line 156, `::-moz-range-thumb` line 181). No accent overuse.
- All colors are in the token system — no hardcoded hex values appear outside the `:root`-equivalent `#pandero-player` block.
- The palette is internally consistent: `--pandero-surface` and `--pandero-text` share the same dark brown value (`#3b1f0e`), which is correct (text reads on the bg, button reads on the bg).
- Tokens are scoped to `#pandero-player` — no `:root` pollution. Host pages can override for theming.

**Hardcoded hex audit:** All five `#` hex values appear only in the token definition block (player.css lines 24–28). No inline style hex values in player.js.

---

### Pillar 4: Typography (4/4)

**What works well:**
- One font family in use: Lora, with a `serif` fallback. No font mix.
- Two font sizes in use: `1rem` (label context, `--pandero-size-label`) and `1.25rem` (BPM value, `--pandero-size-value`). The 2rem on `.pandero-play-btn` serves the icon glyph specifically — this is appropriate and not a body text size.
- One declared font weight: 400 (regular) throughout. `font-weight: 400` on `.pandero-value` (line 127) is explicit and matches the @font-face weight.
- Self-hosted woff2 eliminates Google Fonts network dependency — privacy-safe and embedding-safe.
- `font-display: swap` prevents FOIT; Lora at 12560 bytes loads quickly.

**Font size distribution:**
- `2rem` — play button icon glyph only
- `1.25rem` — live BPM value (`--pandero-size-value`)
- `1rem` — slider header baseline (`--pandero-size-label`)

Three sizes total, each with a clear semantic purpose. Well within the 4-size ceiling.

---

### Pillar 5: Spacing (4/4)

**What works well:**
- Primary rhythm is token-driven: `--pandero-gap: 1.25rem` governs both the root column gap and the controls column gap.
- Secondary rhythm: `0.25rem` gap within `.pandero-slider-row` (label/value above slider). Tight and appropriate for this relationship.
- Widget padding (`1.5rem 1rem`) follows a clear desktop/mobile asymmetry: more vertical breathing room, tighter horizontal.
- The 44px slider height and 44px effective thumb hit area are explicit and deliberate — not arbitrary pixel values, they reference the touch target standard.
- No Tailwind arbitrary values to audit — pure CSS with named properties.
- No magic numbers: all pixel values serve a specific purpose (120px hex size, 4px track height, 24px thumb visual, 10px border for hit expansion).

**Spacing value inventory:**
- `1.25rem` — gap (token)
- `1.5rem 1rem` — widget padding
- `0.25rem` — slider row internal gap
- `44px` — touch target height
- `24px` — thumb visual diameter
- `4px` — track height
- `10px` — transparent border for hit area expansion
- `375px` — max-width (mobile-first constraint)

All values are intentional and documented in CSS comments.

---

### Pillar 6: Experience Design (2/4)

**What works well:**
- Button is disabled during async init (`hexBtn.disabled = true` on line 178, re-enabled on line 180). This prevents double-fire and communicates unavailability during load.
- Space key handler is wired and calls the same `togglePlayback()` path — consistent keyboard/pointer behavior.
- `mp3Promise` is pre-fetched at module load to hide network latency before first gesture.
- `source.loop = true` ensures seamless playback without a visible empty state.
- isSecureContext guard fails fast with a visible error node in the DOM — degradation is handled.

**Issues:**

1. **No aria-pressed state on toggle button** (`player.js` line 214): The `<button>` element has a static `aria-label` and no `aria-pressed` attribute. Toggling play/pause changes only the text content (▶/⏸) — screen readers are not notified of the state change semantically. The `aria-label` should update to "Reproducir" or "Detener" (not both simultaneously), and `aria-pressed="true/false"` should be set on each toggle.

2. **No error recovery in `init()`** (`player.js` lines 106–128): The `init()` function is async and can fail at three points — `addModule()`, the resolved `mp3Promise`, or `decodeAudioData()`. None are wrapped in try/catch. If the MP3 fetch was rejected (network error), `mp3Promise` will throw when awaited. The widget becomes non-functional with no user feedback. The `isInitialized` flag is set to `true` before these await calls (line 108), so a retry is also impossible without page reload.

3. **No loading indicator during init** (`player.js` lines 177–181): The button is disabled silently. Users on slow connections see a non-responsive button with no indication that audio is loading. A text content change (e.g., "…") or a CSS class change on the button during `isInitialized` would communicate the pending state.

4. **`aria-label` language is static** — the label "Reproducir / Detener" will be read by VoiceOver/TalkBack as a single label on every interaction. With `aria-pressed`, the screen reader announces both the label and the state. Without it, users must infer state from the glyph change, which many screen readers do not read aloud.

5. **No BPM aria-live region**: The `#pandero-tempo-val` span updates live as the slider moves but has no `aria-live="polite"` attribute. Screen reader users dragging the slider cannot hear the BPM value change.

---

## Files Audited

- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/pandero/player.js` (223 lines)
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/pandero/player.css` (193 lines)
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/pandero/poc.html` (context only — dev shell)
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/planning/phases/04-cueca-specific-ux-refinements/04-01-SUMMARY.md`
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/planning/phases/04-cueca-specific-ux-refinements/04-01-PLAN.md`
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/planning/phases/04-cueca-specific-ux-refinements/04-CONTEXT.md`
- `/Users/salvadorcassis/Documents/08_PROYECTOS_DIGITALES/05-pandero-web/planning/phases/04-cueca-specific-ux-refinements/04-VERIFICATION.md`

Registry audit: shadcn not initialized — skipped.
