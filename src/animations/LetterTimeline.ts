import * as THREE from 'three';
import { gsap } from 'gsap';
import { ENV_H, ENV_W } from '../objects/Envelope';
import type { World } from './World';

/**
 * Acte 4 : l'enveloppe quitte le bouquet et vient face à nous, le cachet se
 * brise, le rabat s'ouvre, la carte glisse. La lettre HTML prend ensuite le relais.
 */
export function letterOpenTimeline(w: World, first: boolean) {
  const env = w.bouquet.envelope;
  const cam = w.rig.camera;
  const s = w.speed;
  w.scene.attach(env.root);

  const vf = THREE.MathUtils.degToRad(cam.fov) / 2;
  const aspect = w.rig.aspect;
  const dW = ENV_W / 0.5 / 2 / (Math.tan(vf) * aspect);
  const dH = (ENV_H * 3.2) / 2 / Math.tan(vf);
  const d = Math.max(dW, dH);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const endPos = cam.position.clone().addScaledVector(fwd, d).addScaledVector(up, -d * Math.tan(vf) * 0.12);
  const endQ = cam.quaternion.clone();
  const startPos = env.root.position.clone();
  const startQ = env.root.quaternion.clone();
  const p = { t: 0 };

  const tl = gsap.timeline();
  tl.to(env, { invite: 0, duration: 0.6 }, 0);
  tl.call(() => w.audio.sfx('paper'), [], 0.1);
  tl.to(
    p,
    {
      t: 1,
      duration: 1.6 * s,
      ease: 'power3.inOut',
      onUpdate: () => {
        env.root.position.lerpVectors(startPos, endPos, p.t);
        env.root.position.addScaledVector(up, Math.sin(p.t * Math.PI) * 0.12);
        env.root.quaternion.slerpQuaternions(startQ, endQ, p.t);
      },
    },
    0,
  );
  let t = 1.6 * s;
  if (first) {
    const [a, b] = env.sealHalves;
    tl.call(() => w.audio.sfx('seal'), [], t + 0.1);
    tl.to(a.position, { x: -0.006, duration: 0.12, ease: 'power2.out' }, t + 0.1);
    tl.to(b.position, { x: 0.006, duration: 0.12, ease: 'power2.out' }, t + 0.1);
    tl.to(a.position, { x: -0.05, z: 0.2, duration: 0.8 * s, ease: 'power2.in' }, t + 0.35);
    tl.to(b.position, { x: 0.05, z: 0.22, duration: 0.8 * s, ease: 'power2.in' }, t + 0.35);
    tl.to(a.rotation, { z: 0.9, x: 0.6, duration: 0.8 * s, ease: 'power1.in' }, t + 0.35);
    tl.to(b.rotation, { z: -0.9, x: 0.5, duration: 0.8 * s, ease: 'power1.in' }, t + 0.35);
    const o = { v: 1 };
    tl.to(o, { v: 0, duration: 0.5 * s, onUpdate: () => env.setSealOpacity(o.v) }, t + 0.7 * s);
    t += 0.7 * s;
    tl.to(env.flap.rotation, { x: -2.95, duration: 1.1 * s, ease: 'power2.inOut' }, t);
    tl.call(() => w.audio.sfx('paper'), [], t + 0.2);
    t += 0.9 * s;
  }
  tl.to(env.card.position, { y: ENV_H * 0.7, duration: 1.1 * s, ease: 'power2.out' }, t);
  tl.to(env.card.position, { z: 0.03, duration: 0.6 * s, ease: 'power2.inOut' }, t + 0.8 * s);
  tl.call(() => {
    env.opened = true;
  });
  return tl;
}

/** Retour de l'enveloppe dans le bouquet, carte à moitié glissée. */
export function letterCloseTimeline(w: World) {
  const env = w.bouquet.envelope;
  const s = w.speed;
  const content = w.bouquet.content;
  content.updateMatrixWorld(true);
  const home = new THREE.Matrix4().compose(env.homePosition, env.homeQuaternion, new THREE.Vector3(1, 1, 1));
  const world = new THREE.Matrix4().multiplyMatrices(content.matrixWorld, home);
  const endPos = new THREE.Vector3();
  const endQ = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  world.decompose(endPos, endQ, sc);
  const startPos = env.root.position.clone();
  const startQ = env.root.quaternion.clone();
  const startScale = env.root.scale.clone();
  const p = { t: 0 };
  const tl = gsap.timeline();
  tl.to(env.card.position, { y: ENV_H * 0.28, z: 0, duration: 0.8 * s, ease: 'power2.inOut' }, 0);
  tl.to(
    p,
    {
      t: 1,
      duration: 1.5 * s,
      ease: 'power3.inOut',
      onUpdate: () => {
        env.root.position.lerpVectors(startPos, endPos, p.t);
        env.root.quaternion.slerpQuaternions(startQ, endQ, p.t);
        env.root.scale.lerpVectors(startScale, sc, p.t);
      },
      onComplete: () => {
        content.attach(env.root);
        env.root.position.copy(env.homePosition);
        env.root.quaternion.copy(env.homeQuaternion);
        env.root.scale.set(1, 1, 1);
      },
    },
    0.3,
  );
  return tl;
}
