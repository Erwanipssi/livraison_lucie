import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { fill } from '../config';
import { el, text } from './dom';

/**
 * Lettre en HTML/CSS (lisibilité mobile) : dépliage en trois volets puis
 * apparition du texte mot à mot, comme tracé à la plume.
 */
export class LetterView {
  readonly el: HTMLElement;
  private paper: HTMLElement;
  private words: HTMLElement[] = [];
  private actions: HTMLElement;
  private backdrop: HTMLElement;
  onClose: () => void = () => {};
  onContinue: () => void = () => {};
  onWrite: () => void = () => {};
  private tl: gsap.core.Timeline | null = null;

  constructor(root: HTMLElement, cfg: AppConfig, private reduced: boolean) {
    this.el = el('div', 'letter-layer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lettre' });
    this.backdrop = el('div', 'letter-layer__backdrop');
    const wrap = el('div', 'letter');
    this.paper = el('article', 'letter__paper');
    const greet = el('p', 'letter__greeting');
    const body = el('div', 'letter__body');
    const sign = el('p', 'letter__signature');

    const split = (target: HTMLElement, content: string) => {
      content.split(/(\s+)/).forEach((w) => {
        if (!w.trim()) {
          target.append(document.createTextNode(' '));
          return;
        }
        const s = text('span', 'w', w);
        target.append(s);
        this.words.push(s);
      });
    };
    split(greet, fill(cfg.letter.greeting, cfg));
    cfg.letter.paragraphs.forEach((p) => {
      const para = el('p');
      split(para, fill(p, cfg));
      body.append(para);
    });
    split(sign, fill(cfg.letter.signature, cfg));

    const folds = el('div', 'letter__folds', { 'aria-hidden': 'true' });
    folds.append(el('i'), el('i'));
    this.paper.append(greet, body, sign, folds);
    wrap.append(this.paper);

    this.actions = el('div', 'letter__actions');
    const close = text('button', 'btn btn--ghost', 'Replier la lettre') as HTMLButtonElement;
    close.type = 'button';
    close.addEventListener('click', () => this.onClose());
    const next = text('button', 'btn btn--primary', 'Voir le reçu') as HTMLButtonElement;
    next.type = 'button';
    next.addEventListener('click', () => this.onContinue());
    this.actions.append(close, next);

    this.el.append(this.backdrop, wrap, this.actions);
    this.el.style.display = 'none';
    root.append(this.el);
  }

  async show(firstTime: boolean) {
    this.el.style.display = '';
    this.tl?.kill();
    const tl = gsap.timeline();
    this.tl = tl;
    tl.fromTo(this.backdrop, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0);
    tl.fromTo(
      this.paper,
      { opacity: 0, y: 40, rotateX: 38, clipPath: 'inset(33% 0% 33% 0%)', scale: 0.94 },
      { opacity: 1, y: 0, rotateX: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: this.reduced ? 0.6 : 1.5, ease: 'power3.inOut' },
      0.1,
    );
    tl.fromTo(this.paper.querySelectorAll('.letter__folds i'), { opacity: 0.9 }, { opacity: 0.35, duration: 1.4 }, 0.6);
    if (firstTime && !this.reduced) {
      gsap.set(this.words, { clipPath: 'inset(0 100% 0 0)', opacity: 0 });
      let t = 1.4;
      this.words.forEach((w, i) => {
        const d = 0.12 + w.textContent!.length * 0.035;
        tl.to(w, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: d, ease: 'none', clearProps: 'clipPath' }, t);
        if (i % 6 === 0) tl.call(() => this.onWrite(), [], t);
        t += d * 0.82 + (/[.,!?)]$/.test(w.textContent!) ? 0.25 : 0.02);
      });
      tl.fromTo(this.actions, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, t + 0.2);
    } else {
      gsap.set(this.words, { clearProps: 'clipPath', opacity: 1 });
      tl.fromTo(this.actions, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, 0.8);
    }
    // un tap sur la lettre accélère l'écriture
    this.paper.onclick = () => {
      if (tl.isActive()) tl.timeScale(4);
    };
    await tl;
  }

  async hide() {
    this.tl?.kill();
    await gsap
      .timeline()
      .to(this.actions, { opacity: 0, duration: 0.3 }, 0)
      .to(this.paper, { opacity: 0, y: 30, rotateX: 25, clipPath: 'inset(33% 0% 33% 0%)', duration: 0.9, ease: 'power3.inOut' }, 0)
      .to(this.backdrop, { opacity: 0, duration: 0.7 }, 0.2);
    this.el.style.display = 'none';
  }
}
