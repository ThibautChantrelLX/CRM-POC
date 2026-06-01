-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "TypeProfilPrincipal" AS ENUM ('AVOCAT_INTERNE', 'ASSISTANT_INTERNE', 'FONCTION_SUPPORT', 'AVOCAT_EXTERNE', 'INTERVENANT_JUSTICE', 'PARTICULIER', 'CONTACT_PRO', 'APPRENANT_EXTERNE', 'FORMATEUR_EXTERNE', 'NOTAIRE', 'CLERC_NOTAIRE', 'COMMISSAIRE_JUSTICE', 'MAGISTRAT', 'GREFFIER', 'JURISTE', 'FONCTION_SUPPORT_EXTERNE');

-- DropForeignKey
ALTER TABLE "entites" DROP CONSTRAINT "entites_entite_parente_id_fkey";

-- DropForeignKey
ALTER TABLE "personnes_morales" DROP CONSTRAINT "personnes_morales_maison_mere_id_fkey";

-- DropForeignKey
ALTER TABLE "rattachements_pp_pm" DROP CONSTRAINT "rattachements_pp_pm_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "rattachements_pp_pm" DROP CONSTRAINT "rattachements_pp_pm_personne_morale_id_fkey";

-- DropForeignKey
ALTER TABLE "dossiers" DROP CONSTRAINT "dossiers_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_dossier_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_personne_morale_id_fkey";

-- DropForeignKey
ALTER TABLE "factures" DROP CONSTRAINT "factures_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "factures" DROP CONSTRAINT "factures_dossier_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_modifications" DROP CONSTRAINT "audit_modifications_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_migrations" DROP CONSTRAINT "journal_migrations_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "segments" DROP CONSTRAINT "segments_entite_id_fkey";

-- AlterTable
ALTER TABLE "entites" DROP CONSTRAINT "entites_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "entite_parente_id",
ADD COLUMN     "entite_parente_id" UUID,
ADD CONSTRAINT "entites_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "personnes_morales" DROP CONSTRAINT "personnes_morales_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "maison_mere_id",
ADD COLUMN     "maison_mere_id" UUID,
ADD CONSTRAINT "personnes_morales_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "personnes_physiques" DROP CONSTRAINT "personnes_physiques_pkey",
DROP COLUMN "barreau",
DROP COLUMN "date_serment",
DROP COLUMN "profession",
DROP COLUMN "specialite",
ADD COLUMN     "type_profil_principal" "TypeProfilPrincipal" NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "personnes_physiques_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rattachements_pp_pm" DROP COLUMN "personne_physique_id",
ADD COLUMN     "personne_physique_id" UUID NOT NULL,
DROP COLUMN "personne_morale_id",
ADD COLUMN     "personne_morale_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "dossiers" DROP CONSTRAINT "dossiers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "entite_id",
ADD COLUMN     "entite_id" UUID NOT NULL,
ADD CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dossier_intervenants_contexte" DROP COLUMN "dossier_id",
ADD COLUMN     "dossier_id" UUID NOT NULL,
DROP COLUMN "personne_physique_id",
ADD COLUMN     "personne_physique_id" UUID,
DROP COLUMN "personne_morale_id",
ADD COLUMN     "personne_morale_id" UUID;

-- AlterTable
ALTER TABLE "factures" DROP COLUMN "entite_id",
ADD COLUMN     "entite_id" UUID NOT NULL,
DROP COLUMN "dossier_id",
ADD COLUMN     "dossier_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "mapping_sources" ALTER COLUMN "entite_crm_id" SET DATA TYPE VARCHAR(36);

-- AlterTable
ALTER TABLE "audit_modifications" DROP COLUMN "entite_id",
ADD COLUMN     "entite_id" UUID;

-- AlterTable
ALTER TABLE "journal_migrations" DROP COLUMN "entite_id",
ADD COLUMN     "entite_id" UUID;

-- AlterTable
ALTER TABLE "segments" DROP COLUMN "entite_id",
ADD COLUMN     "entite_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "profil_avocat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personne_physique_id" UUID NOT NULL,
    "barreau" VARCHAR(255),
    "date_serment" DATE,
    "specialite" TEXT,
    "profession" TEXT,
    "activite_dominante" TEXT,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profil_avocat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_pro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personne_physique_id" UUID NOT NULL,
    "profession" TEXT,
    "specialite" TEXT,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profil_pro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_particulier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personne_physique_id" UUID NOT NULL,
    "date_naissance" DATE,
    "civilite" VARCHAR(20),
    "situation_familiale" VARCHAR(100),
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profil_particulier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profil_avocat_personne_physique_id_key" ON "profil_avocat"("personne_physique_id");

-- CreateIndex
CREATE UNIQUE INDEX "profil_pro_personne_physique_id_key" ON "profil_pro"("personne_physique_id");

-- CreateIndex
CREATE UNIQUE INDEX "profil_particulier_personne_physique_id_key" ON "profil_particulier"("personne_physique_id");

-- CreateIndex
CREATE INDEX "idx_rattachements_pp" ON "rattachements_pp_pm"("personne_physique_id");

-- CreateIndex
CREATE INDEX "idx_rattachements_pm" ON "rattachements_pp_pm"("personne_morale_id");

-- CreateIndex
CREATE INDEX "idx_dossiers_entite" ON "dossiers"("entite_id");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_entite_id_num_dossier_metier_key" ON "dossiers"("entite_id", "num_dossier_metier");

-- CreateIndex
CREATE INDEX "idx_dic_dossier" ON "dossier_intervenants_contexte"("dossier_id");

-- CreateIndex
CREATE INDEX "idx_dic_pp" ON "dossier_intervenants_contexte"("personne_physique_id");

-- CreateIndex
CREATE INDEX "idx_dic_pm" ON "dossier_intervenants_contexte"("personne_morale_id");

-- CreateIndex
CREATE INDEX "idx_factures_entite" ON "factures"("entite_id");

-- CreateIndex
CREATE INDEX "idx_factures_dossier" ON "factures"("dossier_id");

-- CreateIndex
CREATE INDEX "idx_segments_entite" ON "segments"("entite_id");

-- AddForeignKey
ALTER TABLE "entites" ADD CONSTRAINT "entites_entite_parente_id_fkey" FOREIGN KEY ("entite_parente_id") REFERENCES "entites"("id");

-- AddForeignKey
ALTER TABLE "personnes_morales" ADD CONSTRAINT "personnes_morales_maison_mere_id_fkey" FOREIGN KEY ("maison_mere_id") REFERENCES "personnes_morales"("id");

-- AddForeignKey
ALTER TABLE "profil_avocat" ADD CONSTRAINT "profil_avocat_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id");

-- AddForeignKey
ALTER TABLE "profil_pro" ADD CONSTRAINT "profil_pro_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id");

-- AddForeignKey
ALTER TABLE "profil_particulier" ADD CONSTRAINT "profil_particulier_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id");

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id");

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id");

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id");

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id");

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id");

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id");

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id");

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id");

-- AddForeignKey
ALTER TABLE "audit_modifications" ADD CONSTRAINT "audit_modifications_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id");

-- AddForeignKey
ALTER TABLE "journal_migrations" ADD CONSTRAINT "journal_migrations_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id");

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id");
