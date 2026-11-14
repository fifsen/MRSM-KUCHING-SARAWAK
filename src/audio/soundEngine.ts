// Procedural Web Audio API sound, launch rumble, explosion, win fanfare & ambient space engine

export type MusicMood = 'title' | 'design' | 'flight' | 'debrief';
export type FlightSoundMode = 'cruise' | 'science' | 'hazard';

export interface FlightSoundscapeState {
  active: boolean;
  intensity: number; // 0..1
  mode: FlightSoundMode;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicEnabled = false;
  private sfxEnabled = true;
  private muted = false;
  private mood: MusicMood = 'title';
  private loopTimer: number | null = null;
  private stepIndex = 0;
  private noiseBuffer: AudioBuffer | null = null;

  // Flight soundscape nodes
  private flightDesired: FlightSoundscapeState = { active: false, intensity: 0.25, mode: 'cruise' };
  private flightHumGain: GainNode | null = null;
  private flightFilter: BiquadFilterNode | null = null;
  private flightOscSub: OscillatorNode | null = null;
  private flightOscHarm: OscillatorNode | null = null;
  private flightLfo: OscillatorNode | null = null;
  private flightPingTimer: number | null = null;
  private flightPingStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.26;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.45;
      this.sfxGain.connect(this.masterGain);

      // Reusable short noise buffer for crisp hi-hats and snare ticks
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    const ctx = this.ensureContext();
    if (ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled && !this.muted;
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled && !this.muted;
  }

  public setMood(mood: MusicMood) {
    this.mood = mood;
  }

