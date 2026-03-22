// poc.js — Dairapp Phase 1 PoC: full audio pipeline
// Sources: @soundtouchjs/audio-worklet v1.0.8 README + processor source
//          unmute-ios-audio v3.3.0 source
//          MDN AudioBufferSourceNode, AudioContext

import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
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
let source = null;
let audioBuffer = null;
let isInitialized = false;  // ENG-05 guard: AudioContext created only once, inside gesture
let isPlaying = false;

// ---------------------------------------------------------------------------
// init() — called exclusively inside play(), which is a click handler.
// Creates the AudioContext and registers the SoundTouch worklet processor.
// ENG-05: AudioContext MUST be created inside a user gesture.
// ---------------------------------------------------------------------------
async function init() {
  if (isInitialized) return;
  isInitialized = true;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Log state for debugging (should show 'suspended' on some browsers before gesture completes)
  console.log('AudioContext state after creation:', audioCtx.state);

  // Register self-hosted worklet processor (cross-origin addModule() is blocked).
  await SoundTouchNode.register(audioCtx, './soundtouch-processor.js');

  // Decode the pre-fetched MP3 — now that AudioContext exists.
  const arrayBuffer = await mp3Promise;
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  document.getElementById('status').textContent = 'Initialized — ready to play';
}

// ---------------------------------------------------------------------------
// play() — starts (or restarts) playback from the beginning.
// Creates a new AudioBufferSourceNode each call; source nodes are fire-and-forget.
// ---------------------------------------------------------------------------
async function play() {
  await init();

  // Resume if suspended (autoplay policy) or interrupted (iOS screen lock — Pitfall 2).
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    await audioCtx.resume();
  }

  // Disconnect previous source node if one exists (cannot reuse — Pitfall 6).
  if (source) {
    source.disconnect();
  }

  // Build audio graph: source → stNode → speakers.
  stNode = new SoundTouchNode(audioCtx);
  stNode.connect(audioCtx.destination);

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;  // ENG-04: seamless loop — browser handles boundary with zero gap

  // ENG-02: Tandem pattern — BOTH source and stNode must receive the same ratio.
  // Prevents silence gaps at ratios > 1.0 (Pitfall 4). stNode.tempo is NOT used.
  const ratio = parseFloat(document.getElementById('tempo').value);
  source.playbackRate.value = ratio;
  source.connect(stNode);
  stNode.playbackRate.value = ratio;  // processor divides pitch by this automatically

  // ENG-03: Independent pitch shift in semitones (integer steps, -6 to +6 for this UI).
  stNode.pitchSemitones.value = parseInt(document.getElementById('pitch').value);

  source.start();
  isPlaying = true;

  document.getElementById('status').textContent = 'Playing';
  document.getElementById('pause-btn').disabled = false;
  document.getElementById('play-btn').textContent = 'Restart';
}

// ---------------------------------------------------------------------------
// pause() — suspends the AudioContext (preserves playback position).
// NEVER calls source.stop() — that makes the node unusable (Pitfall 6).
// ---------------------------------------------------------------------------
async function pause() {
  if (!audioCtx || !isPlaying) return;

  await audioCtx.suspend();
  isPlaying = false;

  document.getElementById('status').textContent = 'Paused';
  document.getElementById('pause-btn').disabled = true;
  document.getElementById('play-btn').textContent = 'Resume';
}

// ---------------------------------------------------------------------------
// Tempo slider — ENG-02: tandem pattern (both nodes, same ratio).
// ---------------------------------------------------------------------------
function handleTempoChange(e) {
  if (!source || !stNode) return;
  const ratio = parseFloat(e.target.value);
  source.playbackRate.value = ratio;   // feed samples at the new rate
  stNode.playbackRate.value = ratio;   // processor compensates pitch automatically
  document.getElementById('tempo-val').textContent = ratio.toFixed(2);
}

// ---------------------------------------------------------------------------
// Pitch slider — ENG-03: independent semitone shift.
// ---------------------------------------------------------------------------
function handlePitchChange(e) {
  if (!stNode) return;
  stNode.pitchSemitones.value = parseInt(e.target.value);
  document.getElementById('pitch-val').textContent = e.target.value;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
document.getElementById('play-btn').addEventListener('click', play);
document.getElementById('pause-btn').addEventListener('click', pause);
document.getElementById('tempo').addEventListener('input', handleTempoChange);
document.getElementById('pitch').addEventListener('input', handlePitchChange);
