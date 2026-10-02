# Vidéo de présentation (motion design)

| Fichier | Contenu |
|---|---|
| `smart-tontine-presentation.mp4` | Vidéo finale 1920 × 1080, 30 i/s, 65 s, avec musique |
| `couverture.jpg` | Image de couverture (vignette YouTube, Facebook, WhatsApp) |
| `index.html` | La composition animée (s'ouvre aussi dans un navigateur et se joue en boucle) |
| `render.mjs` | Rendu image par image puis encodage MP4 (Playwright + ffmpeg) |
| `soundtrack.py` | Musique originale synthétisée (aucun droit d'auteur) |
| `assets/` | Captures réelles de l'application et de la plateforme, police Inter |

## Déroulé (65 s)

| Temps | Scène | Message |
|---|---|---|
| 0 – 5 s | Ouverture | Logo animé, « La tontine en ligne, sûre et sans espèces » |
| 5 – 12 s | Le constat | Cahiers et espèces, trésorier qui disparaît, impayés, pas de crédit |
| 12 – 20 s | La solution | L'app dans un téléphone, Orange Money · Moov Money · Wave, pot versé automatiquement |
| 20 – 29 s | Comment ça marche | 4 étapes, anneau des tours 1 → 10 |
| 29 – 36 s | Sécurité | Clavier PIN, caution, fonds cantonnés BCEAO, paiements vérifiés |
| 36 – 44 s | Score et crédit | Score qui monte jusqu'à 780, avance sur tontine, microcrédit |
| 44 – 51 s | Tontines de biens | Moto, réfrigérateur, téléphone ; séquestre puis livraison |
| 51 – 59 s | Plateforme web | Espace membre et portail partenaire à sa marque |
| 59 – 65 s | Conclusion | « Cotisez. Recevez. Grandissez. » · Android, iPhone, web · Burkina Faso puis UEMOA |

## Modifier et refaire la vidéo

```bash
# 1. Modifier les textes ou les temps dans index.html (chaque animation indique son instant en secondes)
node render.mjs --stills 3,17,41      # aperçus PNG à ces instants
OUT=video.mp4 node render.mjs          # vidéo sans son — environ 2 min 30
python3 soundtrack.py                  # → soundtrack.wav
ffmpeg -i video.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest smart-tontine-presentation.mp4
```
Prérequis : Node 22, Playwright (Chromium), ffmpeg, Python 3 + numpy.
