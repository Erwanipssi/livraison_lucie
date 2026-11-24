import type { AppConfig } from '../config';

const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  /[?&]iosaudio=1/.test(location.search); // test du chemin iOS sur ordinateur

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Progression douce en ré majeur : Dmaj9 – Bm9 – Gmaj9 – Asus
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 59],
  [45, 52, 57, 59, 64],
];
const MELODY = [74, 76, 78, 81, 83, 86, 88, 90];

export type Sfx = 'untie' | 'lid' | 'bloom' | 'note' | 'seal' | 'paper' | 'stamp' | 'chime';

/**
 * Ambiance sonore entièrement générée en Web Audio (aucun fichier, aucune
 * licence) : nappes d'accords filtrées + boîte à musique dans une réverbération
 * synthétique. Désactivée par défaut ; ne démarre qu'après un geste utilisateur.
 */
export class AudioEngine {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private timer = 0;
  private nextChord = 0;
  private nextBeat = 0;
  private chordIdx = 0;
  private noiseBuf!: AudioBuffer;

  constructor(private cfg: AppConfig['audio']) {}

  private init() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 4;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.6;
    this.master.connect(comp).connect(makeup);
    this.output = makeup;
    // iOS : tout le son passe par un vrai lecteur <audio> (lecture « média »,
    // ignore l'interrupteur silencieux, pas de conflit avec un 2e lecteur).
    if (IS_IOS && typeof ctx.createMediaStreamDestination === 'function') {
      const dest = ctx.createMediaStreamDestination();
      makeup.connect(dest);
      const el = new Audio();
      el.srcObject = dest.stream;
      el.setAttribute('playsinline', '');
      this.outputEl = el;
    } else {
      makeup.connect(ctx.destination);
    }
    ctx.onstatechange = () => this.resumeHandler();

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.5;
    this.music.connect(this.master);
    this.music.connect(this.reverb);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);

    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /**
   * iOS : le Web Audio est coupé par l'interrupteur silencieux tant qu'aucun
   * élément <audio> ne joue. On lance donc une boucle de silence (et on
   * déclare la session audio en « lecture ») pendant le geste utilisateur.
   */
  private setPlaybackSession() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* non supporté */
    }
  }

  /** Repli iOS : boucle de silence + sortie directe du contexte. */
  private fallbackToDestination() {
    if (!this.ctx || this.fellBack) return;
    this.fellBack = true;
    this.outputEl = null;
    this.output.connect(this.ctx.destination);
    this.playSilentLoop();
  }
  private fellBack = false;
  private output!: AudioNode;
  private outputEl: HTMLAudioElement | null = null;

  private playSilentLoop() {
    if (!this.silent) {
      this.silent = new Audio(silentWavUrl());
      this.silent.loop = true;
      this.silent.setAttribute('playsinline', '');
      this.silent.volume = 0.01;
    }
    this.silent.play().catch(() => undefined);
  }
  private silent: HTMLAudioElement | null = null;
  /** Relance le son après une interruption (verrouillage, appel, autre appli…). */
  private resumeHandler = () => {
    if (!this.enabled || !this.ctx || document.hidden) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
    if (this.outputEl?.paused) this.outputEl.play().catch(() => undefined);
    if (this.fellBack && this.silent?.paused) this.silent.play().catch(() => undefined);
  };

  async enable() {
    // Tout ce qui suit démarre de façon synchrone dans le geste (exigé par Safari).
    this.setPlaybackSession();
    if (!this.ctx) this.init();
    const ctx = this.ctx!;
    const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    if (this.outputEl) this.outputEl.play().catch(() => this.fallbackToDestination());
    else if (IS_IOS) this.playSilentLoop();
    // son inaudible immédiat : « déverrouille » la sortie audio
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.output);
    src.start(0);
    await Promise.race([resumed.catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
    this.enabled = true;
    window.addEventListener('pointerdown', this.resumeHandler, { passive: true });
    window.addEventListener('touchend', this.resumeHandler, { passive: true });
    document.addEventListener('visibilitychange', this.resumeHandler);
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.cfg.volume, t + 1.5);
    this.sfx('chime');
    this.nextChord = t + 0.1;
    this.nextBeat = t + 1.2;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  disable() {
    this.enabled = false;
    window.clearInterval(this.timer);
    this.silent?.pause();
    window.removeEventListener('pointerdown', this.resumeHandler);
    window.removeEventListener('touchend', this.resumeHandler);
    document.removeEventListener('visibilitychange', this.resumeHandler);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.8);
    const ctx = this.ctx;
    window.setTimeout(() => {
      if (!this.enabled) {
        ctx.suspend();
        this.outputEl?.pause();
      }
    }, 1000);
  }

  async toggle() {
    if (this.enabled) this.disable();
    else await this.enable();
    return this.enabled;
  }

  /** Suspend/reprend avec la visibilité de l'onglet. */
  setPaused(paused: boolean) {
    if (!this.ctx || !this.enabled) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume().catch(() => undefined);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const ahead = ctx.currentTime + 0.4;
    const dur = this.cfg.chordDuration;
    while (this.nextChord < ahead) {
      this.pad(CHORDS[this.chordIdx % CHORDS.length], this.nextChord, dur);
      this.chordIdx++;
      this.nextChord += dur;
    }
    const beat = dur / 8;
    while (this.nextBeat < ahead) {
      if (Math.random() < this.cfg.melodyDensity) {
        const chord = CHORDS[(this.chordIdx - 1 + CHORDS.length) % CHORDS.length];
        const pool = MELODY.filter((m) => chord.some((c) => (m - c) % 12 === 0) || Math.random() < 0.3);
        const m = pool[Math.floor(Math.random() * pool.length)] ?? 81;
        this.musicBox(mtof(m), this.nextBeat + (Math.random() - 0.5) * 0.04, 0.11, Math.random() * 1.2 - 0.6, this.music);
      }
      this.nextBeat += beat * (Math.random() < 0.2 ? 0.5 : 1);
    }
  }

  private pad(notes: number[], t: number, dur: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(800, t + dur + 3);
    filter.Q.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.11, t + 2.6);
    env.gain.setValueAtTime(0.11, t + dur - 0.5);
    env.gain.linearRampToValueAtTime(0, t + dur + 3);
    filter.connect(env).connect(this.music);
    // une octave au-dessus : audible sur les petits haut-parleurs de téléphone
    for (const n of [...notes, ...notes.slice(1).map((m) => m + 12)]) {
      for (const [type, det] of [['sine', -5], ['triangle', 6]] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = mtof(n);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = type === 'sine' ? 0.22 : 0.1;
        o.connect(g).connect(filter);
        o.start(t);
        o.stop(t + dur + 3.2);
      }
    }
  }

  private musicBox(freq: number, t: number, vol: number, pan: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vol, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p).connect(bus);
    for (const [mul, g] of [[1, 1], [2, 0.18], [4.02, 0.08], [6.1, 0.03]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mul;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(out);
      o.start(t);
      o.stop(t + 2.7);
    }
  }

  private noise(t: number, dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType = 'bandpass', q = 1.2) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Effets sonores discrets. `arg` : index de note pour 'note'. */
  sfx(name: Sfx, arg = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'untie':
        this.noise(t, 0.5, 900, 3200, 0.12);
        this.noise(t + 0.35, 0.6, 1400, 4200, 0.09);
        break;
      case 'lid':
        this.noise(t, 1.4, 300, 1800, 0.14, 'lowpass', 0.7);
        [74, 78, 81, 86].forEach((m, i) => this.musicBox(mtof(m), t + 0.5 + i * 0.09, 0.06, (i - 1.5) * 0.3, this.sfxBus));
        break;
      case 'bloom': {
        [81, 83, 86, 88, 90, 93].forEach((m, i) => this.musicBox(mtof(m), t + i * 0.11, 0.045, Math.sin(i) * 0.6, this.sfxBus));
        break;
      }
      case 'note':
        this.musicBox(mtof(MELODY[Math.abs(arg) % MELODY.length]), t, 0.08, (Math.random() - 0.5) * 0.8, this.sfxBus);
        break;
      case 'chime':
        [86, 90, 93].forEach((m, i) => this.musicBox(mtof(m), t + i * 0.07, 0.05, 0, this.sfxBus));
        break;
      case 'seal':
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.025, 0.06, 2500 + Math.random() * 2500, 6000, 0.15, 'highpass', 0.8);
        break;
      case 'paper':
        this.noise(t, 0.7, 1800, 600, 0.08, 'bandpass', 0.6);
        break;
      case 'stamp': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(this.sfxBus);
        o.start(t);
        o.stop(t + 0.4);
        this.noise(t, 0.12, 1200, 400, 0.12, 'lowpass', 0.5);
        break;
      }
    }
  }
}

/** Petit WAV silencieux (0,5 s) généré en mémoire, pour l'astuce iOS. */
let silentUrl = '';
function silentWavUrl() {
  if (silentUrl) return silentUrl;
  const rate = 44100, n = rate / 2;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}
