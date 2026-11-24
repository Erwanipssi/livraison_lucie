import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { el, monogramSVG, text } from './dom';

/** Marque, bouton son, titres de chapitre et indications discrètes. */
export class Hud {
  readonly el: HTMLElement;
  readonly soundBtn: HTMLButtonElement;
  private chapterEl: HTMLElement;
  private hintEl: HTMLElement;
  private hintTimer = 0;
  onSound: () => Promise<boolean> = async () => false;

  constructor(root: HTMLElement, cfg: AppConfig) {
    this.el = el('div', 'hud');
    const brand = el('div', 'hud__brand');
    const mark = el('span', 'hud__mark');
    mark.innerHTML = monogramSVG(cfg.brand.monogram);
    brand.append(mark, el('span', 'hud__brandtext', {}, [text('strong', '', cfg.brand.name), text('small', '', cfg.brand.tagline)]));

    this.soundBtn = el('button', 'hud__sound', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'Activer le son' }) as HTMLButtonElement;
    this.soundBtn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span><span class="hud__soundlabel">Son</span>`;
    this.soundBtn.addEventListener('click', async () => {
      let on = false;
      try {
        on = await this.onSound();
      } catch (e) {
        console.warn('Audio indisponible', e);
      }
      this.soundBtn.setAttribute('aria-pressed', String(on));
      this.soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
      this.soundBtn.classList.toggle('is-on', on);
    });

    this.chapterEl = el('div', 'hud__chapter', { 'aria-live': 'polite' });
    this.hintEl = el('div', 'hud__hint', { 'aria-live': 'polite' });
    this.el.append(brand, this.soundBtn, this.chapterEl, this.hintEl);
    root.append(this.el);
  }

  show() {
    gsap.fromTo(this.el.children, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'power2.out' });
  }

  chapter(num: string, title: string) {
    const c = this.chapterEl;
    c.innerHTML = '';
    c.append(text('span', 'num', num), text('span', 'title', title));
    gsap.killTweensOf(c);
    gsap.timeline()
      .fromTo(c, { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out' })
      .to(c, { opacity: 0, duration: 1.2, delay: 2.8, ease: 'power2.in' });
  }

  hint(msg: string, duration = 5) {
    window.clearTimeout(this.hintTimer);
    this.hintEl.textContent = msg;
    gsap.killTweensOf(this.hintEl);
    gsap.to(this.hintEl, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' });
    if (duration > 0) this.hintTimer = window.setTimeout(() => this.hideHint(), duration * 1000);
  }

  hideHint() {
    window.clearTimeout(this.hintTimer);
    gsap.to(this.hintEl, { opacity: 0, y: 6, duration: 0.6, ease: 'power2.in' });
  }
}
