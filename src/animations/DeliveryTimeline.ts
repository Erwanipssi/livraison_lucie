import { gsap } from 'gsap';
import { FRAME_GIFT, FRAME_GIFT_W, type World } from './World';

/** Acte 1 : la caméra descend vers le socle, le colis se pose en lévitation. */
export function deliveryTimeline(w: World, insets: { bottom: number; right: number }) {
  const { rig, gift, stage, turntable } = w;
  const s = w.speed;
  const d = rig.fit(FRAME_GIFT, insets.bottom, insets.right, FRAME_GIFT_W);
  const tl = gsap.timeline();
  tl.set(rig, { dist: d * 1.9, polar: 0.72, azim: -1.0, zoom: 1 }, 0);
  tl.set(rig.target, { x: 0, y: 1.1, z: 0 }, 0);
  tl.set(gift.spin.position, { y: 2.6 }, 0);
  tl.set(turntable, { rotation: -1.6 }, 0);
  tl.set(stage.contact.material, { opacity: 0 }, 0);

  tl.to(rig, { dist: d, polar: 1.12, azim: 0.32, duration: 3.8 * s, ease: 'power3.inOut' }, 0);
  tl.to(rig, { insetBottom: insets.bottom, insetRight: insets.right, duration: 2.6 * s, ease: 'power2.inOut' }, 1.0 * s);
  tl.to(rig.target, { y: 0.34, duration: 3.8 * s, ease: 'power3.inOut' }, 0);
  tl.to(gift.spin.position, { y: 0, duration: 2.6 * s, ease: 'power3.out' }, 0.6 * s);
  tl.to(turntable, { rotation: 0.3, duration: 3.2 * s, ease: 'power3.out' }, 0.6 * s);
  tl.to(stage.contact.material, { opacity: 0.8, duration: 2 * s }, 1.4 * s);
  return tl;
}
