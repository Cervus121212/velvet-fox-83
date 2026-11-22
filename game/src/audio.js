// Ember Sigils — tiny WebAudio synth. No audio files: every sound is
// an oscillator blip, so the game stays a handful of static files.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, vol, delay) {
    if (this.muted || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio is garnish; a failure must never break the game.
    }
  }

  play() {
    this.tone(660, 0.12, "triangle", 0.07);
    this.tone(990, 0.1, "sine", 0.05, 0.05);
  }

  hit() {
    this.tone(180, 0.18, "sawtooth", 0.06);
  }

  heal() {
    this.tone(880, 0.15, "sine", 0.06);
    this.tone(1174, 0.18, "sine", 0.05, 0.07);
  }

  endTurn() {
    this.tone(440, 0.1, "triangle", 0.05);
    this.tone(330, 0.14, "triangle", 0.05, 0.08);
  }

  begin() {
    this.tone(523, 0.12, "triangle", 0.07);
    this.tone(659, 0.12, "triangle", 0.07, 0.09);
    this.tone(784, 0.2, "triangle", 0.07, 0.18);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.08, i * 0.11));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, "sawtooth", 0.05, i * 0.13));
  }
}
