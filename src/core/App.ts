import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { bloomTimeline } from '../animations/BloomTimeline';
import { deliveryTimeline } from '../animations/DeliveryTimeline';
import { letterCloseTimeline, letterOpenTimeline } from '../animations/LetterTimeline';
import { openingTimeline } from '../animations/OpeningTimeline';
import { FRAME_BOUQUET, FRAME_BOUQUET_W, FRAME_GIFT, FRAME_GIFT_W, type World } from '../animations/World';
import { AudioEngine } from '../audio/AudioEngine';
import { fill, type AppConfig } from '../config';
import { Particles } from '../effects/Particles';
import { Petals } from '../effects/Petals';
import { PostProcessing } from '../effects/PostProcessing';
import { Turntable } from '../interactions/Turntable';
import { Bouquet, type FlowerItem } from '../objects/Bouquet';
import { GiftBox } from '../objects/GiftBox';
import { clearLeafCache } from '../objects/Leaf';
import { DeliveryPanel } from '../ui/DeliveryPanel';
import { Hud } from '../ui/Hud';
import { LetterView } from '../ui/LetterView';
import { Loader } from '../ui/Loader';
import { ReceiptView } from '../ui/ReceiptView';
import { nextFrame, wait } from '../utils/math';
import { FONTS, setMaxAnisotropy } from '../utils/textures';
import { CameraRig } from './Camera';
import { Lighting } from './Lighting';
import { detectQuality, PerformanceMonitor, type QualitySettings } from './Quality';
import { createRenderer } from './Renderer';
import { Stage } from './Scene';
import { StateMachine } from './StateMachine';

/** Orchestrateur : moteur 3D, interface, son et machine à états. */
export class App {
  readonly q: QualitySettings = detectQuality();
  readonly sm = new StateMachine();
  private renderer!: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private rig = new CameraRig();
  private world!: World;
  private clock = new THREE.Clock();
  private time = 0;
  private raf = 0;
  private running = false;
  private dpr = 1;
  private perf!: PerformanceMonitor;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tmp = new THREE.Vector3();
  private letterRead = false;
  private inviteTimer = 0;
  private current: gsap.core.Timeline | null = null;

  private loader!: Loader;
  private hud!: Hud;
  private panel!: DeliveryPanel;
  private letter!: LetterView;
  private receipt!: ReceiptView;
  private audio: AudioEngine;

  constructor(private root: HTMLElement, private canvas: HTMLCanvasElement, private cfg: AppConfig) {
    this.audio = new AudioEngine(cfg.audio);
  }

  async init() {
    const ui = this.root.querySelector<HTMLElement>('#ui')!;
    this.loader = new Loader(ui, this.cfg);
    this.loader.set(0.04);

    await this.loadFonts();
    this.loader.set(0.15, 'Choix du papier et du ruban');
    await nextFrame();

    // ── Moteur ───────────────────────────────────────────────────────────
    const q = this.q;
    this.renderer = createRenderer(this.canvas, q);
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.dpr = this.renderer.getPixelRatio();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();
    const lights = new Lighting(this.scene, q);
    const stage = new Stage(this.scene, q.shadows > 0);
    this.loader.set(0.3, 'Installation du socle');
    await nextFrame();

    const post = new PostProcessing(this.renderer, this.scene, this.rig.camera, q, this.cfg.effects.bloom);
    const particles = new Particles(this.scene, q.particles * this.cfg.effects.particles, this.dpr);
    const petals = new Petals(this.scene, Math.round(75 * q.petals * this.cfg.effects.petals), this.cfg.bouquet.flowers.flatMap((f) => f.colors));
    const turntable = new Turntable(this.canvas, this.rig);
    this.loader.set(0.4, 'Emballage du colis');
    await nextFrame();

    const gift = new GiftBox(this.cfg, q.shadows > 0);
    this.scene.add(gift.root);
    this.loader.set(0.55, 'Composition du bouquet');
    await nextFrame();
    const bouquet = this.buildBouquet();
    this.loader.set(0.82, 'Derniers détails');
    await nextFrame();

    const reduced = q.reducedMotion;
    this.world = {
      cfg: this.cfg,
      q,
      speed: this.cfg.timing.speed * (reduced ? 0.6 : 1),
      reduced,
      scene: this.scene,
      rig: this.rig,
      lights,
      stage,
      post,
      particles,
      petals,
      audio: this.audio,
      turntable,
      gift,
      bouquet,
      state: { bouquetFloat: 0, bouquetBaseY: 0.24, contact: 0.8 },
    };

    // ── Interface ────────────────────────────────────────────────────────
    this.hud = new Hud(ui, this.cfg);
    this.hud.onSound = () => this.audio.toggle();
    this.panel = new DeliveryPanel(ui, this.cfg);
    this.panel.el.style.display = 'none';
    this.panel.onOpen = () => this.open();
    this.letter = new LetterView(ui, this.cfg, reduced);
    this.letter.onClose = () => this.closeLetter();
    this.letter.onContinue = () => this.showReceipt();
    this.letter.onWrite = () => this.audio.sfx('paper');
    this.receipt = new ReceiptView(ui, this.cfg);
    this.receipt.onReplay = () => this.replayBouquet();
    this.receipt.onReread = () => this.rereadLetter();
    this.receipt.onRestart = () => this.restart();
    this.receipt.onStamp = () => this.audio.sfx('stamp');
    this.receipt.onPrint = () => this.audio.sfx('paper');

    turntable.onTap = (x, y) => this.tap(x, y);
    turntable.onHover = (x, y) => this.hover(x, y);
    turntable.onInteract = () => this.hud.hideHint();

    this.perf = new PerformanceMonitor((level) => this.degrade(level));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => this.onVisibility());

