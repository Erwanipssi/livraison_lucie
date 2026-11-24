import * as THREE from 'three';
import { fbm3, noise3, Rng } from './math';

export const FONTS = {
  serif: '"Cormorant Garamond", Georgia, serif',
  script: '"Pinyon Script", "Snell Roundhand", cursive',
  hand: '"Caveat", "Segoe Print", cursive',
  sans: '"Inter", system-ui, sans-serif',
};

let maxAniso = 4;
export function setMaxAnisotropy(v: number) {
  maxAniso = v;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Bump de papier : fibres + grain. Niveaux de gris, tuilable. */
export function paperBump(size = 256, seed = 3): THREE.Texture {
  const { c, ctx } = canvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // grain isotrope : nuages doux + grain fin
      const n = fbm3(x * 0.04 + seed, y * 0.04, seed * 0.37, 3);
      const fine = noise3(x * 0.45, y * 0.45, seed) * 0.5;
      const v = Math.max(0, Math.min(255, (0.35 + n * 0.3 + fine * 0.25 + Math.random() * 0.1) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, false, true);
}

/** Marbre ivoire très doux, périodique horizontalement (pour le socle). */
export function marbleTexture(w = 512, h = 256): THREE.Texture {
  const { c, ctx } = canvas(w, h);
  const img = ctx.createImageData(w, h);
  const base = [246, 239, 231];
  const vein = [214, 190, 184];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (x / w) * Math.PI * 2;
      const nx = Math.cos(a) * 1.6, nz = Math.sin(a) * 1.6, ny = (y / h) * 2.2;
      const turb = fbm3(nx * 1.5, ny * 1.5, nz * 1.5, 5);
      const m = Math.abs(Math.sin((nx + ny * 1.7 + turb * 5.5) * 2.2));
      const v = Math.pow(1 - m, 7) * 0.55 + (fbm3(nx * 6, ny * 6, nz * 6, 2) - 0.5) * 0.08;
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) img.data[i + k] = base[k] + (vein[k] - base[k]) * Math.max(0, v);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c);
}

