/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURATION — tout ce qui est personnalisable se trouve ici.
 *  Aucune modification du moteur 3D n'est nécessaire.
 *
 *  Astuce confidentialité : GitHub Pages est public. Plutôt que d'écrire les
 *  prénoms ici, tu peux les passer dans le lien partagé :
 *      https://username.github.io/flowers/?pour=Léa&de=Erwan
 *  Les paramètres d'URL remplacent `sender` et `recipient`.
 *
 *  Dans les textes, {recipient} et {sender} sont remplacés automatiquement.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type FlowerKind = 'rose' | 'tulip';

export interface FlowerGroupConfig {
  kind: FlowerKind;
  count: number;
  /** Couleurs de base (une est tirée au hasard pour chaque fleur). */
  colors: string[];
}

export const config = {
  // ── Personnes ────────────────────────────────────────────────────────────
  sender: 'Erwan',
  recipient: 'Lucie',

  // ── Entreprise fictive ───────────────────────────────────────────────────
  brand: {
    name: 'Les Fleurs de Lucie',
    monogram: 'L',
    tagline: 'Rien que pour toi',
  },

  // ── Acte 1 : la livraison ────────────────────────────────────────────────
  delivery: {
    number: '0001',
    status: 'En attente de réception',
    statusSigned: 'Signature reçue',
    mode: 'Un peu particulier',
    intro: 'Une livraison un peu particulière vous attend.',
    tagLine: 'Pour',
    signatureHint: 'Signez ici pour réceptionner',
    openLabel: 'Ouvrir ma livraison',
  },

  // ── Acte 4 : la lettre ───────────────────────────────────────────────────
  letter: {
    greeting: '{recipient},',
    paragraphs: [
      "Je voulais t'offrir des fleurs, mais il me manquait un petit détail.",
      "J'espère que ça te fera plaisir, même si tu en mérites des montagnes (ne prends pas la grosse tête, même si ce serait mérité).",
    ],
    signature: '{sender}',
    envelopeHint: 'Quelque chose se cache parmi les fleurs…',
  },

  // ── Acte 5 : le reçu ─────────────────────────────────────────────────────
  receipt: {
    title: 'Reçu de livraison',
    lines: [
      { label: 'Bouquet personnalisé', value: 'Offert' },
      { label: 'Livraison virtuelle', value: 'Offerte' },
      { label: 'Temps de développement', value: 'Inestimable' },
      { label: 'Adresse de livraison', value: 'Introuvable' },
      { label: 'Frais supplémentaires', value: 'Aucun' },
    ],
    totalLabel: 'Total à régler',
    totalValue: 'Ton plus beau sourire',
    status: 'Livraison effectuée avec succès.',
    finalMessage: "Les vraies fleurs arriveront dès que le livreur aura trouvé ton adresse.",
    stamp: 'Livré',
  },

  // ── Le bouquet ───────────────────────────────────────────────────────────
  bouquet: {
    seed: 1402,
    flowers: [
      { kind: 'rose', count: 12, colors: ['#eeb0b6', '#d98894', '#f5d6cc', '#c56f7f'] },
      { kind: 'tulip', count: 6, colors: ['#f3c2bd', '#f7d9c8', '#efb2b8'] },
    ] as FlowerGroupConfig[],
    /** Petites fleurs décoratives (grappes). */
    blossomClusters: 8,
    blossomColors: ['#fbf4ec', '#f6d6d8', '#f3e2c4'],
    /** Nuages de gypsophile. */
    gypsophila: 6,
    /** Branches d'eucalyptus. */
    eucalyptus: 6,
    /** Feuillage décoratif autour du papier. */
    foliage: 14,
    wrapping: {
      outer: '#f5ede2',
      inner: '#efcfcb',
      foil: '#c9a36a',
    },
    ribbon: '#b4606d',
  },

  // ── Le colis ─────────────────────────────────────────────────────────────
  giftBox: {
    box: '#efd2cb',
    inner: '#f8f1e7',
    ribbon: '#a9566a',
    accent: '#c9a36a',
    tag: '#fbf6ee',
  },

  // ── Effets & rythme ──────────────────────────────────────────────────────
  effects: {
    /** 0 → 1.5 : densité des particules lumineuses. */
    particles: 1,
    /** 0 → 1.5 : densité des pétales flottants. */
    petals: 1,
    /** 0 → 2 : intensité du halo lumineux (bloom). */
    bloom: 1,
  },
  timing: {
    /** Multiplicateur global de durée (1 = normal, 1.3 = plus lent). */
    speed: 1,
  },

  // ── Ambiance sonore (générée en direct, aucune licence nécessaire) ───────
  audio: {
    /** Le son reste désactivé par défaut, la personne choisit de l'activer. */
    enabledByDefault: false,
    volume: 0.55,
    /** Durée d'un accord en secondes (plus grand = plus lent). */
    chordDuration: 8,
    /** Probabilité d'une note de boîte à musique par temps (0 → 1). */
    melodyDensity: 0.55,
  },
};

export type AppConfig = typeof config;

/** Applique les paramètres d'URL (?pour=…&de=…) et renvoie la config résolue. */
export function resolveConfig(): AppConfig {
  const params = new URLSearchParams(window.location.search);
  const clean = (v: string | null) => (v ? v.replace(/[<>]/g, '').trim().slice(0, 32) : '');
  const to = clean(params.get('pour') ?? params.get('to'));
  const from = clean(params.get('de') ?? params.get('from'));
  return {
    ...config,
    recipient: to || config.recipient,
    sender: from || config.sender,
  };
}

/** Remplace {recipient} / {sender} dans un texte. */
export function fill(text: string, cfg: AppConfig): string {
  return text.replace(/\{recipient\}/g, cfg.recipient).replace(/\{sender\}/g, cfg.sender);
}
