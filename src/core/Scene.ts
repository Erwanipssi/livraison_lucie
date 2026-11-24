import * as THREE from 'three';
import { backdropFragment, backdropVertex } from '../shaders/backdrop';
import { marbleTexture, radialTexture } from '../utils/textures';

/**
 * Environnement minimaliste : fond dégradé (shader), sol fondu dans le
 * brouillard, socle en marbre ivoire cerclé d'or, ombre de contact et halo.
 */
export class Stage {
  readonly group = new THREE.Group();
  readonly contact: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly halo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly backdrop: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly pedestalRadius = 1.3;

  constructor(scene: THREE.Scene, shadows: boolean) {
    const horizon = new THREE.Color('#f1e1d7');
    scene.fog = new THREE.Fog(horizon.clone(), 6, 17);

    this.backdrop = new THREE.Mesh(
      new THREE.SphereGeometry(40, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color('#f9f2ea') },
          uHorizon: { value: horizon.clone() },
          uBottom: { value: new THREE.Color('#e9d5cb') },
          uGlow: { value: new THREE.Color('#fff1df') },
          uGlowDir: { value: new THREE.Vector3(0, 0.15, -1) },
          uGlowStrength: { value: 0.55 },
          uTime: { value: 0 },
        },
      }),
    );
    this.backdrop.renderOrder = -10;
    this.backdrop.frustumCulled = false;
    this.group.add(this.backdrop);

    // Sol
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshStandardMaterial({ color: '#f0e0d6', roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    floor.receiveShadow = shadows;
    this.group.add(floor);

    // Socle (tour) : profil avec arêtes adoucies
    const R = this.pedestalRadius;
    const prof: [number, number][] = [
      [0, -0.62], [R + 0.02, -0.62], [R + 0.055, -0.6], [R + 0.06, -0.57], [R + 0.06, -0.12],
      [R + 0.05, -0.07], [R + 0.03, -0.035], [R, -0.012], [R - 0.03, 0], [0, 0],
    ];
    const lathe = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 128);
    const marble = marbleTexture();
    const pedestal = new THREE.Mesh(
      lathe,
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        map: marble,
        roughness: 0.32,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
      }),
    );
    pedestal.receiveShadow = shadows;
    pedestal.castShadow = shadows;
    this.group.add(pedestal);

    const gold = new THREE.MeshStandardMaterial({ color: '#cfa56b', metalness: 1, roughness: 0.28 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.062, 0.007, 8, 160), gold);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -0.16;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.062, 0.004, 8, 160), gold);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.52;
    this.group.add(ring1, ring2);

    // Ombre de contact (douce, sous l'objet principal)
    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(90,50,45,0.55)'], [0.45, 'rgba(90,50,45,0.22)'], [1, 'rgba(90,50,45,0)']]),
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      }),
    );
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.002;
    this.group.add(this.contact);

    // Halo chaud au pied du bouquet
    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(255,214,170,0.9)'], [0.35, 'rgba(255,200,170,0.35)'], [1, 'rgba(255,200,170,0)']]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.004;
    this.group.add(this.halo);

    scene.add(this.group);
  }

  update(time: number, glowDir: THREE.Vector3) {
    const u = this.backdrop.material.uniforms;
    u.uTime.value = time;
    (u.uGlowDir.value as THREE.Vector3).lerp(glowDir, 0.08);
  }
}
