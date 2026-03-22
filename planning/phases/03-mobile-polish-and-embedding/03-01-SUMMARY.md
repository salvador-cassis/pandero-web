---
phase: 03-mobile-polish-and-embedding
plan: "01"
subsystem: css-visual-identity
tags: [css, mobile, touch-targets, visual-identity, fonts]
dependency_graph:
  requires: []
  provides:
    - pandero/player.css
    - pandero/caveat-regular.woff2
  affects:
    - pandero/player.js (plan 03-02 consumes these CSS classes)
tech_stack:
  added:
    - Self-hosted Caveat Regular woff2 font (v23 latin subset, 48KB)
  patterns:
    - CSS custom property token system scoped to #pandero-player
    - Mobile-first flexbox column layout (max-width: 375px)
    - clip-path polygon with perturbed vertices for handmade hexagon
    - Transparent border trick for 44px touch targets on circular thumbs
    - Dual aspect-ratio declarations (0.866 fallback + cos(30deg) modern)
key_files:
  created:
    - pandero/player.css
    - pandero/caveat-regular.woff2
  modified: []
decisions:
  - "Caveat v23 (not v18 from research) — updated URL fetched from Google Fonts API; v18 URL returned HTML redirect"
  - "Latin subset only — sufficient for all Spanish UI labels (Tempo, Pitch, Volumen)"
  - "CSS custom properties scoped to #pandero-player, not :root — prevents token leakage into host page"
metrics:
  duration_seconds: 105
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 3 Plan 1: Widget CSS and Visual Identity Summary

**One-liner:** Complete widget stylesheet with earthy pandero palette (#f5eedc/#3b1f0e/#c4702b), handmade hexagon button via clip-path polygon, and 44px touch targets via transparent border trick — plus self-hosted Caveat Regular woff2 font.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Download Caveat font | cfb6144 | pandero/caveat-regular.woff2 |
| 2 | Create pandero/player.css | e860be2 | pandero/player.css |

## What Was Built

### Task 1: Caveat Regular woff2 (cfb6144)

Downloaded the self-hosted font file from Google Fonts CDN (updated to v23 — see deviations). The latin subset (48KB) covers all widget labels in Spanish. Magic bytes `wOF2` confirmed; size 48,864 bytes (> 10KB requirement).

### Task 2: pandero/player.css (e860be2)

Complete production-ready stylesheet with 193 lines and 43 `pandero-*` selector occurrences. Key structural elements:

- **@font-face** — loads `./caveat-regular.woff2` with `font-display: swap`
- **Token system** — 9 CSS custom properties in `#pandero-player` scope, including all three palette colors, font, hex size, and gap
- **Root layout** — `flex-direction: column`, `max-width: 375px`, centered with `margin: 0 auto`
- **Hexagon button** — `clip-path: polygon(51% 1%, 99% 24%, 100% 76%, 49% 99%, 1% 77%, 0% 25%)` with asymmetric vertices for handmade feel; dual `aspect-ratio` declarations
- **Slider base** — `height: 44px` provides the full touch row (UI-02 satisfied by height alone, thumb handled separately)
- **WebKit thumb** — 24px circle + `border: 10px solid transparent` + `background-clip: padding-box` = 44px total hit area with only 24px visible dot
- **Firefox thumb** — separate `::-moz-range-thumb` rule (cannot combine pseudo-elements across browser engines)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Caveat font URL updated from v18 to v23**
- **Found during:** Task 1
- **Issue:** The research document specified `caveat/v18/...woff2` but that URL returns an HTML redirect page (1618 bytes, DOCTYPE html) — the font version was updated since research was written
- **Fix:** Queried the live Google Fonts CSS API (`fonts.googleapis.com/css2?family=Caveat:wght@400&display=swap`) to find the current URL, then downloaded `caveat/v23/...` (48,864 bytes, confirmed `wOF2` magic bytes)
- **Files modified:** pandero/caveat-regular.woff2
- **Commit:** cfb6144

## Known Stubs

None — this plan produces static CSS and a binary font file. No data flows, no placeholder text, no hardcoded empty values.

## Self-Check: PASSED

- pandero/caveat-regular.woff2: EXISTS (48,864 bytes, wOF2 magic bytes)
- pandero/player.css: EXISTS (193 lines, 43 pandero- occurrences)
- Commit cfb6144: EXISTS (git log verified)
- Commit e860be2: EXISTS (git log verified)
- All 13 acceptance criteria: PASSED
