import type * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AppConfig } from '../config';
import type { CameraRig } from '../core/Camera';
import type { Lighting } from '../core/Lighting';
import type { QualitySettings } from '../core/Quality';
import type { Stage } from '../core/Scene';
import type { Particles } from '../effects/Particles';
import type { Petals } from '../effects/Petals';
import type { PostProcessing } from '../effects/PostProcessing';
import type { Turntable } from '../interactions/Turntable';
import type { Bouquet } from '../objects/Bouquet';
import type { GiftBox } from '../objects/GiftBox';

/** Tout ce dont les séquences cinématiques ont besoin. */
export interface World {
  cfg: AppConfig;
  q: QualitySettings;
  /** multiplicateur de durée (config × reduced-motion) */
  speed: number;
  reduced: boolean;
  scene: THREE.Scene;
  rig: CameraRig;
  lights: Lighting;
  stage: Stage;
  post: PostProcessing;
  particles: Particles;
  petals: Petals;
  audio: AudioEngine;
  turntable: Turntable;
  gift: GiftBox;
  bouquet: Bouquet;
  /** paramètres animables de l'orchestrateur */
  state: { bouquetFloat: number; bouquetBaseY: number; contact: number };
}

/** Taille de cadrage du colis sur son socle, et du bouquet. */
export const FRAME_GIFT = 2.15;
export const FRAME_GIFT_W = 1.75;
export const FRAME_BOUQUET = 2.5;
export const FRAME_BOUQUET_W = 1.65;
