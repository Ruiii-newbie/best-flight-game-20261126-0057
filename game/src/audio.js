// All sound is synthesized with WebAudio — no audio files, no network.
// Engine drone follows the throttle, wind follows speed, rings chime.
export function createAudio() {
  const audio = {
    ctx: null,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    muted: false,
    /** Create the context on the first user gesture (browsers require it). */
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        const engine = this.ctx.createOscillator();
        engine.type = 'sawtooth';
        engine.frequency.value = 55;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 320;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        engine.connect(engineFilter).connect(this.engineGain).connect(this.ctx.destination);
        engine.start();
        this.engine = engine;

        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        const wind = this.ctx.createBufferSource();
        wind.buffer = buffer;
        wind.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 480;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.0;
        wind.connect(windFilter).connect(this.windGain).connect(this.ctx.destination);
        wind.start();
        this.wind = wind;
      } catch {
        this.ctx = null;
      }
    },
    /** Continuous levels from the flight state, called every frame. */
    update(state) {
      if (!this.ctx || this.muted) {
        if (this.engineGain) this.engineGain.gain.value = 0;
        if (this.windGain) this.windGain.gain.value = 0;
        return;
      }
      const t = this.ctx.currentTime;
      this.engine.frequency.setTargetAtTime(48 + state.throttle * 70 + state.speed * 0.35, t, 0.08);
      this.engineGain.gain.setTargetAtTime(state.onGround && state.speed < 2 ? 0.0 : 0.028 + state.throttle * 0.05, t, 0.1);
      this.windGain.gain.setTargetAtTime(Math.min(0.09, (state.speed / 95) * 0.09), t, 0.15);
    },
    /** A short chime: two sines, one after the other. */
    chime() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      for (const [offset, freq] of [[0, 880], [0.09, 1318]]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.14, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.55);
      }
    },
    /** A low thud for touchdown and a noise burst for a crash. */
    thud() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    },
    crash() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.connect(gain).connect(this.ctx.destination);
      src.start(t);
    },
  };
  return audio;
}