/** Dégradé radial (sprites, ombres de contact, halos). */
export function radialTexture(stops: [number, string][], size = 256): THREE.Texture {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

/** Papier d'emballage : carte couleur + bande dorée en haut, et carte ORM (G=rugosité, B=métal). */
export function wrapPaperTextures(color: string, foil: string) {
  const w = 256, h = 512, band = 7;
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  // fibres délicates
  const rng = new Rng(11);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = rng.next() < 0.5 ? '#ffffff' : '#bfae9a';
    ctx.lineWidth = rng.range(0.4, 1.1);
    const x = rng.range(0, w), y = rng.range(0, h), l = rng.range(4, 18), a = rng.range(0, Math.PI);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = foil;
  ctx.fillRect(0, 0, w, band);
  ctx.fillRect(0, band + 4, w, 2);
  const map = toTexture(c);
  map.flipY = true;

  const o = canvas(w, h);
  o.ctx.fillStyle = 'rgb(0, 215, 0)';
  o.ctx.fillRect(0, 0, w, h);
  o.ctx.fillStyle = 'rgb(0, 80, 255)';
  o.ctx.fillRect(0, 0, w, band);
  o.ctx.fillRect(0, band + 4, w, 2);
  const orm = toTexture(o.c, false);
  return { map, orm };
}

/** Étiquette du colis : « Pour {prénom} ». */
export function labelTexture(lead: string, name: string, number: string, accent: string): THREE.Texture {
  const W = 1024, H = 600;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#fbf6ee';
  ctx.fillRect(0, 0, W, H);
  // grain
  const rng = new Rng(5);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(120,90,70,${rng.range(0.01, 0.04)})`;
    ctx.fillRect(rng.range(0, W), rng.range(0, H), 1.5, 1.5);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8f6f52';
  ctx.font = `500 46px ${FONTS.serif}`;
  ctx.fillText(lead.toUpperCase().split('').join(' '), W / 2 + 60, 190);
  ctx.fillStyle = '#6b2f3c';
  let size = 150;
  ctx.font = `${size}px ${FONTS.script}`;
  while (ctx.measureText(name).width > W - 330 && size > 60) {
    size -= 6;
    ctx.font = `${size}px ${FONTS.script}`;
  }
  ctx.fillText(name, W / 2 + 60, 360);
  ctx.fillStyle = '#a08568';
  ctx.font = `400 34px ${FONTS.serif}`;
  ctx.fillText(`N° ${number}`, W / 2 + 60, 470);
  // trou de l'œillet
  ctx.fillStyle = '#efe3d3';
  ctx.beginPath();
  ctx.arc(150, H / 2, 34, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

/** Décor doré « MAISON FLORALE » sur la face avant du colis (alphaMap). */
export function brandDecalTexture(name: string): THREE.Texture {
  const W = 1024, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `500 92px ${FONTS.serif}`;
  const spaced = name.toUpperCase().split('').join(' ');
  let size = 92;
  while (ctx.measureText(spaced).width > W - 80 && size > 40) {
    size -= 4;
    ctx.font = `500 ${size}px ${FONTS.serif}`;
  }
  ctx.fillText(spaced, W / 2, 138);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, 190);
  ctx.lineTo(W / 2 - 30, 190);
  ctx.moveTo(W / 2 + 30, 190);
  ctx.lineTo(W / 2 + 170, 190);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 190, 6, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c, false);
}

/** Dos de l'enveloppe : doublure sous le rabat, plis de la poche, prénom manuscrit. */
export function envelopeBackTexture(name: string, liner: string): THREE.Texture {
  const W = 1024, H = 712;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#f7f0e4';
  ctx.fillRect(0, 0, W, H);
  // doublure visible quand le rabat est ouvert
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W / 2, H * 0.53);
  ctx.closePath();
  ctx.clip();
  drawLiner(ctx, W, H, liner);
  ctx.restore();
  // plis de la poche
  const g1 = ctx.createLinearGradient(0, H, W / 2, H * 0.45);
  g1.addColorStop(0, 'rgba(160,130,105,0.0)');
  g1.addColorStop(1, 'rgba(160,130,105,0.10)');
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(W / 2, H * 0.47);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, H);
  ctx.lineTo(W / 2, H * 0.47);
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,120,95,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, H - 4);
  ctx.lineTo(W / 2, H * 0.47);
  ctx.lineTo(W - 4, H - 4);
  ctx.stroke();
  // prénom
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5e2a35';
  let size = 104;
  ctx.font = `${size}px ${FONTS.script}`;
  while (ctx.measureText(name).width > W * 0.62 && size > 50) {
    size -= 4;
    ctx.font = `${size}px ${FONTS.script}`;
  }
  ctx.fillText(name, W / 2, H * 0.86);
  addGrain(ctx, W, H, 3000);
  return toTexture(c);
}

function drawLiner(ctx: CanvasRenderingContext2D, W: number, H: number, liner: string) {
  ctx.fillStyle = liner;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(201,163,106,0.55)';
  for (let y = 0; y < H; y += 36) {
    for (let x = (y / 36) % 2 ? 18 : 0; x < W; x += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Face intérieure du rabat (doublure à pois dorés). */
export function linerTexture(liner: string): THREE.Texture {
  const { c, ctx } = canvas(512, 512);
  drawLiner(ctx, 512, 512, liner);
  return toTexture(c);
}

/** Face avant / extérieure en papier ivoire. */
export function ivoryPaperTexture(tint = '#f7f0e4', w = 512, h = 512): THREE.Texture {
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  addGrain(ctx, w, h, 2500);
  return toTexture(c);
}

/** Carte à l'intérieur de l'enveloppe (aperçu manuscrit). */
export function cardTexture(greeting: string, line: string): THREE.Texture {
  const W = 1024, H = 680;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#fdf8f0';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(201,163,106,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.fillStyle = '#4a2a30';
  ctx.font = `78px ${FONTS.script}`;
  ctx.fillText(greeting, 90, 160);
  ctx.font = `52px ${FONTS.hand}`;
  ctx.fillStyle = '#5a3a3e';
  const words = line.split(' ');
  let y = 260, cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > W - 180) {
      ctx.fillText(cur, 90, y);
      y += 70;
      cur = w;
      if (y > H - 80) break;
    } else cur = test;
  }
  if (y <= H - 80) ctx.fillText(cur, 90, y);
  addGrain(ctx, W, H, 2000);
  return toTexture(c);
}

/** Relief du cachet de cire : initiale + couronne. */
export function sealBumpTexture(initial: string): THREE.Texture {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#808080');
  g.addColorStop(0.78, '#7a7a7a');
  g.addColorStop(0.86, '#a0a0a0');
  g.addColorStop(1, '#505050');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#2c2c2c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `120px ${FONTS.script}`;
  ctx.fillText(initial, S / 2, S / 2 + 8);
  // petites feuilles en couronne
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.save();
    ctx.translate(S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.42);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return toTexture(c, false);
}

function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, n: number) {
  const rng = new Rng(w + h);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(120,95,75,${rng.range(0.015, 0.045)})`;
    const s = rng.range(0.8, 2);
    ctx.fillRect(rng.range(0, w), rng.range(0, h), s, s);
  }
}
