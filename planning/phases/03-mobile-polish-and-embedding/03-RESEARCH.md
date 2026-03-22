# Phase 3: Mobile Polish and Embedding - Research

**Researched:** 2026-03-22
**Domain:** CSS layout, mobile touch targets, widget embedding, ES module isolation
**Confidence:** HIGH (core techniques), MEDIUM (font choice, hexagon imperfection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The widget has its own strong visual identity, in dialogue with salvadorcassis.com's brand (earthy, minimal, content-forward, object made with care)
- **D-02:** Color palette inspired by the physical pandero instrument: warm ochre + dark brown + off-white (reddish-brown wood + goatskin tones)
- **D-03:** Aesthetic feel: handmade/imperfect — slight texture, fanzine cut-and-paste quality, not a clean Spotify-style app
- **D-04:** Motif system: hexagon (pandero shape) + circles (pandero construction detail) — these two shapes drive all visual decisions
- **D-05:** Play/stop toggle is a large prominent hexagon — the primary visual anchor of the widget, centered at top
- **D-06:** Hexagon style: handmade/imperfect feel — not a clean flat polygon
- **D-07:** Button behavior is unchanged from Phase 2 (toggle: starts from beginning, stops) — only restyled
- **D-08:** The hexagon IS the button — no separate label or text
- **D-09:** Layout: big hexagon centered at top, three sliders stacked vertically below it
- **D-10:** Slider order: Tempo → Pitch → Volume (top to bottom)
- **D-11:** Each slider row: label + live value displayed above the slider (stacked, not inline)
- **D-12:** Slider thumbs styled as circles — part of the hexagon+circle visual language
- **D-13:** No reset button in the embedded widget — intentional removal. Reset existed in poc.js (CTRL-05) but is excluded from player.js UI. poc.html keeps it for development use only.
- **D-14:** Prefixed CSS selectors (pandero-*) — no Shadow DOM
- **D-15:** Host page CSS can intentionally override widget styles (themeable from salvadorcassis.com stylesheet if needed)
- **D-16:** Widget CSS lives in pandero/player.css, loaded separately by the host page
- **D-17:** Final delivery target is salvadorcassis.com — not a standalone demo page
- **D-18:** poc.html is preserved as a development and testing tool only (not public-facing)
- **D-19:** player.js must programmatically create all DOM elements inside #pandero-player — no HTML required from the host page beyond the mount div

### Claude's Discretion

- Exact hexagon dimensions and proportions
- Typography choice (consistent with earthy/fanzine aesthetic)
- Spacing scale and padding values
- Breakpoint behavior at 768px and 1280px (beyond the 375px minimum)
- Slider track styling
- Transition/animation details (if any)
- Whether to use a CSS custom property system for theming

### Deferred Ideas (OUT OF SCOPE)

- Cueca tempo vocabulary labels ("lento / normal / animado") — Phase 4 (CUE-02)
- Default BPM at ~90–100 on load — Phase 4 (CUE-01)
- Guitar (polyphonic) audio support — future v2 milestone

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | La interfaz es responsive y usable en móvil (teléfono en atril) | Mobile-first CSS with 375px baseline; flexbox column layout; CSS custom properties for sizing |
| UI-02 | Los controles tienen touch targets suficientemente grandes para uso con dedos | Transparent border technique on ::-webkit-slider-thumb; minimum 44×44px for all interactive elements per WCAG 2.5.5 |
| UI-03 | El widget se puede embeber en una página HTML existente con dos líneas (un div y un script) | ES module auto-mount pattern; programmatic DOM injection on DOMContentLoaded; importmap collision strategy documented |
| UI-04 | El JS del widget no contamina el scope global de la página host | ES module scope isolation (type="module" is already strict); pandero-* prefixed CSS selectors; no window.* assignments |

</phase_requirements>

---

## Summary

Phase 3 transforms the functional PoC into a polished, embeddable widget. The work divides cleanly into two tracks: (1) responsive layout + visual design, and (2) widget file structure + isolation. Both tracks are pure CSS and DOM work — the audio engine is frozen.

The most significant technical constraint is the importmap: `poc.html` defines `unmute-ios-audio` via a `<script type="importmap">`. Because only one importmap per page is honored by browsers (and it cannot be added after modules begin loading), `player.js` cannot define its own importmap — it must be provided by the host page, or the widget must resolve the dependency without an importmap (via a direct esm.sh URL import or by inlining the dependency). This is the single highest-risk item for UI-03.

The hexagon button and circular slider thumbs are achievable entirely with CSS `clip-path: polygon()` and `::-webkit-slider-thumb` / `::-moz-range-thumb` pseudo-elements. Creating an imperfect/handmade hexagon requires adding slight coordinate perturbations to the clean 6-point polygon. For touch targets on sliders, a transparent border on the thumb pseudo-element reliably expands the hit area to 44px without affecting visual size on WebKit; Firefox handles thumb sizing differently.

**Primary recommendation:** Resolve the importmap collision before any other work. The safest path is to convert the `unmute-ios-audio` import to a direct CDN URL (no importmap needed) inside `player.js`. All other CSS/layout work is straightforward given the locked design decisions.

---

## Standard Stack

### Core

| Library / Feature | Version / Level | Purpose | Why Standard |
|-------------------|-----------------|---------|--------------|
| CSS `clip-path: polygon()` | CSS3 / all modern browsers | Hexagon shape for play button | No JS, no SVG file, hardware-accelerated, fully themeable |
| `appearance: none` + `::-webkit-slider-thumb` | CSS / WebKit | Custom range slider thumb | Required to override UA stylesheet before any custom styles apply |
| `::-moz-range-thumb` | CSS / Firefox | Custom range slider thumb (Firefox path) | Separate pseudo-element; cannot combine with -webkit- in one rule |
| CSS Custom Properties (`--pandero-*`) | CSS3 | Theming tokens — colors, spacing, sizes | Scoped to `#pandero-player`, overridable by host without Shadow DOM |
| ES module (`type="module"`) | Baseline 2017 | Scope isolation for player.js | Free isolation: module scripts have their own scope, no IIFE needed |
| `document.createElement` + `append()` | DOM API | Programmatic DOM injection | Vanilla, no deps, no innerHTML security surface |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unmute-ios-audio` (esm.sh) | 3.3.0 | iOS hardware mute switch bypass | Import via direct URL, not importmap, so no host-page importmap collision |
| Google Fonts — Caveat | 4.x | Handwritten, fanzine-quality display font | Labels and BPM value display; earthy/handmade aesthetic |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clip-path: polygon()` hexagon | SVG `<polygon>` inline element | SVG is more flexible for imperfect paths but adds DOM complexity and serialization in JS |
| `clip-path: polygon()` hexagon | CSS border-trick hexagon (3 rectangles) | Border trick is a hack; clip-path is the correct modern approach |
| Direct CDN URL for unmute-ios-audio | importmap in widget | importmap in widget would break if host page already defines one — CDN URL is simpler and safer |
| Caveat (Google Fonts) | System handwriting font (`ui-rounded`, Chalkboard) | System fonts are zero-cost but inconsistent across platforms; Caveat is consistent and on-brand |
| Caveat via Google CDN | Self-hosted Caveat woff2 | CDN is a third-party dependency and GDPR concern; self-host is safer for an embeddable widget. Only weight needed is 400 (Regular) for labels. |

**Installation:**

No npm packages for Phase 3. All dependencies are either:
- CSS features (no install)
- The `unmute-ios-audio` import already present in poc.js (migrates as a direct URL import)
- Caveat font as self-hosted woff2 file in `pandero/`

Download Caveat Regular woff2:
```bash
# Download from Google Web Fonts Helper or directly
curl -o pandero/caveat-regular.woff2 \
  "https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZA.woff2"
```

---

## Architecture Patterns

### Recommended Project Structure (after Phase 3)

```
pandero/
  player.js                  # Widget entry point — mounts DOM, wires audio engine
  player.css                 # All widget styles, pandero-* prefixed
  pandero.mp3                # Audio asset (same origin as player.js — required for fetch())
  soundtouch-processor.js    # AudioWorklet processor (same origin — addModule blocked cross-origin)
  caveat-regular.woff2       # Self-hosted font (avoids Google CDN dependency)
poc.html                     # Dev/test shell only — not public
poc.js                       # Phase 2 implementation — preserved for reference
```

### Pattern 1: ES Module Auto-Mount

`player.js` is loaded as `type="module"` by the host page. Module scripts run after the DOM is parsed. The widget finds its mount point and creates DOM in one synchronous pass.

```javascript
// player.js — top-level module scope (no IIFE needed, modules are already isolated)

// Called at module evaluation time — DOM is ready when type="module" scripts run
const mount = document.getElementById('pandero-player');
if (!mount) throw new Error('[pandero] Mount point #pandero-player not found');

// Build the widget DOM tree
const root = buildDOM();          // returns the widget root element
mount.appendChild(root);

// Wire event listeners to the new elements
wireEvents(root);

// Audio init deferred to first user gesture — same pattern as poc.js
```

**Key point:** `type="module"` scripts are deferred by default (equivalent to `defer`). No need for `DOMContentLoaded` listener — the DOM is guaranteed ready at module evaluation time.

### Pattern 2: Programmatic DOM Creation (preferred over innerHTML)

Build the widget's DOM tree with `createElement` + `textContent`. Avoids innerHTML security surface and is fully compatible with CSP policies the host page may enforce.

```javascript
function buildDOM() {
  const root = el('div', 'pandero-widget');

  const hexBtn = el('button', 'pandero-play-btn');
  hexBtn.setAttribute('aria-label', 'Reproducir / Detener');
  hexBtn.setAttribute('type', 'button');
  // Icon set via CSS ::before content or textContent
  hexBtn.textContent = '\u25B6'; // ▶ — updated to ⏸ when playing

  const controls = el('div', 'pandero-controls');
  controls.append(
    sliderRow('tempo',  'Tempo',   0.5,  1.5, 0.01, 1.0,  'pandero-tempo-val',  '111 BPM'),
    sliderRow('pitch',  'Pitch',  -6,    6,   1,    0,    'pandero-pitch-val',  '0 st'),
    sliderRow('volume', 'Volumen', 0,    1,   0.01, 1.0,   null, null)
  );

  root.append(hexBtn, controls);
  return root;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function sliderRow(id, label, min, max, step, value, valId, valText) {
  const row = el('div', 'pandero-slider-row');
  const header = el('div', 'pandero-slider-header');
  const lbl = el('label');
  lbl.textContent = label;
  lbl.htmlFor = 'pandero-' + id;
  header.appendChild(lbl);
  if (valId) {
    const val = el('span', 'pandero-value');
    val.id = valId;
    val.textContent = valText;
    header.appendChild(val);
  }
  const input = el('input');
  input.type = 'range';
  input.id = 'pandero-' + id;
  input.className = 'pandero-slider';
  input.min = min; input.max = max; input.step = step; input.value = value;
  row.append(header, input);
  return row;
}
```

### Pattern 3: CSS Hexagon with Imperfection

A clean 6-point hexagon uses `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`. To achieve the locked D-06 "handmade/imperfect" feel, perturb each vertex by 1–3 percentage points. The perturbation must be subtle enough to read as hexagon, distinct enough to feel non-digital.

```css
/* Source: css-tip.com/hexagon-shape — adapted with vertex perturbation */

/* Clean reference hexagon */
.pandero-play-btn {
  aspect-ratio: 1 / cos(30deg);   /* mathematically correct proportion */
  clip-path: polygon(
    50% 0%,
    100% 25%,
    100% 75%,
    50% 100%,
    0% 75%,
    0% 25%
  );
}

/* Handmade variant — slight perturbations on each vertex */
.pandero-play-btn {
  aspect-ratio: 1 / cos(30deg);
  clip-path: polygon(
    51% 1%,     /* top — shifted right 1, down 1 */
    99% 24%,    /* upper-right — pulled in */
    101% 76%,   /* lower-right — slightly out */
    49% 99%,    /* bottom — shifted left 1 */
    1% 76%,     /* lower-left — slightly out */
    0% 24%      /* upper-left — on edge */
  );
}
```

The `cos(30deg)` value for `aspect-ratio` is computed at CSS calc time in modern browsers (Chrome 99+, Safari 15.4+, Firefox 96+). For wider compatibility fallback, use `aspect-ratio: 1 / 0.866`.

### Pattern 4: Range Slider Touch Target (44px)

The key problem: the visual thumb should be ~24px circle but the touch target must be ≥44px. The transparent border technique is the cleanest solution for WebKit browsers.

```css
/* Source: Smashing Magazine + CSS-Tricks range input styling */

/* Reset */
.pandero-slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  height: 44px;   /* track height = full touch row height on iOS */
}

/* WebKit thumb — visual circle inside 44px touch target */
.pandero-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--pandero-accent);
  border: 10px solid transparent;   /* expands hit area: 24 + 20 = 44px */
  box-sizing: content-box;
  background-clip: padding-box;     /* prevents background bleeding into border */
  margin-top: -12px;                /* center on track */
  cursor: pointer;
}

/* WebKit track */
.pandero-slider::-webkit-slider-runnable-track {
  height: 4px;
  background-color: var(--pandero-track);
  border-radius: 2px;
}

/* Firefox thumb */
.pandero-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--pandero-accent);
  border: none;   /* Firefox: no transparent border trick needed — min-height on slider works */
  cursor: pointer;
}

/* Firefox track */
.pandero-slider::-moz-range-track {
  height: 4px;
  background-color: var(--pandero-track);
  border-radius: 2px;
}
```

**iOS note:** Setting `height: 44px` on the `<input>` itself (not just the thumb) is the most reliable way to guarantee the touch row is 44px on iOS Safari. iOS Safari respects the input height for hit testing.

### Pattern 5: CSS Custom Property Token System

Scoped to `#pandero-player` — does not pollute `:root`. Host page can override by targeting `#pandero-player` in its own stylesheet.

```css
/* player.css — all tokens scoped to the widget root */
#pandero-player {
  /* Color palette (D-02) */
  --pandero-bg:        #f5eedc;   /* off-white / goatskin */
  --pandero-surface:   #3b1f0e;   /* dark brown / wood */
  --pandero-accent:    #c4702b;   /* warm ochre */
  --pandero-text:      #3b1f0e;
  --pandero-track:     #c4a882;   /* mid ochre */

  /* Typography */
  --pandero-font:      'Caveat', cursive;
  --pandero-size-label: 0.85rem;
  --pandero-size-value: 1.1rem;

  /* Sizing */
  --pandero-hex-size:  120px;     /* hexagon button width */
  --pandero-gap:       1.25rem;
}
```

### Pattern 6: importmap Collision Resolution

`poc.html` currently defines the importmap for `unmute-ios-audio`. A `type="module"` widget script cannot add its own importmap after the page has begun module loading. Two approaches exist:

**Approach A — Direct URL import (recommended):** Replace the bare specifier with the full CDN URL inside `player.js`. No importmap needed at all.

```javascript
// player.js — no importmap dependency
import unmuteAudio from 'https://esm.sh/unmute-ios-audio@3.3.0';
```

Tradeoff: The URL is hardcoded. If esm.sh CDN is unavailable, unmuteAudio silently fails. However, `unmute-ios-audio` is a failsafe — if it doesn't run, audio still works on most iOS devices; only the hardware mute switch behaviour is affected.

**Approach B — Host page provides importmap:** The host page (salvadorcassis.com) includes the importmap for the widget's bare specifiers. The widget's README documents required mappings. Planner should document this in the two-line embed instructions.

```html
<!-- Host page must include this before the widget script -->
<script type="importmap">
  { "imports": { "unmute-ios-audio": "https://esm.sh/unmute-ios-audio@3.3.0" } }
</script>
<!-- Widget embed (two lines) -->
<div id="pandero-player"></div>
<script src="pandero/player.js" type="module"></script>
```

Tradeoff: Adds a third line to the embed, but keeps the bare specifier readable in the source. If the host page already has an importmap, the two maps must be merged (only one importmap per page; first entry wins for duplicate keys).

**Recommendation:** Approach A (direct URL import) for Phase 3. It keeps the embed to exactly two lines as specified in UI-03 and eliminates the host-page importmap dependency entirely. Document the CDN URL in a comment.

### Anti-Patterns to Avoid

- **Using `innerHTML` for DOM construction:** Not CSP-safe; avoids in favor of `createElement` + `textContent`/`append`.
- **Assigning to `window.*`:** Violates UI-04. ES module scope prevents accidental globals but explicit `window.foo = bar` inside a module still pollutes.
- **Using `document.write`:** Blocks parser, deprecated, reloads page if called after parse.
- **Using `id` without `pandero-` prefix:** IDs are global. `id="toggle-btn"` from poc.html would collide with any host-page element. Every ID must be `pandero-toggle-btn`, etc.
- **Using `type="module"` without specifying MIME:** Servers must serve `.js` as `text/javascript`. `serve` and `python3 -m http.server` both handle this correctly.
- **Adding Shadow DOM:** D-14 locks against Shadow DOM. Do not use it even though it would simplify CSS isolation — host page intentional override (D-15) requires the styles to be reachable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hexagon shape | Custom SVG shape component | `clip-path: polygon()` | 4–6 CSS values replace 30+ lines of SVG; hardware-accelerated |
| Circular slider thumb | Custom `<div>` drag UI | `::-webkit-slider-thumb` + `::-moz-range-thumb` | Native input has built-in keyboard and screen reader support for free |
| Touch target expansion | Invisible overlay div | Transparent `border` on thumb pseudo-element | Overlay would intercept pointer events and break keyboard focus |
| Scope isolation | IIFE wrapper | `type="module"` | Modules are already strict-mode isolated scopes; IIFE is redundant overhead |
| Font loading detection | `document.fonts.ready` polling | CSS `font-display: swap` | Prevents invisible text flash; no JS needed |

**Key insight:** Native HTML form elements (`<input type="range">`) provide free accessibility (keyboard navigation, screen reader value announcement, ARIA implicit roles). Custom drag-based sliders would require all of that to be reimplemented manually — this is the canonical case against hand-rolling form controls.

---

## Common Pitfalls

### Pitfall 1: importmap Timing — "Module already loaded, import map ignored"

**What goes wrong:** `player.js` attempts to define a `<script type="importmap">` by injecting it into `<head>` via DOM manipulation. The browser silently ignores it because the module graph has already started loading.

**Why it happens:** importmaps must be declared in HTML before any `<script type="module">` — the specification does not allow dynamic importmap injection.

**How to avoid:** Use a direct URL import for `unmute-ios-audio` inside `player.js` (Approach A above), or require the host page to declare the importmap in its HTML before the widget script tag.

**Warning signs:** `unmute-ios-audio` is `undefined` or the import fails with a resolution error in the browser console.

### Pitfall 2: CSS Leaking From Host Into Widget (and vice versa)

**What goes wrong:** Host page has a global `input[type=range]` style that overrides `appearance: none` on the widget's sliders, causing thumb styling to fail.

**Why it happens:** Without Shadow DOM, all CSS is global. Specificity battles can override widget styles.

**How to avoid:** Always style widget elements via the fully-qualified `#pandero-player .pandero-slider` selector chain. This adds ID specificity (0,1,0,0) which beats most global rules. Document that hosts can override via `#pandero-player { --pandero-accent: ... }`.

**Warning signs:** Slider thumb looks like browser default on the host page but looks correct on the standalone poc.html dev server.

### Pitfall 3: Range Slider Touch Hitbox on iOS Safari

**What goes wrong:** The slider thumb looks correct but users cannot grab it reliably on touch — takes multiple attempts.

**Why it happens:** If the `<input>` element height is less than the thumb visual size, iOS Safari clips the touch hitbox to the element bounds, not the rendered thumb bounds.

**How to avoid:** Set `height: 44px` on the `<input>` directly. This makes the full interaction row tappable. Combine with the transparent-border technique on the thumb for belt-and-suspenders coverage.

**Warning signs:** Works on desktop Chrome/Firefox; fails on physical iPhone. Cannot reproduce in DevTools device emulation — requires real device.

### Pitfall 4: `clip-path` and `overflow` Conflict

**What goes wrong:** The hexagon button has `clip-path` applied, but a child element (e.g., the icon) overflows the clip boundary and gets visually cropped in unexpected ways.

**Why it happens:** `clip-path` clips the painted area of the element AND all its descendants.

**How to avoid:** Size the button large enough that the icon glyph (▶/⏸) sits comfortably inside the hexagon boundary with padding. Prefer text/Unicode glyphs over child `<span>` elements for the icon.

**Warning signs:** The play icon is partially invisible or cropped on certain browsers.

### Pitfall 5: `cos(30deg)` in `aspect-ratio` Fails on Older Browsers

**What goes wrong:** `aspect-ratio: 1 / cos(30deg)` is a CSS trigonometric function available in Chrome 99+, Safari 15.4+, Firefox 96+, but fails silently on older versions — the element collapses to a square.

**Why it happens:** CSS trig functions are relatively new (2022). Older iOS Safari versions (< 15.4) are still in use.

**How to avoid:** Provide a numeric fallback: `aspect-ratio: 1 / 0.866` (0.866 ≈ cos(30°)). Order: numeric first, then overridden by `cos()` if supported.

```css
.pandero-play-btn {
  aspect-ratio: 1 / 0.866;            /* fallback */
  aspect-ratio: 1 / cos(30deg);       /* modern — overrides above if supported */
}
```

**Warning signs:** Hexagon button appears as a tall rectangle on real iOS 14 devices.

### Pitfall 6: ID Collisions From poc.html Element IDs

**What goes wrong:** `player.js` creates elements using the same `id` values as `poc.html` (`toggle-btn`, `tempo`, `pitch`, etc.). If a developer opens poc.html in one tab and somehow the IDs leak (or a future dev copies IDs), conflicts arise.

**Why it happens:** poc.js references IDs like `toggle-btn`, `tempo-val`. Migrating to player.js without renaming IDs creates collision risk.

**How to avoid:** All element IDs in player.js must use the `pandero-` prefix: `pandero-toggle-btn`, `pandero-tempo`, `pandero-tempo-val`, etc. This was locked in D-14 but is easy to miss during migration.

**Warning signs:** `document.getElementById('tempo')` returning `null` in player.js while it works in poc.html — or worse, returning the wrong element on a page that has its own `id="tempo"`.

---

## Code Examples

### Hexagon Button — Full CSS Block

```css
/* Source: css-tip.com/hexagon-shape, adapted */

.pandero-play-btn {
  /* Dimensions */
  width: var(--pandero-hex-size, 120px);
  aspect-ratio: 1 / 0.866;            /* fallback */
  aspect-ratio: 1 / cos(30deg);       /* modern override */

  /* Handmade hexagon — subtle vertex perturbation for D-06 */
  clip-path: polygon(
    51% 1%,
    99% 24%,
    100% 76%,
    49% 99%,
    1% 77%,
    0% 25%
  );

  /* Visuals */
  background-color: var(--pandero-surface);
  color: var(--pandero-bg);
  border: none;
  cursor: pointer;
  font-family: var(--pandero-font);
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;

  /* Transition */
  transition: opacity 0.15s ease;
}

.pandero-play-btn:active {
  opacity: 0.75;
}
```

### Slider Row — HTML Structure Created by JS

```html
<!-- Programmatically created — shown here for reference -->
<div class="pandero-slider-row">
  <div class="pandero-slider-header">
    <label for="pandero-tempo">Tempo</label>
    <span id="pandero-tempo-val" class="pandero-value">111 BPM</span>
  </div>
  <input
    type="range"
    id="pandero-tempo"
    class="pandero-slider"
    min="0.5" max="1.5" step="0.01" value="1.0"
  >
</div>
```

### Slider Row — Full CSS Block

```css
/* Source: CSS-Tricks range input guide + Smashing Magazine */

.pandero-slider-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.pandero-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: var(--pandero-font);
  font-size: var(--pandero-size-label);
  color: var(--pandero-text);
}

.pandero-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 44px;            /* iOS touch row height */
  background: transparent;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

/* WebKit thumb */
.pandero-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--pandero-accent);
  border: 10px solid transparent;
  box-sizing: content-box;
  background-clip: padding-box;
  margin-top: -20px;        /* (44px input height - 4px track height) / 2 = 20px */
  cursor: pointer;
}

/* WebKit track */
.pandero-slider::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--pandero-track);
  border-radius: 2px;
}

/* Firefox thumb */
.pandero-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--pandero-accent);
  border: none;
  cursor: pointer;
}

/* Firefox track */
.pandero-slider::-moz-range-track {
  height: 4px;
  background: var(--pandero-track);
  border-radius: 2px;
}
```

### Widget Layout — Outer Structure CSS

```css
/* player.css */

@font-face {
  font-family: 'Caveat';
  src: url('./caveat-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

#pandero-player {
  /* Token system */
  --pandero-bg:        #f5eedc;
  --pandero-surface:   #3b1f0e;
  --pandero-accent:    #c4702b;
  --pandero-text:      #3b1f0e;
  --pandero-track:     #c4a882;
  --pandero-font:      'Caveat', cursive;
  --pandero-size-label: 0.9rem;
  --pandero-size-value: 1.1rem;
  --pandero-hex-size:   120px;
  --pandero-gap:        1.25rem;

  /* Layout */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pandero-gap);
  padding: 1.5rem 1rem;
  background-color: var(--pandero-bg);
  max-width: 375px;
  width: 100%;
  box-sizing: border-box;

  /* Typography baseline */
  font-family: var(--pandero-font);
  color: var(--pandero-text);
}

.pandero-controls {
  display: flex;
  flex-direction: column;
  gap: var(--pandero-gap);
  width: 100%;
}
```

### Host Page Embed (two lines — UI-03)

```html
<!-- Host page (salvadorcassis.com) -->

<!-- Line 1: CSS -->
<link rel="stylesheet" href="/pandero/player.css">

<!-- Mount point -->
<div id="pandero-player"></div>

<!-- Line 2: JS -->
<script src="/pandero/player.js" type="module"></script>
```

Note: The importmap for `unmute-ios-audio` is eliminated by using a direct CDN URL import inside `player.js` (Approach A). If the host page already uses an importmap for other purposes, no conflict occurs.

### isSecureContext Guard in player.js

The guard from `poc.html` must move into `player.js` since the host page provides no shell HTML:

```javascript
// player.js — top of module
if (!window.isSecureContext) {
  const warn = document.createElement('p');
  warn.style.cssText = 'color:red;font-weight:bold;font-family:sans-serif';
  warn.textContent = '[Pandero] Must be served via HTTPS or localhost — not file://';
  document.getElementById('pandero-player')?.appendChild(warn);
  throw new Error('[pandero] Not a Secure Context. AudioWorklet will fail.');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS border-trick hexagon (3 rotated divs) | `clip-path: polygon()` | ~2016 | Simpler, animatable, correct semantic element |
| `::-ms-track` / `::-ms-thumb` for IE | Drop IE, use `::-webkit-*` + `::-moz-*` only | 2022 (IE EOL) | Removes ~30% of range slider CSS complexity |
| `document.write` for widget DOM | `createElement` + `append` | Always bad, now standard to avoid | Security, performance, CSP compliance |
| Google Fonts CDN `<link>` | Self-hosted `@font-face` woff2 | 2020 GDPR ruling | Privacy compliance, eliminates external dependency, faster if co-hosted |
| Multiple importmaps per page | Single importmap (merged, first-wins) | Spec finalized 2023 | Widget must not define its own importmap |

**Deprecated/outdated:**
- `::-ms-range-thumb` / `::-ms-track` (IE Edge Legacy): not needed, IE is EOL
- `ScriptProcessorNode`-based SoundTouch: already rejected in Phase 1, not relevant here
- Shadow DOM for widget isolation: rejected by D-14 — do not reintroduce

---

## Open Questions

1. **Exact color values for pandero palette (D-02)**
   - What we know: warm ochre + dark brown + off-white, inspired by the physical pandero
   - What's unclear: Specific hex values. The values in this document (`#f5eedc`, `#3b1f0e`, `#c4702b`) are research-derived approximations.
   - Recommendation: Implementer validates against a photo of the pandero instrument. These values are starting points in CSS custom properties, easily adjusted.

2. **Caveat font weight needed**
   - What we know: Labels and value displays use the font; only Regular (400) weight appears needed
   - What's unclear: Whether the hexagon play icon should use the font or a Unicode character
   - Recommendation: Use Unicode ▶ (U+25B6) and ⏹ (U+23F9) — they are platform-independent glyphs available without any font. The Caveat font is used only for text labels and numeric displays.

3. **cos(30deg) CSS trig function — iOS 14 coverage**
   - What we know: Supported in iOS Safari 15.4+ (released September 2022). iOS 14 is below the cutoff.
   - What's unclear: Whether salvadorcassis.com's audience includes iOS 14 users
   - Recommendation: Include the numeric fallback (`aspect-ratio: 1 / 0.866`) before the trig expression. Cost is zero.

4. **esm.sh availability and caching**
   - What we know: Using `https://esm.sh/unmute-ios-audio@3.3.0` as a direct import in player.js requires esm.sh to be available
   - What's unclear: Whether salvadorcassis.com's deployment allows external module fetches (CSP `script-src`)
   - Recommendation: Document this in the embed instructions. Alternatively, include `unmute-ios-audio` as a vendored file in `pandero/` (copy the esm.sh output once). This is the most robust option.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — `<script type="importmap">` — multiple importmap merging behavior, first-wins rule
- MDN Web Docs — `document.createElement()` — DOM injection API
- css-tip.com/hexagon-shape/ — modern `clip-path: polygon()` + `cos(30deg)` hexagon approach
- WCAG 2.5.5 — 44×44px minimum touch target requirement

### Secondary (MEDIUM confidence)
- CSS-Tricks — Styling Cross-Browser Compatible Range Inputs — webkit/moz pseudo-elements, margin-top centering
- Smashing Magazine — Create Custom Range Input Consistent Browsers — transparent border touch target expansion
- web.dev — Import Maps in All Modern Browsers — cross-browser importmap support status
- Google Web Fonts Helper (gwfh.mranftl.com) — Caveat woff2 download and @font-face snippet

### Tertiary (LOW confidence)
- Vertex perturbation values for "handmade" hexagon — derived from CSS-Tricks clip-path article pattern; exact values need visual tuning during implementation
- Specific hex color values for pandero palette — approximated from description; need validation against physical instrument photo

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core techniques (clip-path, range pseudo-elements, ES module scope) are well-documented in MDN and CSS-Tricks with cross-browser compatibility data
- Architecture: HIGH — DOM injection pattern, CSS custom property scoping, importmap collision are all verified against official sources
- Pitfalls: HIGH (importmap timing, ID collisions, cos(30deg) fallback) / MEDIUM (iOS touch hitbox — requires real device, cannot fully verify without hardware)

**Research date:** 2026-03-22
**Valid until:** 2026-09-22 (CSS techniques are stable; importmap spec is finalized)
