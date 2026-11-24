import * as THREE from 'three';
import { gsap } from 'gsap';
import { FRAME_BOUQUET, FRAME_BOUQUET_W, type World } from './World';

/**
 * Acte 2 : ouverture cinématique.
 * Rapprochement → le ruban se dénoue → le couvercle se soulève → la lumière
 * jaillit → particules et pétales → les parois s'ouvrent comme une corolle →
 * le bouquet émerge → la caméra recule et tourne pour le révéler.
 */
export function openingTimeline(w: World) {
  const { rig, gift, bouquet, lights, particles, petals, post, stage, audio, turntable } = w;
  const s = w.speed;
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

  // 0. on présente la face avant et on s'approche
  const TAU = Math.PI * 2;
  const face = Math.round((turntable.rotation - 0.3) / TAU) * TAU + 0.3;
  tl.to(turntable, { rotation: face, duration: 1.8 * s, ease: 'power3.inOut' }, 0);
  tl.to(rig, { insetBottom: 0, insetRight: 0, zoom: 1, duration: 1.6 * s }, 0);
  tl.to(rig, { dist: rig.fit(1.75, 0, 0, 1.45), polar: 0.96, azim: 0.32, duration: 2.6 * s, ease: 'power3.inOut' }, 0.1);
  tl.to(rig.target, { y: 0.6, duration: 2.6 * s, ease: 'power3.inOut' }, 0.1);

  // 1. le ruban se dénoue
  const u = 1.7 * s;
  const bow = gift.bow;
  tl.call(() => audio.sfx('untie'), [], u);
  tl.to(bow.knot.scale, { x: '*=1.25', y: '*=0.8', duration: 0.25 * s, ease: 'power1.out' }, u);
  bow.loops.forEach((l, i) => {
    tl.to(l.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.75 * s, ease: 'back.in(1.4)' }, u + 0.15 + i * 0.09 * s);
    tl.to(l.rotation, { y: (i % 2 ? -1 : 1) * 0.9, duration: 0.75 * s, ease: 'power2.in' }, u + 0.15 + i * 0.09 * s);
  });
  bow.tails.forEach((t, i) => {
    tl.to(t.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.7 * s, ease: 'power2.in' }, u + 0.35 + i * 0.1 * s);
  });
  tl.to(bow.knot.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45 * s, ease: 'power2.in' }, u + 0.75 * s);
  tl.to(gift, { ribbonProgress: 0, duration: 1.1 * s, ease: 'power2.in' }, u + 0.45 * s);
  tl.set(gift.ribbonThread, { visible: false }, u + 0.2 * s);
  // l'étiquette glisse et tombe
  const tagP = gift.tag.position;
  tl.to(tagP, { z: 0.72, x: tagP.x + 0.12, duration: 0.6 * s, ease: 'power2.in' }, u + 0.1);
  tl.to(tagP, { y: 0.06, duration: 0.7 * s, ease: 'power2.in' }, u + 0.6 * s);
  tl.to(gift.tag.rotation, { x: -1.2, z: 0.6, duration: 1.0 * s, ease: 'power1.in' }, u + 0.45 * s);
  const tagO = { v: 1 };
  tl.to(tagO, { v: 0, duration: 0.5 * s, onUpdate: () => gift.setTagOpacity(tagO.v) }, u + 0.9 * s);

  // 2. le couvercle se soulève, la lumière s'échappe
  const L = u + 1.7 * s;
  tl.call(() => audio.sfx('lid'), [], L);
  tl.to(gift.lid.position, { y: '+=0.07', duration: 0.4 * s, ease: 'power2.out' }, L);
  tl.to(lights.boxLight, { intensity: 1.5, duration: 0.4 * s, ease: 'power2.out' }, L);
  tl.to(gift.glow.material, { opacity: 0.3, duration: 0.4 * s }, L);
  tl.to(gift.lid.position, { y: '-=0.03', duration: 0.3 * s, ease: 'power2.inOut' }, L + 0.4 * s);
  tl.to(gift.lid.position, { y: 2.4, x: -1.0, z: -1.3, duration: 2.0 * s, ease: 'power2.inOut' }, L + 0.75 * s);
  tl.to(gift.lid.rotation, { x: -0.7, z: 0.45, duration: 2.0 * s, ease: 'power2.inOut' }, L + 0.75 * s);
  const lidO = { v: 1 };
  tl.to(lidO, { v: 0, duration: 0.9 * s, onUpdate: () => gift.setLidOpacity(lidO.v) }, L + 1.7 * s);
  tl.set(gift.lid, { visible: false }, L + 2.7 * s);

  tl.to(lights.boxLight, { intensity: 3.5, duration: 1.4 * s, ease: 'power2.out' }, L + 0.75 * s);
  tl.to(gift.glow.material, { opacity: 0.55, duration: 1.2 * s }, L + 0.75 * s);
  tl.to(particles.shaft.material.uniforms.uIntensity, { value: 0.45, duration: 1.6 * s, ease: 'power2.out' }, L + 0.8 * s);
  tl.to(post, { boost: 0.35, duration: 1.4 * s, ease: 'power2.out' }, L + 0.8 * s);
  tl.to(rig, { shake: 0.5, duration: 0.3, yoyo: true, repeat: 1 }, L + 0.8 * s);
  const su = particles.sparks.material.uniforms;
  tl.to(su.uIntensity, { value: 1, duration: 1.2 * s }, L + 0.9 * s);
  tl.fromTo(su.uSpread, { value: 0.05 }, { value: 1, duration: 3.5 * s, ease: 'power2.out' }, L + 0.9 * s);
  tl.call(() => petals.burst(new THREE.Vector3(0, 0.5, 0), 0.65), [], L + 1.1 * s);
  tl.to(petals, { swirl: 1, duration: 3 * s, ease: 'power1.in' }, L + 1.4 * s);

  // 3. les parois s'ouvrent comme une corolle, le colis se pose
  const Wt = L + 1.5 * s;
  gift.walls.forEach((h, i) => {
    tl.to(h.rotation, { x: Math.PI / 2, duration: 1.0 * s, ease: 'power3.in' }, Wt + i * 0.08 * s);
    tl.to(h.rotation, { x: Math.PI / 2 - 0.06, duration: 0.22 * s, ease: 'power1.out', yoyo: true, repeat: 1 }, Wt + 1.0 * s + i * 0.08 * s);
  });
  tl.to(gift, { floatAmount: 0, duration: 1.4 * s, ease: 'power2.inOut' }, Wt);

  // 4. le bouquet émerge de la lumière
  const B = L + 1.25 * s;
  tl.set(bouquet.root, { visible: true }, B);
  tl.fromTo(bouquet.root.position, { y: -0.15 }, { y: 0.24, duration: 2.8 * s, ease: 'power3.out' }, B);
  tl.fromTo(bouquet.root.scale, { x: 0.45, y: 0.45, z: 0.45 }, { x: 1, y: 1, z: 1, duration: 2.8 * s, ease: 'power3.out' }, B);
  tl.fromTo(bouquet.spin.rotation, { y: -1.4 }, { y: 0, duration: 3.6 * s, ease: 'power3.out' }, B);
  tl.to(w.state, { bouquetFloat: 1, duration: 2 * s }, B + 2 * s);
  tl.to(w.state, { contact: 0.5, duration: 2 * s }, B);

  // 5. la caméra recule et tourne pour révéler le cadeau
  const C = B + 0.7 * s;
  tl.to(rig, { dist: rig.fit(FRAME_BOUQUET, 0, 0, FRAME_BOUQUET_W), polar: 1.3, azim: -0.36, duration: 3.8 * s, ease: 'power2.inOut' }, C);
  tl.to(rig.target, { y: 1.08, duration: 3.8 * s, ease: 'power2.inOut' }, C);

  // 6. la lumière retombe en douceur
  tl.to(particles.shaft.material.uniforms.uIntensity, { value: 0, duration: 2.4 * s }, C + 1.6 * s);
  tl.to(lights.boxLight, { intensity: 0.5, duration: 2.6 * s }, C + 1.4 * s);
  tl.to(gift.glow.material, { opacity: 0.12, duration: 2.4 * s }, C + 1.6 * s);
  tl.to(post, { boost: 0.1, duration: 2.4 * s }, C + 1.2 * s);
  tl.to(lights.hero, { intensity: 12, duration: 3 * s }, C + 0.8 * s);
  tl.to(stage.halo.material, { opacity: 0.3, duration: 2.6 * s }, C + 1 * s);
  tl.to(su.uIntensity, { value: 0.65, duration: 2 * s }, C + 2 * s);
  return tl;
}
