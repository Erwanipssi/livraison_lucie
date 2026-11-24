# Les Fleurs de Lucie — livraison florale virtuelle

Une expérience web immersive en cinq actes : un colis de luxe à réceptionner
(avec signature), une ouverture cinématique, un bouquet 3D qui éclôt fleur
après fleur, une lettre manuscrite cachée dans le bouquet, et un reçu de
livraison un peu taquin.

Tout est **généré procéduralement** (aucun modèle 3D, aucune image, aucun son
téléchargé) : roses, tulipes, feuilles, eucalyptus, gypsophile, papier
d'emballage, ruban, cachet de cire, textures de papier et de marbre, musique.

**Stack :** Vite · TypeScript · Three.js · GSAP · GLSL · Web Audio API.
Aucun backend, aucun compte, aucune clé : un site statique hébergé gratuitement
sur GitHub Pages.

---

## Démarrage

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # génère dist/
npm run preview   # sert dist/ localement
```

## Personnalisation

Tout se règle dans **`src/config.ts`**, sans toucher au moteur :

| Clé | Rôle |
| --- | --- |
| `sender`, `recipient` | prénoms de l'expéditeur et de la destinataire |
| `brand` | nom, monogramme et accroche de la maison fictive |
| `delivery` | numéro, statut, mode, texte d'introduction |
| `letter` | salutation, paragraphes, signature, indice de l'enveloppe |
| `receipt` | lignes du reçu, total, statut, message final |
| `bouquet.flowers` | types (`rose`, `tulip`), nombre et couleurs |
| `bouquet.*` | petites fleurs, gypsophile, eucalyptus, feuillage, papier, ruban, `seed` |
| `giftBox` | couleurs du colis, du ruban, de la dorure |
| `effects` | densité des particules / pétales, intensité du halo |
| `timing.speed` | multiplicateur de durée de toutes les animations |
| `audio` | volume, tempo des accords, densité de la mélodie |

Dans les textes, `{recipient}` et `{sender}` sont remplacés automatiquement.
Changer `bouquet.seed` donne une autre composition du bouquet.

### Prénoms via le lien (recommandé)

GitHub Pages est **public** : tout ce qui est dans le dépôt peut être lu.
Pour ne pas écrire les prénoms dans le code, mets-les dans le lien partagé :

```
https://<utilisateur>.github.io/flowers/?pour=Léa&de=Erwan
```

`?pour=` remplace la destinataire et `?de=` l'expéditeur. N'ajoute jamais
d'information sensible (adresse, numéro…) dans le dépôt ni dans le lien.

Autres paramètres utiles : `?quality=low|medium|high` force un niveau de rendu.

## Déploiement gratuit sur GitHub Pages

1. Crée un dépôt **public** sur GitHub (par ex. `flowers`). Les comptes gratuits
   n'ont GitHub Pages que sur les dépôts publics.
2. Pousse le projet sur la branche `main` :
   ```bash
   git remote add origin https://github.com/<utilisateur>/flowers.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Le workflow `.github/workflows/deploy.yml` construit et publie le site à
   chaque push sur `main` (onglet **Actions** pour suivre). L'adresse finale :
   `https://<utilisateur>.github.io/flowers/`.

`vite.config.ts` utilise `base: './'` : les chemins sont relatifs et le site
marche quel que soit le nom du dépôt.

## Architecture

```
src/
├── config.ts               ← personnalisation
├── main.ts                 ← démarrage, détection WebGL 2, repli HTML
├── core/                   ← App (orchestrateur), machine à états, rendu,
│                             caméra, lumières, scène, niveaux de qualité
├── objects/                ← Flower (moteur de pétales), Rose, Tulip, Blossom,
│                             Leaf, Wrapping, Ribbon, GiftBox, Envelope, Bouquet
├── effects/                ← particules GLSL (bokeh), pétales, post-traitement
├── animations/             ← timelines GSAP de chaque acte
├── interactions/           ← plateau tournant (inertie, pincer, tap)
├── ui/                     ← chargement, HUD, avis de passage, signature,
│                             lettre, reçu, repli sans WebGL
├── audio/                  ← musique générative + effets (Web Audio)
├── shaders/                ← GLSL (fond, particules, faisceau)
└── utils/                  ← aléatoire déterministe, bruit, textures canvas
```

**Machine à états :** `LOADING → DELIVERY → OPENING → BLOOMING → BOUQUET ⇄ LETTER → COMPLETED`.
Les transitions invalides et les doubles déclenchements sont refusés pendant
les séquences animées.

**Fleurs procédurales :** chaque pétale est une surface paramétrique (nervure
intégrée avec inclinaison et enroulement, cintrage autour de l'axe, bords
retournés, ondulations). Les roses ont 30 à 36 pétales en spirale d'angle d'or ;
trois états (bouton / mi-ouvert / éclos) sont stockés en *morph targets* pour
une éclosion fluide sur GPU.

**Performances / mobile :** pixel ratio plafonné, niveaux de qualité détectés
(ombres, bloom, MSAA, densité de particules), dégradation automatique si la
fluidité chute, `InstancedMesh` pour les pétales, gypsophile et petites fleurs,
rendu suspendu quand l'onglet est caché, libération GPU au « Recommencer »,
`prefers-reduced-motion`, safe areas iPhone, portrait et paysage.

## Son

La musique (nappes en ré majeur + boîte à musique) et les effets sont
synthétisés en direct avec la Web Audio API : aucun fichier audio, donc aucune
question de licence. Le son est coupé par défaut et s'active avec le bouton
« Son ».
