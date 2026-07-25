-- ============================================================================
-- Video2Skill — mise à jour d'une base EXISTANTE vers le schéma courant.
--
-- Usage (zéro outil local) : Supabase → SQL Editor → colle ce fichier → Run.
-- Alternative : `npm run db:push`.
--
-- Écrit en IF NOT EXISTS : le rejouer est sans effet, et une exécution
-- partiellement appliquée se termine proprement. Purement additif — aucune
-- donnée existante n'est lue, modifiée ni supprimée.
-- ============================================================================

-- Publication publique opt-in d'un skill.md terminé (/skills/<slug>).
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isPublic"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "publicSlug"    TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "publicTitle"   TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "publicSummary" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "publishedAt"   TIMESTAMP(3);

-- userId devient nullable. Nécessaire uniquement si une version antérieure a pu
-- créer des jobs sans compte ; inoffensif sinon.
ALTER TABLE "Job" ALTER COLUMN "userId" DROP NOT NULL;

-- Un slug public est unique ; l'index partiel sert la liste /skills.
CREATE UNIQUE INDEX IF NOT EXISTS "Job_publicSlug_key"        ON "Job"("publicSlug");
CREATE INDEX        IF NOT EXISTS "Job_isPublic_publishedAt_idx" ON "Job"("isPublic", "publishedAt");