  public startMusic() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.musicEnabled = true;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.26, ctx.currentTime, 0.2);
    }
    if (this.loopTimer === null) {
      this.stepIndex = 0;
      this.scheduleBeat();
      // 125ms per 16th note = lively 120 BPM groove
      this.loopTimer = window.setInterval(() => this.scheduleBeat(), 125);
    }
    if (this.flightDesired.active) {
      this.syncFlightNodes();
    }
  }

  public stopMusic() {
    this.musicEnabled = false;
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
    }
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.teardownFlightNodes();
  }

  public toggleMusic(): boolean {
    if (this.musicEnabled) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  public toggleSfx(): boolean {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  private playSynthTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    cutoffHz: number,
  ) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, cutoffHz * 0.45), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playKick(startTime: number, level = 0.22) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, startTime);
    osc.frequency.exponentialRampToValueAtTime(44, startTime + 0.09);

    gain.gain.setValueAtTime(level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.13);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  private playHat(startTime: number, accent: boolean) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(accent ? 5200 : 7200, startTime);

    const gain = this.ctx.createGain();
    const dur = accent ? 0.085 : 0.038;
    gain.gain.setValueAtTime(accent ? 0.09 : 0.045, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + dur);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    src.start(startTime);
    src.stop(startTime + dur + 0.01);
  }

  private scheduleBeat() {
    if (!this.musicEnabled || this.muted || !this.ctx || !this.musicGain) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime + 0.015;
    const step = this.stepIndex % 16; // 16 sixteenth notes per bar
    const bar = Math.floor(this.stepIndex / 16) % 4; // 4-bar phrase

    // Bright, uplifting space-adventure progressions (C major / Lydian / Mixolydian energy)
    const progressions: Record<MusicMood, number[][]> = {
      title: [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [293.66, 369.99, 440.0, 587.33], // D/C energy (Lydian sparkle)
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [196.0, 246.94, 293.66, 392.0],  // G
      ],
      design: [
        [261.63, 329.63, 392.0, 523.25], // C
        [174.61, 220.0, 261.63, 349.23], // F
        [220.0, 261.63, 329.63, 440.0],  // Am
        [196.0, 246.94, 293.66, 392.0],  // G
      ],
      flight: [
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [196.0, 246.94, 293.66, 392.0],  // G
      ],
      debrief: [
        [174.61, 220.0, 261.63, 349.23], // F
        [196.0, 246.94, 293.66, 392.0],  // G
        [220.0, 261.63, 329.63, 440.0],  // Am
        [261.63, 329.63, 392.0, 523.25], // C!
      ],
    };

    const chords = progressions[this.mood];
    const chord = chords[bar];
    const rootHz = chord[0] * 0.5; // bass register

    // 1. Light upbeat drum groove (four-on-the-floor kick on flight, bouncy pop groove otherwise)
    const isKick =
      this.mood === 'flight'
        ? step % 4 === 0
        : step === 0 || step === 6 || step === 8 || step === 14;
    if (isKick) {
      this.playKick(now, this.mood === 'flight' ? 0.24 : 0.19);
    }
    if (step === 4 || step === 12) {
      // Crisp clap/snare tick on beats 2 & 4
      this.playHat(now, true);
    } else if (step % 2 === 1) {
      // Off-beat 8th-note hi-hat sparkle
      this.playHat(now, false);
    }

    // 2. Bouncy octave synth bassline
    const bassPattern = [1, 0, 1, 0, 0, 2, 1, 0, 1, 0, 2, 0, 1, 0, 2, 1];
    const bassMode = bassPattern[step];
    if (bassMode > 0) {
      const bassFreq = bassMode === 2 ? rootHz * 2 : rootHz;
      this.playSynthTone(bassFreq, now, 0.14, 'triangle', 0.17, 720);
    }

    // 3. Warm bouncy chord stabs on beat 1 and syncopated '& of 2' / beat 3
    if (step === 0 || step === 6 || step === 10) {
      const stabGain = step === 0 ? 0.065 : 0.042;
      const stabDur = step === 0 ? 0.32 : 0.18;
      chord.slice(0, 3).forEach((f) => {
        this.playSynthTone(f, now, stabDur, 'triangle', stabGain, 1500);
      });
    }

    // 4. Sparkling synth arpeggio dancing on 8th notes (and energetic 16ths in flight/title)
    const playArp = this.mood === 'flight' || this.mood === 'title' ? step % 2 === 0 || step === 15 : step % 2 === 0;
    if (playArp) {
      const arpSeq = [0, 1, 2, 3, 2, 1, 3, 2];
      const arpNote = chord[arpSeq[Math.floor(step / 2) % arpSeq.length]] * 2;
      this.playSynthTone(arpNote, now, 0.16, 'sine', 0.075, 2800);
    }

    // 5. Playful catchy lead melody hook (plays memorable 4-bar phrases)
    const melodyByMood: Record<MusicMood, (number | null)[]> = {
      title: [2, null, 3, null, 2, 1, 0, null, 2, null, 3, 2, 3, null, null, null],
      design: [0, null, 2, null, 1, null, 3, null, 2, null, 1, 0, 2, null, null, null],
      flight: [3, null, 2, 3, 1, null, 2, null, 3, null, 2, 1, 0, null, 2, null],
      debrief: [0, null, 1, null, 2, null, 3, null, 3, 2, 3, null, null, null, 2, null],
    };
    const melIdx = melodyByMood[this.mood][step];
    if (melIdx !== null) {
      const melFreq = chord[melIdx % chord.length] * 2;
      this.playSynthTone(melFreq, now, 0.24, 'triangle', 0.095, 3200);
    }

    this.stepIndex += 1;
  }

  public updateFlightSoundscape(next: FlightSoundscapeState) {
    this.flightDesired = {
      active: next.active,
      intensity: Math.max(0.1, Math.min(1, next.intensity)),
      mode: next.mode,
    };
    if (!this.flightDesired.active || !this.musicEnabled || this.muted) {
      this.teardownFlightNodes();
      return;
    }
    this.syncFlightNodes();
  }

  public stopFlightSoundscape() {
    this.flightDesired = { active: false, intensity: 0.2, mode: 'cruise' };
    this.teardownFlightNodes();
  }

  private syncFlightNodes() {
    if (!this.musicEnabled || this.muted || !this.flightDesired.active) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const { intensity, mode } = this.flightDesired;

    if (!this.flightOscSub) {
      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(0.0001, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.Q.setValueAtTime(1.8, now);

      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);

      const harmOsc = ctx.createOscillator();
      harmOsc.type = 'triangle';
      harmOsc.frequency.setValueAtTime(110.4, now);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.18, now);
      lfoGain.gain.setValueAtTime(36, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      subOsc.connect(filter);
      harmOsc.connect(filter);
      filter.connect(humGain);
      humGain.connect(this.masterGain);

      subOsc.start(now);
      harmOsc.start(now);
      lfo.start(now);

      this.flightHumGain = humGain;
      this.flightFilter = filter;
      this.flightOscSub = subOsc;
      this.flightOscHarm = harmOsc;
      this.flightLfo = lfo;
    }

    const targetGain = 0.035 + intensity * 0.065;
    const targetCutoff =
      mode === 'hazard'
        ? 190 + intensity * 260
        : mode === 'science'
          ? 165 + intensity * 210
          : 130 + intensity * 120;
    const subFreq = mode === 'hazard' ? 61.74 : mode === 'science' ? 58.27 : 55.0;

    this.flightHumGain?.gain.setTargetAtTime(targetGain, now, 0.45);
    this.flightFilter?.frequency.setTargetAtTime(targetCutoff, now, 0.45);
    this.flightOscSub?.frequency.setTargetAtTime(subFreq, now, 0.5);
    this.flightOscHarm?.frequency.setTargetAtTime(subFreq * 2.004, now, 0.5);

    if (this.flightPingTimer === null) {
      this.scheduleFlightPing();
    }
  }

  private scheduleFlightPing() {
    if (!this.musicEnabled || this.muted || !this.flightDesired.active) {
      this.flightPingTimer = null;
      return;
    }

    this.emitTelemetryPing();

    const intervalMs = Math.round(1950 - this.flightDesired.intensity * 1030);
    this.flightPingTimer = window.setTimeout(() => {
      this.flightPingTimer = null;
      this.scheduleFlightPing();
    }, intervalMs);
  }

  private emitTelemetryPing() {
    if (!this.ctx || !this.masterGain || this.ctx.state === 'suspended' || this.muted) return;
    const now = this.ctx.currentTime;
    const { intensity, mode } = this.flightDesired;
    this.flightPingStep += 1;

    if (mode === 'science') {
      const baseFreq = this.flightPingStep % 2 === 0 ? 1174.66 : 1318.51;
      [baseFreq, baseFreq * 1.25].forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.02 + intensity * 0.022, now + idx * 0.09 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + idx * 0.09 + 0.28);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.3);
      });
    } else if (mode === 'hazard') {
      const freq = this.flightPingStep % 3 === 0 ? 783.99 : 659.25;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.025 + intensity * 0.026, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      if (this.flightPingStep % 2 === 0) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.016 + intensity * 0.015, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.38);
    }
  }

  private teardownFlightNodes() {
    if (this.flightPingTimer !== null) {
      window.clearTimeout(this.flightPingTimer);
      this.flightPingTimer = null;
    }
    if (this.ctx && this.flightHumGain) {
      const now = this.ctx.currentTime;
      const humGain = this.flightHumGain;
      const subOsc = this.flightOscSub;
      const harmOsc = this.flightOscHarm;
      const lfo = this.flightLfo;
      humGain.gain.setTargetAtTime(0.0001, now, 0.12);
      window.setTimeout(() => {
        try {
          subOsc?.stop();
          harmOsc?.stop();
          lfo?.stop();
          subOsc?.disconnect();
          harmOsc?.disconnect();
          lfo?.disconnect();
          humGain.disconnect();
        } catch {
          // Ignore already stopped
        }
      }, 250);
    }
    this.flightHumGain = null;
    this.flightFilter = null;
    this.flightOscSub = null;
    this.flightOscHarm = null;
    this.flightLfo = null;
  }

  public playSelect() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playTick() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playCountdownBeep(isZero = false) {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isZero ? 987.77 : 659.25, now);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isZero ? 0.34 : 0.16));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isZero ? 0.36 : 0.18));
  }

  public playLaunchRumble() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // White noise filtered down into deep rocket engine roar
    const duration = 1.6;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, now);
    filter.frequency.linearRampToValueAtTime(360, now + 0.45);
    filter.frequency.exponentialRampToValueAtTime(95, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.32, now + 0.18);
    noiseGain.gain.exponentialRampToValueAtTime(0.002, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + duration);

    // Sub-bass thrust tone
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(52, now);
    sub.frequency.linearRampToValueAtTime(78, now + 0.5);
    sub.frequency.exponentialRampToValueAtTime(42, now + duration);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(160, now);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.12);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + duration);
  }

  public playExplosion() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const duration = 0.9;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + duration);
  }

  public playSuccess() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.28);
    });
  }

  public playWinFanfare() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.11, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.55);
    });
  }

  public playAlert() {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [440, 349.23].forEach((freq, idx) => {
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.07, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.16);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.18);
    });
  }

  public playLaunch() {
    this.playLaunchRumble();
  }
}

export const soundEngine = new SoundEngine();