    await this.warmup();
    this.loader.set(1, 'Votre livraison est prête');
    this.running = true;
    this.clock.start();
    this.loop();
    await wait(250);
    await this.loader.hide();
    this.enterDelivery();
  }

  private async loadFonts() {
    if (!document.fonts) return;
    const families = [
      `48px ${FONTS.script}`,
      `48px ${FONTS.hand}`,
      `500 48px ${FONTS.serif}`,
      `400 48px ${FONTS.serif}`,
    ];
    await Promise.race([Promise.all(families.map((f) => document.fonts.load(f))).catch(() => undefined), wait(3000)]);
  }

  private buildBouquet() {
    const b = new Bouquet(this.cfg, this.q.shadows > 0);
    b.root.visible = false;
    b.resetGrowth();
    this.scene.add(b.root);
    return b;
  }

  /** Compile les shaders en amont (pas de saccade à l'ouverture). */
  private async warmup() {
    const w = this.world;
    const b = w.bouquet;
    b.root.visible = true;
    b.flowers.forEach((f) => ((f.headScale = 1), (f.grow = 1), f.leaves.forEach((l) => (l.open = 1))));
    b.crowns.forEach((c) => (c.pop = 1));
    b.sprigs.forEach((s) => (s.grow = 1));
    b.foliage.forEach((f) => f.leaves.forEach((l) => (l.open = 1)));
    b.update(0);
    w.petals.mesh.visible = true;
    w.particles.sparks.visible = true;
    w.particles.shaft.visible = true;
    w.stage.halo.material.opacity = 0.01;
    this.rig.update();
    try {
      await this.renderer.compileAsync(this.scene, this.rig.camera);
    } catch {
      this.renderer.compile(this.scene, this.rig.camera);
    }
    this.renderFrame();
    b.resetGrowth();
    b.update(0);
    b.root.visible = false;
    w.petals.mesh.visible = false;
    w.particles.shaft.visible = false;
    w.stage.halo.material.opacity = 0;
  }

  // ── Actes ──────────────────────────────────────────────────────────────

  private enterDelivery() {
    if (!this.sm.go('DELIVERY', true)) return;
    const w = this.world;
    w.turntable.attach(w.gift.spin);
    w.turntable.enabled = true;
    w.turntable.autoRotate = 0.18;
    w.turntable.zoomMin = 0.85;
    w.turntable.zoomMax = 1.1;
    this.hud.show();
    this.hud.chapter('I', 'La livraison');
    // le panneau est mis en page (invisible) pour mesurer le cadrage
    this.panel.el.style.display = '';
    this.panel.el.style.opacity = '0';
    this.panel.visible = true;
    const insets = this.panel.insets();
    this.current = deliveryTimeline(w, insets);
    this.current.call(() => {
      this.panel.show();
    }, [], 2.0 * w.speed);
    this.current.call(() => this.hud.hint('Faites tourner le colis du bout du doigt', 6), [], 4.2 * w.speed);
  }

  private async open() {
    if (!this.sm.can('OPENING')) return;
    this.sm.go('OPENING');
    this.sm.busy = true;
    const w = this.world;
    w.turntable.enabled = false;
    w.turntable.autoRotate = 0;
    this.hud.hideHint();
    this.audio.sfx('chime');
    this.panel.hide();
    this.hud.chapter('II', 'L’ouverture');
    this.current?.kill();
    this.current = openingTimeline(w);
    await this.current;
    this.sm.busy = false;
    this.bloom();
  }

  private async bloom() {
    if (!this.sm.go('BLOOMING')) return;
    this.sm.busy = true;
    this.hud.chapter('III', 'L’éclosion');
    const w = this.world;
    this.current = bloomTimeline(w);
    await this.current;
    this.sm.busy = false;
    this.sm.go('BOUQUET');
    this.enterBouquet(true);
  }

  private enterBouquet(first: boolean) {
    const w = this.world;
    w.turntable.attach(w.bouquet.spin);
    w.turntable.enabled = true;
    w.turntable.autoRotate = 0.12;
    w.turntable.zoomMin = 0.72;
    w.turntable.zoomMax = 1.12;
    window.clearTimeout(this.inviteTimer);
    if (first) {
      this.hud.hint('Faites-le tourner, touchez les fleurs…', 6);
      this.inviteTimer = window.setTimeout(() => {
        if (!this.sm.is('BOUQUET')) return;
        gsap.to(w.bouquet.envelope, { invite: 1, duration: 1.5 });
        this.hud.hint(this.cfg.letter.envelopeHint, 7);
      }, 6500);
    } else {
      gsap.to(w.bouquet.envelope, { invite: 1, duration: 1.5 });
    }
  }

  private async openLetter() {
    if (!this.sm.can('LETTER')) return;
    this.sm.go('LETTER');
    this.sm.busy = true;
    window.clearTimeout(this.inviteTimer);
    this.hud.hideHint();
    this.hud.chapter('IV', 'La lettre');
    const w = this.world;
    w.turntable.enabled = false;
    w.turntable.autoRotate = 0;
    gsap.to(this.rig, { zoom: 1, duration: 1 });
    gsap.to(w.state, { bouquetFloat: 0, duration: 0.8 });
    const first = !w.bouquet.envelope.opened;
    this.current = letterOpenTimeline(w, first);
    await this.current;
    await this.letter.show(!this.letterRead);
    this.letterRead = true;
    this.sm.busy = false;
  }

  private async closeLetter() {
    if (this.sm.busy || !this.sm.is('LETTER')) return;
    this.sm.busy = true;
    await this.letter.hide();
    this.current = letterCloseTimeline(this.world);
    gsap.to(this.world.state, { bouquetFloat: 1, duration: 1.5, delay: 1.5 });
    await this.current;
    this.sm.busy = false;
    this.sm.go('BOUQUET');
    this.enterBouquet(false);
  }

  private async showReceipt() {
    if (!this.sm.can('COMPLETED')) return;
    this.sm.busy = true;
    await this.letter.hide();
    this.sm.go('COMPLETED', true);
    this.hud.chapter('V', 'Le reçu');
    letterCloseTimeline(this.world);
    gsap.to(this.world.state, { bouquetFloat: 1, duration: 1.5, delay: 1.5 });
    await this.receipt.show(this.world.reduced);
    this.sm.busy = false;
  }

  private async replayBouquet() {
    if (this.sm.busy || !this.sm.can('BOUQUET')) return;
    this.sm.busy = true;
    await this.receipt.hide();
    this.sm.busy = false;
    this.sm.go('BOUQUET');
    this.enterBouquet(false);
  }

  private async rereadLetter() {
    if (this.sm.busy || !this.sm.is('COMPLETED')) return;
    this.sm.busy = true;
    await this.receipt.hide();
    this.sm.busy = false;
    this.sm.go('BOUQUET', true);
    await wait(900);
    this.openLetter();
  }

  /** Recommencer : libère tout le contenu 3D et le reconstruit. */
  private async restart() {
    if (this.sm.busy) return;
    this.sm.busy = true;
    const w = this.world;
    const veil = document.createElement('div');
    veil.className = 'veil';
    this.root.append(veil);
    await gsap.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.inOut' });
    await this.receipt.hide();
    gsap.killTweensOf([this.rig, this.rig.target, w.state]);
    window.clearTimeout(this.inviteTimer);

    w.gift.dispose();
    w.bouquet.dispose();
    clearLeafCache();
    w.gift = new GiftBox(this.cfg, this.q.shadows > 0);
    this.scene.add(w.gift.root);
    w.bouquet = this.buildBouquet();
    w.petals.reset();
    const su = w.particles.sparks.material.uniforms;
    su.uIntensity.value = 0;
    su.uSpread.value = 0;
    w.particles.shaft.material.uniforms.uIntensity.value = 0;
    w.lights.boxLight.intensity = 0;
    w.lights.hero.intensity = 0;
    w.stage.halo.material.opacity = 0;
    w.post.boost = 0;
    w.state.bouquetFloat = 0;
    w.state.contact = 0.8;
    this.rig.zoom = 1;
    this.letterRead = false;
    this.panel.reset();
    this.sm.busy = false;
    this.enterDelivery();
    await gsap.to(veil, { opacity: 0, duration: 1.2, delay: 0.3 });
    veil.remove();
  }

  // ── Interactions ───────────────────────────────────────────────────────

  private setRay(x: number, y: number) {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
  }

  private tap(x: number, y: number) {
    const w = this.world;
    this.setRay(x, y);
    if (this.sm.is('BOUQUET') && !this.sm.busy) {
      const envHit = this.raycaster.intersectObject(w.bouquet.envelope.proxy, false);
      const hits = this.raycaster.intersectObjects(w.bouquet.proxies, false);
      if (envHit.length && (!hits.length || envHit[0].distance < hits[0].distance + 0.1)) {
        this.openLetter();
        return;
      }
      if (hits.length) {
        const f = hits[0].object.userData.flower as FlowerItem;
        w.bouquet.touch(f, (pos) => {
          w.petals.emitAt(pos, 3);
          this.audio.sfx('note', Math.floor(Math.random() * 8));
        });
      }
    } else if (this.sm.is('DELIVERY')) {
      const hit = this.raycaster.intersectObject(w.gift.spin, true);
      if (hit.length && !gsap.isTweening(w.gift.spin.position)) {
        this.audio.sfx('note', 3);
        gsap.timeline()
          .to(w.gift.spin.position, { y: 0.1, duration: 0.22, ease: 'power2.out' })
          .to(w.gift.spin.position, { y: 0, duration: 0.6, ease: 'bounce.out' });
      }
    }
  }

  private hover(x: number, y: number) {
    if (x < -1000) {
      this.canvas.style.cursor = '';
      return;
    }
    const w = this.world;
    this.setRay(x, y);
    if (this.sm.is('BOUQUET', 'BLOOMING')) w.petals.setPointerRay(this.raycaster.ray);
    let pointer = false;
    if (this.sm.is('BOUQUET')) {
      pointer =
        this.raycaster.intersectObject(w.bouquet.envelope.proxy, false).length > 0 ||
        this.raycaster.intersectObjects(w.bouquet.proxies, false).length > 0;
    }
    this.canvas.style.cursor = pointer ? 'pointer' : this.sm.is('DELIVERY', 'BOUQUET') ? 'grab' : '';
  }

  // ── Boucle de rendu ────────────────────────────────────────────────────

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.update(dt);
    this.renderFrame();
    this.perf.sample(dt);
  };

  private update(dt: number) {
    const w = this.world;
    const t = this.time;
    w.turntable.update(dt);
    if (w.gift.root.visible) w.gift.update(t);
    if (w.bouquet.root.visible) {
      w.bouquet.update(t);
      if (!gsap.isTweening(w.bouquet.root.position)) {
        w.bouquet.root.position.y = w.state.bouquetBaseY + Math.sin(t * 0.9) * 0.025 * w.state.bouquetFloat;
      }
    }
    w.petals.update(dt, t);
    this.rig.update(t);
    w.stage.update(t, this.rig.backDirection(this.tmp));
    const focus = this.rig.camera.position.distanceTo(this.rig.target);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = focus + 2.5;
    fog.far = focus + 14;
    w.particles.update(t, focus);
    // ombre de contact : s'adoucit quand le colis s'élève
    if (this.sm.is('DELIVERY', 'OPENING')) {
      const h = w.gift.height;
      const m = w.stage.contact.material;
      if (!gsap.isTweening(m)) m.opacity = Math.max(0.25, 0.85 - h * 3.5) * (this.sm.is('OPENING') ? 1 : 1);
      w.stage.contact.scale.setScalar(0.85 + h * 2);
    }
  }

  private renderFrame() {
    this.world.post.render();
  }

  private resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(W, H, false);
    this.rig.resize(W, H);
    this.world.post.setSize(W, H, this.dpr);
    this.world.particles.setPixelRatio(this.dpr);
    if (this.sm.is('DELIVERY') && !gsap.isTweening(this.rig)) {
      const ins = this.panel.insets();
      gsap.to(this.rig, {
        insetBottom: ins.bottom,
        insetRight: ins.right,
        dist: this.rig.fit(FRAME_GIFT, ins.bottom, ins.right, FRAME_GIFT_W),
        duration: 0.6,
        ease: 'power2.out',
      });
    } else if (this.sm.is('BOUQUET', 'COMPLETED')) {
      gsap.to(this.rig, { dist: this.rig.fit(FRAME_BOUQUET, 0, 0, FRAME_BOUQUET_W), duration: 0.6 });
    }
  }

  private degrade(level: number): boolean {
    if (this.dpr > 1.01) {
      this.dpr = Math.max(1, this.dpr - 0.35);
      this.resize();
      return true;
    }
    if (level >= 2 && this.world.post.disableBloom()) return true;
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
      return true;
    }
    return false;
  }

  private onVisibility() {
    if (document.hidden) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      gsap.globalTimeline.pause();
      this.audio.setPaused(true);
    } else if (!this.running) {
      this.running = true;
      this.clock.getDelta();
      gsap.globalTimeline.resume();
      this.audio.setPaused(false);
      this.loop();
    }
  }

  /** Texte du prénom utilisé dans le titre du document. */
  static title(cfg: AppConfig) {
    return fill('Une livraison pour {recipient}', cfg);
  }
}
