-- AlterTable personnes_morales
-- Suppression de la limite VarChar(255) sur raison_sociale
ALTER TABLE "personnes_morales"
    ALTER COLUMN "raison_sociale" SET DATA TYPE TEXT;
