// ─── Audio Manager ───────────────────────────────────────────
// Low-latency procedural audio using pre-generated buffers

export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private buffers: Map<string, AudioBuffer> = new Map();
  private resumed = false;

  constructor() {
    try {
      this.ctx = new AudioContext();
      // Pre-generate buffers once
      this.pregenerate();
      // Resume on any user gesture (critical for mobile latency)
      const resume = () => {
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
        this.resumed = true;
      };
      document.addEventListener("touchstart", resume, { once: false, passive: true });
      document.addEventListener("pointerdown", resume, { once: false, passive: true });
    } catch {
      this.enabled = false;
    }
  }

  private pregenerate() {
    const ctx = this.ctx;
    if (!ctx) return;
    const sr = ctx.sampleRate;

    // Shoot sounds (short noise bursts with pitch)
    this.buffers.set("shoot_pistol", this.genShot(sr, 200, 0.08, 0.12));
    this.buffers.set("shoot_smg", this.genShot(sr, 300, 0.05, 0.08));
    this.buffers.set("shoot_shotgun", this.genShot(sr, 100, 0.15, 0.2));
    this.buffers.set("shoot_rifle", this.genShot(sr, 150, 0.1, 0.15));

    // Hit
    this.buffers.set("hit", this.genTone(sr, 800, 200, 0.05, 0.1));

    // Damage (noise)
    this.buffers.set("damage", this.genNoise(sr, 0.08, 0.15));

    // Explosion (long noise)
    this.buffers.set("explosion", this.genNoise(sr, 0.3, 0.3));

    // Pickup (ascending tone)
    this.buffers.set("pickup", this.genTone(sr, 400, 800, 0.08, 0.08));

    // Extract (multi-tone)
    this.buffers.set("extract", this.genExtract(sr));
  }

  private genShot(sr: number, freq: number, dur: number, vol: number): AudioBuffer {
    const len = Math.floor(sr * dur);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 30);
      const f = freq * Math.exp(-t * 20);
      // Square wave + noise
      const sq = Math.sign(Math.sin(2 * Math.PI * f * t));
      const noise = Math.random() * 2 - 1;
      d[i] = (sq * 0.6 + noise * 0.4) * env * vol;
    }
    return buf;
  }

  private genTone(sr: number, f1: number, f2: number, dur: number, vol: number): AudioBuffer {
    const len = Math.floor(sr * dur);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const p = t / dur;
      const freq = f1 + (f2 - f1) * p;
      const env = 1 - p;
      d[i] = Math.sin(2 * Math.PI * freq * t) * env * vol;
    }
    return buf;
  }

  private genNoise(sr: number, dur: number, vol: number): AudioBuffer {
    const len = Math.floor(sr * dur);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 2);
      d[i] = (Math.random() * 2 - 1) * env * vol;
    }
    return buf;
  }

  private genExtract(sr: number): AudioBuffer {
    const dur = 0.7;
    const len = Math.floor(sr * dur);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const notes = [400, 500, 600, 800];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const noteIdx = Math.min(Math.floor(t / 0.15), notes.length - 1);
      const noteT = t - noteIdx * 0.15;
      const env = Math.max(0, 1 - noteT / 0.18);
      d[i] = Math.sin(2 * Math.PI * notes[noteIdx] * t) * env * 0.08;
    }
    return buf;
  }

  private play(key: string) {
    if (!this.ctx || !this.enabled) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(0);
  }

  playShoot(type: "pistol" | "smg" | "shotgun" | "rifle" = "pistol") {
    this.play(`shoot_${type}`);
  }

  playHit() { this.play("hit"); }
  playDamage() { this.play("damage"); }
  playExplosion() { this.play("explosion"); }
  playPickup() { this.play("pickup"); }
  playExtract() { this.play("extract"); }
}
