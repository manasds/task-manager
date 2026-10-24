/**
 * Web Audio API synthesized sound effects and focus ambient audio.
 * Zero external audio files required - works offline and sandboxed.
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private ambientNoiseNode: AudioNode | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;

    if (muted && this.ambientNoiseNode) {
      this.stopAmbient();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Subtle click feedback when grabbing or dragging an element
   */
  public playDragStart() {
    if (this.isMuted) return;

    try {
      const ctx = this.getContext();

      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // AudioContext policy fallback
    }
  }

  /**
   * Satisfying drop sound when task lands in a new column or time slot
   */
  public playDrop() {
    if (this.isMuted) return;

    try {
      const ctx = this.getContext();

      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext policy fallback
    }
  }

  /**
   * Harmonious chime when completing an activity or subtask
   */
  public playComplete() {
    if (this.isMuted) return;

    try {
      const ctx = this.getContext();

      if (!ctx) return;
      const now = ctx.currentTime;

      // Chord: C5, E5, G5
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.05, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    } catch {
      // AudioContext policy fallback
    }
  }

  /**
   * Ambient Pink Noise for Deep Focus
   */
  public startAmbientFocus(): boolean {
    if (this.isMuted) return false;

    try {
      const ctx = this.getContext();

      if (!ctx) return false;
      this.stopAmbient();

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink noise algorithm (Paul Kellet's filtered white noise)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.02;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Low pass filter for soft rainfall / ocean tone
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      this.ambientNoiseNode = whiteNoise;

      return true;
    } catch {
      return false;
    }
  }

  public stopAmbient() {
    if (this.ambientNoiseNode) {
      try {
        (this.ambientNoiseNode as AudioBufferSourceNode).stop();
        this.ambientNoiseNode.disconnect();
      } catch {
        // Safe disconnect
      }

      this.ambientNoiseNode = null;
    }
  }

  public isAmbientPlaying(): boolean {
    return this.ambientNoiseNode !== null;
  }
}

export const soundManager = new SoundEffectsManager();
