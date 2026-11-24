import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { QualitySettings } from '../core/Quality';

/**
 * Chaîne de post-traitement : rendu HDR multi-échantillonné → bloom subtil →
 * tone mapping / sRGB. Vignettage et grain sont faits en CSS (gratuits).
 * Sur les appareils modestes, rendu direct sans composer.
 */
export class PostProcessing {
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  baseStrength = 0.32;
  boost = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    q: QualitySettings,
    bloomIntensity: number,
  ) {
    this.baseStrength = 0.32 * bloomIntensity;
    if (!q.bloom || bloomIntensity <= 0) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), this.baseStrength, 0.55, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pr: number) {
    if (!this.composer) return;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
  }

  disableBloom() {
    if (!this.composer) return false;
    this.composer.dispose();
    this.composer = null;
    this.bloom = null;
    return true;
  }

  render() {
    if (this.composer && this.bloom) {
      this.bloom.strength = this.baseStrength + this.boost;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
