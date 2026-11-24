import * as THREE from 'three';
import { gsap } from 'gsap';
import type { AppConfig, FlowerKind } from '../config';
import { disposeObject } from '../utils/dispose';
import { clamp, Rng } from '../utils/math';
import { createBlossomGeometry } from './Blossom';
import { Envelope } from './Envelope';
import { applyBloom, petalMaterial } from './Flower';
import { createLeafGeometry, leafMaterial, type LeafKind } from './Leaf';
import { buildBow, satinMaterial, stripGeometry } from './Ribbon';
import { createRoseGeometry } from './Rose';
import { createTulipGeometry } from './Tulip';
import { createWrapping, NECK_R, NECK_Y } from './Wrapping';

const DOME_C = new THREE.Vector3(0, 0.98, 0);
const DOME_R = 0.62;
const PIVOT = new THREE.Vector3(0, NECK_Y, 0);
const STEM_SEG = 48;
const STEM_RAD = 6;

export interface LeafItem {
  mesh: THREE.Mesh;
  open: number;
  base: number;
}

export interface FlowerItem {
  kind: FlowerKind;
  group: THREE.Group;
  stem: THREE.Mesh;
  headAnchor: THREE.Group;
  wobble: THREE.Group;
  head: THREE.Mesh;
  proxy: THREE.Mesh;
  leaves: LeafItem[];
  grow: number;
  headScale: number;
  bloom: number;
  phase: number;
  order: number;
  busy: boolean;
}

interface CrownItem {
  group: THREE.Group;
  stem: THREE.Mesh;
  crown: THREE.Group;
  grow: number;
  pop: number;
  phase: number;
  order: number;
}

interface SprigItem {
  group: THREE.Group;
  stem: THREE.Mesh;
  leaves: THREE.InstancedMesh;
  base: THREE.Matrix4[];
  ts: number[];
  grow: number;
  phase: number;
}

const dirFrom = (polar: number, az: number) =>
  new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));

/** Quaternion orientant +Y vers `dir`, avec une rotation propre `spin`. */
function orient(dir: THREE.Vector3, spin: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
}

