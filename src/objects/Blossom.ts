import * as THREE from 'three';
import { buildHeadGeometry, coloredSphere, type PetalParams } from './Flower';
import { smoothstep } from '../utils/math';

const blossomProfile = (u: number) => Math.pow(Math.sin(Math.PI * (0.12 + 0.78 * u)), 0.55);

/** Petite fleur décorative à 5 pétales (type fleur de cire). Couleur via instanceColor. */
export function createBlossomGeometry(): THREE.BufferGeometry {
  const white = new THREE.Color('#ffffff');
  const base = new THREE.Color('#f3e6d6');
  const petals: PetalParams[] = [];
  for (let k = 0; k < 5; k++) {
    petals.push({
      angle: (k / 5) * Math.PI * 2,
      length: 0.03,
      width: 0.017,
      baseRadius: 0.003,
      baseY: 0,
      tilt: 1.25,
      curl: 0.35,
      curlPow: 1.5,
      cup: 0.35,
      roll: 0.2,
      wave: 0.05,
      tipRound: 0.45,
      profile: blossomProfile,
      seed: k,
      color: (u, _s, c) => c.copy(base).lerp(white, smoothstep(0, 0.5, u)),
    });
  }
  const heart = coloredSphere(0.0075, new THREE.Color('#cfa84f'), 0.004, 0.7);
  return buildHeadGeometry({ states: [petals], extras: [heart] });
}

/** Un pétale isolé (pour les pétales flottants). */
export function createLoosePetalGeometry(): THREE.BufferGeometry {
  const white = new THREE.Color('#ffffff');
  const tint = new THREE.Color('#f3dcd8');
  const p: PetalParams = {
    angle: 0,
    length: 0.075,
    width: 0.04,
    baseRadius: 0.035,
    baseY: 0,
    tilt: 0.6,
    curl: 0.55,
    curlPow: 1.6,
    cup: 0.55,
    roll: 0.6,
    wave: 0.08,
    tipRound: 0.25,
    profile: (u) => (0.3 + 0.7 * Math.sin(Math.min(u * 1.6, 1) * Math.PI * 0.5)) * (1 - 0.2 * u ** 4),
    seed: 2,
    color: (u, _s, c) => c.copy(tint).lerp(white, u),
  };
  const g = buildHeadGeometry({ states: [[p]] });
  g.center();
  g.computeBoundingSphere();
  return g;
}
