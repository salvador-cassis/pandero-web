// player.js — Pandero Widget: self-mounting ES module
// Phase 3: Mobile Polish and Embedding
// Migrated from poc.js — audio engine preserved exactly; DOM is programmatic.

// SECTION A: Guards and imports
// ----------------------------------------------------------------------------

// Direct CDN URL — eliminates importmap dependency (UI-03, no bare specifier).
import unmuteAudio from 'https://esm.sh/unmute-ios-audio@3.3.0';

// isSecureContext guard — AudioWorklet requires HTTPS or localhost.
if (!window.isSecureContext) {
  const warn = document.createElement('p');
  warn.style.cssText = 'color:red;font-weight:bold;font-family:sans-serif';
  warn.textContent = '[Pandero] Must be served via HTTPS or localhost — not file://';
  document.getElementById('pandero-player')?.appendChild(warn);
  throw new Error('[pandero] Not a Secure Context. AudioWorklet will fail.');
}

// ENG-06: Call as early as possible, before any user gesture fires.
// Registers listeners for click/touchend so iOS routes Web Audio to the media
// channel (bypasses hardware mute switch). No callback needed.
unmuteAudio();

// Pre-fetch MP3 immediately to hide network latency.
// Use import.meta.url so the path resolves relative to player.js, not the host page.
// AudioContext is not created yet — decodeAudioData() runs later inside init().
const mp3Promise = fetch(new URL('./pandero.mp3', import.meta.url)).then(r => r.arrayBuffer());

// SECTION B: DOM creation and mounting
// ----------------------------------------------------------------------------

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
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  row.append(header, input);
  return row;
}

function buildDOM() {
  const root = el('div', 'pandero-widget');

  const hexBtn = el('button', 'pandero-play-btn');
  hexBtn.setAttribute('type', 'button');
  hexBtn.setAttribute('aria-label', 'Reproducir / Detener');
  hexBtn.textContent = '\u25B6'; // ▶

  const controls = el('div', 'pandero-controls');
  controls.append(
    sliderRow('tempo',  'Tempo',   0.5, 1.5, 0.01, 1.0, 'pandero-tempo-val', '111 BPM'),
    sliderRow('pitch',  'Pitch',  -6,   6,   1,    0,   'pandero-pitch-val', '0 st'),
    sliderRow('volume', 'Volumen', 0,   1,   0.01, 1.0,  null, null)
  );

  root.append(hexBtn, controls);
  return root;
}

const mount = document.getElementById('pandero-player');
if (!mount) throw new Error('[pandero] Mount point #pandero-player not found');
const root = buildDOM();
mount.appendChild(root);

// SECTION C: Audio engine (migrated from poc.js exactly) + event wiring
// ----------------------------------------------------------------------------

// Module-level singletons — one AudioContext per widget (Safari cap: 4 per page).
let audioCtx = null;
let stNode = null;
let gainNode = null;
let source = null;
let audioBuffer = null;
let isInitialized = false;  // ENG-05 guard: AudioContext created only once, inside gesture
let isPlaying = false;

// ---------------------------------------------------------------------------
// init() — called exclusively inside togglePlayback(), which is a click handler.
// Creates the AudioContext, registers the SoundTouch worklet processor, and
// creates the GainNode singleton that persists across play/restart cycles.
// ENG-05: AudioContext MUST be created inside a user gesture.
// ---------------------------------------------------------------------------
async function init() {
  if (isInitialized) return;
  isInitialized = true;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Log state for debugging (should show 'suspended' on some browsers before gesture completes)
  console.log('AudioContext state after creation:', audioCtx.state);

  // Register self-hosted worklet processor (cross-origin addModule() is blocked).
  // Use import.meta.url to resolve relative to player.js, not the host page.
  await audioCtx.audioWorklet.addModule(new URL('./soundtouch-processor.js', import.meta.url));

  // Decode the pre-fetched MP3 — now that AudioContext exists.
  const arrayBuffer = await mp3Promise;
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // GainNode created once in init() — persists across startPlayback() restarts.
  // stNode connects to gainNode on each startPlayback(); gainNode routes to destination.
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.0;
  gainNode.connect(audioCtx.destination);
}

