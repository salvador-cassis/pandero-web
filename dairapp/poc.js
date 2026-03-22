// poc.js — Dairapp Phase 2 PoC: WSOLA-tuned audio pipeline with GainNode and full controls
// Sources: @soundtouchjs/audio-worklet v1.0.8 README + processor source
//          unmute-ios-audio v3.3.0 source
//          MDN AudioBufferSourceNode, AudioContext, AudioWorkletNode

import unmuteAudio from 'unmute-ios-audio';

// ENG-06: Call as early as possible, before any user gesture fires.
// Registers listeners for click/touchend so iOS routes Web Audio to the media
// channel (bypasses hardware mute switch). No callback needed.
unmuteAudio();

// Pre-fetch MP3 immediately to hide network latency.
// AudioContext is not created yet — decodeAudioData() runs later inside init().
const mp3Promise = fetch('./pandero.mp3').then(r => r.arrayBuffer());

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
  await audioCtx.audioWorklet.addModule('./soundtouch-processor.js');

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
  const ratio = parseFloat(document.getElementById('tempo').value);
  source.playbackRate.value = ratio;
  source.connect(stNode);
  stNode.parameters.get('playbackRate').value = ratio;  // processor divides pitch by this automatically

  // ENG-03: Independent pitch shift in semitones (integer steps, -6 to +6 for this UI).
  stNode.parameters.get('pitchSemitones').value = parseInt(document.getElementById('pitch').value);

  source.start();
}

// ---------------------------------------------------------------------------
// togglePlayback() — click handler for toggle-btn.
// Not playing: start from beginning, show ⏸.
// Playing: stop completely, show ▶. Next click starts from beginning.
// ---------------------------------------------------------------------------
async function togglePlayback() {
  const btn = document.getElementById('toggle-btn');

  if (!isInitialized) {
    btn.disabled = true;
    document.getElementById('status').textContent = 'Cargando...';
    await init();
    btn.disabled = false;
    document.getElementById('status').textContent = '';
  }

  if (!isPlaying) {
    await audioCtx.resume();
    await startPlayback();
    isPlaying = true;
    btn.textContent = '\u23F8';  // ⏸
  } else {
    if (source) { source.stop(); source.disconnect(); source = null; }
    if (stNode) { stNode.disconnect(); stNode = null; }
    isPlaying = false;
    btn.textContent = '\u25B6';  // ▶
  }
}

// ---------------------------------------------------------------------------
// handleTempoChange — ENG-02: tandem pattern (both nodes, same ratio).
// Display updates always (even before first play). AudioParam updates only when playing.
// VIS-01, D-10, D-12: show BPM as integer (Math.round(ratio * 111)).
// ---------------------------------------------------------------------------
function handleTempoChange(e) {
  const ratio = parseFloat(e.target.value);
  document.getElementById('tempo-val').textContent = Math.round(ratio * 111);
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
  document.getElementById('pitch-val').textContent = n === 0 ? '0' : (n > 0 ? '+' + n : '' + n);
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
// handleReset — CTRL-05, D-07, D-08, D-09: reset tempo and pitch only.
// Volume is NOT reset (D-08). Applies live AudioParam updates when playing.
// ---------------------------------------------------------------------------
function handleReset() {
  document.getElementById('tempo').value = 1.0;
  document.getElementById('pitch').value = 0;
  document.getElementById('tempo-val').textContent = '111';
  document.getElementById('pitch-val').textContent = '0';
  if (source && stNode) {
    source.playbackRate.value = 1.0;
    stNode.parameters.get('playbackRate').value = 1.0;
    stNode.parameters.get('pitchSemitones').value = 0;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
document.getElementById('toggle-btn').addEventListener('click', togglePlayback);
document.getElementById('tempo').addEventListener('input', handleTempoChange);
document.getElementById('pitch').addEventListener('input', handlePitchChange);
document.getElementById('volume').addEventListener('input', handleVolumeChange);
document.getElementById('reset-btn').addEventListener('click', handleReset);

// Space key: same as clicking the toggle button.
document.addEventListener('keydown', async (e) => {
  if (e.code === 'Space' && isInitialized) {
    e.preventDefault();
    await togglePlayback();
  }
});
