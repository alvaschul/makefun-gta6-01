// All of NEON HARBOR's sound is synthesised with WebAudio — no audio files,
// nothing to load, nothing to license. A tiny synth voice kit (oscillator and
// filtered-noise one-shots) builds gunfire, sirens, pickups and jingles, a
// two-oscillator engine hum follows the car Rio is driving, and a slow
// synthwave chord loop with a bass arpeggio plays underneath the city. The
// radio in a car re-tunes that loop: three stations, three moods.

const STATIONS = [
  { name: 'Kelapa FM — synthwave', root: 110, wave: 'sawtooth', tempo: 0.46 },
  { name: 'Bay Oldies — organ trio', root: 98, wave: 'triangle', tempo: 0.62 },
  { name: 'Gamelan Jazz 88.1', root: 130.81, wave: 'square', tempo: 0.54 },
  { name: 'Radio off', root: 0, wave: 'sine', tempo: 0 },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let stationIndex = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let chordStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.3, freq = 1800, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
  }

  function stopEngine() {
    if (engineOsc) {
      try { engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null;
      engineGain = null;
    }
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }

  function stopSiren() {
    if (sirenOsc) {
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
      sirenGain = null;
    }
  }

  // A I–VI–III–VII walk in the station's root key: pad chord on the bar,
  // a plucked bass note twice per bar. Cheap, endless, and it never repeats
  // a sample because there are no samples.
  const CHORDS = [[1, 1.25, 1.5], [0.75, 1, 1.189], [0.891, 1.122, 1.335], [0.667, 0.841, 1]];

  function stepMusic(dt, inCar) {
    const station = STATIONS[stationIndex];
    if (!station.root || !ensure()) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = station.tempo * 2;
    const chord = CHORDS[chordStep % CHORDS.length];
    chordStep += 1;
    const vol = inCar ? 0.055 : 0.028;
    for (const mult of chord) tone(station.root * 2 * mult, station.tempo * 1.9, station.wave, vol);
    tone(station.root, station.tempo * 0.9, 'triangle', vol * 1.5);
    tone(station.root * 1.5, station.tempo * 0.9, 'triangle', vol, null, station.tempo);
  }

  return {
    unlock() { ensure(); },
    setMuted(next) {
      muted = next;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    isMuted() { return muted; },
    station() { return STATIONS[stationIndex]; },
    nextStation() {
      stationIndex = (stationIndex + 1) % STATIONS.length;
      chordStep = 0;
      musicTimer = 0;
      return STATIONS[stationIndex];
    },
    shot() { noise(0.14, 0.5, 2600); tone(140, 0.1, 'square', 0.18, 60); },
    dryFire() { tone(900, 0.04, 'square', 0.08); },
    hit() { noise(0.08, 0.25, 900); },
    crash(strength = 1) { noise(0.3, 0.4 * strength, 500); tone(70, 0.25, 'sine', 0.3 * strength, 40); },
    door() { tone(220, 0.07, 'square', 0.12, 160); },
    cash() { tone(880, 0.09, 'sine', 0.2); tone(1320, 0.14, 'sine', 0.2, null, 0.08); },
    missionDone() {
      tone(523, 0.16, 'triangle', 0.25);
      tone(659, 0.16, 'triangle', 0.25, null, 0.14);
      tone(784, 0.3, 'triangle', 0.28, null, 0.28);
    },
    missionFail() { tone(220, 0.3, 'sawtooth', 0.16, 110); },
    wantedUp() { tone(392, 0.12, 'square', 0.16); tone(392, 0.12, 'square', 0.16, null, 0.16); },
    update(dt, { driving = false, speed = 0, sirenNear = false, inCar = false } = {}) {
      if (!ctx) return;
      if (driving) {
        startEngine();
        if (engineOsc) {
          const rpm = 50 + Math.abs(speed) * 9;
          engineOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.06);
          engineGain.gain.setTargetAtTime(0.05 + Math.min(0.08, Math.abs(speed) * 0.004), ctx.currentTime, 0.08);
        }
      } else stopEngine();
      if (sirenNear) {
        startSiren();
        if (sirenOsc) {
          const wail = 720 + Math.sin(ctx.currentTime * 4.2) * 180;
          sirenOsc.frequency.setTargetAtTime(wail, ctx.currentTime, 0.05);
          sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
        }
      } else stopSiren();
      stepMusic(dt, inCar);
    },
  };
}
