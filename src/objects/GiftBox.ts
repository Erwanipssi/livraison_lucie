import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AppConfig } from '../config';
import { disposeObject } from '../utils/dispose';
import { brandDecalTexture, labelTexture, paperBump, radialTexture } from '../utils/textures';
import { buildBow, roundedPath, satinMaterial, stripGeometry } from './Ribbon';

const W = 1.0; // largeur du colis
const H = 0.72; // hauteur des parois
const T = 0.03; // épaisseur du carton
const LID_H = 0.2;
const LID_W = 1.06;
const LID_Y = H - 0.12; // bas du couvercle
const TOP = LID_Y + LID_H; // dessus du couvercle

interface Band {
  mesh: THREE.Mesh;
  total: number;
}

/**
 * Colis de luxe procédural. Les parois sont articulées à leur base pour
 * s'ouvrir comme une fleur ; le ruban peut se « dénouer » (drawRange).
 */
export class GiftBox {
  readonly root = new THREE.Group(); // position sur le socle (lévitation)
  readonly spin = new THREE.Group(); // rotation utilisateur (turntable)
  readonly lid = new THREE.Group();
  readonly walls: THREE.Group[] = [];
  readonly ribbon = new THREE.Group();
  readonly tag = new THREE.Group();
  readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly lidMaterials: THREE.Material[] = [];
  bow!: ReturnType<typeof buildBow>;
  bands: Band[] = [];
  /** 1 = ruban complet, 0 = entièrement retiré. */
  ribbonProgress = 1;
  floatAmount = 1;
  readonly tagMaterials: THREE.Material[] = [];

