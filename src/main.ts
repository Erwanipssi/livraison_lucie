import './styles/main.css';
import { resolveConfig } from './config';
import { App } from './core/App';
import { hasWebGL2 } from './core/Renderer';
import { mountFallback } from './ui/Fallback';

const cfg = resolveConfig();
document.title = App.title(cfg);

const root = document.getElementById('app')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

function start() {
  if (!hasWebGL2()) {
    canvas.remove();
    mountFallback(root.querySelector('#ui')!, cfg);
    return;
  }
  const app = new App(root, canvas, cfg);
  if (import.meta.env.DEV) {
    const dbg = window as unknown as Record<string, unknown>;
    dbg.__app = app;
    // outil de test : avance la scène de `seconds` (onglets non affichés, rAF gelé)
    dbg.__step = async (seconds: number) => {
      const { gsap } = await import('gsap');
      const a = app as unknown as { clock: { getDelta(): number }; time: number; update(dt: number): void; renderFrame(): void };
      const end = performance.now() + seconds * 1000;
      while (performance.now() < end) {
        const t = performance.now();
        while (performance.now() - t < 16) {
          /* attente active */
        }
        await new Promise<void>((r) => {
          const c = new MessageChannel();
          c.port1.onmessage = () => r();
          c.port2.postMessage(0);
        });
        gsap.ticker.tick();
        const dt = Math.min(a.clock.getDelta(), 0.05);
        a.time += dt;
        a.update(dt);
        a.renderFrame();
      }
    };
  }
  app.init().catch((err) => {
    console.error(err);
    if (import.meta.env.DEV) {
      const bad: string[] = [];
      app.scene.traverse((o) => {
        const m = o as import('three').Mesh;
        if (m.geometry?.morphAttributes?.position && !m.morphTargetInfluences) bad.push(`${o.type}:${o.name}`);
      });
      console.error('morph sans influences', bad);
      return;
    }
    // en dernier recours : expérience HTML
    root.querySelectorAll('#ui > *').forEach((n) => n.remove());
    canvas.remove();
    mountFallback(root.querySelector('#ui')!, cfg);
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setTimeout(() => location.reload(), 600);
  });
}

start();
