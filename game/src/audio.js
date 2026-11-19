// All sound is synthesized with WebAudio: no audio files, no network.
// The engine is a sawtooth whose pitch follows speed; the siren is two
// alternating tones; shots, punches and jingles are short envelopes.
// Everything is created lazily on the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let skidSrc = null;
  let skidGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // engine: saw + sub sine through a lowpass
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sine';
      engineOsc2.frequency.value = 30;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 900;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // skid: looped noise through a bandpass
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      skidSrc = ctx.createBufferSource();
      skidSrc.buffer = noiseBuf;
      skidSrc.loop = true;
      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 800;
      skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidSrc.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(master);
      skidSrc.start();
      // siren
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq = 1200) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
    // called every frame: engine pitch by speed, siren wail by police distance
    update(dt, speed01, throttle, skidAmount, nearestPoliceDist) {
      if (!ctx || muted) return;
      const target = throttle > 0 || speed01 > 0.02 ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      const freq = 55 + speed01 * 165 + throttle * 25;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.06);
      engineOsc2.frequency.setTargetAtTime(freq / 2, ctx.currentTime, 0.06);
      skidGain.gain.setTargetAtTime(Math.min(0.12, skidAmount * 0.14), ctx.currentTime, 0.05);
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.02);
      }
      const sirenVol = nearestPoliceDist === null ? 0 : Math.max(0, 0.11 - nearestPoliceDist * 0.0012);
      sirenGain.gain.setTargetAtTime(sirenVol, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 2600);
      blip(160, 0.09, 'square', 0.2);
    },
    punch() {
      noiseBurst(0.1, 0.35, 500);
    },
    crash(intensity = 1) {
      noiseBurst(0.25, 0.3 * intensity, 900);
      blip(70, 0.2, 'sine', 0.3 * intensity);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.22);
      blip(1318, 0.14, 'sine', 0.22, 0.08);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.25, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.25, 'triangle', 0.22, i * 0.13));
    },
    click() {
      blip(1200, 0.05, 'square', 0.12);
    },
    wantedUp() {
      blip(220, 0.18, 'sawtooth', 0.2);
      blip(220, 0.18, 'sawtooth', 0.2, 0.2);
    },
  };
}
