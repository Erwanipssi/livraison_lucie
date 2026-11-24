import * as THREE from 'three';

/**
 * Ruban en tissu : bande plate à 3 colonnes (permet l'encoche en V des
 * extrémités). L'index est ordonné le long du ruban, ce qui permet de le
 * « rembobiner » simplement via drawRange (animation de dénouage).
 */
export function stripGeometry(
  points: THREE.Vector3[],
  widthDirs: THREE.Vector3[] | THREE.Vector3,
  widthAt: (t: number) => number,
  notch = 0,
): THREE.BufferGeometry {
  const n = points.length;
  const pos = new Float32Array(n * 3 * 3);
  const uv = new Float32Array(n * 3 * 2);
  const q = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = widthAt(t) / 2;
    const d = Array.isArray(widthDirs) ? widthDirs[i] : widthDirs;
    for (let c = 0; c < 3; c++) {
      q.copy(points[i]).addScaledVector(d, (c - 1) * w);
      if (notch && c === 1 && i === n - 1) {
        tan.subVectors(points[n - 1], points[n - 2]).normalize();
        q.addScaledVector(tan, -notch);
      }
      const k = (i * 3 + c) * 3;
      pos[k] = q.x;
      pos[k + 1] = q.y;
      pos[k + 2] = q.z;
      uv[(i * 3 + c) * 2] = c / 2;
      uv[(i * 3 + c) * 2 + 1] = t;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let c = 0; c < 2; c++) {
      const a = i * 3 + c, b = a + 1, c2 = (i + 1) * 3 + c, d2 = c2 + 1;
      index.push(a, c2, b, b, c2, d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Chemin polyligne aux coins arrondis, rééchantillonné uniformément. */
export function roundedPath(corners: THREE.Vector3[], radius: number, samples: number): THREE.Vector3[] {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cur = corners[0].clone();
  for (let i = 1; i < corners.length - 1; i++) {
    const p = corners[i];
    const din = p.clone().sub(corners[i - 1]).normalize();
    const dout = corners[i + 1].clone().sub(p).normalize();
    const r = Math.min(radius, p.distanceTo(corners[i - 1]) / 2, p.distanceTo(corners[i + 1]) / 2);
    const a = p.clone().addScaledVector(din, -r);
    const b = p.clone().addScaledVector(dout, r);
    if (cur.distanceTo(a) > 1e-5) path.add(new THREE.LineCurve3(cur, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    cur = b;
  }
  path.add(new THREE.LineCurve3(cur, corners[corners.length - 1].clone()));
  return path.getSpacedPoints(samples);
}

export interface BowOptions {
  knot: THREE.Vector3;
  /** Normale « vers le spectateur » (le haut pour un colis, l'avant pour un bouquet). */
  view: THREE.Vector3;
  loops: { dir: THREE.Vector3; length: number; height: number; lift: number }[];
  tails: { dir: THREE.Vector3; length: number; droop?: number; wave?: number }[];
  width: number;
  knotSize: number;
}

/** Nœud complet : boucles, pans à encoche en V et nœud central. */
export function buildBow(opts: BowOptions, material: THREE.Material) {
  const group = new THREE.Group();
  const loops: THREE.Mesh[] = [];
  const tails: THREE.Mesh[] = [];
  const V = opts.view.clone().normalize();

  for (const l of opts.loops) {
    const D = l.dir.clone().addScaledVector(V, -l.dir.dot(V)).normalize();
    const Dp = D.clone().multiplyScalar(Math.cos(l.lift)).addScaledVector(V, Math.sin(l.lift)).normalize();
    const N = V.clone().addScaledVector(Dp, -V.dot(Dp)).normalize();
    const W = new THREE.Vector3().crossVectors(Dp, N).normalize();
    const pts: THREE.Vector3[] = [];
    const dirs: THREE.Vector3[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * Math.PI * 2;
      const p = new THREE.Vector3()
        .addScaledVector(Dp, (l.length * (1 - Math.cos(a))) / 2)
        .addScaledVector(N, (l.height * Math.sin(a)) / 2);
      pts.push(p);
      // léger vrillage du satin
      const tw = Math.sin(a) * 0.18;
      dirs.push(W.clone().applyAxisAngle(Dp, tw));
    }
    const geo = stripGeometry(pts, dirs, (t) => opts.width * (0.42 + 0.58 * Math.pow(Math.sin(Math.PI * t), 0.45)));
    const m = new THREE.Mesh(geo, material);
    m.position.copy(opts.knot);
    m.castShadow = true;
    group.add(m);
    loops.push(m);
  }

  for (const tl of opts.tails) {
    const D = tl.dir.clone().normalize();
    const side = new THREE.Vector3().crossVectors(V, D);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const pts: THREE.Vector3[] = [];
    const dirs: THREE.Vector3[] = [];
    const steps = 30;
    const droop = tl.droop ?? 0.01;
    const wave = tl.wave ?? 0.012;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = new THREE.Vector3()
        .addScaledVector(D, tl.length * t)
        .addScaledVector(V, -droop * Math.min(1, t * 4) + Math.sin(t * Math.PI * 2.2) * wave * t)
        .addScaledVector(side, Math.sin(t * Math.PI * 1.4) * 0.025 * t);
      pts.push(p);
      dirs.push(side.clone().applyAxisAngle(D, (1 - t) * 0.5 + Math.sin(t * 5) * 0.12));
    }
    const geo = stripGeometry(pts, dirs, (t) => opts.width * (0.6 + 0.4 * Math.min(1, t * 5)), opts.width * 0.35);
    const m = new THREE.Mesh(geo, material);
    m.position.copy(opts.knot);
    m.castShadow = true;
    group.add(m);
    tails.push(m);
  }

  const k = opts.knotSize;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
  knot.scale.set(k * 0.62, k * 0.42, k * 0.52);
  knot.position.copy(opts.knot);
  knot.lookAt(opts.knot.clone().add(V));
  knot.castShadow = true;
  group.add(knot);

  return { group, loops, tails, knot };
}

export function satinMaterial(color: string) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.36,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.32,
    sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.55),
    clearcoat: 0.15,
    clearcoatRoughness: 0.5,
    side: THREE.DoubleSide,
  });
}
