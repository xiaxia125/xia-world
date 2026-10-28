export class AudioSystem {
  private ctx?: AudioContext;
  private master?: GainNode;
  private ambientGain?: GainNode;
  private rainGain?: GainNode;
  private radioGain?: GainNode;
  private radioOn = false;
  private volume = 0.55;
  private lastRain = -1;
  private noiseBuffer?: AudioBuffer;
  private radioStarted = false;

  private musicGain?: GainNode;
  private musicSource?: AudioBufferSourceNode;
  private musicBuffer?: AudioBuffer;
  private musicLoad?: Promise<void>;
  private musicOn = true;
  private readonly musicGainValue = 0.22;
  private worldPaused = false;
  private readonly pendingTimeouts = new Set<number>();
  private disposed = false;

  get started() {
    return Boolean(this.ctx);
  }

  get isRadioOn() {
    return this.radioOn;
  }

  get isMusicOn() {
    return this.musicOn;
  }

  async start() {
    if (this.disposed) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.worldPaused ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      this.noiseBuffer = this.makeNoise(this.ctx, 2.5);
      this.startAmbient();
      this.startRain();
      this.buildRadio();
      this.buildMusic();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    void this.loadMusic().then(() => {
      if (this.musicOn) this.startMusic();
    });
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyWorldGain();
  }

  /**
   * 进入别的视图（BIM 查看器、拍照取景）时把 3D 世界的声音整体淡出，返回时恢复。
   * 不走 setVolume，避免把用户设置的总音量冲掉。
   */
  setWorldPaused(paused: boolean) {
    this.worldPaused = paused;
    this.applyWorldGain();
  }

  private applyWorldGain() {
    if (!this.master || !this.ctx) return;
    const target = this.worldPaused ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  }

  setRain(amount: number) {
    if (!this.ctx || !this.rainGain) return;
    if (Math.abs(amount - this.lastRain) < 0.02) return;
    this.lastRain = amount;
    this.rainGain.gain.setTargetAtTime(amount * 0.11, this.ctx.currentTime, 0.5);
  }

  private makeNoise(ctx: AudioContext, seconds: number) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  private startAmbient() {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.018;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.ambientGain = gain;

    // A very low drone gives the world a sense of place.
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.004;
    drone.connect(droneGain).connect(this.master);
    drone.start();

    // Slow wind movement.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  private startRain() {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 650;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 6200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(high).connect(low).connect(gain).connect(this.master);
    source.start();
    this.rainGain = gain;
  }

  private buildRadio() {
    if (!this.ctx || !this.master || !this.noiseBuffer || this.radioStarted) return;
    const ctx = this.ctx;
    this.radioStarted = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    filter.Q.value = 0.4;
    filter.connect(gain).connect(this.master);

    const notes = [220, 261.63, 329.63, 392];
    const oscillators: OscillatorNode[] = [];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 5;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      osc.connect(g).connect(filter);
      osc.start();
      oscillators.push(osc);
    });

    // Slow tremolo, like a cheap radio.
    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 0.18;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.06;
    tremolo.connect(tremoloGain).connect(gain.gain);
    tremolo.start();

    // Vinyl hiss.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const hiss = ctx.createBiquadFilter();
    hiss.type = "highpass";
    hiss.frequency.value = 2600;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.018;
    noise.connect(hiss).connect(hissGain).connect(filter);
    noise.start();

    this.radioGain = gain;
  }

  private buildMusic() {
    if (!this.ctx || !this.master || this.musicGain) return;
    const gain = this.ctx.createGain();
    gain.gain.value = this.musicOn ? this.musicGainValue : 0;
    gain.connect(this.master);
    this.musicGain = gain;
  }

  /** Loads the authored loop once; a failed asset load leaves other game audio usable. */
  private loadMusic() {
    if (this.disposed || !this.ctx || this.musicBuffer) return Promise.resolve();
    if (this.musicLoad) return this.musicLoad;
    const context = this.ctx;
    const musicUrl = new URL("audio/xia-home-ambient.ogg", document.baseURI);
    this.musicLoad = fetch(musicUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Music asset request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (this.disposed || this.ctx !== context) return;
        this.musicBuffer = buffer;
      })
      .catch((error: unknown) => {
        console.error("Unable to load XIA HOME background music:", error);
      })
      .finally(() => {
        this.musicLoad = undefined;
      });
    return this.musicLoad;
  }

  private startMusic() {
    if (this.disposed || !this.ctx || !this.musicGain || !this.musicBuffer || this.musicSource) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
  }

  private stopMusic() {
    const source = this.musicSource;
    this.musicSource = undefined;
    if (!source) return;
    try {
      source.stop();
    } catch {
      // The source may already have ended while the page is being disposed.
    }
    source.disconnect();
  }

  setMusic(on: boolean) {
    if (this.disposed) return;
    this.musicOn = on;
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(on ? this.musicGainValue : 0, this.ctx.currentTime, 0.35);
    if (on) {
      void this.loadMusic().then(() => {
        if (this.musicOn) this.startMusic();
      });
    } else {
      this.stopMusic();
    }
  }

  toggleMusic(): boolean {
    if (this.disposed) return this.musicOn;
    this.setMusic(!this.musicOn);
    return this.musicOn;
  }

  toggleRadio(): boolean {
    if (this.disposed || !this.ctx) return false;
    this.radioOn = !this.radioOn;
    if (this.radioGain) {
      this.radioGain.gain.setTargetAtTime(
        this.radioOn ? 0.05 : 0,
        this.ctx.currentTime,
        this.radioOn ? 0.6 : 0.25,
      );
    }
    return this.radioOn;
  }

  footstep() {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.7 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 170 + Math.random() * 60;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 0.1);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainValue: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shoot() {
    this.tone(180, 0.12, "sine", 0.035);
  }

  score() {
    this.tone(660, 0.22, "triangle", 0.08);
    this.defer(() => this.tone(990, 0.3, "triangle", 0.07), 90);
  }

  chime() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.defer(() => this.tone(freq, 0.5, "sine", 0.06), i * 110);
    });
  }

  secret() {
    this.tone(110, 0.8, "sine", 0.05);
    this.defer(() => this.tone(82, 1.2, "sine", 0.04), 120);
  }

  quack() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(170, now + 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 820;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /** 街头钢琴：1—8 对应一组五声音阶，短促的三角波加一点衰减。 */
  pianoNote(index: number) {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const freq = scale[((index % scale.length) + scale.length) % scale.length]!;
    this.tone(freq, 0.6, "triangle", 0.055);
    this.defer(() => this.tone(freq * 2, 0.35, "sine", 0.02), 12);
  }

  /** 摸猫：低频颤音，音量很低，像贴着耳朵听到的呼噜。 */
  purr() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 42;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 22;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.2);
    lfo.stop(now + 1.2);
  }

  click() {
    this.tone(880, 0.04, "sine", 0.02);
  }

  private defer(callback: () => void, delay: number) {
    if (this.disposed) return;
    const timeout = window.setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      callback();
    }, delay);
    this.pendingTimeouts.add(timeout);
  }

  /** Stops scheduled sounds and closes the context so remounts do not leak audio resources. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopMusic();
    this.pendingTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.pendingTimeouts.clear();
    const context = this.ctx;
    this.ctx = undefined;
    this.master = undefined;
    this.ambientGain = undefined;
    this.rainGain = undefined;
    this.radioGain = undefined;
    this.musicGain = undefined;
    this.musicBuffer = undefined;
    this.musicLoad = undefined;
    this.noiseBuffer = undefined;
    if (context && context.state !== "closed") void context.close();
  }
}

