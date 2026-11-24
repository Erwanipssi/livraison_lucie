import * as THREE from 'three';
import { GOLDEN_ANGLE, lerp, Rng, smoothstep } from '../utils/math';
import { buildHeadGeometry, coloredLathe, paletteFrom, type PetalParams } from './Flower';

const roseProfile = (u: number) => (0.3 + 0.7 * Math.sin(Math.min(u * 1.7, 1) * Math.PI * 0.5)) * (1 - 0.22 * Math.pow(u, 4));
const sepalProfile = (u: number) => Math.sin(Math.min(u * 2.4, 1) * Math.PI * 0.5) * Math.pow(1 - u, 0.85);

/**
 * Rose de jardin : 30 à 36 pétales en spirale (angle d'or), les extérieurs
 * s'ouvrent les premiers et se recourbent, le cœur reste en coupe serrée.
 */
export function createRoseGeometry(rng: Rng, colorHex: string, size = 1): THREE.BufferGeometry {
  const N = rng.int(30, 36);
  const pal = paletteFrom(colorHex, 1, () => rng.next());
  const greenDeep = new THREE.Color('#3d5a35');
  const greenLight = new THREE.Color('#6f8f55');
  const cream = new THREE.Color('#f6e7c8');

  const data = Array.from({ length: N }, (_, i) => {
    const l = i / (N - 1);
    return {
      l,
      angle: i * GOLDEN_ANGLE + rng.range(-0.18, 0.18),
      len: lerp(0.052, 0.13, Math.pow(l, 0.7)) * size * rng.range(0.94, 1.06),
      wid: lerp(0.032, 0.074, Math.pow(l, 0.85)) * size * rng.range(0.92, 1.08),
      br: lerp(0.004, 0.021, l) * size,
      seed: rng.range(0, 10),
      jitter: rng.range(-0.06, 0.06),
      tone: rng.range(-0.05, 0.05),
    };
  });

  const petalsAt = (b: number): PetalParams[] => {
    const petals: PetalParams[] = data.map((d) => {
      const local = smoothstep(0, 1, (b - (1 - d.l) * 0.45) / 0.55);
      const l = d.l;
      const inner = pal.deep.clone().lerp(pal.base, 0.35 + d.tone);
      const outer = pal.base.clone().lerp(pal.light, 0.4 + d.tone);
      return {
        angle: d.angle,
        length: d.len * lerp(0.86, 1, local),
        width: d.wid,
        baseRadius: d.br,
        baseY: lerp(0.0, -0.012, l) * size,
        tilt: lerp(lerp(0.04, 0.38, l), lerp(0.2, 1.42, Math.pow(l, 1.15)), local) + d.jitter * local,
        curl: lerp(lerp(-0.25, -0.78, l), lerp(-0.12, 0.9, l), local),
        curlPow: 2.2,
        cup: lerp(1, lerp(1, 0.42, l), local),
        roll: local * lerp(0.2, 1.5, l),
        wave: 0.08 + 0.14 * l,
        tipRound: 0.42,
        profile: roseProfile,
        seed: d.seed,
        color: (u, s, out) => {
          out.copy(inner).lerp(outer, l * 0.8 + 0.2 * u);
          // pied du pétale crème, bord plus clair
          out.lerp(cream, (1 - smoothstep(0, 0.22, u)) * 0.55);
          out.lerp(pal.light, Math.pow(Math.abs(s), 3) * u * 0.35);
        },
      };
    });
    // sépales
    const local = smoothstep(0, 0.6, b);
    for (let k = 0; k < 5; k++) {
      petals.push({
        angle: (k / 5) * Math.PI * 2 + 0.3,
        length: 0.08 * size,
        width: 0.016 * size,
        baseRadius: 0.014 * size,
        baseY: -0.016 * size,
        tilt: lerp(0.32, 1.95, local),
        curl: lerp(-0.15, 0.9, local),
        curlPow: 1.6,
        cup: 0.55,
        roll: 0,
        wave: 0.05,
        tipRound: 0,
        profile: sepalProfile,
        seed: k,
        color: (u, _s, out) => out.copy(greenDeep).lerp(greenLight, u * 0.6),
      });
    }
    return petals;
  };

  const receptacle = coloredLathe(
    [[0.002, -0.06], [0.01, -0.056], [0.017, -0.042], [0.02, -0.026], [0.017, -0.012], [0.008, -0.004]].map(
      ([x, y]) => [x * size, y * size] as [number, number],
    ),
    greenDeep,
    14,
    (y) => greenDeep.clone().lerp(greenLight, 1 + y / (0.06 * size)),
  );

  return buildHeadGeometry({ states: [petalsAt(0), petalsAt(0.55), petalsAt(1)], extras: [receptacle] });
}
