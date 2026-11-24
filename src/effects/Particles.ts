import * as THREE from 'three';
import { dustFragment, dustVertex, shaftFragment, shaftVertex, sparkFragment, sparkVertex } from '../shaders/particles';
import { Rng } from '../utils/math';

/** Étincelles dorées (révélation) + poussière ambiante en suspension. */
export class Particles {
  readonly sparks: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly shaft: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;

  constructor(scene: THREE.Scene, density: number, pixelRatio: number) {
    const rng = new Rng(77);
    const nS = Math.max(40, Math.round(260 * density));
    const seeds = new Float32Array(nS * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nS * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.sparks = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: sparkVertex,
        fragmentShader: sparkFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpread: { value: 0 },
          uIntensity: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uSize: { value: 26 },
          uFocus: { value: 5 },
          uHeight: { value: 2.6 },
          uRadius: { value: 1.5 },
          uCenter: { value: new THREE.Vector3(0, 0.3, 0) },
          uColorA: { value: new THREE.Color(1.9, 1.45, 0.85) },
          uColorB: { value: new THREE.Color(1.8, 1.1, 1.15) },
        },
      }),
    );
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);

    const nD = Math.max(30, Math.round(140 * density));
    const dPos = new Float32Array(nD * 3);
    const dSeed = new Float32Array(nD * 4);
    for (let i = 0; i < nD; i++) {
      const r = 0.6 + Math.sqrt(rng.next()) * 4.2;
      const a = rng.range(0, Math.PI * 2);
      dPos[i * 3] = Math.cos(a) * r;
      dPos[i * 3 + 1] = rng.range(-0.4, 3.0);
      dPos[i * 3 + 2] = Math.sin(a) * r;
      for (let k = 0; k < 4; k++) dSeed[i * 4 + k] = rng.next();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 4));
    this.dust = new THREE.Points(
      dg,
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uSize: { value: 22 },
          uFocus: { value: 5 },
          uIntensity: { value: 0.35 },
          uColor: { value: new THREE.Color(1.0, 0.86, 0.72) },
        },
      }),
    );
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // faisceau de lumière qui s'échappe du colis
    const cyl = new THREE.CylinderGeometry(0.95, 0.46, 3.2, 48, 1, true);
    cyl.translate(0, 1.6, 0);
    this.shaft = new THREE.Mesh(
      cyl,
      new THREE.ShaderMaterial({
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uIntensity: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(1.0, 0.78, 0.55) },
        },
      }),
    );
    this.shaft.visible = false;
    scene.add(this.shaft);
  }

  setPixelRatio(pr: number) {
    this.sparks.material.uniforms.uPixelRatio.value = pr;
    this.dust.material.uniforms.uPixelRatio.value = pr;
  }

  update(time: number, focus: number) {
    const su = this.sparks.material.uniforms;
    su.uTime.value = time;
    su.uFocus.value = focus;
    this.sparks.visible = su.uIntensity.value > 0.001;
    const du = this.dust.material.uniforms;
    du.uTime.value = time;
    du.uFocus.value = focus;
    const sh = this.shaft.material.uniforms;
    sh.uTime.value = time;
    this.shaft.visible = sh.uIntensity.value > 0.001;
  }
}
