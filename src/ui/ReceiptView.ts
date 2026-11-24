import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { fill } from '../config';
import { el, monogramSVG, text } from './dom';

/** Reçu de livraison fictif, imprimé ligne à ligne, tamponné « Livré ». */
export class ReceiptView {
  readonly el: HTMLElement;
  private sheet: HTMLElement;
  private stamp: HTMLElement;
  private final: HTMLElement;
  private actions: HTMLElement;
  onReplay: () => void = () => {};
  onReread: () => void = () => {};
  onRestart: () => void = () => {};
  onStamp: () => void = () => {};
  onPrint: () => void = () => {};

  constructor(root: HTMLElement, cfg: AppConfig) {
    const r = cfg.receipt;
    this.el = el('div', 'receipt-layer', { role: 'dialog', 'aria-label': r.title });
    const slot = el('div', 'receipt__slot');
    this.sheet = el('div', 'receipt');
    const logo = el('div', 'receipt__logo');
    logo.innerHTML = monogramSVG(cfg.brand.monogram);
    const now = new Date();
    const date = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    this.sheet.append(
      logo,
      text('p', 'receipt__brand', cfg.brand.name.toUpperCase()),
      text('p', 'receipt__title', `${r.title} n°${cfg.delivery.number}`),
      text('p', 'receipt__meta', `${date} · ${time}`),
      el('hr'),
      this.kv('Expéditeur', cfg.sender),
      this.kv('Destinataire', cfg.recipient),
      el('hr'),
    );
    r.lines.forEach((l) => this.sheet.append(this.kv(l.label, l.value)));
    this.sheet.append(el('hr', 'thick'));
    const total = this.kv(r.totalLabel, r.totalValue);
    total.classList.add('receipt__total');
    this.sheet.append(total, el('hr', 'thick'));
    const status = el('p', 'receipt__status');
    status.append(el('i'), document.createTextNode(r.status));
    this.sheet.append(status, text('p', 'receipt__thanks', 'Merci de votre confiance.'), el('div', 'receipt__barcode'));
    this.stamp = text('div', 'receipt__stamp', r.stamp);
    this.sheet.append(this.stamp);
    slot.append(this.sheet);

    this.final = text('p', 'receipt__final', fill(r.finalMessage, cfg));
    this.actions = el('div', 'receipt__actions');
    const mk = (label: string, cls: string, fn: () => void) => {
      const b = text('button', `btn ${cls}`, label) as HTMLButtonElement;
      b.type = 'button';
      b.addEventListener('click', fn);
      this.actions.append(b);
    };
    mk('Revoir le bouquet', 'btn--primary', () => this.onReplay());
    mk('Relire la lettre', 'btn--ghost', () => this.onReread());
    mk('Recommencer', 'btn--ghost', () => this.onRestart());

    this.el.append(el('div', 'receipt-layer__backdrop'), slot, this.final, this.actions);
    this.el.style.display = 'none';
    root.append(this.el);
  }

  private kv(k: string, v: string) {
    const row = el('div', 'receipt__row');
    row.append(text('span', 'k', k), el('span', 'dots'), text('span', 'v', v));
    return row;
  }

  async show(reduced: boolean) {
    this.el.style.display = '';
    const rows = this.sheet.children;
    const tl = gsap.timeline();
    tl.fromTo(this.el.querySelector('.receipt-layer__backdrop'), { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0);
    tl.call(() => this.onPrint(), [], 0.2);
    tl.fromTo(this.sheet, { yPercent: -102 }, { yPercent: 0, duration: reduced ? 0.6 : 2.2, ease: 'steps(18)' }, 0.2);
    tl.fromTo(rows, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.07 }, 0.3);
    tl.set(this.stamp, { opacity: 0 }, 0);
    tl.fromTo(
      this.stamp,
      { opacity: 0, scale: 2.4, rotate: -24 },
      { opacity: 0.9, scale: 1, rotate: -12, duration: 0.35, ease: 'power4.in', onComplete: () => this.onStamp() },
      reduced ? 0.9 : 2.7,
    );
    tl.fromTo(this.sheet, { x: 0 }, { x: 3, duration: 0.05, yoyo: true, repeat: 3 }, '>');
    tl.fromTo(this.final, { opacity: 0, y: 10, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power2.out' }, '+=0.3');
    tl.fromTo(this.actions.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, '-=0.6');
    await tl;
  }

  async hide() {
    await gsap.to(this.el, { opacity: 0, duration: 0.7, ease: 'power2.in' });
    this.el.style.display = 'none';
    this.el.style.opacity = '';
  }
}
