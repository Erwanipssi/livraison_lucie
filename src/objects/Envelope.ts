import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AppConfig } from '../config';
import { fill } from '../config';
import { disposeObject } from '../utils/dispose';
import { cardTexture, envelopeBackTexture, ivoryPaperTexture, linerTexture, radialTexture, sealBumpTexture } from '../utils/textures';

export const ENV_W = 0.36;
export const ENV_H = 0.25;
const THICK = 0.008;

/**
 * Enveloppe ivoire : rabat articulé doublé de rose à pois dorés, cachet de
 * cire en deux moitiés (pour se briser), carte glissée à l'intérieur.
 */
export class Envelope {
  readonly root = new THREE.Group(); // ancrage (dans le bouquet)
  readonly float = new THREE.Group(); // invitation : flottement
  readonly flap = new THREE.Group();
  readonly sealHalves: THREE.Group[] = [];
  readonly seal = new THREE.Group();
  readonly card: THREE.Mesh;
  readonly glow: THREE.Sprite;
  readonly proxy: THREE.Mesh;
  opened = false;
  invite = 0; // 0 → 1 intensité de l'invitation
  homePosition = new THREE.Vector3();
  homeQuaternion = new THREE.Quaternion();

  constructor(cfg: AppConfig, shadows: boolean) {
    const front = ivoryPaperTexture('#f7f0e4');
    const paper = new THREE.MeshStandardMaterial({ color: '#ffffff', map: front, roughness: 0.82 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(ENV_W, ENV_H, THICK, 2, 0.003), paper);
    body.castShadow = shadows;
    this.float.add(body);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_W - 0.004, ENV_H - 0.004),
      new THREE.MeshStandardMaterial({ map: envelopeBackTexture(cfg.recipient, '#ecc3c3'), roughness: 0.8 }),
    );
    back.position.z = THICK / 2 + 0.0006;
    this.float.add(back);

    // carte (cachée dans l'épaisseur)
    const greeting = fill(cfg.letter.greeting, cfg);
    this.card = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_W * 0.9, ENV_H * 0.88),
      new THREE.MeshStandardMaterial({ map: cardTexture(greeting, cfg.letter.paragraphs[0] ?? ''), roughness: 0.75, side: THREE.DoubleSide }),
    );
    this.card.position.set(0, -0.005, 0);
    this.float.add(this.card);

    // rabat
    const s = new THREE.Shape();
    const hw = ENV_W / 2 - 0.002;
    const tipY = -ENV_H * 0.53;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(0.03, tipY + 0.022);
    s.quadraticCurveTo(0, tipY - 0.004, -0.03, tipY + 0.022);
    s.closePath();
    const flapGeo = new THREE.ShapeGeometry(s, 8);
    const uv = flapGeo.attributes.uv as THREE.BufferAttribute;
    const p = flapGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + hw) / (2 * hw), (p.getY(i) - tipY) / -tipY);
    const flapOut = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ map: ivoryPaperTexture('#f5ecdf', 256, 256), roughness: 0.8, side: THREE.FrontSide }));
    const flapIn = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ map: linerTexture('#ecc3c3'), roughness: 0.85, side: THREE.BackSide }));
    flapOut.castShadow = shadows;
    this.flap.add(flapOut, flapIn);
    this.flap.position.set(0, ENV_H / 2 - 0.001, THICK / 2 + 0.0014);
    this.float.add(this.flap);

    // cachet de cire (deux moitiés)
    const bump = sealBumpTexture((cfg.sender[0] ?? 'M').toUpperCase());
    const wax = new THREE.MeshPhysicalMaterial({
      color: '#8c3445',
      roughness: 0.38,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
      bumpMap: bump,
      bumpScale: 2.2,
      transparent: true,
    });
    const R = 0.034;
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      profile.push(new THREE.Vector2(R * (0.98 + 0.06 * Math.sin(t * Math.PI)) * Math.sin((t * Math.PI) / 2 + 0.0001), 0.004 + 0.007 * Math.cos((t * Math.PI) / 2)));
    }
    profile.reverse();
    profile.unshift(new THREE.Vector2(R * 1.02, 0));
    for (let h = 0; h < 2; h++) {
      const half = new THREE.Group();
      const rimGeo = new THREE.LatheGeometry(profile, 24, h * Math.PI, Math.PI);
      // bord irrégulier de cire coulée
      const pa = rimGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i);
        const a = Math.atan2(z, x);
        const rr = Math.hypot(x, z);
        const k = 1 + 0.07 * Math.sin(a * 7) + 0.04 * Math.sin(a * 13 + 1);
        pa.setX(i, (x / (rr || 1)) * rr * k);
        pa.setZ(i, (z / (rr || 1)) * rr * k);
      }
      rimGeo.computeVertexNormals();
      const rim = new THREE.Mesh(rimGeo, wax);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 24, -Math.PI / 2 + h * Math.PI, Math.PI), wax);
      disk.rotation.x = -Math.PI / 2;
      disk.position.y = 0.0112;
      // UV du disque : centrées pour le relief
      half.add(rim, disk);
      this.seal.add(half);
      this.sealHalves.push(half);
    }
    this.seal.rotation.x = Math.PI / 2;
    this.seal.position.set(0, tipY + ENV_H / 2 + 0.006, THICK / 2 + 0.003);
    this.float.add(this.seal);

    // halo d'invitation
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture([[0, 'rgba(255,236,210,0.95)'], [0.4, 'rgba(255,214,190,0.35)'], [1, 'rgba(255,210,190,0)']]),
        color: new THREE.Color(1.6, 1.35, 1.2),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    this.glow.scale.set(0.75, 0.6, 1);
    this.glow.position.z = -0.03;
    this.float.add(this.glow);

    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(ENV_W * 1.4, ENV_H * 1.5, 0.12), new THREE.MeshBasicMaterial());
    this.proxy.visible = false;
    this.root.add(this.float, this.proxy);
  }

  /** Enregistre la pose locale (pour revenir dans le bouquet). */
  saveHome() {
    this.homePosition.copy(this.root.position);
    this.homeQuaternion.copy(this.root.quaternion);
  }

  update(time: number) {
    const k = this.invite;
    this.float.position.y = Math.sin(time * 1.6) * 0.012 * k;
    this.float.rotation.z = Math.sin(time * 1.1) * 0.035 * k;
    this.float.rotation.x = Math.sin(time * 0.9) * 0.03 * k;
    (this.glow.material as THREE.SpriteMaterial).opacity = k * (0.45 + 0.25 * Math.sin(time * 2.2));
  }

  setSealOpacity(o: number) {
    const m = (this.sealHalves[0].children[0] as THREE.Mesh).material as THREE.Material;
    m.opacity = o;
  }

  dispose() {
    disposeObject(this.root);
  }
}
