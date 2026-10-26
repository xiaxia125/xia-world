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
  private musicDelay?: DelayNode;
  private musicTimer = 0;
  private musicOn = true;
  private musicBeat = 0;
  private nextBeatTime = 0;
  private readonly beatDuration = 60 / 64;
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
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);

      this.noiseBuffer = this.makeNoise(this.ctx, 2.5);
      this.startAmbient();
      this.startRain();
      this.buildRadio();
      this.buildMusic();
      if (this.musicOn) this.startMusicScheduler();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
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
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = this.musicOn ? 0.28 : 0;
    gain.connect(this.master);

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.48;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.12;
    const wet = ctx.createGain();
    wet.gain.value = 0.1;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(gain);

    this.musicGain = gain;
    this.musicDelay = delay;

  }

  private startMusicScheduler() {
    if (this.disposed || !this.ctx || !this.musicGain) return;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicBeat = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.12;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 160);
    this.scheduleMusic();
  }

  private stopMusicScheduler() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  private scheduleMusic() {
    if (this.disposed || !this.ctx || !this.musicGain || !this.musicOn) return;
    const ctx = this.ctx;
    if (this.nextBeatTime < ctx.currentTime - 0.4) {
      this.nextBeatTime = ctx.currentTime + 0.06;
    }
    while (this.nextBeatTime < ctx.currentTime + 0.7) {
      this.scheduleBeat(this.musicBeat, this.nextBeatTime);
      this.musicBeat += 1;
      this.nextBeatTime += this.beatDuration;
    }
  }

  private scheduleBeat(beat: number, time: number) {
    const chords = [
      [110.0, 164.81, 261.63, 329.63, 392.0],
      [87.31, 174.61, 220.0, 261.63, 349.23],
      [130.81, 196.0, 261.63, 329.63, 392.0],
      [98.0, 146.83, 196.0, 246.94, 293.66],
      [110.0, 164.81, 220.0, 329.63, 440.0],
    ];
    const bar = Math.floor(beat / 8);
    const chord = chords[bar % chords.length];
    const inBar = beat % 8;

    if (inBar === 0) this.playPad(chord, time);
    if (inBar === 0) this.playBass(chord[0], time);

    if (inBar === 2 || inBar === 6) {
      const pattern = [2, 3, 1, 4, 2, 3, 4, 1];
      const note = chord[pattern[inBar] % chord.length];
      this.playPluck(note, time + 0.012, inBar);
    }
  }

  private playPad(chord: number[], time: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.45;
    filter.connect(this.musicGain);

    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i - 2) * 3.5;
      const gain = ctx.createGain();
      const level = i === 0 ? 0.007 : 0.009;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(level, time + 1.3);
      gain.gain.setValueAtTime(level, time + 4.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.7);
      osc.connect(gain).connect(filter);
      osc.start(time);
      osc.stop(time + 6.8);
    });
  }

  private playBass(freq: number, time: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq / 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.022, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.2);
    osc.connect(gain).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 2.3);
  }

  private playPluck(freq: number, time: number, index: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.72);

    const pan = ctx.createStereoPanner();
    pan.pan.value = ((index % 4) - 1.5) * 0.24;
    osc.connect(filter).connect(gain).connect(pan);
    pan.connect(this.musicGain);
    if (this.musicDelay) pan.connect(this.musicDelay);
    osc.start(time);
    osc.stop(time + 0.75);
  }

  setMusic(on: boolean) {
    if (this.disposed) return;
    this.musicOn = on;
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.35);
    if (on) this.startMusicScheduler();
    else this.stopMusicScheduler();
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

  arcade() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.defer(() => this.tone(freq, 0.14, "square", 0.022), i * 65);
    });
  }

  cinema() {
    this.tone(164.81, 2.2, "sine", 0.03);
    this.defer(() => this.tone(220, 2.6, "triangle", 0.022), 220);
    this.defer(() => this.tone(329.63, 2.8, "sine", 0.014), 420);
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
    this.stopMusicScheduler();
    this.pendingTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.pendingTimeouts.clear();
    const context = this.ctx;
    this.ctx = undefined;
    this.master = undefined;
    this.ambientGain = undefined;
    this.rainGain = undefined;
    this.radioGain = undefined;
    this.musicGain = undefined;
    this.musicDelay = undefined;
    this.noiseBuffer = undefined;
    if (context && context.state !== "closed") void context.close();
  }
}

