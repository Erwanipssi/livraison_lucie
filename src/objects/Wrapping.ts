import * as THREE from 'three';
import { fbm3, Rng } from '../utils/math';
import { paperBump, wrapPaperTextures } from '../utils/textures';

export const NECK_Y = 0.34;
export const NECK_R = 0.058;

interface SheetSpec {
  center: number; // azimut central (0 = face caméra, +z)
  span: number;
  top: number; // hauteur du bord supérieur
  topVar: number;
  r1: number; // rayon en haut
  scale: number; // décalage radial (anti z-fighting)
  pleats: number;
  pleatAmp: number;
  crinkle: number;
  flare: number;
}

/**
 * Emballage floral : plusieurs feuilles de papier (ivoire à liseré doré et
 * papier de soie rosé froissé) resserrées au niveau du lien, évasées en
 * corolle au-dessus, avec plis, ondulation du bord et légère jupe en bas.
 */
export function createWrapping(colors: { outer: string; inner: string; foil: string }, shadows: boolean, seed = 7) {
  const group = new THREE.Group();
  const rng = new Rng(seed);
  const bump = paperBump(256, 13);
  bump.repeat.set(2, 3);

  const { map, orm } = wrapPaperTextures(colors.outer, colors.foil);
  const outerMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    roughnessMap: orm,
    metalnessMap: orm,
    roughness: 1,
    metalness: 1,
    bumpMap: bump,
    bumpScale: 0.25,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(colors.outer).multiplyScalar(0.3),
  });
  const tissueMat = new THREE.MeshStandardMaterial({
    color: colors.inner,
    roughness: 0.92,
    side: THREE.DoubleSide,
    bumpMap: bump,
    bumpScale: 0.4,
  });

  const outer: SheetSpec[] = [
    { center: Math.PI, span: 3.9, top: 1.42, topVar: 0.04, r1: 0.56, scale: 1.0, pleats: 5, pleatAmp: 0.045, crinkle: 0, flare: 0.06 },
    { center: Math.PI * 0.6, span: 3.4, top: 1.3, topVar: 0.035, r1: 0.55, scale: 1.03, pleats: 4, pleatAmp: 0.045, crinkle: 0, flare: 0.06 },
    { center: -Math.PI * 0.6, span: 3.4, top: 1.32, topVar: 0.035, r1: 0.55, scale: 1.06, pleats: 4, pleatAmp: 0.045, crinkle: 0, flare: 0.06 },
    { center: 0, span: 3.7, top: 1.06, topVar: 0.03, r1: 0.5, scale: 1.09, pleats: 4, pleatAmp: 0.04, crinkle: 0, flare: 0.07 },
  ];
  const tissue: SheetSpec[] = [
    { center: Math.PI * 0.85, span: 3.2, top: 1.36, topVar: 0.06, r1: 0.5, scale: 0.94, pleats: 7, pleatAmp: 0.06, crinkle: 0.05, flare: 0.1 },
    { center: -Math.PI * 0.4, span: 3.0, top: 1.24, topVar: 0.06, r1: 0.5, scale: 0.955, pleats: 7, pleatAmp: 0.06, crinkle: 0.05, flare: 0.12 },
    { center: Math.PI * 0.25, span: 2.6, top: 1.16, topVar: 0.06, r1: 0.48, scale: 0.97, pleats: 6, pleatAmp: 0.06, crinkle: 0.05, flare: 0.14 },
  ];

  const sheets: THREE.Mesh[] = [];
  const add = (spec: SheetSpec, mat: THREE.Material) => {
    const m = new THREE.Mesh(sheetGeometry(spec, rng.range(0, 100)), mat);
    m.castShadow = shadows;
    m.receiveShadow = false;
    group.add(m);
    sheets.push(m);
  };
  tissue.forEach((s) => add(s, tissueMat));
  outer.forEach((s) => add(s, outerMat));
  return { group, sheets };
}

function sheetGeometry(spec: SheetSpec, seed: number): THREE.BufferGeometry {
  const U = 34, V = 44;
  const y0 = 0.13;
  const pos = new Float32Array((U + 1) * (V + 1) * 3);
  const uv = new Float32Array((U + 1) * (V + 1) * 2);
  let k = 0, q = 0;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      // azimut : 0 = +z (face caméra)
      const az = spec.center + (v - 0.5) * spec.span;
      const top = spec.top + spec.topVar * Math.sin(v * 9.0 + seed) + 0.025 * Math.sin(v * 23 + seed * 2);
      const y = y0 + u * (top - y0);
      let r: number;
      if (y >= NECK_Y) {
        const t = (y - NECK_Y) / (top - NECK_Y);
        r = NECK_R + (spec.r1 - NECK_R) * Math.pow(t, 0.92) + spec.flare * Math.pow(t, 4);
      } else {
        const t = (NECK_Y - y) / (NECK_Y - y0);
        r = NECK_R + 0.05 * Math.pow(t, 1.4);
      }
      const above = Math.max(0, (y - NECK_Y) / (top - NECK_Y));
      r *= spec.scale;
      r *= 1 + spec.pleatAmp * Math.sin(v * spec.pleats * Math.PI * 2 + seed) * (0.3 + above);
      r += spec.crinkle * (fbm3(v * 9 + seed, u * 7, seed, 3) - 0.5) * (0.2 + above);
      // les bords libres de la feuille se décollent légèrement
      const edge = Math.min(v, 1 - v);
      r += (1 - Math.min(1, edge * 8)) * 0.02 * above;
      pos[k++] = Math.sin(az) * r;
      pos[k++] = y;
      pos[k++] = Math.cos(az) * r;
      uv[q++] = v;
      uv[q++] = u;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j, b = a + 1, c = a + V + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
