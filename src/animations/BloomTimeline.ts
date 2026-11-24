import { gsap } from 'gsap';
import type { World } from './World';

/**
 * Acte 3 : éclosion. Les tiges poussent, les feuilles se déploient, les
 * boutons apparaissent puis les pétales s'ouvrent, fleur après fleur.
 */
export function bloomTimeline(w: World) {
  const { bouquet, audio, rig, post } = w;
  const s = w.speed;
  const tl = gsap.timeline();
  const step = 0.2 * s;

  tl.call(() => audio.sfx('bloom'), [], 0.4);
  bouquet.flowers.forEach((f, i) => {
    const t0 = 0.1 + i * step;
    tl.to(f, { grow: 1, duration: 1.3 * s, ease: 'power2.out' }, t0);
    f.leaves.forEach((l, j) => tl.to(l, { open: 1, duration: 1.5 * s, ease: 'power2.out' }, t0 + 0.55 * s + j * 0.2 * s));
    tl.to(f, { headScale: 1, duration: 1.0 * s, ease: 'back.out(2)' }, t0 + 0.85 * s);
    tl.to(f, { bloom: 1, duration: 2.8 * s, ease: 'power1.inOut' }, t0 + 1.3 * s);
    tl.call(() => audio.sfx('note', i * 2), [], t0 + 1.5 * s);
  });

  const n = bouquet.flowers.length;
  const mid = 0.6 + n * step * 0.5;
  bouquet.sprigs.forEach((sp, i) => {
    tl.to(sp, { grow: 1, duration: 2.2 * s, ease: 'power2.out' }, 0.3 + i * 0.25 * s);
  });
  bouquet.foliage.forEach((fo, i) => {
    fo.leaves.forEach((l, j) => tl.to(l, { open: 1, duration: 1.6 * s, ease: 'power2.out' }, 0.5 + i * 0.15 * s + j * 0.12 * s));
  });
  bouquet.crowns.forEach((c, i) => {
    const t0 = mid + i * 0.16 * s;
    tl.to(c, { grow: 1, duration: 1.1 * s, ease: 'power2.out' }, t0);
    tl.to(c, { pop: 1, duration: 0.9 * s, ease: 'back.out(2.4)' }, t0 + 0.8 * s);
  });

  const total = 0.1 + n * step + 4.1 * s;
  tl.to(rig, { azim: '+=0.4', duration: total, ease: 'sine.inOut' }, 0);
  tl.to(post, { boost: 0.15, duration: 1.2, yoyo: true, repeat: 1 }, total * 0.45);
  return tl;
}
