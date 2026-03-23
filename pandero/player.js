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
let sliceHits     = [];     // onset times (sec) detected in audioBuffer — set in init()

// ---------------------------------------------------------------------------
// findTransients(buffer) — detect percussion onset times in a decoded buffer.
// Algorithm: half-wave rectified first-order difference of the short-window
// RMS envelope (standard onset detection function for percussive audio).
// Returns an array of times in seconds, sorted ascending.
// Falls back to an empty array if no peaks exceed the threshold.
// ---------------------------------------------------------------------------
function findTransients(buffer) {
  const data = buffer.getChannelData(0);
  const sr   = buffer.sampleRate;
  const WIN  = Math.max(1, Math.floor(0.005 * sr));  // 5 ms RMS window
  const HOP  = Math.max(1, Math.floor(0.002 * sr));  // 2 ms hop
  const nF   = Math.floor((data.length - WIN) / HOP);

  // Short-window RMS envelope
  const env = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    let s = 0, b = f * HOP;
    for (let k = 0; k < WIN; k++) s += data[b + k] * data[b + k];
    env[f] = Math.sqrt(s / WIN);
  }

  // Half-wave rectified first-order difference = onset strength function
  let peak = 0;
  const odf = new Float32Array(nF);
  for (let f = 1; f < nF; f++) {
    odf[f] = Math.max(0, env[f] - env[f - 1]);
    if (odf[f] > peak) peak = odf[f];
  }

  // Pick local maxima above threshold with minimum inter-onset gap
  const thresh    = peak * 0.12;
  const minGapF   = Math.floor(0.08 * sr / HOP);  // 80 ms min gap
  const hits = [];
  let lastF = -minGapF;
  for (let f = 1; f < nF - 1; f++) {
    if (odf[f] > thresh &&
        odf[f] >= odf[f - 1] &&
        odf[f] >= odf[f + 1] &&
        f - lastF >= minGapF) {
      hits.push(f * HOP / sr);
      lastF = f;
    }
  }
  console.log('[pandero] transients detected:', hits.length,
    '—', hits.map(t => t.toFixed(3) + 's').join('  '));
  return hits;
}

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
// Uses detected transient positions (sliceHits) so each segment starts exactly
// at a real pandero hit rather than at an arbitrary equal-grid boundary.
// Falls back to NUM_GRID equal segments if transient detection found nothing.
// Each segment plays at original speed; only the real-time gaps are stretched.
// ---------------------------------------------------------------------------
function scheduleSlices() {
  if (!isPlaying || !audioBuffer) return;
  const bufDur = audioBuffer.duration;
  const nHits  = sliceHits.length;
  const now    = audioCtx.currentTime;

  // seg(i): {offset, dur, isLast} for logical slice index i (wraps around the loop).
  // isLast flags the final segment of each loop cycle — it ends at bufDur and
  // may have reverb tail, so it gets a longer fade-out than intra-loop segments.
  const loopLen = nHits > 0 ? nHits : NUM_GRID;
  function seg(i) {
    if (nHits === 0) {
      const d = bufDur / NUM_GRID;
      const h = i % NUM_GRID;
      return { offset: h * d, dur: d, isLast: h === NUM_GRID - 1 };
    }
    const h      = i % nHits;
    const offset = sliceHits[h];
    const end    = h < nHits - 1 ? sliceHits[h + 1] : bufDur;
    return { offset, dur: end - offset, isLast: h === nHits - 1 };
  }

  // Background-tab recovery: fast-forward past all segments that are
  // already in the past, then pin nextSliceWhen to now if still behind.
  let guard = 0;
  while (nextSliceWhen < now - SLICE_LOOKAHEAD && guard++ < 500) {
    nextSliceWhen += seg(nextSliceIdx).dur / currentRatio;  // isLast not needed here
    nextSliceIdx++;
  }
  if (nextSliceWhen < now) nextSliceWhen = now;

  // Schedule up to SLICE_LOOKAHEAD seconds ahead
  while (nextSliceWhen < now + SLICE_LOOKAHEAD) {
    const { offset, dur, isLast } = seg(nextSliceIdx);

    // Per-segment gain envelope with targeted fade-out:
    //   • Intra-loop segments end right before the next hit (amplitude ≈ 0) → 3ms
    //   • Last segment ends at bufDur where reverb tail may still be active → 50ms
    // This preserves the trill attack while eliminating the loop-boundary click.
    const fadeOut  = isLast ? Math.min(0.050, dur * 0.25) : Math.min(0.003, dur * 0.05);
    const segGain  = audioCtx.createGain();
    segGain.connect(gainNode);
    segGain.gain.setValueAtTime(1.0, nextSliceWhen);
    segGain.gain.setValueAtTime(1.0, nextSliceWhen + dur - fadeOut);
    segGain.gain.linearRampToValueAtTime(0.0, nextSliceWhen + dur);

    const node = audioCtx.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(segGain);
    node.start(nextSliceWhen, offset, dur);
    activeSources.push(node);
    node.onended = () => {
      segGain.disconnect();
      const i = activeSources.indexOf(node);
      if (i !== -1) activeSources.splice(i, 1);
    };
    nextSliceIdx++;
    nextSliceWhen += dur / currentRatio;
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

  // Detect pandero hit positions for slice mode (runs synchronously, < 5ms).
  sliceHits = findTransients(audioBuffer);

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
  hexBtn.querySelector('.pandero-hex-svg')?.classList.remove('pandero-hex-beat');
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
    // Flash the hexagon: remove → force reflow → re-add restarts the keyframe.
    const svg = hexBtn.querySelector('.pandero-hex-svg');
    svg.classList.remove('pandero-hex-beat');
    void svg.offsetWidth;
    svg.classList.add('pandero-hex-beat');
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
    if (!sliceMode && source) {
      // WSOLA → Slice: schedule WSOLA source to stop in 40ms (avoids abrupt cut),
      // then start slice scheduler from the correct position in the loop.
      const handoff = audioCtx.currentTime + 0.040;
      source.stop(handoff);
      if (stNode) { stNode.disconnect(); stNode = null; }
      source = null;
      sliceMode = true;
      // accumulatedBufferTime was already committed above by the odometer.
      // Project forward 40ms to find buffer position when WSOLA actually stops.
      const bufPosAtHandoff = (accumulatedBufferTime + 0.040 * ratio) % audioBuffer.duration;
      const nH = sliceHits.length;
      if (nH > 0) {
        // Find the first hit strictly after bufPosAtHandoff
        let hi = 0;
        while (hi < nH && sliceHits[hi] <= bufPosAtHandoff) hi++;
        // hi === nH means we're past the last hit — next is slice 0 of next loop
        const nextOnset = hi < nH ? sliceHits[hi] : audioBuffer.duration;
        nextSliceIdx  = hi % nH;
        nextSliceWhen = handoff + (nextOnset - bufPosAtHandoff) / ratio;
      } else {
        const segDur  = audioBuffer.duration / NUM_GRID;
        const hi      = Math.ceil(bufPosAtHandoff / segDur);
        nextSliceIdx  = hi % NUM_GRID;
        nextSliceWhen = handoff + (hi * segDur - bufPosAtHandoff) / ratio;
      }
      activeSources = [];
      scheduleSlices();
      sliceTimer = setInterval(scheduleSlices, SLICE_INTERVAL);
    } else {
      // Slice → WSOLA: slice segments are very short; startPlayback is clean enough.
      startPlayback();
    }
    return;
  }

  if (sliceMode) {
    // currentRatio was updated above — the running setInterval picks it up
    // automatically on its next tick. Do NOT stop in-flight segments: calling
    // s.stop() mid-playback causes an audible click on every slider movement.
    // nextSliceWhen already points to the next upcoming segment; new segments
    // will be spaced at the new ratio from that point forward.
    return;
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
