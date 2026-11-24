import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { fill } from '../config';
import { el, text } from './dom';
import { SignaturePad } from './SignaturePad';

/** Avis de passage : informations de livraison, signature, bouton d'ouverture. */
export class DeliveryPanel {
  readonly el: HTMLElement;
  private pad: SignaturePad;
  private cta: HTMLButtonElement;
  private status: HTMLElement;
  private sigHint: HTMLElement;
  onOpen: () => void = () => {};
  visible = false;

  constructor(root: HTMLElement, private cfg: AppConfig) {
    const d = cfg.delivery;
    this.el = el('section', 'delivery', { 'aria-label': 'Avis de livraison' });

    const head = el('header', 'delivery__head');
    head.append(
      text('p', 'eyebrow', `Avis de passage · N° ${d.number}`),
      text('h1', 'delivery__intro', fill(d.intro, cfg)),
    );

    const ledger = el('dl', 'ledger');
    const row = (k: string, v: string | HTMLElement, cls = '') => {
      const r = el('div', `ledger__row ${cls}`);
      const dd = el('dd');
      if (typeof v === 'string') dd.textContent = v;
      else dd.append(v);
      r.append(text('dt', '', k), dd);
      ledger.append(r);
    };
    row('Expéditeur', cfg.sender);
    row('Destinataire', cfg.recipient);
    row('N° de livraison', d.number);
    row('Mode de livraison', d.mode);
    this.status = el('span', 'status');
    this.status.append(el('i', 'status__dot'), text('span', 'status__text', d.status));
    row('Statut', this.status, 'ledger__row--wide');

    const sig = el('div', 'signature');
    const canvas = el('canvas', 'signature__canvas', { 'aria-label': 'Zone de signature' });
    this.sigHint = text('span', 'signature__hint', d.signatureHint);
    const line = el('span', 'signature__line');
    line.innerHTML = '<em>×</em>';
    const clear = text('button', 'signature__clear', 'Effacer') as HTMLButtonElement;
    clear.type = 'button';
    clear.addEventListener('click', () => this.pad.clear());
    sig.append(this.sigHint, line, canvas, clear);

    this.cta = el('button', 'cta', { type: 'button', disabled: '' }) as HTMLButtonElement;
    this.cta.innerHTML = `<span>${d.openLabel.replace(/[<>&]/g, '')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
    this.cta.addEventListener('click', () => {
      if (!this.cta.disabled) this.onOpen();
    });

    const note = text('p', 'delivery__note', 'Votre signature reste sur votre appareil.');
    this.el.append(head, ledger, sig, this.cta, note);
    root.append(this.el);

    this.pad = new SignaturePad(canvas);
    this.pad.onChange = (len) => {
      const ok = len > 60;
      this.cta.disabled = !ok;
      this.sigHint.style.opacity = len > 0 ? '0' : '1';
      this.status.classList.toggle('is-ok', ok);
      (this.status.querySelector('.status__text') as HTMLElement).textContent = ok ? d.statusSigned : d.status;
    };
    window.addEventListener('resize', () => this.pad.resize());
  }

  async show() {
    this.visible = true;
    this.el.style.display = '';
    this.pad.resize();
    gsap.fromTo(this.el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
    await gsap.fromTo(
      this.el.querySelectorAll('.delivery__head > *, .ledger__row, .signature, .cta, .delivery__note'),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power2.out', delay: 0.2 },
    );
  }

  async hide() {
    this.visible = false;
    await gsap.to(this.el, { opacity: 0, y: 24, duration: 0.8, ease: 'power2.in' });
    this.el.style.display = 'none';
  }

  reset() {
    this.pad.clear();
    this.el.style.display = 'none';
  }

  /** Fraction de l'écran masquée (bas sur mobile, droite sur grand écran). */
  insets(): { bottom: number; right: number } {
    if (!this.visible) return { bottom: 0, right: 0 };
    const r = this.el.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    if (r.width < W * 0.7) return { bottom: 0, right: Math.min(0.6, (W - r.left) / W) };
    return { bottom: Math.min(0.7, (H - r.top) / H), right: 0 };
  }
}