// ---------------------------------------------------------------------------
// startPlayback() — internal: starts (or restarts) playback from the beginning.
// Creates a new AudioBufferSourceNode and AudioWorkletNode each call;
// source nodes are fire-and-forget (cannot be reused — Pitfall 6).
// ---------------------------------------------------------------------------
async function startPlayback() {
  // Disconnect previous nodes to prevent multiple stNodes feeding gainNode.
  if (source) source.disconnect();
  if (stNode) stNode.disconnect();

  // Build audio graph: source → stNode → gainNode → destination.
  // Use raw AudioWorkletNode (not the library wrapper) to pass processorOptions.
  // WSOLA params: sequenceMs=40, seekWindowMs=15, overlapMs=8 — tuned for percussion.
  stNode = new AudioWorkletNode(audioCtx, 'soundtouch-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: {
      sequenceMs: 40,
      seekWindowMs: 15,
      overlapMs: 8
    }
  });
  stNode.connect(gainNode);

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;  // ENG-04: seamless loop — browser handles boundary with zero gap

  // ENG-02: Tandem pattern — BOTH source and stNode must receive the same ratio.
  // Prevents silence gaps at ratios > 1.0 (Pitfall 4). stNode.tempo is NOT used.
  const ratio = parseFloat(document.getElementById('pandero-tempo').value);
  source.playbackRate.value = ratio;
  source.connect(stNode);
  stNode.parameters.get('playbackRate').value = ratio;  // processor divides pitch by this automatically

  // ENG-03: Independent pitch shift in semitones (integer steps, -6 to +6 for this UI).
  stNode.parameters.get('pitchSemitones').value = parseInt(document.getElementById('pandero-pitch').value);

  source.start();
}

// ---------------------------------------------------------------------------
// togglePlayback() — click handler for hexagon button.
// Not playing: start from beginning, show ⏸.
// Playing: stop completely, show ▶. Next click starts from beginning.
// ---------------------------------------------------------------------------
const hexBtn = root.querySelector('.pandero-play-btn');

async function togglePlayback() {
  if (!isInitialized) {
    hexBtn.disabled = true;
    await init();
    hexBtn.disabled = false;
  }

  if (!isPlaying) {
    await audioCtx.resume();
    await startPlayback();
    isPlaying = true;
    hexBtn.textContent = '\u23F8';  // ⏸
  } else {
    if (source) { source.stop(); source.disconnect(); source = null; }
    if (stNode) { stNode.disconnect(); stNode = null; }
    isPlaying = false;
    hexBtn.textContent = '\u25B6';  // ▶
  }
}

// ---------------------------------------------------------------------------
// handleTempoChange — ENG-02: tandem pattern (both nodes, same ratio).
// Display updates always (even before first play). AudioParam updates only when playing.
// VIS-01, D-10, D-12: show BPM as integer (Math.round(ratio * 111)).
// ---------------------------------------------------------------------------
function handleTempoChange(e) {
  const ratio = parseFloat(e.target.value);
  document.getElementById('pandero-tempo-val').textContent = Math.round(ratio * 111) + ' BPM';
  if (!source || !stNode) return;
  source.playbackRate.value = ratio;
  stNode.parameters.get('playbackRate').value = ratio;
}

// ---------------------------------------------------------------------------
// handlePitchChange — ENG-03: independent semitone shift.
// VIS-02, D-13: signed display (0, +N, -N).
// ---------------------------------------------------------------------------
function handlePitchChange(e) {
  const n = parseInt(e.target.value);
  document.getElementById('pandero-pitch-val').textContent = (n === 0 ? '0' : (n > 0 ? '+' + n : '' + n)) + ' st';
  if (!stNode) return;
  stNode.parameters.get('pitchSemitones').value = n;
}

// ---------------------------------------------------------------------------
// handleVolumeChange — CTRL-04, D-15, D-16: volume via GainNode.
// gainNode persists across restarts so volume is preserved.
// ---------------------------------------------------------------------------
function handleVolumeChange(e) {
  if (!gainNode) return;
  gainNode.gain.value = parseFloat(e.target.value);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
const tempoSlider = document.getElementById('pandero-tempo');
const pitchSlider = document.getElementById('pandero-pitch');
const volumeSlider = document.getElementById('pandero-volume');

hexBtn.addEventListener('click', togglePlayback);
tempoSlider.addEventListener('input', handleTempoChange);
pitchSlider.addEventListener('input', handlePitchChange);
volumeSlider.addEventListener('input', handleVolumeChange);

// Space key: same as clicking the toggle button.
document.addEventListener('keydown', async (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    await togglePlayback();
  }
});
