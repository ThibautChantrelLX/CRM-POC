-- AlterTable adresses
-- Suppression des limites VarChar sur les champs texte libres
-- (les données Anaba contiennent des mémos jusqu'à 595 caractères)
ALTER TABLE "adresses"
    ALTER COLUMN "rue"               SET DATA TYPE TEXT,
    ALTER COLUMN "complement_adresse" SET DATA TYPE TEXT,
    ALTER COLUMN "ville"             SET DATA TYPE TEXT,
    ALTER COLUMN "pays"              SET DATA TYPE TEXT;
