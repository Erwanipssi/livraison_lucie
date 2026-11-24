import { gsap } from 'gsap';
import type { AppConfig } from '../config';
import { DeliveryPanel } from './DeliveryPanel';
import { Hud } from './Hud';
import { LetterView } from './LetterView';
import { ReceiptView } from './ReceiptView';
import { el, text } from './dom';
import { AudioEngine } from '../audio/AudioEngine';

/** Bouquet en dessin au trait (SVG), animé au tracé. */
function bouquetSVG() {
  const rose = (x: number, y: number, s: number) => `
    <g transform="translate(${x} ${y}) scale(${s})" class="fb-flower">
      <path d="M0 0 C -14 -2, -18 -18, -4 -24 C 10 -30, 22 -16, 14 -4 C 8 6, -8 8, -12 -2 C -16 -12, -4 -20, 4 -16 C 10 -12, 8 -4, 2 -4 C -3 -4, -4 -9, 0 -11" />
      <path d="M-20 -8 C -26 6, -10 18, 4 16 C 20 14, 28 0, 22 -14" />
    </g>`;
  const tulip = (x: number, y: number, s: number) => `
    <g transform="translate(${x} ${y}) scale(${s})" class="fb-flower">
      <path d="M-12 0 C -16 -16, -10 -30, -6 -34 C -4 -26, 0 -22, 0 -22 C 0 -22, 4 -26, 6 -34 C 10 -30, 16 -16, 12 0 C 6 6, -6 6, -12 0 Z" />
    </g>`;
  return `
<svg class="fb-bouquet" viewBox="0 0 300 380" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path class="fb-stem" d="M150 300 C 140 240, 110 200, 96 150" />
    <path class="fb-stem" d="M150 300 C 150 230, 150 190, 150 120" />
    <path class="fb-stem" d="M150 300 C 160 240, 190 200, 204 152" />
    <path class="fb-stem" d="M150 300 C 146 250, 124 220, 118 196" />
    <path class="fb-stem" d="M150 300 C 156 250, 178 222, 184 198" />
    <path class="fb-leaf" d="M128 220 C 100 214, 86 196, 84 180 C 104 182, 122 196, 128 220 Z" />
    <path class="fb-leaf" d="M172 222 C 200 214, 214 198, 216 182 C 196 184, 178 198, 172 222 Z" />
    ${rose(96, 150, 1.6)}${rose(150, 118, 1.8)}${rose(204, 152, 1.5)}${tulip(118, 196, 1.3)}${tulip(184, 198, 1.25)}
    <path class="fb-wrap" d="M150 330 L 70 170 C 110 190, 130 186, 150 196 C 170 186, 190 190, 230 170 Z" />
    <path class="fb-wrap" d="M120 290 C 135 282, 165 282, 180 290" />
    <path class="fb-bow" d="M150 292 C 130 276, 116 284, 122 296 C 128 306, 146 298, 150 292 C 154 298, 172 306, 178 296 C 184 284, 170 276, 150 292 M150 292 L 138 330 M150 292 L 164 332" />
  </g>
</svg>`;
}

/**
 * Expérience HTML/CSS simplifiée lorsque WebGL 2 n'est pas disponible :
 * même parcours (livraison → bouquet → lettre → reçu), sans 3D.
 */
export function mountFallback(root: HTMLElement, cfg: AppConfig) {
  document.documentElement.classList.add('no-webgl');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = new AudioEngine(cfg.audio);
  const hud = new Hud(root, cfg);
  hud.onSound = () => audio.toggle();
  hud.show();

  const stage = el('div', 'fb-stage');
  stage.innerHTML = bouquetSVG();
  const envBtn = text('button', 'btn btn--primary fb-envelope', 'Ouvrir l’enveloppe') as HTMLButtonElement;
  envBtn.type = 'button';
  stage.append(envBtn);
  stage.style.display = 'none';
  root.append(stage);

  const panel = new DeliveryPanel(root, cfg);
  const letter = new LetterView(root, cfg, reduced);
  const receipt = new ReceiptView(root, cfg);
  let letterRead = false;

  panel.show();
  panel.onOpen = async () => {
    audio.sfx('lid');
    await panel.hide();
    stage.style.display = '';
    const paths = stage.querySelectorAll<SVGPathElement>('path');
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    await gsap.to(paths, { strokeDashoffset: 0, duration: reduced ? 0.6 : 2.4, stagger: 0.08, ease: 'power2.inOut' });
    gsap.fromTo(envBtn, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 });
  };
  envBtn.addEventListener('click', async () => {
    audio.sfx('seal');
    await letter.show(!letterRead);
    letterRead = true;
  });
  letter.onWrite = () => audio.sfx('paper');
  letter.onClose = () => letter.hide();
  letter.onContinue = async () => {
    await letter.hide();
    receipt.show(reduced);
  };
  receipt.onStamp = () => audio.sfx('stamp');
  receipt.onReplay = () => receipt.hide();
  receipt.onReread = async () => {
    await receipt.hide();
    letter.show(false);
  };
  receipt.onRestart = () => location.reload();
}
