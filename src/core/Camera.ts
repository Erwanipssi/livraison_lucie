import * as THREE from 'three';

/**
 * Rig de caméra en coordonnées sphériques autour d'une cible.
 * Toutes les valeurs sont animables avec GSAP. Les « insets » décalent le
 * cadrage pour laisser la place aux panneaux d'interface (bas sur mobile,
 * droite sur ordinateur) sans recadrer la scène à la main.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3(0, 0.45, 0);
  dist = 6;
  azim = 0;
  polar = 1.2;
  zoom = 1;
  insetBottom = 0;
  insetRight = 0;
  shake = 0;
  private w = 1;
  private h = 1;
  private tmp = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  }

  get aspect() {
    return this.w / this.h;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Distance nécessaire pour cadrer un objet de taille `size` (diamètre). */
  fit(size: number, insetBottom = this.insetBottom, insetRight = this.insetRight, width = size) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const visH = Math.max(0.35, 1 - insetBottom);
    const visW = Math.max(0.35, 1 - insetRight);
    const dV = size / 2 / Math.tan(vf) / visH;
    const hf = Math.atan(Math.tan(vf) * this.aspect * visW);
    const dH = width / 2 / Math.tan(hf);
    return Math.max(dV, dH) * 1.04;
  }

  update(time = 0) {
    const r = this.dist * this.zoom;
    const sp = Math.sin(this.polar);
    this.tmp.set(r * sp * Math.sin(this.azim), r * Math.cos(this.polar), r * sp * Math.cos(this.azim));
    this.camera.position.copy(this.target).add(this.tmp);
    if (this.shake > 0) {
      this.camera.position.x += Math.sin(time * 37) * 0.01 * this.shake;
      this.camera.position.y += Math.cos(time * 41) * 0.01 * this.shake;
    }
    this.camera.lookAt(this.target);
    const ox = (this.w * this.insetRight) / 2;
    const oy = (this.h * this.insetBottom) / 2;
    if (ox > 0.5 || oy > 0.5) this.camera.setViewOffset(this.w, this.h, ox, oy, this.w, this.h);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
  }

  /** Direction horizontale « derrière la scène » vue depuis la caméra. */
  backDirection(out: THREE.Vector3) {
    return out.set(-Math.sin(this.azim), 0.12, -Math.cos(this.azim)).normalize();
  }
}
