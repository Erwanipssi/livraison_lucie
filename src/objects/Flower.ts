import * as THREE from 'three';
import { clamp } from '../utils/math';

/**
 * Moteur de pétales procéduraux.
 *
 * Chaque pétale est une surface paramétrique (u le long du pétale, s en
 * travers). Sa nervure centrale est intégrée à partir d'un angle qui varie le
 * long du pétale (inclinaison + enroulement), puis la surface est « cintrée »
 * autour de l'axe de la fleur (cup) ou laissée plate, avec bords retournés et
 * ondulations. Une fleur est décrite par une fonction bloom → pétales : on en
 * dérive plusieurs états (bouton, mi-ouvert, éclos) stockés en morph targets.
 */
export interface PetalParams {
  angle: number;
  length: number;
  width: number;
  baseRadius: number;
  baseY: number;
  tilt: number;
  curl: number;
  curlPow: number;
  cup: number;
  roll: number;
  wave: number;
  tipRound: number;
  profile: (u: number) => number;
  seed: number;
  /** couleur d'un sommet (u, s) → écrit dans out */
  color: (u: number, s: number, out: THREE.Color) => void;
}

export const PETAL_U = 12;
export const PETAL_S = 12;

export function petalVertex(p: PetalParams, u: number, s: number, out: THREE.Vector3) {
  const ue = u * (1 - p.tipRound * s * s);
  const steps = 14;
  let r = p.baseRadius;
  let y = p.baseY;
  const du = ue / steps;
  for (let i = 0; i < steps; i++) {
    const uu = (i + 0.5) * du;
    const th = p.tilt + p.curl * Math.pow(uu, p.curlPow);
    r += Math.sin(th) * p.length * du;
    y += Math.cos(th) * p.length * du;
  }
  const th = p.tilt + p.curl * Math.pow(ue, p.curlPow);
  const hw = p.width * p.profile(ue) * s;
  const rr = Math.max(Math.abs(r), 0.0035);
  const da = clamp(hw / rr, -2.9, 2.9);
  const a = p.angle;
  const ca = Math.cos(a), sa = Math.sin(a);
  // version cintrée (autour de l'axe) et version plate
  const cx = Math.cos(a + da) * r, cz = Math.sin(a + da) * r;
  const fx = ca * r - sa * hw, fz = sa * r + ca * hw;
  let x = fx + (cx - fx) * p.cup;
  let z = fz + (cz - fz) * p.cup;
  // bords retournés + ondulation, le long de la normale extérieure
  const as = Math.abs(s);
  const off =
    p.roll * as * as * as * Math.pow(ue, 1.5) * p.width +
    p.wave * Math.sin(s * 5.3 + p.seed) * ue * ue * p.width;
  const ra = a + da * p.cup;
  const nr = Math.cos(th), ny = -Math.sin(th);
  x += Math.cos(ra) * nr * off;
  z += Math.sin(ra) * nr * off;
  y += ny * off;
  out.set(x, y, z);
}

interface HeadBuild {
  /** pour chaque état, la liste de pétales */
  states: PetalParams[][];
  /** géométries statiques ajoutées (cœur, réceptacle…) avec attribut color */
  extras?: THREE.BufferGeometry[];
}

/**
 * Construit la géométrie d'une tête de fleur : position = état 0,
 * morph targets = états suivants (relatifs = false).
 */
