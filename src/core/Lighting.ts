import * as THREE from 'three';
import type { QualitySettings } from './Quality';

/** Éclairage cinématique doux : clé chaude, contre-jour rosé, remplissage froid. */
export class Lighting {
  readonly hemi: THREE.HemisphereLight;
  readonly key: THREE.DirectionalLight;
  readonly rim: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly hero: THREE.SpotLight;
  readonly boxLight: THREE.PointLight;

  constructor(scene: THREE.Scene, q: QualitySettings) {
    this.hemi = new THREE.HemisphereLight(0xfff3ea, 0xe7c7bf, 0.55);
    scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xfff0de, 2.2);
    this.key.position.set(3.2, 6.5, 4.2);
    this.key.target.position.set(0, 0.5, 0);
    if (q.shadows > 0) {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(q.shadows, q.shadows);
      const cam = this.key.shadow.camera;
      cam.left = -2.2;
      cam.right = 2.2;
      cam.top = 2.8;
      cam.bottom = -1.6;
      cam.near = 2;
      cam.far = 14;
      this.key.shadow.bias = -0.0004;
      this.key.shadow.normalBias = 0.025;
    }
    scene.add(this.key, this.key.target);

    this.rim = new THREE.DirectionalLight(0xffcfd6, 1.6);
    this.rim.position.set(-3, 3.5, -4.5);
    scene.add(this.rim);

    this.fill = new THREE.DirectionalLight(0xe9ecff, 0.45);
    this.fill.position.set(-4.5, 1.8, 2.5);
    scene.add(this.fill);

    this.hero = new THREE.SpotLight(0xfff2e2, 0, 14, 0.42, 0.85, 1.4);
    this.hero.position.set(0.4, 7, 1.6);
    this.hero.target.position.set(0, 1, 0);
    scene.add(this.hero, this.hero.target);

    this.boxLight = new THREE.PointLight(0xffc68a, 0, 5, 1.6);
    this.boxLight.position.set(0, 0.45, 0);
    scene.add(this.boxLight);
  }
}
