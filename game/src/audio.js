// audio.js — procedural WebAudio sound for NEON HARBOR.
// There are no audio assets: every effect is synthesised from oscillators
// and filtered noise, so the game stays fully self-contained and offline.

let ctx = null;
let master = null;
let sirenNodes = null;
let engineNodes = null;
let noiseBuffer = null;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  // A shared white-noise buffer, reused by shots, hits and rain-like hiss.
  const len = ctx.sampleRate;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function initAudio() {
  ensureContext();
  if (!ctx) return;
  const resume = () => {
    if (ctx.state === "suspended") ctx.resume();
  };
  window.addEventListener("pointerdown", resume, { once: false });
  window.addEventListener("keydown", resume, { once: false });
}

function tone(freqA, freqB, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqA, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq, type = "lowpass", when = 0) {
  if (!ctx || !noiseBuffer) return;
  const t0 = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0, Math.random());
  src.stop(t0 + dur + 0.02);
}

// A pistol crack: bright noise snap over a falling square blip.
export function playShot() {
  if (!ctx) return;
  noiseBurst(0.12, 0.5, 3200, "highpass");
  tone(220, 55, 0.1, "square", 0.25);
}

// A dull thud for impacts and landed hits.
export function playHit() {
  if (!ctx) return;
  noiseBurst(0.09, 0.35, 500);
  tone(120, 60, 0.09, "sine", 0.3);
}

// Cheerful two-note register chime when a payout lands.
export function playCash() {
  if (!ctx) return;
  tone(880, 880, 0.09, "triangle", 0.3);
  tone(1318, 1318, 0.14, "triangle", 0.3, 0.08);
}

// Short rising blip for entering markers and picking things up.
export function playPickup() {
  if (!ctx) return;
  tone(520, 940, 0.12, "sine", 0.28);
}

// Descending sting for the busted / wasted moment.
export function playBusted() {
  if (!ctx) return;
  tone(392, 392, 0.18, "sawtooth", 0.22);
  tone(311, 311, 0.18, "sawtooth", 0.22, 0.18);
  tone(233, 196, 0.34, "sawtooth", 0.24, 0.36);
}

// Two-tone police siren, looped while wanted. Call with false to stop.
export function setSiren(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 830;
    lfo.type = "square";
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.05;
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, gain };
  } else if (!on && sirenNodes) {
    try {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
    } catch (err) { /* already stopped */ }
    sirenNodes = null;
  }
}

// Continuous engine hum whose pitch follows throttle/speed 0..1.
export function setEngine(level01) {
  if (!ctx) return;
  const level = Math.max(0, Math.min(1, level01 || 0));
  if (!engineNodes) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    sub.type = "square";
    gain.gain.value = 0;
    osc.connect(gain);
    sub.connect(gain);
    gain.connect(master);
    osc.start();
    sub.start();
    engineNodes = { osc, sub, gain };
  }
  const t = ctx.currentTime;
  const freq = 55 + level * 165;
  engineNodes.osc.frequency.setTargetAtTime(freq, t, 0.06);
  engineNodes.sub.frequency.setTargetAtTime(freq / 2, t, 0.06);
  engineNodes.gain.gain.setTargetAtTime(0.02 + level * 0.07, t, 0.08);
}

export function stopEngine() {
  if (engineNodes && ctx) {
    engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }
}
