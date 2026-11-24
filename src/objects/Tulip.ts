import * as THREE from 'three';
import { lerp, Rng, smoothstep } from '../utils/math';
import { buildHeadGeometry, coloredLathe, coloredSphere, paletteFrom, type PetalParams } from './Flower';

const tulipProfile = (u: number) => Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * u)), 0.6);

/**
 * Tulipe : deux verticilles de 3 tépales en forme d'œuf, qui s'entrouvrent
 * en coupe. Stries délicates et base légèrement verte.
 */
export function createTulipGeometry(rng: Rng, colorHex: string, size = 1): THREE.BufferGeometry {
  const pal = paletteFrom(colorHex, 1, () => rng.next());
  const greenBase = new THREE.Color('#9bb27a');
  const twist = rng.range(0, Math.PI);

  const petalsAt = (b: number): PetalParams[] => {
    const out: PetalParams[] = [];
    for (let k = 0; k < 6; k++) {
      const outer = k < 3;
      const local = smoothstep(outer ? 0 : 0.12, 1, b);
      const seed = k * 1.7;
      out.push({
        angle: twist + (k % 3) * ((Math.PI * 2) / 3) + (outer ? 0 : Math.PI / 3),
        length: (outer ? 0.172 : 0.162) * size,
        width: (outer ? 0.086 : 0.076) * size,
        baseRadius: (outer ? 0.011 : 0.006) * size,
        baseY: 0,
        tilt: lerp(outer ? 0.62 : 0.56, outer ? 0.98 : 0.76, local),
        curl: lerp(-1.36, outer ? -0.5 : -0.68, local),
        curlPow: 1.3,
        cup: lerp(1, 0.86, local),
        roll: local * 0.3,
        wave: 0.03,
        tipRound: 0.34,
        profile: tulipProfile,
        seed,
        color: (u, s, c) => {
          c.copy(pal.base);
          c.lerp(pal.deep, smoothstep(0.25, 0.7, u) * 0.35 * (1 - Math.abs(s)));
          c.lerp(pal.light, Math.pow(Math.abs(s), 2) * 0.45 + smoothstep(0.75, 1, u) * 0.25);
          // stries fines
          c.multiplyScalar(1 + Math.sin(s * 26 + seed) * 0.025);
          c.lerp(greenBase, (1 - smoothstep(0, 0.2, u)) * 0.6);
        },
      });
    }
    return out;
  };

  const green = new THREE.Color('#5d7a45');
  const cap = coloredLathe(
    [[0.002, -0.03], [0.014, -0.022], [0.016, -0.008], [0.012, 0.004]].map(([x, y]) => [x * size, y * size] as [number, number]),
    green,
    12,
  );
  const pistil = coloredSphere(0.012 * size, new THREE.Color('#c9c08a'), 0.03 * size, 1.8);
  return buildHeadGeometry({ states: [petalsAt(0), petalsAt(0.55), petalsAt(1)], extras: [cap, pistil] });
}
