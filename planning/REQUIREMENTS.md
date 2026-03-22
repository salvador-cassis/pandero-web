# Requirements: Pandero Web

**Defined:** 2026-03-22
**Core Value:** El músico puede cambiar pitch y tempo de forma independiente sin que uno afecte al otro, para practicar cueca en cualquier nivel y contexto.

## v1 Requirements

### Audio Engine

- [x] **ENG-01**: El pandero MP3 se carga y decodifica en el navegador sin servidor
- [x] **ENG-02**: El tempo puede modificarse de forma independiente al pitch (time-stretching real)
- [x] **ENG-03**: El pitch puede modificarse de forma independiente al tempo (pitch-shifting real)
- [x] **ENG-04**: El audio se reproduce en loop continuo automáticamente
- [x] **ENG-05**: El AudioContext se crea dentro de un gesto del usuario (política autoplay del browser)
- [ ] **ENG-06**: El audio funciona en iOS aunque el switch de silencio esté activado

### Controles de Reproducción

- [ ] **CTRL-01**: El usuario puede iniciar y pausar la reproducción
- [ ] **CTRL-02**: El usuario puede ajustar el tempo con un slider (rango: ~50%–150% del original)
- [ ] **CTRL-03**: El usuario puede ajustar el pitch con un slider (rango: ±6 semitonos)
- [ ] **CTRL-04**: El usuario puede ajustar el volumen
- [ ] **CTRL-05**: El usuario puede resetear pitch y tempo a los valores originales con un solo clic

### Visualización

- [ ] **VIS-01**: El BPM actual se muestra junto al slider de tempo
- [ ] **VIS-02**: Los semitonos actuales se muestran junto al slider de pitch (+2, -1, etc.)

### UI y Embedding

- [ ] **UI-01**: La interfaz es responsive y usable en móvil (teléfono en atril)
- [ ] **UI-02**: Los controles tienen touch targets suficientemente grandes para uso con dedos
- [ ] **UI-03**: El widget se puede embeber en una página HTML existente con dos líneas (un `<div>` y un `<script>`)
- [ ] **UI-04**: El JS del widget no contamina el scope global de la página host

### Cueca UX

- [ ] **CUE-01**: El tempo por defecto al cargar refleja el rango típico de la cueca (~90–100 BPM)
- [ ] **CUE-02**: El slider de tempo muestra etiquetas de vocabulario cuequero ("lento / normal / animado")

## v2 Requirements

### Instrumentos adicionales

- **INST-01**: Pista de guitarra rítmica con los mismos controles de pitch/tempo
- **INST-02**: Selector de instrumento activo (pandero / guitarra)
- **INST-03**: Posibilidad de agregar más instrumentos de la tradición cuequera (acordeón, voz, etc.)

### Calidad de audio

- **QUAL-01**: Evaluación de RubberBand WASM para instrumentos polifónicos (guitarra, acordeón) si SoundTouchJS muestra artefactos a ratios extremos

## Out of Scope

| Feature | Razón |
|---------|-------|
| Carga de archivos por el usuario | Destruye la identidad "curado para cueca"; agrega complejidad de formato/tamaño; excluido en PROJECT.md |
| Display de nombre de nota (ej: "La", "Si♭") | El pandero es percusión, no tiene tonalidad de referencia — mostrar nombre de nota no aplica |
| Descarga/exportación del audio modificado | No es parte del flujo de práctica; requeriría ffmpeg.wasm u otro encoder pesado |
| Login / cuentas de usuario | Fricción innecesaria para una herramienta pública de comunidad |
| Marcadores A-B de sección | La pista de pandero es homogénea — no hay secciones que navegar |
| Waveform visual | Sin valor navegacional en un loop homogéneo |
| EQ / efectos de audio | La grabación debe ser de calidad; efectos agregan complejidad sin mejorar la práctica |
| Detección de BPM por micrófono | Requiere permisos; innecesario cuando el usuario controla el tempo por slider |
| Funciones sociales / historial | Requiere backend; la comunidad cuequera se conecta offline |
| Separación de stems (Demucs/Spleeter) | La pista ya es el stem; demasiado pesado para web |
| App móvil nativa | La web resuelve la distribución sin costos de App Store |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Complete |
| ENG-04 | Phase 1 | Complete |
| ENG-05 | Phase 1 | Complete |
| ENG-06 | Phase 1 | Pending |
| CTRL-01 | Phase 2 | Pending |
| CTRL-02 | Phase 2 | Pending |
| CTRL-03 | Phase 2 | Pending |
| CTRL-04 | Phase 2 | Pending |
| CTRL-05 | Phase 2 | Pending |
| VIS-01 | Phase 2 | Pending |
| VIS-02 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| CUE-01 | Phase 4 | Pending |
| CUE-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — ENG-01, ENG-02, ENG-03, ENG-04 marked complete (plan 01-02, desktop smoke test passed)*
