import * as THREE from 'three';
import { createLoosePetalGeometry } from '../objects/Blossom';
import { Rng } from '../utils/math';

interface Petal {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  q: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  scale: number;
  radius: number;
  height: number;
  phase: number;
  alive: boolean;
}

/**
 * Pétales flottants simulés (InstancedMesh, 1 draw call) : tourbillon doux
 * autour du bouquet, portance, battement, et répulsion au pointeur.
 */
export class Petals {
  readonly mesh: THREE.InstancedMesh;
  readonly center = new THREE.Vector3(0, 0.9, 0);
  swirl = 0;
  private petals: Petal[] = [];
  private m = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private rng = new Rng(3);
  private ray: THREE.Ray | null = null;
  private rayTTL = 0;

  constructor(scene: THREE.Scene, count: number, colors: string[]) {
    const geo = createLoosePetalGeometry();
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.6,
      sheen: 0.6,
      sheenColor: new THREE.Color('#fff0f0'),
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.set(this.rng.pick(colors)).lerp(new THREE.Color('#ffffff'), this.rng.range(0, 0.3));
      this.mesh.setColorAt(i, c);
      this.petals.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        q: new THREE.Quaternion().random(),
        axis: new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)).normalize(),
        spin: this.rng.range(0.6, 2.2),
        scale: this.rng.range(0.7, 1.2),
        radius: this.rng.range(0.75, 1.7),
        height: this.rng.range(0.4, 2.3),
        phase: this.rng.range(0, 10),
        alive: false,
      });
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Jaillissement depuis un point (ouverture du colis). */
  burst(origin: THREE.Vector3, fraction = 1) {
    const n = Math.floor(this.petals.length * fraction);
    this.mesh.visible = true;
    for (let i = 0; i < n; i++) {
      const p = this.petals[i];
      if (p.alive) continue;
      p.alive = true;
      p.pos.copy(origin).add(new THREE.Vector3(this.rng.range(-0.2, 0.2), this.rng.range(0, 0.2), this.rng.range(-0.2, 0.2)));
      const a = this.rng.range(0, Math.PI * 2);
      const out = this.rng.range(0.4, 1.4);
      p.vel.set(Math.cos(a) * out, this.rng.range(1.6, 3.2), Math.sin(a) * out);
    }
  }

  /** Quelques pétales libérés à un endroit (toucher d'une fleur). */
  emitAt(pos: THREE.Vector3, count = 3) {
    let done = 0;
    for (const p of this.petals) {
      if (done >= count) break;
      // recycle des pétales éloignés
      if (!p.alive || p.pos.distanceTo(this.center) > 2.4) {
        p.alive = true;
        p.pos.copy(pos);
        p.vel.set(this.rng.range(-0.4, 0.4), this.rng.range(0.2, 0.7), this.rng.range(-0.4, 0.4));
        done++;
      }
    }
    if (done < count) {
      for (let i = 0; i < count - done; i++) {
        const p = this.petals[this.rng.int(0, this.petals.length - 1)];
        p.alive = true;
        p.pos.copy(pos);
        p.vel.set(this.rng.range(-0.4, 0.4), this.rng.range(0.2, 0.7), this.rng.range(-0.4, 0.4));
      }
    }
    this.mesh.visible = true;
  }

  /** Rayon du pointeur (en coordonnées monde) pour repousser les pétales. */
  setPointerRay(ray: THREE.Ray) {
    this.ray = ray.clone();
    this.rayTTL = 0.12;
  }

  reset() {
    this.petals.forEach((p) => (p.alive = false));
    this.mesh.visible = false;
    this.swirl = 0;
  }

  update(dt: number, time: number) {
    if (!this.mesh.visible) return;
    dt = Math.min(dt, 1 / 30);
    this.rayTTL -= dt;
    const ray = this.rayTTL > 0 ? this.ray : null;
    const closest = new THREE.Vector3();
    const c = this.center;
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      if (!p.alive) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      const dx = p.pos.x - c.x, dz = p.pos.z - c.z;
      const r = Math.hypot(dx, dz) || 0.001;
      const tx = -dz / r, tz = dx / r;
      const sw = this.swirl;
      // tourbillon + rappel radial + portance vers une altitude préférée
      p.vel.x += (tx * 0.55 * sw - (dx / r) * (r - p.radius) * 0.6 * sw) * dt;
      p.vel.z += (tz * 0.55 * sw - (dz / r) * (r - p.radius) * 0.6 * sw) * dt;
      p.vel.y += ((p.height - p.pos.y) * 0.35 * sw - 0.35 * (1 - sw)) * dt;
      // battement (feuille morte)
      p.vel.x += Math.sin(time * 1.7 + p.phase) * 0.25 * dt;
      p.vel.y += Math.sin(time * 2.3 + p.phase * 2) * 0.18 * dt;
      p.vel.z += Math.cos(time * 1.5 + p.phase) * 0.25 * dt;
      if (ray) {
        ray.closestPointToPoint(p.pos, closest);
        const d = closest.distanceTo(p.pos);
        if (d < 0.35) {
          const push = (1 - d / 0.35) * 5.5 * dt;
          const away = p.pos.clone().sub(closest).normalize();
          p.vel.addScaledVector(away, push);
          p.vel.y += push * 0.4;
        }
      }
      const damp = Math.exp(-dt * 1.1);
      p.vel.multiplyScalar(damp);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.02 && sw < 0.5) p.pos.y = 0.02;
      const spin = p.spin * (0.4 + Math.min(1.5, p.vel.length()));
      this.tmpQ.setFromAxisAngle(p.axis, spin * dt);
      p.q.multiply(this.tmpQ);
      this.s.setScalar(p.scale);
      this.m.compose(p.pos, p.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
