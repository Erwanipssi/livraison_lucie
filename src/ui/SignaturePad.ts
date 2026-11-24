/**
 * Zone de signature tactile à l'encre : lissage quadratique et épaisseur
 * variable selon la vitesse. 100 % locale : rien n'est enregistré ni envoyé.
 */
export class SignaturePad {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawing = false;
  private last: { x: number; y: number; t: number; w: number } | null = null;
  private mid: { x: number; y: number } | null = null;
  length = 0;
  onChange: (length: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width === 0) return;
    const prev = this.length > 0 ? this.canvas.toDataURL() : null;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    if (prev) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = prev;
    }
  }

  private pos(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.drawing = true;
    const p = this.pos(e);
    this.last = { ...p, w: 2.2 };
    this.mid = { x: p.x, y: p.y };
    this.ctx.fillStyle = '#4b2530';
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    this.ctx.fill();
  };

  private move = (e: PointerEvent) => {
    if (!this.drawing || !this.last || !this.mid) return;
    const p = this.pos(e);
    const dx = p.x - this.last.x, dy = p.y - this.last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.2) return;
    const v = dist / Math.max(1, p.t - this.last.t);
    const target = Math.max(0.9, Math.min(3.2, 3.4 - v * 1.4));
    const w = this.last.w + (target - this.last.w) * 0.35;
    const mid = { x: (this.last.x + p.x) / 2, y: (this.last.y + p.y) / 2 };
    const ctx = this.ctx;
    ctx.strokeStyle = '#4b2530';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(this.mid.x, this.mid.y);
    ctx.quadraticCurveTo(this.last.x, this.last.y, mid.x, mid.y);
    ctx.stroke();
    this.mid = mid;
    this.last = { ...p, w };
    this.length += dist;
    this.onChange(this.length);
  };

  private up = () => {
    this.drawing = false;
    this.last = null;
  };

  clear() {
    const r = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, r.width, r.height);
    this.length = 0;
    this.onChange(0);
  }

  destroy() {
    window.removeEventListener('pointerup', this.up);
  }
}
