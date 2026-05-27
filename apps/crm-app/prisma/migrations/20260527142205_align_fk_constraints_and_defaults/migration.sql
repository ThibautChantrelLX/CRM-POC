-- DropForeignKey
ALTER TABLE "audit_modifications" DROP CONSTRAINT "audit_modifications_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_dossier_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_personne_morale_id_fkey";

-- DropForeignKey
ALTER TABLE "dossier_intervenants_contexte" DROP CONSTRAINT "dossier_intervenants_contexte_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "dossiers" DROP CONSTRAINT "dossiers_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "entites" DROP CONSTRAINT "entites_entite_parente_id_fkey";

-- DropForeignKey
ALTER TABLE "factures" DROP CONSTRAINT "factures_dossier_id_fkey";

-- DropForeignKey
ALTER TABLE "factures" DROP CONSTRAINT "factures_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_migrations" DROP CONSTRAINT "journal_migrations_entite_id_fkey";

-- DropForeignKey
ALTER TABLE "personnes_morales" DROP CONSTRAINT "personnes_morales_maison_mere_id_fkey";

-- DropForeignKey
ALTER TABLE "profil_avocat" DROP CONSTRAINT "profil_avocat_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "profil_particulier" DROP CONSTRAINT "profil_particulier_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "profil_pro" DROP CONSTRAINT "profil_pro_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "rattachements_pp_pm" DROP CONSTRAINT "rattachements_pp_pm_personne_morale_id_fkey";

-- DropForeignKey
ALTER TABLE "rattachements_pp_pm" DROP CONSTRAINT "rattachements_pp_pm_personne_physique_id_fkey";

-- DropForeignKey
ALTER TABLE "segments" DROP CONSTRAINT "segments_entite_id_fkey";

-- AlterTable
ALTER TABLE "dossiers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "entites" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "personnes_morales" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "personnes_physiques" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "profil_avocat" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "modifier_le" DROP DEFAULT;

-- AlterTable
ALTER TABLE "profil_particulier" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "modifier_le" DROP DEFAULT;

-- AlterTable
ALTER TABLE "profil_pro" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "modifier_le" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "entites" ADD CONSTRAINT "entites_entite_parente_id_fkey" FOREIGN KEY ("entite_parente_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_morales" ADD CONSTRAINT "personnes_morales_maison_mere_id_fkey" FOREIGN KEY ("maison_mere_id") REFERENCES "personnes_morales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_avocat" ADD CONSTRAINT "profil_avocat_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_pro" ADD CONSTRAINT "profil_pro_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_particulier" ADD CONSTRAINT "profil_particulier_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_modifications" ADD CONSTRAINT "audit_modifications_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_migrations" ADD CONSTRAINT "journal_migrations_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
