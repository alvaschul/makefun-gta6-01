// NEON HARBOR v2 — WebAudio synthesiser. No audio files anywhere:
// engine, sirens, gunfire, weather and the radio are all oscillators
// and filtered noise, generated live.

import { NAMES } from "./config.js";

// Short generated melodies per station: [midiNote, beats] pairs.
const STATION_LOOPS = {
  pop: [[69, 1], [72, 1], [76, 1], [72, 1], [67, 1], [69, 1], [64, 2], [0, 1]],
  chill: [[57, 2], [60, 2], [64, 2], [62, 2], [55, 2], [59, 2], [57, 4], [0, 2]],
  talk: [[45, 0.5], [0, 0.5], [47, 0.5], [0, 1], [43, 0.5], [0, 0.5], [45, 1], [0, 2]],
};

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlipAt = 0;
    this.sirenHigh = false;
    this.radioStation = -1; // -1 = off
    this.radioTimer = 0;
    this.radioStep = 0;
    this.noiseBuffer = null;
  }

  /** Create the context on first user gesture. Safe to call repeatedly. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // Shared white-noise buffer for shots, thunder and rain hiss.
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Engine: a sawtooth whose pitch follows speed, through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    // Siren: a square wave flipping between two tones in update().
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = "triangle";
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /** speedRatio 0..1 while driving; call with on=false when on foot. */
  setEngine(on, speedRatio) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = on ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speedRatio) * 130, t, 0.1);
  }

  /** active when any police unit is near; volume scales with closeness. */
  setSiren(active, closeness) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = active ? 0.015 + closeness * 0.05 : 0;
    this.sirenGain.gain.setTargetAtTime(target, t, 0.2);
    if (active && t > this.sirenFlipAt) {
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setValueAtTime(this.sirenHigh ? 940 : 660, t);
      this.sirenFlipAt = t + 0.42;
    }
  }

  burstNoise(duration, filterFreq, gainValue, type = "lowpass") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  shoot() {
    this.burstNoise(0.14, 2600, 0.5, "highpass");
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  blip(kind = "cash") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = kind === "cash" ? [880, 1318] : [620, 830];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.16, t + i * 0.07 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.16);
      osc.connect(gain).connect(this.master);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.2);
    });
  }

  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1150;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  thunder() {
    this.burstNoise(1.6, 220, 0.55);
  }

  horn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 494].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.setValueAtTime(0.07, t + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  setRadio(stationIndex) {
    this.radioStation = stationIndex;
    this.radioStep = 0;
    this.radioTimer = 0;
  }

  radioName() {
    if (this.radioStation < 0) return "";
    return NAMES.radioStations[this.radioStation]?.name ?? "";
  }

  /** Advance the radio sequencer; only sounds while driving. */
  update(dt, radioAudible) {
    if (!this.ctx || this.radioStation < 0 || !radioAudible) return;
    this.radioTimer -= dt;
    if (this.radioTimer > 0) return;
    const style = NAMES.radioStations[this.radioStation].style;
    const loop = STATION_LOOPS[style] || STATION_LOOPS.pop;
    const [note, beats] = loop[this.radioStep % loop.length];
    this.radioStep += 1;
    const beatSeconds = style === "talk" ? 0.34 : 0.42;
    this.radioTimer = beats * beatSeconds;
    if (note === 0) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = style === "chill" ? "sine" : style === "talk" ? "square" : "triangle";
    osc.frequency.value = midiToFreq(note);
    const gain = this.ctx.createGain();
    const level = style === "talk" ? 0.045 : 0.09;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + beats * beatSeconds * 0.95);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + beats * beatSeconds);
  }
}
