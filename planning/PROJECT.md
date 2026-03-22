# Pandero Web — Backing Track Interactivo para Cueca Chilena

## What This Is

Herramienta web para estudiar y practicar cueca chilena. Permite reproducir un backing track de un instrumento específico (pandero en v1) con control independiente de pitch y tempo, para que cualquier músico — cantor, guitarrista, panderetero, acordeonista — pueda ensayar a su propio ritmo y tonalidad. Disponible gratis en la web, sin necesidad de instalación ni financiamiento.

## Core Value

El músico puede cambiar pitch y tempo de forma independiente sin que uno afecte al otro, para practicar cueca en cualquier nivel y contexto.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Reproducir un MP3 fijo de pandero desde el navegador
- [ ] Controlar el tempo de forma independiente (sin afectar pitch)
- [ ] Controlar el pitch de forma independiente (sin afectar tempo)
- [ ] Interfaz embebible en web existente (HTML/JS puro, sin framework)
- [ ] Accesible para público general sin instalación

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
*Last updated: 2026-03-22 after initialization*
