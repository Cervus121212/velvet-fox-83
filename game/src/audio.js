// audio.js — a tiny WebAudio synth for Ember Sigils.
// No audio files: every sound is an oscillator through a gain envelope,
// so the game ships no assets and plays offline. A failed AudioContext
// (autoplay policy, headless capture) never breaks the game.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  tone(freq, dur = 0.12, type = 'sine', gain = 0.08, when = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* sound is decoration; the game plays on */ }
  }

  play() { this.tone(520, 0.09, 'triangle', 0.06); this.tone(780, 0.1, 'triangle', 0.05, 0.05); }
  hit() { this.tone(180, 0.14, 'sawtooth', 0.07); this.tone(120, 0.16, 'square', 0.04, 0.02); }
  deny() { this.tone(140, 0.08, 'square', 0.04); }
  endTurn() { this.tone(330, 0.08, 'sine', 0.05); }
  start() { this.tone(392, 0.1, 'triangle', 0.06); this.tone(523, 0.12, 'triangle', 0.06, 0.08); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, i * 0.11)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.06, i * 0.12)); }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
