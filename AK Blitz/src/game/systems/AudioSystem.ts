// ============================================================================
// AudioSystem.ts — all SFX synthesized via Web Audio (no asset files).
// ============================================================================
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Must be called from a user gesture (click/keypress) to satisfy autoplay. */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 1, slideTo?: number) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 1, hp = 400) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  snap() { this.tone(180, 0.08, "square", 0.5, 120); }
  throwBall() { this.tone(520, 0.12, "triangle", 0.5, 300); }
  catchBall() { this.tone(700, 0.09, "sine", 0.6, 900); }
  incomplete() { this.tone(200, 0.18, "sawtooth", 0.4, 90); }
  hit() { this.noise(0.18, 0.8, 250); this.tone(90, 0.16, "square", 0.6, 50); }
  bigHit() { this.noise(0.3, 1.0, 180); this.tone(70, 0.3, "sawtooth", 0.8, 40); }
  whistle() { this.tone(2200, 0.18, "square", 0.25, 2400); }
  touchdown() {
    this.tone(523, 0.12, "square", 0.5);
    setTimeout(() => this.tone(659, 0.12, "square", 0.5), 110);
    setTimeout(() => this.tone(784, 0.22, "square", 0.6), 220);
  }
  pickoff() { this.tone(330, 0.1, "sawtooth", 0.5, 660); setTimeout(() => this.tone(220, 0.2, "square", 0.5, 110), 90); }
  fire() { this.tone(440, 0.4, "sawtooth", 0.4, 880); this.noise(0.4, 0.3, 800); }
  shockwave() { this.tone(120, 0.5, "sawtooth", 0.9, 30); this.noise(0.5, 0.9, 120); }
  ui() { this.tone(660, 0.05, "square", 0.3); }
}