/** Matrice de base pour une feuille : +Y le long de la feuille, +Z face visible vers `face`. */
function leafBasis(along: THREE.Vector3, face: THREE.Vector3) {
  const Y = along.clone().normalize();
  const X = new THREE.Vector3().crossVectors(Y, face);
  if (X.lengthSq() < 1e-5) X.set(1, 0, 0);
  X.normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

export class Bouquet {
  readonly root = new THREE.Group();
  readonly spin = new THREE.Group();
  readonly content = new THREE.Group();
  readonly flowers: FlowerItem[] = [];
  readonly crowns: CrownItem[] = [];
  readonly sprigs: SprigItem[] = [];
  readonly foliage: { group: THREE.Group; leaves: LeafItem[]; phase: number }[] = [];
  readonly envelope: Envelope;
  readonly proxies: THREE.Mesh[] = [];
  readonly petalColors: string[];
  sway = 1;
  private rng: Rng;
  private stemMat = new THREE.MeshStandardMaterial({ color: '#58733f', roughness: 0.62 });
  private leafMat = leafMaterial();
  private petalMat = petalMaterial();

  constructor(private cfg: AppConfig, private shadows: boolean) {
    this.rng = new Rng(cfg.bouquet.seed);
    this.root.add(this.spin);
    this.spin.add(this.content);

    const wrap = createWrapping(cfg.bouquet.wrapping, shadows, cfg.bouquet.seed);
    this.content.add(wrap.group);
    this.buildTie();

    // ── Enveloppe glissée dans le bouquet ────────────────────────────────
    const envDir = dirFrom(0.95, 0.42);
    this.envelope = new Envelope(cfg, shadows);
    const envPos = DOME_C.clone().addScaledVector(envDir, DOME_R + 0.08);
    envPos.y -= 0.05;
    this.envelope.root.position.copy(envPos);
    const outward = new THREE.Vector3(envDir.x, envDir.y * 0.35, envDir.z).normalize();
    this.envelope.root.lookAt(envPos.clone().add(outward));
    this.envelope.root.rotateZ(-0.24);
    this.envelope.saveHome();
    this.content.add(this.envelope.root);

    // ── Têtes principales ────────────────────────────────────────────────
    const kinds: { kind: FlowerKind; color: string }[] = [];
    for (const g of cfg.bouquet.flowers) {
      for (let i = 0; i < g.count; i++) kinds.push({ kind: g.kind, color: this.rng.pick(g.colors) });
    }
    this.rng.shuffle(kinds);
    // une rose au sommet si possible
    const firstRose = kinds.findIndex((k) => k.kind === 'rose');
    if (firstRose > 0) [kinds[0], kinds[firstRose]] = [kinds[firstRose], kinds[0]];
    this.petalColors = cfg.bouquet.flowers.flatMap((g) => g.colors);

    const placed: THREE.Vector3[] = [];
    const avoid = [envDir];
    const heads = this.scatter(kinds.length, 0.34, 1.12, placed, avoid, 0.5, true);
    heads.forEach((dir, i) => this.addFlower(kinds[i].kind, kinds[i].color, dir, i));

    // ── Remplissage : petites fleurs & gypsophile ────────────────────────
    const fillers = this.scatter(cfg.bouquet.blossomClusters + cfg.bouquet.gypsophila, 0.17, 1.18, placed, avoid, 0.32, false);
    fillers.forEach((dir, i) => {
      if (i < cfg.bouquet.blossomClusters) this.addBlossomCluster(dir, i);
      else this.addGypsophila(dir, i);
    });

    // ── Eucalyptus & feuillage en couronne ───────────────────────────────
    const nE = cfg.bouquet.eucalyptus;
    for (let i = 0; i < nE; i++) {
      const az = (i / nE) * Math.PI * 2 + 0.35 + this.rng.range(-0.2, 0.2);
      if (Math.abs(Math.atan2(Math.sin(az - 0.42), Math.cos(az - 0.42))) < 0.35) continue;
      this.addEucalyptus(az, this.rng.range(1.0, 1.2), i);
    }
    const nF = cfg.bouquet.foliage;
    for (let i = 0; i < nF; i++) {
      const az = (i / nF) * Math.PI * 2 + this.rng.range(-0.15, 0.15);
      if (Math.abs(Math.atan2(Math.sin(az - 0.42), Math.cos(az - 0.42))) < 0.3) continue;
      this.addFoliage(az, i);
    }

    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== this.envelope.proxy && !this.proxies.includes(m)) {
        m.castShadow = shadows && !(o as THREE.InstancedMesh).isInstancedMesh;
        m.receiveShadow = shadows;
      }
    });
  }

  /** Répartition sur la coupole par échantillonnage de Poisson glouton. */
  private scatter(n: number, minAngle: number, maxPolar: number, placed: THREE.Vector3[], avoid: THREE.Vector3[], avoidAngle: number, top: boolean) {
    const out: THREE.Vector3[] = [];
    let min = minAngle;
    let tries = 0;
    if (top) {
      const d = dirFrom(0.05, this.rng.range(0, 6));
      out.push(d);
      placed.push(d);
    }
    while (out.length < n && tries < 6000) {
      tries++;
      if (tries % 900 === 0) min *= 0.9;
      const cosMax = Math.cos(maxPolar);
      const z = 1 - this.rng.next() * (1 - cosMax);
      const polar = Math.acos(z);
      const d = dirFrom(polar, this.rng.range(0, Math.PI * 2));
      if (placed.some((p) => p.angleTo(d) < min)) continue;
      if (avoid.some((p) => p.angleTo(d) < avoidAngle)) continue;
      out.push(d);
      placed.push(d);
    }
    return out;
  }

  private stemCurve(head: THREE.Vector3) {
    const j = new THREE.Vector3(this.rng.range(-1, 1), 0, this.rng.range(-1, 1)).multiplyScalar(0.035);
    const bottom = new THREE.Vector3(j.x, 0.02 + this.rng.range(0, 0.04), j.z);
    const tie = new THREE.Vector3(j.x * 0.5, NECK_Y, j.z * 0.5);
    const mid = tie.clone().lerp(head, 0.55);
    const out = new THREE.Vector3(head.x, 0, head.z).normalize().multiplyScalar(0.035);
    mid.add(out);
    return new THREE.CatmullRomCurve3([bottom, tie, mid, head], false, 'centripetal');
  }

  private makeStem(curve: THREE.Curve<THREE.Vector3>, radius: number) {
    const geo = new THREE.TubeGeometry(curve, STEM_SEG, radius, STEM_RAD, false);
    geo.translate(-PIVOT.x, -PIVOT.y, -PIVOT.z);
    const stem = new THREE.Mesh(geo, this.stemMat);
    return stem;
  }

  private addFlower(kind: FlowerKind, color: string, dir: THREE.Vector3, order: number) {
    const isTulip = kind === 'tulip';
    const size = isTulip ? this.rng.range(1.12, 1.24) : this.rng.range(1.1, 1.36);
    const radius = DOME_R + (isTulip ? 0.07 : 0) + this.rng.range(-0.03, 0.03);
    const head = DOME_C.clone().addScaledVector(dir, radius);
    const axis = dir.clone().add(new THREE.Vector3(0, isTulip ? 0.9 : 0.45, 0)).normalize();
    const group = new THREE.Group();
    group.position.copy(PIVOT);

    const curve = this.stemCurve(head);
    const stem = this.makeStem(curve, isTulip ? 0.013 : 0.0105);
    group.add(stem);

    const geo = isTulip ? createTulipGeometry(this.rng, color, size) : createRoseGeometry(this.rng, color, size);
    const headMesh = new THREE.Mesh(geo, this.petalMat);
    const headAnchor = new THREE.Group();
    headAnchor.position.copy(head).sub(PIVOT);
    headAnchor.quaternion.copy(orient(axis, this.rng.range(0, Math.PI * 2)));
    const wobble = new THREE.Group();
    wobble.add(headMesh);
    headAnchor.add(wobble);
    group.add(headAnchor);

    const proxy = new THREE.Mesh(new THREE.SphereGeometry(isTulip ? 0.13 : 0.17, 8, 6), new THREE.MeshBasicMaterial());
    proxy.visible = false;
    proxy.position.y = 0.05;
    headAnchor.add(proxy);
    this.proxies.push(proxy);

    // feuilles le long de la tige
    const leaves: LeafItem[] = [];
    const nLeaves = isTulip ? 1 : this.rng.int(1, 2);
    for (let i = 0; i < nLeaves; i++) {
      const t = isTulip ? 0.62 : this.rng.range(0.66, 0.84);
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const outward = new THREE.Vector3(p.x, 0, p.z);
      if (outward.lengthSq() < 1e-4) outward.set(1, 0, 0);
      outward.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(-0.9, 0.9));
      const along = isTulip ? tan.clone().multiplyScalar(1.2).add(outward.clone().multiplyScalar(0.5)) : outward.clone().add(tan.clone().multiplyScalar(0.6));
      const kindL: LeafKind = isTulip ? 'strap' : 'rose';
      const mesh = new THREE.Mesh(createLeafGeometry(kindL, this.rng.int(0, 2)), this.leafMat);
      mesh.position.copy(p).sub(PIVOT);
      mesh.quaternion.copy(leafBasis(along, new THREE.Vector3(0, 1, 0).add(outward)));
      const base = isTulip ? this.rng.range(0.8, 1) : this.rng.range(0.9, 1.25);
      mesh.scale.setScalar(0.0001);
      group.add(mesh);
      leaves.push({ mesh, open: 0, base });
    }

    this.content.add(group);
    const item: FlowerItem = {
      kind, group, stem, headAnchor, wobble, head: headMesh, proxy, leaves,
      grow: 0, headScale: 0, bloom: 0, phase: this.rng.range(0, 10), order, busy: false,
    };
    proxy.userData.flower = item;
    this.flowers.push(item);
  }

  private addCrownBase(dir: THREE.Vector3, order: number, radius: number) {
    const tip = DOME_C.clone().addScaledVector(dir, DOME_R + radius);
    const group = new THREE.Group();
    group.position.copy(PIVOT);
    const curve = this.stemCurve(tip);
    const stem = this.makeStem(curve, 0.0055);
    group.add(stem);
    const crown = new THREE.Group();
    crown.position.copy(tip).sub(PIVOT);
    crown.quaternion.copy(orient(dir.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize(), this.rng.range(0, 6)));
    crown.scale.setScalar(0.0001);
    group.add(crown);
    this.content.add(group);
    const item: CrownItem = { group, stem, crown, grow: 0, pop: 0, phase: this.rng.range(0, 10), order };
    this.crowns.push(item);
    return item;
  }

  private addBlossomCluster(dir: THREE.Vector3, order: number) {
    const item = this.addCrownBase(dir, order, 0.02);
    const n = this.rng.int(5, 8);
    const branches: THREE.BufferGeometry[] = [];
    const tips: THREE.Vector3[] = [new THREE.Vector3(0, 0.012, 0)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const end = new THREE.Vector3(Math.cos(a) * 0.07, this.rng.range(0.0, 0.05), Math.sin(a) * 0.07);
      const mid = end.clone().multiplyScalar(0.5);
      mid.y -= 0.012;
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.02, 0), mid, end);
      branches.push(new THREE.TubeGeometry(c, 8, 0.0025, 4, false));
      tips.push(end);
    }
    const mergedStems = mergeTubes(branches);
    item.crown.add(new THREE.Mesh(mergedStems, this.stemMat));
    const geo = this.blossomGeo ?? (this.blossomGeo = createBlossomGeometry());
    const inst = new THREE.InstancedMesh(geo, this.petalMat, tips.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    tips.forEach((p, i) => {
      const q = orient(p.clone().add(new THREE.Vector3(0, 0.08, 0)).normalize(), this.rng.range(0, 6));
      m.compose(p, q, new THREE.Vector3().setScalar(this.rng.range(0.85, 1.2)));
      inst.setMatrixAt(i, m);
      col.set(this.rng.pick(this.cfg.bouquet.blossomColors));
      inst.setColorAt(i, col);
    });
    inst.computeBoundingSphere();
    item.crown.add(inst);
  }
  private blossomGeo?: THREE.BufferGeometry;
  private roundLeaf: THREE.BufferGeometry[] = [];
  private floretGeo?: THREE.BufferGeometry;
  private floretMat = new THREE.MeshStandardMaterial({ color: '#fffaf3', roughness: 0.9, emissive: new THREE.Color('#3a3330') });
  private twigMat = new THREE.LineBasicMaterial({ color: '#9aae86', transparent: true, opacity: 0.9 });

  private addGypsophila(dir: THREE.Vector3, order: number) {
    const item = this.addCrownBase(dir, order, 0.05);
    const seg: number[] = [];
    const florets: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const e1 = new THREE.Vector3(Math.cos(a) * 0.06, this.rng.range(0.02, 0.07), Math.sin(a) * 0.06);
      seg.push(0, -0.03, 0, e1.x, e1.y, e1.z);
      for (let k = 0; k < 4; k++) {
        const b = a + this.rng.range(-0.9, 0.9);
        const e2 = e1.clone().add(new THREE.Vector3(Math.cos(b) * 0.04, this.rng.range(0.0, 0.04), Math.sin(b) * 0.04));
        seg.push(e1.x, e1.y, e1.z, e2.x, e2.y, e2.z);
        florets.push(e2);
        for (let f = 0; f < 4; f++) {
          florets.push(e2.clone().add(new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-0.3, 1), this.rng.range(-1, 1)).multiplyScalar(0.016)));
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    item.crown.add(new THREE.LineSegments(lg, this.twigMat));
    const geo = this.floretGeo ?? (this.floretGeo = new THREE.SphereGeometry(0.0052, 7, 5));
    const inst = new THREE.InstancedMesh(geo, this.floretMat, florets.length);
    const m = new THREE.Matrix4();
    florets.forEach((p, i) => {
      m.compose(p, new THREE.Quaternion().random(), new THREE.Vector3().setScalar(this.rng.range(0.7, 1.3)));
      inst.setMatrixAt(i, m);
    });
    inst.computeBoundingSphere();
    item.crown.add(inst);
  }

  private addEucalyptus(az: number, polar: number, i: number) {
    const dir = dirFrom(polar, az);
    const group = new THREE.Group();
    group.position.copy(PIVOT);
    const start = DOME_C.clone().addScaledVector(dir, 0.15);
    start.y -= 0.2;
    const end = DOME_C.clone().addScaledVector(dir, DOME_R + this.rng.range(0.24, 0.34));
    end.y += this.rng.range(0.05, 0.18);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.08;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geo = new THREE.TubeGeometry(curve, 32, 0.0045, 5, false);
    geo.translate(-PIVOT.x, -PIVOT.y, -PIVOT.z);
    const stem = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7d8f74', roughness: 0.7 }));
    group.add(stem);

    const ts: number[] = [];
    const base: THREE.Matrix4[] = [];
    const pairs = 6;
    const variant = i % 2;
    let leafGeo = this.roundLeaf[variant];
    if (!leafGeo) {
      // version sans morph targets pour l'instanciation
      leafGeo = createLeafGeometry('round', variant).clone();
      leafGeo.morphAttributes = {};
      this.roundLeaf[variant] = leafGeo;
    }
    const inst = new THREE.InstancedMesh(leafGeo, this.leafMat, pairs * 2);
    for (let k = 0; k < pairs; k++) {
      const t = 0.3 + (k / (pairs - 1)) * 0.68;
      const p = curve.getPointAt(t).sub(PIVOT);
      const tan = curve.getTangentAt(t);
      const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0));
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      for (const sgn of [-1, 1]) {
        const along = side.clone().multiplyScalar(sgn).addScaledVector(tan, 0.55);
        const q = leafBasis(along, new THREE.Vector3(0, 1, 0).addScaledVector(dir, 0.6));
        const s = (1.15 - t * 0.5) * this.rng.range(0.85, 1.1);
        base.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)));
        ts.push(t);
      }
    }
    group.add(inst);
    this.content.add(group);
    this.sprigs.push({ group, stem, leaves: inst, base, ts, grow: 0, phase: this.rng.range(0, 10) });
  }

  private addFoliage(az: number, i: number) {
    const polar = this.rng.range(1.08, 1.28);
    const dir = dirFrom(polar, az);
    const group = new THREE.Group();
    group.position.copy(PIVOT);
    const leaves: LeafItem[] = [];
    const anchor = DOME_C.clone().addScaledVector(dir, DOME_R * 0.92).sub(PIVOT);
    anchor.y -= 0.06;
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.Mesh(createLeafGeometry('ruscus', (i + k) % 3), this.leafMat);
      const along = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (k - 1) * 0.35);
      along.y += 0.15 + k * 0.08;
      mesh.position.copy(anchor);
      mesh.quaternion.copy(leafBasis(along, new THREE.Vector3(0, 1, 0)));
      mesh.scale.setScalar(0.0001);
      group.add(mesh);
      leaves.push({ mesh, open: 0, base: this.rng.range(0.85, 1.15) });
    }
    this.content.add(group);
    this.foliage.push({ group, leaves, phase: this.rng.range(0, 10) });
  }

  private buildTie() {
    const mat = satinMaterial(this.cfg.bouquet.ribbon);
    const r = NECK_R + 0.012;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * r, NECK_Y, Math.cos(a) * r));
    }
    const band = new THREE.Mesh(stripGeometry(pts, new THREE.Vector3(0, 1, 0), () => 0.05), mat);
    this.content.add(band);
    const knot = new THREE.Vector3(0, NECK_Y, r + 0.012);
    const fwd = new THREE.Vector3(0, 0, 1);
    const bow = buildBow(
      {
        knot,
        view: fwd,
        width: 0.05,
        knotSize: 0.05,
        loops: [
          { dir: new THREE.Vector3(1, 0.25, 0), length: 0.17, height: 0.05, lift: 0.3 },
          { dir: new THREE.Vector3(-1, 0.2, 0), length: 0.16, height: 0.05, lift: 0.32 },
        ],
        tails: [
          { dir: new THREE.Vector3(0.3, -1, 0.1), length: 0.32, droop: 0.0, wave: 0.02 },
          { dir: new THREE.Vector3(-0.25, -1, 0.05), length: 0.36, droop: 0.0, wave: 0.02 },
        ],
      },
      mat,
    );
    this.content.add(bow.group);
  }

  /** Animation délicate au toucher d'une fleur. */
  touch(item: FlowerItem, onPeak?: (pos: THREE.Vector3) => void) {
    if (item.busy || item.headScale < 0.95) return;
    item.busy = true;
    const w = item.wobble;
    const tl = gsap.timeline({
      onComplete: () => {
        item.busy = false;
      },
    });
    tl.to(item, { bloom: 0.78, duration: 0.35, ease: 'power2.out' }, 0)
      .to(w.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.35, ease: 'power2.out' }, 0)
      .to(w.rotation, { y: w.rotation.y + Math.PI * 0.35, duration: 1.4, ease: 'power3.out' }, 0)
      .call(() => onPeak?.(item.head.getWorldPosition(new THREE.Vector3())), [], 0.3)
      .to(item, { bloom: 1, duration: 1.2, ease: 'elastic.out(1, 0.45)' }, 0.35)
      .to(w.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1, 0.4)' }, 0.35);
  }

  /** Remet tout à l'état « caché dans le colis ». */
  resetGrowth() {
    for (const f of this.flowers) {
      f.grow = 0.2;
      f.headScale = 0;
      f.bloom = 0;
      f.leaves.forEach((l) => (l.open = 0));
    }
    this.crowns.forEach((c) => ((c.grow = 0.2), (c.pop = 0)));
    this.sprigs.forEach((s) => (s.grow = 0));
    this.foliage.forEach((f) => f.leaves.forEach((l) => (l.open = 0)));
  }

  update(time: number) {
    const sw = this.sway;
    const m = new THREE.Matrix4();
    const sc = new THREE.Matrix4();
    for (const f of this.flowers) {
      const count = Math.floor(clamp(f.grow) * STEM_SEG) * STEM_RAD * 6;
      f.stem.geometry.setDrawRange(0, count);
      const hs = Math.max(0.0001, f.headScale);
      f.headAnchor.scale.setScalar(hs);
      f.headAnchor.visible = f.headScale > 0.001;
      applyBloom(f.head, f.bloom);
      f.group.rotation.x = Math.sin(time * 0.8 + f.phase) * 0.018 * sw;
      f.group.rotation.z = Math.cos(time * 0.67 + f.phase * 1.3) * 0.018 * sw;
      for (const l of f.leaves) this.applyLeaf(l);
    }
    for (const c of this.crowns) {
      c.stem.geometry.setDrawRange(0, Math.floor(clamp(c.grow) * STEM_SEG) * STEM_RAD * 6);
      c.crown.scale.setScalar(Math.max(0.0001, c.pop));
      c.crown.visible = c.pop > 0.001;
      c.group.rotation.x = Math.sin(time * 0.9 + c.phase) * 0.022 * sw;
      c.group.rotation.z = Math.cos(time * 0.73 + c.phase) * 0.022 * sw;
    }
    for (const s of this.sprigs) {
      const segs = (s.stem.geometry as THREE.TubeGeometry).parameters.tubularSegments;
      s.stem.geometry.setDrawRange(0, Math.floor(clamp(s.grow) * segs) * 5 * 6);
      for (let i = 0; i < s.base.length; i++) {
        const k = clamp((s.grow - s.ts[i] * 0.85) / 0.25);
        sc.makeScale(k + 0.0001, k + 0.0001, k + 0.0001);
        m.multiplyMatrices(s.base[i], sc);
        s.leaves.setMatrixAt(i, m);
      }
      s.leaves.instanceMatrix.needsUpdate = true;
      s.leaves.visible = s.grow > 0.2;
      s.group.rotation.x = Math.sin(time * 0.7 + s.phase) * 0.025 * sw;
      s.group.rotation.z = Math.cos(time * 0.6 + s.phase) * 0.025 * sw;
    }
    for (const f of this.foliage) {
      f.group.rotation.x = Math.sin(time * 0.75 + f.phase) * 0.015 * sw;
      for (const l of f.leaves) this.applyLeaf(l);
    }
    this.envelope.update(time);
  }

  private applyLeaf(l: LeafItem) {
    const o = clamp(l.open);
    l.mesh.scale.setScalar(Math.max(0.0001, l.base * Math.pow(o, 0.6)));
    l.mesh.visible = o > 0.001;
    if (l.mesh.morphTargetInfluences) l.mesh.morphTargetInfluences[0] = 1 - o;
  }

  dispose() {
    disposeObject(this.root);
  }
}

function mergeTubes(list: THREE.BufferGeometry[]) {
  let vCount = 0;
  list.forEach((g) => (vCount += g.attributes.position.count));
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const idx: number[] = [];
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    const gi = g.index!;
    for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + o);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
