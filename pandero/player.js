// player.js — Pandero Widget: self-mounting ES module
// Phase 4: Cueca-Specific UX Refinements
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
  if (label) {
    const lbl = el('label');
    lbl.textContent = label;
    lbl.htmlFor = 'pandero-' + id;
    header.appendChild(lbl);
  }
  if (valId) {
    const val = el('span', 'pandero-value');
    val.id = valId;
    val.textContent = valText;
    val.setAttribute('aria-live', 'polite');
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
  // SVG: loads original hand-drawn Inkscape assets.
  // hex-borde.svg = teal hexagon fill + hand-drawn 6-sided frame (two offset layers for depth).
  // borde-play.svg = play triangle (3 filled marker-stroke paths).
  // Play position (37.12, 35.06) derived from canvas origin offset between both SVG exports.
  const hexBordeUrl = new URL('./hex-borde.svg', import.meta.url).href;
  const playUrl = new URL('./borde-play.svg', import.meta.url).href;
  hexBtn.innerHTML = `<svg class="pandero-hex-svg" viewBox="0 0 134.1427 142.32431" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <image href="${hexBordeUrl}" width="134.1427" height="142.32431"/>
    <g class="pandero-icon-play">
      <image href="${playUrl}" x="37.12" y="35.06" width="60.41" height="66.52"/>
    </g>
    <g class="pandero-icon-pause" style="display:none">
      <path class="pandero-pause-bar" d="M 50 37 C 48 53, 51 75, 49 102"/>
      <path class="pandero-pause-bar" d="M 81 36 C 79 53, 82 75, 82 103"/>
    </g>
  </svg>`;

  const beatRow = el('div', 'pandero-beats');
  const beat0 = el('span', 'pandero-beat'); beat0.setAttribute('aria-hidden', 'true');
  const beat1 = el('span', 'pandero-beat'); beat1.setAttribute('aria-hidden', 'true');
  beatRow.append(beat0, beat1);

  const controls = el('div', 'pandero-controls');
  controls.append(
    sliderRow('tempo', 'Tempo', 0.5, 1.5, 0.01, 1.009, 'pandero-tempo-val', '112 BPM')
  );

  root.append(hexBtn, beatRow, controls);
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
let animFrame = null;
let lastBeatIdx = -1;
let accumulatedBufferTime = 0;  // buffer-time odometer: accumulates on every ratio change
let lastTempoChangeCtxTime = 0; // audioCtx.currentTime at last ratio change
let currentRatio = 1.009;       // mirrors the slider, kept in sync by handleTempoChange

// ---------------------------------------------------------------------------
// Slice mode constants and state.
// Below SLICE_THRESHOLD the WSOLA algorithm produces audible artifacts on
// percussion — the "drunk" smear. Slice mode plays each grid segment at the
// original recording speed and stretches real-time by adding silence between
// segments, like Logic Pro's Slice algorithm.
// ---------------------------------------------------------------------------
const SLICE_THRESHOLD = 0.785;  // ratio below which slice activates (~87 BPM)
const NUM_GRID        = 24;     // equal segments per loop
const SLICE_LOOKAHEAD = 0.25;   // seconds ahead to schedule (latency buffer)
const SLICE_INTERVAL  = 100;    // scheduler poll interval (ms)

let sliceMode    = false;   // true when slice scheduler is active
let sliceTimer   = null;    // setInterval handle
let nextSliceIdx = 0;       // next grid segment index to schedule
let nextSliceWhen = 0;      // audioCtx.currentTime when nextSliceIdx should play
let activeSources = [];     // fire-and-forget nodes currently in flight (slice mode)

// ---------------------------------------------------------------------------
// stopCurrentPlayback() — tears down whichever playback mode is active.
// Safe to call when nothing is playing (all guards are null-checks).
// ---------------------------------------------------------------------------
function stopCurrentPlayback() {
  // WSOLA nodes
  if (source) { try { source.stop(); } catch (_) {} source.disconnect(); source = null; }
  if (stNode)  { stNode.disconnect(); stNode = null; }
  // Slice scheduler + in-flight segments
  if (sliceTimer) { clearInterval(sliceTimer); sliceTimer = null; }
  activeSources.forEach(s => { try { s.stop(); s.disconnect(); } catch (_) {} });
  activeSources = [];
}

// ---------------------------------------------------------------------------
// scheduleSlices() — look-ahead scheduler for slice mode.
// Runs on a setInterval; schedules AudioBufferSourceNode segments just ahead
// of audioCtx.currentTime so the audio thread always has work queued.
// Each segment plays at original speed — only the real-time gaps are stretched.
// ---------------------------------------------------------------------------
function scheduleSlices() {
  if (!isPlaying || !audioBuffer) return;
  const segDur = audioBuffer.duration / NUM_GRID;
  const now    = audioCtx.currentTime;

  // Background-tab recovery: if the tab was hidden, nextSliceWhen may be far
  // in the past. Fast-forward index and time to stay close to the present.
  if (nextSliceWhen < now - segDur / currentRatio) {
    const behind = Math.ceil((now - nextSliceWhen) / (segDur / currentRatio));
    nextSliceIdx  = (nextSliceIdx + behind) % NUM_GRID;
    nextSliceWhen += behind * (segDur / currentRatio);
    if (nextSliceWhen < now) nextSliceWhen = now;
  }

  while (nextSliceWhen < now + SLICE_LOOKAHEAD) {
    const node = audioCtx.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(gainNode);
    // start(when, offset, duration): play one segment at original speed
    node.start(nextSliceWhen, nextSliceIdx * segDur, segDur);
    activeSources.push(node);
    node.onended = () => {
      const i = activeSources.indexOf(node);
      if (i !== -1) activeSources.splice(i, 1);
    };
    nextSliceIdx  = (nextSliceIdx + 1) % NUM_GRID;
    // real-time gap between segment onsets = segDur / ratio
    nextSliceWhen += segDur / currentRatio;
  }
}

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
// Branches on sliceMode: WSOLA graph for normal tempos, look-ahead slice
// scheduler for slow tempos (below SLICE_THRESHOLD).
// ---------------------------------------------------------------------------
function startPlayback() {
  stopCurrentPlayback();  // tear down any prior mode cleanly

  const ratio = parseFloat(document.getElementById('pandero-tempo').value);
  sliceMode = ratio < SLICE_THRESHOLD;

  // Reset odometer — beat animation starts tracking from buffer position 0.
  accumulatedBufferTime  = 0;
  lastTempoChangeCtxTime = audioCtx.currentTime;
  currentRatio           = ratio;

  if (sliceMode) {
    // Slice mode: schedule individual segments at original speed, gaps provide stretch.
    nextSliceIdx  = 0;
    nextSliceWhen = audioCtx.currentTime;
    activeSources = [];
    scheduleSlices();
    sliceTimer = setInterval(scheduleSlices, SLICE_INTERVAL);
  } else {
    // WSOLA mode: source → SoundTouch worklet → gainNode.
    // ENG-02: Tandem pattern — both nodes receive the same ratio.
    // WSOLA params tuned for percussion: seq=40ms, seek=15ms, overlap=8ms.
    stNode = new AudioWorkletNode(audioCtx, 'soundtouch-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { sequenceMs: 40, seekWindowMs: 15, overlapMs: 8 }
    });
    stNode.connect(gainNode);

    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;  // ENG-04: seamless loop
    source.playbackRate.value = ratio;
    source.connect(stNode);
    stNode.parameters.get('playbackRate').value = ratio;
    source.start();
  }

  startBeatAnim();
}

