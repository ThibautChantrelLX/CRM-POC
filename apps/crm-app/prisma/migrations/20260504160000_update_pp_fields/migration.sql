-- AlterTable personnes_physiques
-- Suppression de la limite VarChar sur specialite, profession, poste
-- Suppression du champ seniorité (données Anaba non conservées)
ALTER TABLE "personnes_physiques"
    ALTER COLUMN "specialite" SET DATA TYPE TEXT,
    ALTER COLUMN "profession" SET DATA TYPE TEXT,
    ALTER COLUMN "poste" SET DATA TYPE TEXT,
    DROP COLUMN IF EXISTS "seniorité";
