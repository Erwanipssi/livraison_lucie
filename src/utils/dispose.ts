import * as THREE from 'three';

const TEXTURE_KEYS = [
  'map', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap',
  'emissiveMap', 'aoMap', 'sheenColorMap', 'sheenRoughnessMap',
] as const;

/** Libère géométries, matériaux et textures d'un sous-graphe (mémoire GPU). */
export function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geometries.add(m.geometry);
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => materials.add(x));
  });
  materials.forEach((mat) => {
    const rec = mat as unknown as Record<string, unknown>;
    for (const k of TEXTURE_KEYS) {
      const t = rec[k];
      if (t instanceof THREE.Texture) textures.add(t);
    }
    if (mat instanceof THREE.ShaderMaterial) {
      Object.values(mat.uniforms).forEach((u) => {
        if (u.value instanceof THREE.Texture) textures.add(u.value);
      });
    }
    mat.dispose();
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  root.removeFromParent();
}
