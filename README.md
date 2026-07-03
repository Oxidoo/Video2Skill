# Video to Skill

Transforme une formation vidéo en `skill.md` exploitable par une IA, avec timestamps, captures analysées, OCR et procédures.

Webapp locale : page unique → drag & drop vidéo → bouton « Créer skill.md » → progression → téléchargement.

## Pipeline

```
vidéo → audio → transcription horodatée → screenshots clés → OCR
→ analyse visuelle → alignement audio+image → procédures
→ génération skill.md → contrôle qualité
```

## Prérequis

- Node.js ≥ 20
- FFmpeg et Tesseract dans le PATH :

**macOS**
```bash
brew install ffmpeg tesseract tesseract-lang
```

**Windows**
```bash
winget install Gyan.FFmpeg
winget install UB-Mannheim.TesseractOCR
```

**Linux**
```bash
sudo apt update
sudo apt install ffmpeg tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng
```

## Option la plus simple : Docker (rien d'autre à installer)

Avec [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé, pas besoin de Node, FFmpeg ni Tesseract :

```bash
# créer .env.local avec tes clés (voir .env.example), puis :
docker compose up --build
```

Ouvre http://localhost:3000. Les jobs sont persistés dans `./data`.

## Installation manuelle

```bash
npm install
cp .env.example .env.local
# Remplir OPENAI_API_KEY et ANTHROPIC_API_KEY dans .env.local
npm run dev
```

Ouvre http://localhost:3000.

## Configuration

Tout est dans `.env.local` (voir `.env.example`) :

- `TRANSCRIPTION_PROVIDER` : `openai` (transcription audio)
- `VISION_PROVIDER` : `anthropic` ou `openai` (analyse des captures)
- `SYNTHESIS_PROVIDER` : `anthropic` ou `openai` (génération skill.md + contrôle qualité)
- Modèles configurables : `OPENAI_TRANSCRIBE_MODEL`, `ANTHROPIC_VISION_MODEL`, etc.
- Tuning : `FRAME_INTERVAL_SEC`, `SCENE_THRESHOLD`, `MAX_VISION_FRAMES`, `OCR_LANGS`

## Données des jobs

Chaque vidéo crée `data/jobs/job_<uuid>/` avec tous les fichiers intermédiaires conservés pour le debug :

```
input/video.mp4
audio/full.wav + chunk_*.wav
frames/*.png
ocr/ocr.json
vision/visual_analysis.json
transcript/transcript.json
merged/timeline.json
output/skill.md + report.json
job.json
```

## Options avancées (UI)

- **Mode ultra précis** : deuxième passe de contrôle qualité après correction.
- **Inclure OCR brut** : injecte le texte OCR dans le contexte de synthèse.
- **Langue** : Français / Anglais / Auto (détection).

## Notes de fiabilité

- Le `skill.md` contient une section « Zones incertaines à vérifier manuellement ».
- Le contrôle qualité produit un `report.json` avec score 0–100 et liste d'incohérences, et corrige automatiquement le skill si nécessaire.
- Aucune étape UI n'est générée à partir du seul audio : sans capture à l'appui, l'étape est marquée incertaine.
