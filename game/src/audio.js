// Sound, synthesised with WebAudio only — no audio files. An engine hum that follows the
// car's speed, a two-tone police siren, a noise-burst gunshot, a pickup blip and a little
// mission jingle. The context is created on the first user gesture; M mutes everything.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, its pitch following speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle wave whose frequency alternates between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type, when) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + (when || 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame: engine follows speed (0..1), siren sounds while wanted.
    update(speed01, inCar, wanted) {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      if (engineGain) {
        engineGain.gain.setTargetAtTime(inCar ? 0.05 + speed01 * 0.07 : 0, now, 0.1);
        if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, now, 0.1);
      }
      if (sirenGain && sirenOsc) {
        const on = wanted > 0;
        sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, now, 0.2);
        if (on) sirenOsc.frequency.setTargetAtTime(Math.floor(now * 1.6) % 2 === 0 ? 700 : 950, now, 0.05);
      }
    },
    shot() { if (ensure()) noiseBurst(0.12, 0.5, 2600); },
    melee() { if (ensure()) noiseBurst(0.08, 0.3, 900); },
    crash() { if (ensure()) noiseBurst(0.25, 0.5, 500); },
    explosion() { if (ensure()) { noiseBurst(0.7, 0.8, 300); tone(55, 0.6, 0.5, 'sine'); } },
    blip() { if (ensure()) tone(880, 0.12, 0.25, 'sine'); },
    cash() { if (ensure()) { tone(988, 0.1, 0.25, 'sine'); tone(1319, 0.16, 0.25, 'sine', 0.09); } },
    jingle() {
      if (!ensure()) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => tone(freq, 0.22, 0.28, 'triangle', i * 0.12));
    },
    busted() { if (ensure()) { tone(392, 0.3, 0.3, 'sawtooth'); tone(311, 0.5, 0.3, 'sawtooth', 0.25); } },
  };
}