// ---------------------------------------------------------------------------
// Beat animation — visual pulse on the two main pulses of the 6/8 bar.
// Beat 1 = buffer start, Beat 4 = buffer midpoint (user-confirmed split).
// requestAnimationFrame polls audioCtx.currentTime — no setTimeout drift.
// ---------------------------------------------------------------------------
function startBeatAnim() {
  lastBeatIdx = -1;
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(animLoop);
}

function stopBeatAnim() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  lastBeatIdx = -1;
  root.querySelectorAll('.pandero-beat').forEach(d => d.classList.remove('pandero-beat-active'));
}

function animLoop() {
  if (!isPlaying || !audioBuffer) return;
  const elapsed = accumulatedBufferTime + (audioCtx.currentTime - lastTempoChangeCtxTime) * currentRatio;
  const posInBuffer = elapsed % audioBuffer.duration;
  const beatIdx = Math.floor(posInBuffer / (audioBuffer.duration / 4)) % 2;
  if (beatIdx !== lastBeatIdx) {
    lastBeatIdx = beatIdx;
    root.querySelectorAll('.pandero-beat').forEach((d, i) => {
      d.classList.toggle('pandero-beat-active', i === beatIdx);
    });
  }
  animFrame = requestAnimationFrame(animLoop);
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
    hexBtn.querySelector('.pandero-icon-play').style.display = 'none';
    hexBtn.querySelector('.pandero-icon-pause').style.display = '';
    hexBtn.setAttribute('aria-label', 'Detener');
  } else {
    stopCurrentPlayback();
    isPlaying = false;
    stopBeatAnim();
    hexBtn.querySelector('.pandero-icon-play').style.display = '';
    hexBtn.querySelector('.pandero-icon-pause').style.display = 'none';
    hexBtn.setAttribute('aria-label', 'Reproducir');
  }
}

