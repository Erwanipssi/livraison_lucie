import * as THREE from 'three';
import type { QualitySettings } from './Quality';

export function createRenderer(canvas: HTMLCanvasElement, q: QualitySettings) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: q.antialias,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping « neutre » (Khronos PBR Neutral) : respecte les teintes crème/poudré.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = q.shadows > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xf3e8de, 1);
  return renderer;
}

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
