# Pandero Web — Backing Track Interactivo para Cueca Chilena

## What This Is

Herramienta web para estudiar y practicar cueca chilena. Permite reproducir un backing track de pandero con control de tempo, para que cualquier músico pueda ensayar a su propio ritmo. Disponible gratis en la web, sin necesidad de instalación ni financiamiento. Un solo control, una sola acción: ajustar el tiempo.

## Core Value

El músico puede ajustar el tempo del pandero para practicar cueca a su propio ritmo, desde un widget embebible en cualquier página web.

## Requirements

### Validated

- [x] Reproducir un MP3 fijo de pandero desde el navegador — Validated in Phase 1: Audio Engine Foundation
- [x] Controlar el tempo de forma independiente (sin afectar pitch) — Validated in Phase 1: Audio Engine Foundation
- [x] Interfaz embebible en web existente (HTML/JS puro, sin framework) — Validated in Phase 3: Mobile Polish and Embedding
- [x] Tempo por defecto apropiado para cueca (~112 BPM, CUE-01) — Validated in Phase 4: Cueca-Specific UX Refinements
- [x] Widget simplificado a un solo control de tempo (sin pitch ni volumen) — Validated in Phase 4: Cueca-Specific UX Refinements

### Active

- [ ] Accesible para público general sin instalación

### Out of Scope (v1)

- Controlar pitch de forma independiente — audio engine lo soporta internamente, pero UI removida en Phase 4 por decisión del usuario (v2+)

### Out of Scope

- Descarga del audio modificado — no es necesario para v1
- Carga de archivos por el usuario — el audio es fijo para cada instrumento
- Login / cuentas de usuario — herramienta pública y sin fricción
- App móvil nativa — el canal web resuelve el problema de distribución
- Guitarra y otros instrumentos — v2+

## Context

- El autor construyó una versión iOS funcional usando la librería RubberBand para time-stretching/pitch-shifting independiente. No fue publicada por costos del App Store.
- La versión web permite distribuir gratuitamente a la comunidad cuequera sin depender de tiendas de apps.
- El proyecto vive en una web existente en HTML puro — la herramienta debe poder embeberse directamente.
- El concepto está validado: el problema es real, la solución técnica ya fue probada.
- Instrumentos de la tradición cuequera a incorporar progresivamente: pandero (v1), guitarra rítmica, guitarra solista, acordeón, voz.

## Constraints

- **Tech Stack**: HTML/JS puro — sin frameworks, sin servidor. Debe funcionar en el browser sin backend.
- **Audio Processing**: Pitch y tempo deben ser independientes (time-stretching real). RubberBand WASM o SoundTouchJS son candidatos naturales dado el antecedente iOS.
- **Distribución**: Embebible en web existente — no es una SPA standalone.
- **Audio**: El MP3 del pandero es un archivo fijo incluido en el proyecto.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web en lugar de app nativa | Sin costo de distribución, accesible desde cualquier dispositivo | — Pending |
| HTML/JS puro (sin framework) | Embebible en web existente, sin complejidad de build | — Pending |
| Audio fijo por instrumento (no carga de usuario) | Simplifica v1, cada track es curado para la enseñanza | — Pending |

---

## Evolution

Este documento evoluciona en cada transición de fase y milestone.

**Después de cada fase** (via `/gsd:transition`):
1. ¿Requisitos invalidados? → Mover a Out of Scope con razón
2. ¿Requisitos validados? → Mover a Validated con referencia de fase
3. ¿Nuevos requisitos emergieron? → Agregar a Active
4. ¿Decisiones a registrar? → Agregar a Key Decisions
5. ¿"What This Is" sigue siendo preciso? → Actualizar si derivó

**Después de cada milestone** (via `/gsd:complete-milestone`):
1. Revisión completa de todas las secciones
2. ¿Core Value sigue siendo la prioridad correcta?
3. ¿Razones de Out of Scope siguen siendo válidas?
4. Actualizar Context con estado actual

---
*Last updated: 2026-03-23 — Phase 4 complete (milestone v1.0.8 done)*