// ---------------------------------------------------------------------------
// handleTempoChange — updates display always; updates engine only when playing.
// Handles three cases:
//   1. No change in mode (WSOLA↔WSOLA): live tandem AudioParam update.
//   2. No change in mode (slice↔slice): restart scheduler at new ratio.
//   3. Mode boundary crossed: restart playback entirely in new mode.
// VIS-01, D-10, D-12: show BPM as integer (Math.round(ratio * 111)).
// ---------------------------------------------------------------------------
function handleTempoChange(e) {
  const ratio = parseFloat(e.target.value);
  document.getElementById('pandero-tempo-val').textContent = Math.round(ratio * 111) + ' BPM';

  if (!isPlaying || !audioCtx) {
    currentRatio = ratio;
    return;
  }

  // Odometer: commit elapsed buffer-time at the old ratio before switching.
  accumulatedBufferTime += (audioCtx.currentTime - lastTempoChangeCtxTime) * currentRatio;
  lastTempoChangeCtxTime = audioCtx.currentTime;
  currentRatio = ratio;

  const willSlice = ratio < SLICE_THRESHOLD;

  if (willSlice !== sliceMode) {
    // Mode boundary crossed — restart in new mode.
    // accumulatedBufferTime is reset inside startPlayback(); beat indicator restarts
    // from 0 which is unnoticeable on a loop.
    startPlayback();
    return;
  }

  if (sliceMode) {
    // Staying in slice mode — restart scheduler from current buffer position at new ratio.
    // In-flight segments are short (< segDur seconds) so stopping them is seamless.
    if (sliceTimer) { clearInterval(sliceTimer); sliceTimer = null; }
    activeSources.forEach(s => { try { s.stop(); s.disconnect(); } catch (_) {} });
    activeSources = [];
    const segDur   = audioBuffer.duration / NUM_GRID;
    const posInBuf = accumulatedBufferTime % audioBuffer.duration;
    nextSliceIdx   = Math.floor(posInBuf / segDur) % NUM_GRID;
    nextSliceWhen  = audioCtx.currentTime;
    scheduleSlices();
    sliceTimer = setInterval(scheduleSlices, SLICE_INTERVAL);
  } else {
    // Staying in WSOLA mode — live tandem update, no restart needed.
    source.playbackRate.value = ratio;
    stNode.parameters.get('playbackRate').value = ratio;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
const tempoSlider = document.getElementById('pandero-tempo');

hexBtn.addEventListener('click', togglePlayback);
tempoSlider.addEventListener('input', handleTempoChange);

// Space key: same as clicking the toggle button.
// Guard: skip if focus is inside a text input to avoid conflicting with host page forms.
document.addEventListener('keydown', async (e) => {
  if (e.code === 'Space') {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    await togglePlayback();
  }
});