export function buildHeadGeometry(build: HeadBuild): THREE.BufferGeometry {
  const petalsCount = build.states[0].length;
  const vPerPetal = (PETAL_U + 1) * (PETAL_S + 1);
  const extras = build.extras ?? [];
  const extraVerts = extras.reduce((n, g) => n + g.attributes.position.count, 0);
  const total = petalsCount * vPerPetal + extraVerts;

  const index: number[] = [];
  for (let p = 0; p < petalsCount; p++) {
    const o = p * vPerPetal;
    for (let i = 0; i < PETAL_U; i++) {
      for (let j = 0; j < PETAL_S; j++) {
        const a = o + i * (PETAL_S + 1) + j;
        const b = a + 1;
        const c = a + PETAL_S + 1;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
  }
  let off = petalsCount * vPerPetal;
  for (const g of extras) {
    const idx = g.index!;
    for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + off);
    off += g.attributes.position.count;
  }

  const colors = new Float32Array(total * 3);
  const col = new THREE.Color();
  const v = new THREE.Vector3();

  const statePositions: Float32Array[] = [];
  const stateNormals: Float32Array[] = [];
  build.states.forEach((petals, si) => {
    const pos = new Float32Array(total * 3);
    let k = 0;
    for (const p of petals) {
      for (let i = 0; i <= PETAL_U; i++) {
        const u = i / PETAL_U;
        for (let j = 0; j <= PETAL_S; j++) {
          const s = (j / PETAL_S) * 2 - 1;
          petalVertex(p, u, s, v);
          pos[k * 3] = v.x;
          pos[k * 3 + 1] = v.y;
          pos[k * 3 + 2] = v.z;
          if (si === 0) {
            p.color(u, s, col);
            colors[k * 3] = col.r;
            colors[k * 3 + 1] = col.g;
            colors[k * 3 + 2] = col.b;
          }
          k++;
        }
      }
    }
    for (const g of extras) {
      const gp = g.attributes.position as THREE.BufferAttribute;
      const gc = g.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < gp.count; i++) {
        pos[k * 3] = gp.getX(i);
        pos[k * 3 + 1] = gp.getY(i);
        pos[k * 3 + 2] = gp.getZ(i);
        if (si === 0) {
          colors[k * 3] = gc.getX(i);
          colors[k * 3 + 1] = gc.getY(i);
          colors[k * 3 + 2] = gc.getZ(i);
        }
        k++;
      }
    }
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tmp.setIndex(index);
    tmp.computeVertexNormals();
    statePositions.push(pos);
    stateNormals.push((tmp.attributes.normal as THREE.BufferAttribute).array as Float32Array);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(statePositions[0], 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(stateNormals[0], 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  if (statePositions.length > 1) {
    geo.morphAttributes.position = statePositions.slice(1).map((a) => new THREE.BufferAttribute(a, 3));
    geo.morphAttributes.normal = stateNormals.slice(1).map((a) => new THREE.BufferAttribute(a, 3));
    geo.morphTargetsRelative = false;
  }
  // sphère englobante couvrant tous les états (culling + raycast fiables)
  let maxR = 0;
  for (const arr of statePositions) {
    for (let i = 0; i < arr.length; i += 3) maxR = Math.max(maxR, Math.hypot(arr[i], arr[i + 1], arr[i + 2]));
  }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxR);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-maxR, -maxR, -maxR), new THREE.Vector3(maxR, maxR, maxR));
  return geo;
}

/** Applique un « bloom » 0→1 sur une tête à 3 états (bouton / mi-ouvert / éclos). */
export function applyBloom(mesh: THREE.Mesh, b: number) {
  const inf = mesh.morphTargetInfluences;
  if (!inf || inf.length < 2) return;
  const x = clamp(b, 0, 1);
  if (x < 0.5) {
    inf[0] = x * 2;
    inf[1] = 0;
  } else {
    inf[0] = 1 - (x - 0.5) * 2;
    inf[1] = (x - 0.5) * 2;
  }
}

/** Lathe coloré (réceptacle, cœur…) utilisable comme extra. */
export function coloredLathe(points: [number, number][], color: THREE.Color, segments = 16, tint?: (y: number) => THREE.Color) {
  const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const cc = tint ? tint(g.attributes.position.getY(i)) : color;
    c[i * 3] = cc.r;
    c[i * 3 + 1] = cc.g;
    c[i * 3 + 2] = cc.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function coloredSphere(radius: number, color: THREE.Color, y = 0, squash = 1) {
  const g = new THREE.SphereGeometry(radius, 12, 8);
  g.scale(1, squash, 1);
  g.translate(0, y, 0);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Matériau velouté commun aux pétales. */
export function petalMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.6,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#fff0f0'),
    side: THREE.DoubleSide,
  });
}

/** Petites variations de teinte. */
export function paletteFrom(hex: string, jitter: number, rnd: () => number) {
  const base = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  base.setHSL(hsl.h + (rnd() - 0.5) * 0.02 * jitter, clamp(hsl.s + (rnd() - 0.5) * 0.1 * jitter), clamp(hsl.l + (rnd() - 0.5) * 0.06 * jitter));
  const deep = base.clone().offsetHSL(0.005, 0.06, -0.14);
  const light = base.clone().lerp(new THREE.Color('#fff6ef'), 0.45);
  return { base, deep, light };
}
