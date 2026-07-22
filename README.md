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
│  Web app (Vercel, gratuit)  │        │  Worker (GitHub Actions,     │
│  Next.js — landing, auth,   │        │  gratuit) FFmpeg + Tesseract │
│  crédits, Stripe, upload,   │        │  + IA — ou conteneur         │
│  dashboard, download        │        │  (Dockerfile.worker)         │
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
- **Worker** → GitHub Actions (`.github/workflows/worker.yml`, gratuit) : réveillé
  par l'app à chaque job créé (`repository_dispatch`), il draine la file puis
  s'éteint ; un cron de secours (6 h) ramasse les jobs orphelins. Alternative :
  conteneur long-running (`Dockerfile.worker`) sur un VPS. Dans les deux cas il
  télécharge la vidéo, exécute le pipeline, renvoie le `skill.md` et **solde les
  crédits**.
- **Postgres (Supabase)** → utilisateurs, jobs, registre de crédits
  (`CreditTransaction`). Pooler transaction (6543) côté serverless, pooler
  session (5432) pour le worker et les migrations.
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

# 2. Postgres local (ou l'URL de ton projet Supabase)
docker run -d --name v2s-pg -e POSTGRES_PASSWORD=video2skill \
  -e POSTGRES_USER=video2skill -e POSTGRES_DB=video2skill -p 5432:5432 postgres:16

# 3. Configuration
cp .env.example .env.local
#   DATABASE_URL=postgresql://video2skill:video2skill@localhost:5432/video2skill
#   DIRECT_URL=  (la même URL en local)
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

## Déploiement en production (100 % gratuit)

### 1. Base de données → Supabase
1. [supabase.com](https://supabase.com) → nouveau projet (gratuit), note le mot
   de passe de la base.
2. **SQL Editor** → colle le contenu de [`prisma/bootstrap.sql`](prisma/bootstrap.sql)
   → **Run** : les tables sont créées (aucun outil local requis).
3. Bouton **Connect** → copie les deux chaînes :
   - pooler **transaction** (port 6543) → `DATABASE_URL` (ajoute
     `?pgbouncer=true&connection_limit=1`) ;
   - pooler **session** (port 5432) → `DIRECT_URL`.

> ⚠️ Plan gratuit Supabase : le projet est mis en pause après ~7 jours sans
> requête (réactivable en un clic dans le dashboard).

### 2. Google OAuth
[Google Cloud Console](https://console.cloud.google.com/) → OAuth client ID (Web).
Redirect URI autorisée : `https://TON-APP.vercel.app/api/auth/callback/google`.
Récupère `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Génère `AUTH_SECRET` (`npx auth secret`).

### 3. Blob storage
Vercel dashboard → Storage → Blob → crée un store → `BLOB_READ_WRITE_TOKEN`.

### 4. App → Vercel (plan Hobby)
Importe le dépôt sur Vercel. Renseigne les variables (voir `.env.example`) :
`DATABASE_URL`, `DIRECT_URL`, `AUTH_*`, `BLOB_READ_WRITE_TOKEN`,
`GITHUB_WORKER_TOKEN`, `GITHUB_WORKER_REPO`, `CREDITS_*`, `NEXT_PUBLIC_*`
(+ `STRIPE_*` quand tu actives la vente). Deploy.

### 5. Worker → GitHub Actions (gratuit)
1. Repo GitHub → **Settings → Secrets and variables → Actions** → ajoute 4
   secrets : `DATABASE_URL` (= le pooler **session**, port 5432),
   `BLOB_READ_WRITE_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
2. Crée un **fine-grained PAT** limité à ce repo avec la permission
   « Contents: Read and write » → mets-le dans `GITHUB_WORKER_TOKEN` sur Vercel
   (avec `GITHUB_WORKER_REPO=Owner/Repo`) : chaque job créé réveille le worker.
3. Test manuel : onglet **Actions** → workflow `worker` → **Run workflow**.

Minutes gratuites : illimitées si le repo est public, ~2000 min/mois s'il est
privé (le cron de secours 6 h consomme ~2 min par passage à vide — supprime le
bloc `schedule` du workflow pour économiser).

> ⚠️ CGU : GitHub Actions tolère le batch ponctuel, pas une ferme de calcul ; et
> le plan Vercel Hobby est réservé à un usage non commercial. Pour vendre
> sérieusement : Vercel Pro + un vrai conteneur worker (`Dockerfile.worker`,
> ~5 €/mois sur un VPS) — le code est déjà prêt pour les deux.

### 6. Stripe (quand tu veux vendre)
- `STRIPE_SECRET_KEY` (dashboard Stripe).
- Webhook → endpoint `https://TON-APP.vercel.app/api/stripe/webhook`, event
  `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.

> Tant que le worker n'est pas configuré (secrets manquants), les jobs restent
> en file d'attente (`queued`) : l'app fonctionne, mais rien n'est traité.

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
