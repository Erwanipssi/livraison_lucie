import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { el, monogramSVG, text } from './dom';

/** Écran de chargement élégant, progression réelle des étapes de construction. */
export class Loader {
  readonly el: HTMLElement;
  private bar: HTMLElement;
  private pct: HTMLElement;
  private label: HTMLElement;
  private value = 0;

  constructor(root: HTMLElement, cfg: AppConfig) {
    this.el = el('div', 'loader', { role: 'status', 'aria-live': 'polite' });
    const mark = el('div', 'loader__mark');
    mark.innerHTML = monogramSVG(cfg.brand.monogram);
    this.label = text('p', 'loader__label', 'Préparation de votre livraison');
    const track = el('div', 'loader__track');
    this.bar = el('div', 'loader__bar');
    track.append(this.bar);
    this.pct = text('span', 'loader__pct', '0 %');
    this.el.append(mark, text('p', 'loader__brand', cfg.brand.name), this.label, track, this.pct);
    root.append(this.el);
  }

  set(p: number, label?: string) {
    this.value = Math.max(this.value, p);
    this.bar.style.transform = `scaleX(${this.value})`;
    this.pct.textContent = `${Math.round(this.value * 100)} %`;
    if (label) this.label.textContent = label;
  }

  async hide() {
    await gsap.to(this.el, { opacity: 0, duration: 1.1, ease: 'power2.inOut', delay: 0.25 });
    this.el.remove();
  }
}