  constructor(cfg: AppConfig, shadows: boolean) {
    const c = cfg.giftBox;
    const bump = paperBump(256, 7);
    bump.repeat.set(2, 2);
    const boxMat = new THREE.MeshPhysicalMaterial({
      color: c.box,
      roughness: 0.62,
      sheen: 0.4,
      sheenColor: new THREE.Color('#fff4f0'),
      sheenRoughness: 0.6,
      bumpMap: bump,
      bumpScale: 0.6,
    });
    const innerMat = new THREE.MeshStandardMaterial({ color: c.inner, roughness: 0.85, bumpMap: bump, bumpScale: 0.4 });
    const gold = new THREE.MeshStandardMaterial({ color: c.accent, metalness: 1, roughness: 0.26 });

    this.root.add(this.spin);

    // ── Parois articulées ────────────────────────────────────────────────
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI) / 2;
      const hinge = new THREE.Group();
      hinge.position.set(0, 0, W / 2);
      pivot.add(hinge);
      const width = k % 2 === 0 ? W : W - 2 * T;
      const panel = new THREE.Mesh(new RoundedBoxGeometry(width, H, T, 3, 0.012), boxMat);
      panel.position.set(0, H / 2, -T / 2);
      panel.castShadow = shadows;
      panel.receiveShadow = shadows;
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.02, H - 0.02), innerMat);
      inner.position.set(0, H / 2, -T - 0.0008);
      inner.rotation.y = Math.PI;
      inner.receiveShadow = shadows;
      hinge.add(panel, inner);
      if (k === 0) {
        const decal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, 0.105),
          new THREE.MeshStandardMaterial({
            color: c.accent,
            metalness: 1,
            roughness: 0.3,
            alphaMap: brandDecalTexture(cfg.brand.name),
            transparent: true,
            depthWrite: false,
          }),
        );
        decal.position.set(0.17, 0.3, 0.0015);
        hinge.add(decal);
      }
      this.spin.add(pivot);
      this.walls.push(hinge);
    }

    // Fond + lueur intérieure
    const bottom = new THREE.Mesh(new RoundedBoxGeometry(W, T, W, 2, 0.01), boxMat);
    bottom.position.y = T / 2;
    bottom.receiveShadow = shadows;
    bottom.castShadow = shadows;
    const bottomIn = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, W - 2 * T), innerMat);
    bottomIn.rotation.x = -Math.PI / 2;
    bottomIn.position.y = T + 0.001;
    bottomIn.receiveShadow = shadows;
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.3, W * 1.3),
      new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(255,236,200,1)'], [0.4, 'rgba(255,200,150,0.6)'], [1, 'rgba(255,190,150,0)']]),
        color: new THREE.Color(1.5, 1.15, 0.85),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = T + 0.01;
    this.spin.add(bottom, bottomIn, this.glow);

    // ── Couvercle ────────────────────────────────────────────────────────
    const lidMat = boxMat.clone();
    lidMat.transparent = true;
    const goldLid = gold.clone();
    goldLid.transparent = true;
    this.lidMaterials.push(lidMat, goldLid);
    const lidBox = new THREE.Mesh(new RoundedBoxGeometry(LID_W, LID_H, LID_W, 4, 0.022), lidMat);
    lidBox.position.y = LID_H / 2;
    lidBox.castShadow = shadows;
    lidBox.receiveShadow = shadows;
    const rim = new THREE.Mesh(new RoundedBoxGeometry(LID_W + 0.008, 0.016, LID_W + 0.008, 2, 0.007), goldLid);
    rim.position.y = 0.014;
    const rimTop = new THREE.Mesh(new RoundedBoxGeometry(LID_W + 0.004, 0.006, LID_W + 0.004, 2, 0.003), goldLid);
    rimTop.position.y = LID_H - 0.035;
    this.lid.add(lidBox, rim, rimTop);
    this.lid.position.y = LID_Y;
    this.spin.add(this.lid);

    // ── Ruban ────────────────────────────────────────────────────────────
    this.buildRibbon(cfg, shadows);
    this.buildTag(cfg, shadows);
    this.spin.add(this.ribbon);
  }

  private buildRibbon(cfg: AppConfig, shadows: boolean) {
    const mat = satinMaterial(cfg.giftBox.ribbon);
    const e = 0.0045;
    const xk = -0.17; // position de la bande nord-sud
    const zk = 0.15; // position de la bande est-ouest
    const yT = TOP + e;
    const bw = 0.075;
    const half = LID_W / 2 + e;
    const hb = W / 2 + e;

    const makeHalf = (axis: 'x' | 'z', sign: number) => {
      const P = (along: number, y: number) =>
        axis === 'x' ? new THREE.Vector3(along, y, zk) : new THREE.Vector3(xk, y, along);
      const start = axis === 'x' ? xk : zk;
      const corners = [
        P(start, yT),
        P(sign * half, yT),
        P(sign * half, LID_Y - e),
        P(sign * hb, LID_Y - e),
        P(sign * hb, -e),
        P(0, -e),
      ];
      const pts = roundedPath(corners, 0.022, 120);
      const dir = axis === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const geo = stripGeometry(pts, dir, () => bw);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows;
      this.ribbon.add(mesh);
      this.bands.push({ mesh, total: geo.index!.count });
    };
    makeHalf('x', 1);
    makeHalf('x', -1);
    makeHalf('z', 1);
    makeHalf('z', -1);

    const knot = new THREE.Vector3(xk, yT + 0.012, zk);
    const up = new THREE.Vector3(0, 1, 0);
    const d = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    this.bow = buildBow(
      {
        knot,
        view: up,
        width: 0.07,
        knotSize: 0.06,
        loops: [
          { dir: d(-0.55), length: 0.24, height: 0.085, lift: 0.5 },
          { dir: d(Math.PI + 0.45), length: 0.23, height: 0.08, lift: 0.52 },
          { dir: d(-Math.PI / 2 - 0.2), length: 0.18, height: 0.07, lift: 0.75 },
          { dir: d(Math.PI / 2 + 0.25), length: 0.17, height: 0.065, lift: 0.7 },
        ],
        tails: [
          { dir: d(0.95), length: 0.27, droop: 0.01, wave: 0.006 },
          { dir: d(2.05), length: 0.24, droop: 0.01, wave: 0.007 },
        ],
      },
      mat,
    );
    this.ribbon.add(this.bow.group);
  }

  private buildTag(cfg: AppConfig, shadows: boolean) {
    const w = 0.25, h = 0.146, cut = 0.04;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + cut, -h / 2);
    s.lineTo(w / 2 - 0.012, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 0.012);
    s.lineTo(w / 2, h / 2 - 0.012);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - 0.012, h / 2);
    s.lineTo(-w / 2 + cut, h / 2);
    s.lineTo(-w / 2, h / 2 - cut);
    s.lineTo(-w / 2, -h / 2 + cut);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 6);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
    const tex = labelTexture(cfg.delivery.tagLine, cfg.recipient, cfg.delivery.number, cfg.giftBox.accent);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, transparent: true });
    const back = new THREE.MeshStandardMaterial({ color: '#efe5d6', roughness: 0.8, transparent: true });
    this.tagMaterials.push(face, back);
    const top = new THREE.Mesh(geo, face);
    const bottom = new THREE.Mesh(geo, back);
    bottom.rotation.y = Math.PI;
    bottom.position.z = -0.003;
    top.castShadow = shadows;
    const card = new THREE.Group();
    card.add(top, bottom);
    // œillet doré
    const eyelet = new THREE.Mesh(
      new THREE.TorusGeometry(0.012, 0.0035, 8, 24),
      new THREE.MeshStandardMaterial({ color: cfg.giftBox.accent, metalness: 1, roughness: 0.25, transparent: true }),
    );
    this.tagMaterials.push(eyelet.material as THREE.Material);
    eyelet.position.set(-w / 2 + 0.035, 0, 0.001);
    card.add(eyelet);
    card.rotation.x = -Math.PI / 2;
    this.tag.add(card);
    this.tag.position.set(0.16, TOP + 0.009, 0.3);
    this.tag.rotation.set(0, 0.32, 0);
    this.tag.rotateX(-0.05);

    // fil reliant l'étiquette au nœud
    const eyeletWorld = new THREE.Vector3(-w / 2 + 0.035, 0, 0).applyEuler(card.rotation).applyEuler(this.tag.rotation).add(this.tag.position);
    const knot = new THREE.Vector3(-0.17, TOP + 0.02, 0.15);
    const mid = eyeletWorld.clone().lerp(knot, 0.5);
    mid.y += 0.015;
    const curve = new THREE.CatmullRomCurve3([knot, mid, eyeletWorld]);
    const threadMat = new THREE.MeshStandardMaterial({ color: cfg.giftBox.accent, metalness: 0.8, roughness: 0.4, transparent: true });
    this.tagMaterials.push(threadMat);
    const thread = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0022, 5), threadMat);
    this.ribbonThread = thread;
    this.spin.add(this.tag, thread);
  }

  ribbonThread!: THREE.Mesh;

  setTagOpacity(o: number) {
    this.tagMaterials.forEach((m) => (m.opacity = o));
  }
  setLidOpacity(o: number) {
    this.lidMaterials.forEach((m) => (m.opacity = o));
  }

  update(time: number) {
    // lévitation / respiration
    this.root.position.y = (0.07 + Math.sin(time * 1.1) * 0.022) * this.floatAmount;
    this.root.rotation.z = Math.sin(time * 0.7) * 0.012 * this.floatAmount;
    this.root.rotation.x = Math.cos(time * 0.6) * 0.01 * this.floatAmount;
    for (const b of this.bands) {
      const count = Math.floor((b.total / 12) * this.ribbonProgress) * 12;
      b.mesh.geometry.setDrawRange(0, count);
      b.mesh.visible = count > 0;
    }
  }

  get height() {
    return this.root.position.y;
  }

  dispose() {
    disposeObject(this.root);
  }
}
