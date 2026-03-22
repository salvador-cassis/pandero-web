# Domain Pitfalls: Browser Real-Time Audio Processing

**Domain:** Browser-based audio time-stretching and pitch-shifting (plain HTML/JS, no build system)
**Researched:** 2026-03-22
**Overall confidence:** HIGH — all major claims verified against official documentation, MDN, library source, and browser vendor blogs.

---

## Critical Pitfalls

Mistakes that cause silent failures, rewrites, or permanently broken audio.

---

### Pitfall 1: AudioContext Created Before User Gesture

**What goes wrong:** You create `new AudioContext()` on page load. The browser silently creates it in `"suspended"` state and audio never plays. No error is thrown. The user sees controls but hears nothing.

**Why it happens:** All major browsers (Chrome since 2018, Safari since iOS 13, Firefox) enforce autoplay policy: an AudioContext created without prior user interaction is born suspended. The policy is non-negotiable and cannot be bypassed with any flag.

**Consequences:** Complete silence. Difficult to diagnose because the Web Audio graph appears wired correctly — the context is just frozen.

**Prevention:** Create the `AudioContext` inside the first user gesture handler (play button click), or check and resume immediately on the gesture:

```js
let ctx;
playButton.addEventListener('click', () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  // start playback
});
```

**Detection:** `audioCtx.state === 'suspended'` after construction. Always log context state at startup during development.

**iOS-specific variant:** On iOS, after the user backgrounds the app or the screen locks, the context moves to `"interrupted"` (not `"suspended"`). You must handle both states:

```js
if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
  ctx.resume().then(() => startPlayback());
}
```

