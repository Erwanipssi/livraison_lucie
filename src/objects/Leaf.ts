import * as THREE from 'three';
import { smoothstep } from '../utils/math';

export type LeafKind = 'rose' | 'strap' | 'round' | 'ruscus';

interface LeafSpec {
  length: number;
  width: number;
  profile: (u: number) => number;
  bend: number;
  fold: number;
  wave: number;
  serrate: number;
  dark: string;
  light: string;
  rib: string;
}

const SPECS: Record<LeafKind, LeafSpec> = {
  rose: {
    length: 0.13, width: 0.05, bend: 0.25, fold: 0.28, wave: 0.05, serrate: 0.07,
    profile: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.75) * (1 - 0.15 * u),
    dark: '#33512f', light: '#5f7f47', rib: '#8aa66b',
  },
  strap: {
    length: 0.42, width: 0.036, bend: 0.55, fold: 0.42, wave: 0.03, serrate: 0,
    profile: (u) => Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * u)), 0.35) * (1 - 0.35 * u),
    dark: '#56764f', light: '#86a27a', rib: '#a5bb92',
  },
  round: {
    length: 0.072, width: 0.064, bend: 0.12, fold: 0.1, wave: 0.03, serrate: 0,
    profile: (u) => Math.pow(Math.sin(Math.PI * u), 0.62),
    dark: '#7e968a', light: '#b3c4b5', rib: '#c6d3c5',
  },
  ruscus: {
    length: 0.24, width: 0.05, bend: 0.38, fold: 0.18, wave: 0.04, serrate: 0,
    profile: (u) => Math.pow(Math.sin(Math.PI * u), 0.85) * (1 - 0.2 * u),
    dark: '#2f4c2c', light: '#557547', rib: '#7c9a63',
  },
};

const U = 14;
const S = 6;

function leafPositions(spec: LeafSpec, closed: number, seed: number): Float32Array {
  const pos = new Float32Array((U + 1) * (S + 1) * 3);
  let k = 0;
  const L = spec.length * (1 - closed * 0.45);
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const w0 = spec.width * spec.profile(u);
    for (let j = 0; j <= S; j++) {
      const s = (j / S) * 2 - 1;
      const as = Math.abs(s);
      const w = spec.serrate && as > 0.99 ? w0 * (1 - spec.serrate * Math.abs(((u * 11) % 1) - 0.5) * 2) : w0;
      const fold = spec.fold + closed * 1.1;
      const x = s * w * (1 - closed * 0.8);
      // courbure le long + pli de la nervure + ondulation des bords
      const bendA = (spec.bend + closed * 0.9) * u;
      const y = L * u * Math.cos(bendA * 0.6);
      let z = -L * u * Math.sin(bendA * 0.6) + as * w * fold + Math.sin(u * 13 + seed) * spec.wave * as * w;
      // vrille douce
      const tw = u * 0.25 * Math.sin(seed);
      const xr = x * Math.cos(tw) - z * Math.sin(tw);
      z = x * Math.sin(tw) + z * Math.cos(tw);
      pos[k++] = xr;
      pos[k++] = y;
      pos[k++] = z;
    }
  }
  return pos;
}

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Feuille procédurale (surface paramétrique) avec morph target « repliée »
 * pour l'animation de déploiement. Couleurs : nervure claire, pointe foncée.
 */
export function createLeafGeometry(kind: LeafKind, variant = 0): THREE.BufferGeometry {
  const key = `${kind}-${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spec = SPECS[kind];
  const seed = variant * 2.3 + 1;
  const open = leafPositions(spec, 0, seed);
  const closed = leafPositions(spec, 1, seed);

  const index: number[] = [];
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const colors = new Float32Array(open.length);
  const dark = new THREE.Color(spec.dark), light = new THREE.Color(spec.light), rib = new THREE.Color(spec.rib);
  const c = new THREE.Color();
  let k = 0;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= S; j++) {
      const s = (j / S) * 2 - 1;
      c.copy(light).lerp(dark, smoothstep(0.1, 1, u) * 0.75);
      c.lerp(rib, (1 - smoothstep(0, 0.34, Math.abs(s))) * 0.6);
      colors[k++] = c.r;
      colors[k++] = c.g;
      colors[k++] = c.b;
    }
  }
  const normalsOf = (p: Float32Array) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g.attributes.normal as THREE.BufferAttribute;
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(open, 3));
  geo.setAttribute('normal', normalsOf(open));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.morphAttributes.position = [new THREE.BufferAttribute(closed, 3)];
  geo.morphAttributes.normal = [normalsOf(closed)];
  geo.computeBoundingSphere();
  cache.set(key, geo);
  return geo;
}

export function clearLeafCache() {
  cache.forEach((g) => g.dispose());
  cache.clear();
}

export function leafMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}
