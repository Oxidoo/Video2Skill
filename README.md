# Video2Skill

Transforme une formation vidéo en `skill.md` fiable, exploitable par une IA — avec
timestamps, captures analysées, OCR et procédures. Application web commerciale :
authentification Google, **crédits à l'usage**, paiement Stripe.

## Architecture

Le traitement vidéo repose sur **FFmpeg + Tesseract** et sur des jobs longs
(plusieurs minutes) : cela **ne peut pas** tourner sur les fonctions serverless de
Vercel. L'app est donc découpée en deux déployables (un seul dépôt) :

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Web app (Vercel)           │        │  Worker (conteneur)          │
│  Next.js — landing, auth,   │        │  FFmpeg + Tesseract + IA     │
│  crédits, Stripe, upload,   │        │  Railway / Render / Fly / VM │
│  dashboard, download        │        │                              │
└──────────────┬──────────────┘        └───────────────┬──────────────┘
               │                                        │
        crée un job (queued)                     prend les jobs (poll)
               │                                        │
               ▼                                        ▼
        ┌──────────────┐   vidéo/skill.md   ┌────────────────────────┐
        │  Postgres    │◀──────────────────▶│  Blob storage (Vercel) │
        │  (jobs,      │                    │  vidéos + skill.md      │
        │  users,      │                    └────────────────────────┘
        │  crédits)    │
        └──────────────┘
```

- **Web app** → Vercel. Léger : auth, crédits, paiement, upload direct vers le
  blob (multipart, contourne la limite 4,5 Mo), création de jobs, suivi, download.
- **Worker** → conteneur long-running (voir `Dockerfile.worker`). Récupère les
  jobs `queued`, télécharge la vidéo, exécute le pipeline, renvoie le `skill.md`,
  et **solde les crédits**.
- **Postgres** → utilisateurs, jobs, registre de crédits (`CreditTransaction`).
- **Blob storage** → vidéos sources et fichiers générés.
- **Stripe** → achat de packs de crédits.
- **Auth.js (NextAuth v5)** → connexion Google.

## Pipeline

```
vidéo → audio → transcription horodatée → captures clés → OCR
→ analyse visuelle → alignement audio+image → procédures
→ génération skill.md → contrôle qualité
```

## Modèle de crédits

- `CREDITS_PER_MINUTE` crédits par minute de vidéo (facturée à la minute entamée).
- `SIGNUP_BONUS_CREDITS` crédits offerts à la première connexion.
- À la soumission : les crédits sont **réservés** (débités) atomiquement.
- À la fin : le worker **solde** selon la durée réelle (remboursement du trop-perçu).
- En cas d'échec : **remboursement intégral**.
- Packs achetables définis dans `src/lib/billing.ts`.

---

## Développement local

Prérequis : Node ≥ 20, Docker (pour Postgres), FFmpeg + Tesseract (pour le worker).

```bash
# 1. Dépendances
npm install

# 2. Postgres local (ou une URL Neon/Supabase)
docker run -d --name v2s-pg -e POSTGRES_PASSWORD=video2skill \
  -e POSTGRES_USER=video2skill -e POSTGRES_DB=video2skill -p 5432:5432 postgres:16

# 3. Configuration
cp .env.example .env.local
#   DATABASE_URL=postgresql://video2skill:video2skill@localhost:5432/video2skill
#   AUTH_SECRET=$(npx auth secret)   + AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
#   BLOB_READ_WRITE_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY, STRIPE_* ...

# 4. Schéma de base
npm run db:push

# 5. Lancer l'app + le worker (deux terminaux)
npm run dev        # http://localhost:3000
npm run worker     # traite les jobs
```

> FFmpeg/Tesseract sont requis **uniquement** pour le worker :
> `brew install ffmpeg tesseract tesseract-lang` (macOS) ou
> `apt install ffmpeg tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng` (Linux).

Alternative tout-en-un (Postgres + app + worker) via Docker :

```bash
cp .env.example .env.local   # DATABASE_URL=postgresql://video2skill:video2skill@db:5432/video2skill
docker compose up --build
docker compose exec app npm run db:push   # une fois
```

---

## Déploiement en production

### 1. Base de données (Neon recommandé)
Crée une base Postgres, récupère `DATABASE_URL`. Applique le schéma :
`DATABASE_URL=... npm run db:push`.

### 2. Google OAuth
[Google Cloud Console](https://console.cloud.google.com/) → OAuth client ID (Web).
Redirect URI autorisée : `https://TON-APP.vercel.app/api/auth/callback/google`.
Récupère `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Génère `AUTH_SECRET` (`npx auth secret`).

### 3. Blob storage
Vercel dashboard → Storage → Blob → crée un store → `BLOB_READ_WRITE_TOKEN`.

### 4. Stripe
- `STRIPE_SECRET_KEY` (dashboard Stripe).
- Webhook → endpoint `https://TON-APP.vercel.app/api/stripe/webhook`, event
  `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.

### 5. App → Vercel
Importe le dépôt sur Vercel. Renseigne toutes les variables (voir `.env.example` :
`DATABASE_URL`, `AUTH_*`, `BLOB_READ_WRITE_TOKEN`, `STRIPE_*`, `CREDITS_*`,
`NEXT_PUBLIC_*`). Deploy. (`prisma generate` tourne au build.)

### 6. Worker → Railway / Render / Fly
Déploie **le même dépôt** avec `Dockerfile.worker`. Variables requises :
`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
(+ tuning pipeline, `CREDITS_PER_MINUTE`). Prévois assez de disque pour la plus
grosse vidéo traitée (`WORKER_TMP_DIR`).

> Tant que le worker n'est pas déployé, les jobs restent en file d'attente
> (`queued`) : l'app fonctionne, mais rien n'est traité.

---

## Variables d'environnement

Voir `.env.example` pour la liste complète et commentée (providers IA, tuning
pipeline, DB, auth, blob, Stripe, crédits).

## Options avancées (studio)

- **Mode ultra précis** : seconde passe de contrôle qualité après correction.
- **Inclure OCR brut** : injecte le texte OCR dans le contexte de synthèse.
- **Langue** : Français / Anglais / Auto.

## Fiabilité

- Section « Zones incertaines à vérifier manuellement » dans le `skill.md`.
- Contrôle qualité → `report.json` (score 0–100 + incohérences), corrige le skill si besoin.
- Aucune étape UI générée à partir du seul audio sans capture à l'appui.
