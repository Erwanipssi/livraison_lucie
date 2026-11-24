import * as THREE from 'three';
import type { CameraRig } from '../core/Camera';

/**
 * Plateau tournant : l'objet tourne sous les doigts (inertie, légère
 * inclinaison qui revient en douceur), la caméra et la lumière restent fixes
 * — les reflets glissent ainsi sur les matières. Pincer / molette = zoom léger.
 * Distingue le tap du glisser pour la sélection.
 */
export class Turntable {
  target: THREE.Object3D | null = null;
  enabled = false;
  autoRotate = 0;
  zoomMin = 0.78;
  zoomMax = 1.12;
  onTap: (x: number, y: number) => void = () => {};
  onHover: (x: number, y: number) => void = () => {};
  onInteract: () => void = () => {};

  private angle = 0;
  private vel = 0;
  private tilt = 0;
  private tiltVel = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; t: number; moved: number } | null = null;
  private pinchDist = 0;
  private idle = 0;
  private qY = new THREE.Quaternion();
  private qX = new THREE.Quaternion();
  private right = new THREE.Vector3();
  private Y = new THREE.Vector3(0, 1, 0);

  constructor(private dom: HTMLElement, private rig: CameraRig) {
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('pointerleave', this.onLeave);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  attach(obj: THREE.Object3D | null) {
    this.target = obj;
    if (obj) {
      const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
      this.angle = e.y;
    }
    this.vel = 0;
    this.tilt = 0;
  }

  /** Oriente doucement vers un angle (utilisé par les cinématiques). */
  get rotation() {
    return this.angle;
  }
  set rotation(v: number) {
    this.angle = v;
  }

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      this.dom.setPointerCapture(e.pointerId);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.down = null;
    }
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') this.onHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    this.onHover(e.clientX, e.clientY);
    if (!this.enabled) return;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.zoomBy(this.pinchDist / d);
      this.pinchDist = d;
      return;
    }
    if (this.down) this.down.moved += Math.abs(dx) + Math.abs(dy);
    const k = 5.2 / Math.max(320, Math.min(window.innerWidth, 900));
    this.angle += dx * k;
    this.vel = (dx * k) / (1 / 60);
    this.tilt = THREE.MathUtils.clamp(this.tilt + dy * k * 0.5, -0.32, 0.32);
    this.idle = 0;
    this.onInteract();
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.down && this.pointers.size === 0) {
      const dt = performance.now() - this.down.t;
      if (this.down.moved < 10 && dt < 450) this.onTap(e.clientX, e.clientY);
    }
    if (this.pointers.size === 0) this.down = null;
    this.pinchDist = 0;
  };

  private onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.pointers.has(e.pointerId)) this.onHover(-9999, -9999);
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.zoomBy(1 + Math.sign(e.deltaY) * 0.06);
  };

  private zoomBy(f: number) {
    this.rig.zoom = THREE.MathUtils.clamp(this.rig.zoom * f, this.zoomMin, this.zoomMax);
    this.idle = 0;
    this.onInteract();
  }

  update(dt: number) {
    if (!this.target) return;
    const dragging = this.pointers.size > 0 && this.enabled;
    this.idle += dt;
    if (!dragging) {
      this.angle += this.vel * dt;
      this.vel *= Math.exp(-dt * 2.6);
      if (this.enabled && this.autoRotate && this.idle > 3) {
        this.vel += (this.autoRotate - this.vel) * Math.min(1, dt * 0.6);
      }
      // retour élastique de l'inclinaison
      this.tiltVel += (-this.tilt * 18 - this.tiltVel * 5.5) * dt;
      this.tilt += this.tiltVel * dt;
    }
    const cam = this.rig.camera;
    this.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    this.right.y = 0;
    this.right.normalize();
    this.qY.setFromAxisAngle(this.Y, this.angle);
    this.qX.setFromAxisAngle(this.right, this.tilt);
    this.target.quaternion.multiplyQuaternions(this.qX, this.qY);
  }
}