**Sources:** [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay), [MDN Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [Web Audio Autoplay & Games](https://developer.chrome.com/blog/web-audio-autoplay)

---

### Pitfall 2: iOS Silent Switch Kills Web Audio (Not HTML Audio)

**What goes wrong:** On iPhone/iPad, when the hardware ringer/mute switch is set to silent, the Web Audio API produces no sound. HTML `<audio>` and `<video>` elements play fine in the same state. Users report "broken" player on mobile with no indication of what went wrong.

**Why it happens:** Web Audio is routed through the ringer channel by default on iOS, not the media channel. This is a WebKit bug (filed as webkit.org bug #237322) and not spec-compliant behavior. The HTML media elements correctly use the media channel.

**Consequences:** Large percentage of iPhone users (many keep phone on silent) will experience complete silence with no error message.

**Prevention:** Play a short silent `<audio>` element before or alongside the Web Audio context. This convinces iOS to route Web Audio through the media channel.

Use the ready-made [`unmute-ios-audio`](https://github.com/feross/unmute-ios-audio) package, or [`unmute`](https://github.com/swevans/unmute) — both solve this with minimal code. Requires a user gesture (same as AudioContext).

**Warning about older hacks:** Previous advice was to loop a silent MP3 through `<audio>` permanently. Post-2023 Safari broke this approach — it causes audio to play for one second then stop. The current correct fix is the library approach above, not manual silent-loop hacks.

**Detection:** Test on a real iPhone with the mute switch engaged. Cannot be simulated in desktop browsers or iOS Simulator.

**Sources:** [WebKit Bug #237322](https://bugs.webkit.org/show_bug.cgi?id=237322), [unmute-ios-audio](https://github.com/feross/unmute-ios-audio), [Adactio iOS Web Audio](https://adactio.com/journal/17709)

---

### Pitfall 3: SoundTouchJS v0.2.0 is ESM-Only — Breaks No-Build Embedding

**What goes wrong:** You install or CDN-link `soundtouchjs` expecting it to work with a plain `<script>` tag in an HTML file. With the v0.2.0 release (March 6, 2025), the library became ESM-only with no UMD or CommonJS output. A `<script src="soundtouchjs.js">` tag stops working.

**Why it happens:** v0.2.0 was a complete architectural rewrite — monorepo, TypeScript strict mode, ES2024 target, ESM only. The release note explicitly warns: "BREAKING CHANGES — This changes everything we had before."

**Consequences:** For a no-build vanilla HTML/JS project (exactly this project's constraint), the library cannot be imported via a simple script tag. Native ES module imports (`<script type="module">`) work but add complexity and require a local HTTP server (not `file://`).

**Prevention options:**
1. Pin to the last pre-v0.2.0 version (`soundtouchjs@0.1.x`) — this version still uses the deprecated `ScriptProcessorNode` (see Pitfall 4).
2. Use the new `@soundtouchjs/audio-worklet` package with `<script type="module">` — requires a local server, cannot open `index.html` directly from the filesystem.
3. Evaluate alternative libraries that ship a single-file build (e.g., older SoundTouch ports, or a pre-compiled RubberBand WASM bundle).

**Detection:** Import error in browser console: `Cannot use import statement outside a module` or `require is not defined`.

**Sources:** [SoundTouchJS GitHub](https://github.com/cutterbl/SoundTouchJS), [npm @soundtouchjs](https://www.npmjs.com/org/soundtouchjs), [CHANGELOG](https://raw.githubusercontent.com/cutterbl/soundtouchjs-audio-worklet/591886df371f1db222d06151f1e0c7208a8f3bba/CHANGELOG.md)

---

### Pitfall 4: ScriptProcessorNode Will Eventually Be Removed

**What goes wrong:** You build using the `@soundtouchjs/core` `PitchShifter` class (or any code path using `ScriptProcessorNode`). It works today but emits deprecation warnings, and the feature may be removed in a future Chrome/Firefox release without a fixed timeline announced.

**Why it happens:** `ScriptProcessorNode` runs audio processing on the main UI thread (not the audio rendering thread), causing latency and UI jank. It was deprecated from the Web Audio spec when `AudioWorklet` arrived in Chrome 66. MDN explicitly states: "be aware that this feature may cease to work at any time."

**Consequences:** A future browser update silently breaks the player. No advance warning to users.

**Prevention:** Use `AudioWorklet`-based processing from the start. For SoundTouchJS, use `@soundtouchjs/audio-worklet` (v0.2.0+) which runs on the audio rendering thread. For RubberBand WASM, design around AudioWorklet from day one.

**Note:** No concrete removal date has been published by Chrome. It has been deprecated since 2018 and remains functional in 2026. The risk is real but not immediate — however, building on a deprecated API for a new project in 2026 is indefensible.

**Sources:** [MDN ScriptProcessorNode](https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode), [Chrome Audio Worklet Available](https://developer.chrome.com/blog/audio-worklet)

---

### Pitfall 5: AudioWorklet Requires HTTPS (or localhost) — Breaks file:// Opening

**What goes wrong:** You open your `index.html` directly from the filesystem (`file://`). AudioWorklet's `addModule()` call fails with a vague error: `DOMException: The user aborted a request` or `NotSupportedError`. Everything else appears to work.

**Why it happens:** `AudioWorklet` is a [Secure Context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) API. It requires HTTPS or `http://localhost`. Opening via `file://` does not satisfy the secure context requirement in Chrome and most browsers.

**Consequences:** Development workflow fails unless a local server is running. Users who try to use the tool from a downloaded file copy will get no audio processing.

**Prevention:** Always develop with a local HTTP server. For deployment, the page must be served over HTTPS (standard for any production website). Use `npx serve .` or `python3 -m http.server` for local dev.

**Detection:** Check `window.isSecureContext` — if `false`, AudioWorklet will not work.

**Sources:** [Worklet addModule MDN](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule), [AudioWorklet Secure Context issue #1436](https://github.com/WebAudio/web-audio-api/issues/1436)

---

## Moderate Pitfalls

Problems that cause significant debugging time or require architectural decisions to avoid.

---

### Pitfall 6: CORS Blocks fetch() for Audio Files on Different Origin

**What goes wrong:** Your MP3 is served from a CDN or a different subdomain from the page. `fetch()` or `decodeAudioData()` fails silently or throws a CORS error. Even if the `<audio>` tag can play the file, `fetch()` for `ArrayBuffer` decoding will fail without proper CORS headers.

**Why it happens:** `fetch()` follows the same-origin policy. A CDN or different subdomain is a different origin. The server must respond with `Access-Control-Allow-Origin` headers.

**Critical gotcha with `MediaElementAudioSourceNode`:** If you route a cross-origin `<audio>` element through `createMediaElementSource()`, the node outputs **zeros (silence)** — no error, just silence. This is a spec-mandated security behavior.

**Prevention:** Serve the MP3 from the same origin as the HTML page, or configure the CDN/server to emit `Access-Control-Allow-Origin: *`. Use `fetch()` with proper error handling. If using `<audio>` as source node, ensure `crossOrigin="anonymous"` attribute is set and the server allows it.

**Detection:** Browser console will show `CORS error` or `Access to fetch blocked by CORS policy`. The silence from `MediaElementAudioSourceNode` is harder to detect — check that `createMediaElementSource` is not being called on cross-origin media.

**Sources:** [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [Web Audio API CORS Issue #2453](https://github.com/WebAudio/web-audio-api/issues/2453)

---

### Pitfall 7: WASM Must Be Pre-Compiled on Main Thread Before AudioWorklet Starts

**What goes wrong:** You attempt to compile or instantiate a WASM module (e.g., RubberBand WASM) inside the `AudioWorkletProcessor`. The module compiles mid-stream, causing glitches or total audio dropout. On slower devices the stall is severe.

**Why it happens:** The AudioWorklet's rendering callback has a 3ms budget at 44.1kHz. WASM compilation is an expensive blocking operation. Running it during the audio rendering thread violates the timing budget.

**Consequences:** Audio glitches ranging from clicks to full dropouts during initialization. Worse on mobile.

**Prevention:** Compile the WASM module on the main thread first, then pass the compiled `WebAssembly.Module` object to the `AudioWorkletNode` constructor via the `processorOptions`. The worklet can then instantiate (not compile) synchronously.

```js
// Main thread
const wasmModule = await WebAssembly.compileStreaming(fetch('processor.wasm'));
const node = new AudioWorkletNode(ctx, 'my-processor', {
  processorOptions: { wasmModule }
});
```

**Sources:** [Audio Worklet Design Pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern/), [WASM + Web Audio (Toptal)](https://www.toptal.com/developers/webassembly/webassembly-rust-tutorial-web-audio)

---

### Pitfall 8: AudioWorklet Fixed 128-Frame Buffer vs. Time-Stretching Algorithm Requirements

**What goes wrong:** The AudioWorklet `process()` callback always receives exactly 128 frames. Time-stretching algorithms like RubberBand and SoundTouch work best with larger block sizes (typically 512–8192 samples). Feeding 128 frames directly produces poor audio quality or incorrect processing.

**Why it happens:** The Web Audio specification mandates 128-frame render quanta. This cannot be changed.

**Consequences:** If not handled, the audio quality is noticeably degraded — warbling, artifacts, pitch instability at extreme settings.

**Prevention:** Implement a ring buffer inside the processor. Accumulate 128-frame chunks until the desired block size is reached, process, then drain back out. The Chrome Audio Worklet design pattern documentation describes this pattern explicitly. Libraries like `@soundtouchjs/audio-worklet` handle this internally.

**Sources:** [Audio Worklet Design Pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern/), [AudioWorklet Real-World Disaster Issue #2632](https://github.com/WebAudio/web-audio-api/issues/2632)

---

### Pitfall 9: RubberBand WASM Requires COOP/COEP Headers for SharedArrayBuffer

**What goes wrong:** Optimal RubberBand WASM + AudioWorklet integration uses `SharedArrayBuffer` for zero-copy data transfer between the main thread, a Web Worker, and the AudioWorklet. `SharedArrayBuffer` requires cross-origin isolation: the server must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.

**Why it happens:** After Spectre/Meltdown, browsers restricted `SharedArrayBuffer` to cross-origin-isolated contexts. This is a browser security policy, not a library limitation.

**Consequences:**
- On static hosts (GitHub Pages, Netlify free tier, basic shared hosting) these headers cannot be set, making `SharedArrayBuffer` impossible without a hack.
- Setting COOP breaks OAuth popups and cross-origin iframes — relevant if the tool is embedded in an existing site.
- The fallback without `SharedArrayBuffer` is message passing, which adds latency and copies buffers on every callback.

**Note for this project:** Since the tool is embedded in an existing website, setting COOP/COEP would break any cross-origin interactions that site depends on (ads, third-party widgets, analytics). Design should avoid requiring `SharedArrayBuffer`. Use message-passing fallback explicitly.

**Workaround:** The `coi-serviceworker` library injects these headers via a service worker on the client side. It works but can interfere with other service workers and requires careful testing. Not recommended for production embedding.

**Sources:** [Making your website cross-origin isolated](https://web.dev/articles/coop-coep), [SharedArrayBuffer Chrome 92 Update](https://developer.chrome.com/blog/enabling-shared-array-buffer), [COOP/COEP GitHub Pages Discussion #13309](https://github.com/orgs/community/discussions/13309)

---

### Pitfall 10: Audio Glitches at Extreme Tempo/Pitch Settings

**What goes wrong:** Users push tempo below ~0.5x or above ~2x, or pitch beyond ±6 semitones. Audio quality degrades: warbling, metallic artifacts, phase discontinuities. This is not a bug — it is an inherent limitation of WSOLA and phase vocoder algorithms.

**Why it happens:** Time-stretching algorithms work by repeating or compressing overlapping audio frames. At extreme ratios, the frame manipulation becomes audible. Phase vocoders introduce metallic "phasiness" on harmonic content. Percussion (like pandero) is particularly susceptible to warbling at slow tempos.

**Consequences:** Poor user experience at edge cases. For cueca practice, users wanting to slow down significantly for learning will encounter quality degradation.

**Prevention and mitigation:**
- Clamp controls to practical ranges (e.g., tempo 0.5x–2.0x, pitch ±12 semitones).
- RubberBand offers a `Percussion` engine mode that handles transient-heavy material better than the default mode — select this for pandero audio.
- SoundTouch has `setSequenceLengthMs`, `setSeekWindowLengthMs`, and `setOverlapLengthMs` tuning parameters; default settings are not optimized for percussion.
- Communicate to users that extreme settings will affect quality (visual indication near slider extremes).

**Sources:** [Audio Time Stretching Wikipedia](https://en.wikipedia.org/wiki/Audio_time_stretching_and_pitch_scaling), [Unison Time Stretching Tips](https://unison.audio/time-stretching/)

---

### Pitfall 11: AudioBuffer Is Not Designed for Long Audio Files

**What goes wrong:** You load a long MP3 (e.g., 5+ minutes) into an `AudioBuffer` via `decodeAudioData()`. The browser decodes the entire file into uncompressed PCM float32 in memory. A 5-minute stereo file at 44.1kHz ≈ 100MB of RAM. On mobile, this causes slowdowns, crashes, or OOM kills.

**Why it happens:** `AudioBuffer` decompresses audio to raw PCM. The spec notes these objects are designed for short clips (under ~45 seconds). For long files, `MediaElementAudioSourceNode` (backed by the HTML `<audio>` element's streaming decoder) is the appropriate alternative.

**Consequences for this project:** A pandero backing track for a full cueca set could be several minutes long. If looping is desired, the buffer approach is practical but memory must be budgeted. A 3-minute mono file at 44.1kHz ≈ 30MB decoded — acceptable but should be validated on target mobile devices.

**Prevention:** Keep the fixed MP3 to a reasonable length (under 2 minutes for a loop). Mono is sufficient for pandero and halves memory. If using `MediaElementAudioSourceNode` for streaming, be aware of the CORS implications from Pitfall 6 and that time-stretching via `AudioWorklet` requires the full PCM data to be available.

**Sources:** [MDN AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer), [decodeAudioData memory issue (Chromium #447580)](https://bugs.chromium.org/p/chromium/issues/detail?id=447580)

---

## Minor Pitfalls

Problems that are annoying but have straightforward fixes.

---

### Pitfall 12: Missing webkitAudioContext Prefix on Older Safari

**What goes wrong:** `new AudioContext()` throws on older Safari versions (pre-Safari 14.1 without prefix). The page breaks silently for users on older iPhones/Macs who haven't updated.

**Prevention:** Always use the prefix fallback:

```js
const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();
```

This one line provides full backwards compatibility at zero cost.

**Sources:** [MDN Cross-browser audio basics](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/Cross-browser_audio_basics)

---

### Pitfall 13: AudioWorklet Processor File Must Have Correct Content-Type

**What goes wrong:** The browser refuses to load the AudioWorklet processor script file. Error: `DOMException: The user aborted a request`. The server is sending the `.js` file with `Content-Type: text/plain` or no content type.

**Why it happens:** Chromium's module loader validates `Content-Type`. The processor file must be served as `application/javascript` or `text/javascript`.

**Prevention:** Ensure your web server (Apache, nginx, any static host) maps `.js` files to the correct MIME type. Most modern static hosts do this by default. Check explicitly if serving from an unusual host.

**Sources:** [AudioWorklet addModule issue #1581](https://github.com/WebAudio/web-audio-api/issues/1581)

---

### Pitfall 14: OfflineAudioContext Renders Silence on Safari and Firefox

**What goes wrong:** You use `OfflineAudioContext` to pre-render a processed audio buffer (e.g., for export or preview). On Safari and Firefox, the render produces silence despite working on Chrome.

**Why it happens:** Known compatibility bug in SoundTouchJS (and potentially other time-stretching libraries) when running in `OfflineAudioContext`. The issue is not present in standard `AudioContext` playback.

**Consequences for this project:** Minimal — this project does not require offline rendering or export (explicitly out of scope). Only relevant if offline rendering is added later.

**Prevention:** If offline rendering is needed in the future, test explicitly on Safari and Firefox. Avoid `OfflineAudioContext` for the real-time playback use case.

**Sources:** [SoundTouchJS Issues](https://github.com/cutterbl/SoundTouchJS/issues)

---

### Pitfall 15: Mobile CPU Throttling Under Sustained Audio Processing

**What goes wrong:** The app works fine initially on a mobile device, but after a few minutes of playback, audio starts glitching or skipping. CPU throttling kicks in to manage heat and battery.

**Why it happens:** iOS and Android both throttle CPU under sustained load. Time-stretching is CPU-intensive. Older devices (iPhone 6/7 era) are particularly susceptible. The AudioWorklet's 3ms per callback budget shrinks effectively under throttled CPU.

**Consequences:** Degraded experience for users on older or budget devices — the primary demographic for a free practice tool may include musicians on older hardware.

**Prevention:**
- Keep the AudioWorklet processor lean. Avoid allocating new objects inside `process()` (GC pauses cause glitches).
- Profile on a real mid-range Android device, not just a MacBook.
- Consider allowing the user to trade quality for performance (e.g., a "lite mode" with a simpler algorithm).
- For RubberBand: use `RubberBandStretcher::OptionProcessRealTime` flag which reduces latency and CPU at the cost of quality compared to the offline mode.

**Sources:** [Web Audio API Performance Notes](https://padenot.github.io/web-audio-perf/), [AudioWorklet Optimization (cprimozic)](https://cprimozic.net/blog/webaudio-audioworklet-optimization/)

---

### Pitfall 16: RubberBand GPL License — Distribution Consideration

**What goes wrong:** You ship a web app using a RubberBand WASM build. RubberBand is licensed under GPL v2+. If the web app is not also GPL-licensed, distribution is a license violation. The commercial license from Particular Programs Ltd. is required for closed-source or proprietary distribution.

**Why it matters for this project:** If the project is open source and GPL-compatible, no issue. If the project is proprietary (private source, commercial site), a commercial license is required. Cost and terms not publicly listed — must be requested from the vendor.

**Prevention:** Decide license model before choosing RubberBand. SoundTouchJS (the original SoundTouch C++ library) is also LGPL — check the JS port's specific license. Some WASM builds package older versions under different terms.

**Sources:** [Rubber Band Library License](https://breakfastquay.com/rubberband/), [rubberband-wasm GitHub](https://github.com/Daninet/rubberband-wasm)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Basic audio playback setup | AudioContext suspended on load | Create context in play button handler |
| iOS testing | Silent switch + user gesture both required | Test on real device early; add unmute-ios-audio |
| Library selection (SoundTouchJS vs RubberBand) | ESM-only break for no-build; GPL license | Evaluate before writing any audio processing code |
| AudioWorklet integration | Secure context (HTTPS/localhost) required | Always use local server in dev |
| WASM loading | Compile on main thread, pass to worklet | Follow Chrome's AudioWorklet + WASM design pattern |
| Embedding in existing site | COOP/COEP headers incompatible with parent page | Do not use SharedArrayBuffer; use message-passing |
| Extreme tempo/pitch controls | Quality degrades, especially percussion | Clamp ranges; select RubberBand percussion mode |
| Mobile performance | CPU throttle after sustained use | Profile on real mid-range device; minimize GC in process() |
| Long audio file | Memory spike on mobile | Keep MP3 under 2 minutes; use mono |

---

## Sources

- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay)
- [MDN Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [MDN AudioContext.resume()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume)
- [MDN Web Audio Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [MDN ScriptProcessorNode (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode)
- [Chrome AudioWorklet Available by Default](https://developer.chrome.com/blog/audio-worklet)
- [Audio Worklet Design Pattern (Chrome Developers)](https://developer.chrome.com/blog/audio-worklet-design-pattern/)
- [MDN AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [SoundTouchJS GitHub Monorepo](https://github.com/cutterbl/SoundTouchJS)
- [SoundTouchJS Issues](https://github.com/cutterbl/SoundTouchJS/issues)
- [rubberband-wasm (Daninet)](https://github.com/Daninet/rubberband-wasm)
- [Rubber Band Library Official](https://breakfastquay.com/rubberband/)
- [WebKit Bug #237322 — iOS mute switch vs Web Audio](https://bugs.webkit.org/show_bug.cgi?id=237322)
- [unmute-ios-audio (feross)](https://github.com/feross/unmute-ios-audio)
- [unmute (swevans)](https://github.com/swevans/unmute)
- [Making your website cross-origin isolated](https://web.dev/articles/coop-coep)
- [SharedArrayBuffer Chrome 92 Update](https://developer.chrome.com/blog/enabling-shared-array-buffer)
- [COOP/COEP on GitHub Pages (Discussion #13309)](https://github.com/orgs/community/discussions/13309)
- [Worklet addModule MDN](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule)
- [Web Audio API Performance Notes (padenot)](https://padenot.github.io/web-audio-perf/)
- [AudioWorklet Optimization (cprimozic)](https://cprimozic.net/blog/webaudio-audioworklet-optimization/)
- [AudioWorklet Real-World Issues #2632](https://github.com/WebAudio/web-audio-api/issues/2632)
- [Audio Time Stretching and Pitch Scaling (Wikipedia)](https://en.wikipedia.org/wiki/Audio_time_stretching_and_pitch_scaling)
- [MDN Cross-browser audio basics](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/Cross-browser_audio_basics)
