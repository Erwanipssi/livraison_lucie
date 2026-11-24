export type Tier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: Tier;
  maxDpr: number;
  antialias: boolean;
  shadows: number; // taille de la shadow map, 0 = désactivé
  bloom: boolean;
  msaa: number;
  particles: number; // multiplicateur
  petals: number;
  reducedMotion: boolean;
  mobile: boolean;
}

export function detectQuality(): QualitySettings {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 4;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const forced = new URLSearchParams(location.search).get('quality') as Tier | null;

  let tier: Tier = mobile ? 'medium' : 'high';
  if (cores <= 4 && mem <= 3) tier = 'low';
  if (mobile && (cores <= 4 || mem <= 2)) tier = 'low';
  if (forced === 'low' || forced === 'medium' || forced === 'high') tier = forced;

  const base: Record<Tier, Omit<QualitySettings, 'tier' | 'reducedMotion' | 'mobile'>> = {
    low: { maxDpr: 1.25, antialias: true, shadows: 0, bloom: false, msaa: 0, particles: 0.45, petals: 0.5 },
    medium: { maxDpr: 1.75, antialias: false, shadows: 1024, bloom: true, msaa: 2, particles: 0.7, petals: 0.75 },
    high: { maxDpr: 2, antialias: false, shadows: 2048, bloom: true, msaa: 4, particles: 1, petals: 1 },
  };
  const q = { tier, reducedMotion, mobile, ...base[tier] };
  if (reducedMotion) {
    q.particles *= 0.5;
    q.petals *= 0.5;
  }
  return q;
}

/**
 * Surveille la fluidité et dégrade progressivement (pixel ratio, puis bloom)
 * si l'appareil n'arrive pas à suivre.
 */
export class PerformanceMonitor {
  private frames = 0;
  private acc = 0;
  private cooldown = 2;
  constructor(private onDegrade: (level: number) => boolean) {}
  private level = 0;

  sample(dt: number) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.frames++;
    this.acc += dt;
    if (this.acc >= 2) {
      const fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
      if (fps < 40) {
        this.level++;
        const changed = this.onDegrade(this.level);
        this.cooldown = changed ? 2.5 : 1e9;
      }
    }
  }
}
