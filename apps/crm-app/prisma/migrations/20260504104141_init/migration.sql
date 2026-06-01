-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "TypeEntite" AS ENUM ('GROUPE', 'FILIALE', 'SITE');

-- CreateEnum
CREATE TYPE "TypeRelationPm" AS ENUM ('CABINET_POSTULATION', 'CLIENT_DIRECT', 'HYBRIDE');

-- CreateEnum
CREATE TYPE "TypeRelationPp" AS ENUM ('CONTACT', 'CLIENT', 'HYBRIDE');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('OUVERT', 'CLOTURE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ContexteIntervenant" AS ENUM ('POSTULATION', 'PLEIN_EXERCICE', 'DIVERS', 'ADVERSE');

-- CreateEnum
CREATE TYPE "StatutMigration" AS ENUM ('EN_COURS', 'SUCCES', 'ECHEC', 'PARTIEL');

-- CreateEnum
CREATE TYPE "StatutRgpd" AS ENUM ('OPT_IN', 'OPT_OUT', 'NON_RENSEIGNE');

-- CreateTable
CREATE TABLE "entites" (
    "id" SERIAL NOT NULL,
    "entite_parente_id" INTEGER,
    "type_entite" "TypeEntite" NOT NULL,
    "raison_sociale" VARCHAR(255) NOT NULL,
    "siret" VARCHAR(20),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adresses" (
    "id" SERIAL NOT NULL,
    "rue" VARCHAR(255),
    "complement_adresse" VARCHAR(255),
    "code_postal" VARCHAR(10),
    "ville" VARCHAR(100),
    "pays" VARCHAR(100) DEFAULT 'France',
    "type_adresse" VARCHAR(30) DEFAULT 'SIEGE',
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnes_morales" (
    "id" SERIAL NOT NULL,
    "maison_mere_id" INTEGER,
    "email" VARCHAR(255),
    "telephone" VARCHAR(50),
    "nom_domaine" TEXT,
    "raison_sociale" VARCHAR(255) NOT NULL,
    "siret_siren" VARCHAR(20),
    "type_structure" VARCHAR(255),
    "type_lien_dossier" "TypeRelationPm" NOT NULL,
    "adresse_id" INTEGER,
    "source_origine" VARCHAR(20) DEFAULT 'EXPERT',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),
    "modifier_par" VARCHAR(100),
    "categorie_entreprise" VARCHAR(255),
    "secteur_activite" VARCHAR(255),
    "site_web" TEXT,

    CONSTRAINT "personnes_morales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnes_physiques" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "prenom" VARCHAR(255),
    "email" VARCHAR(255),
    "telephone" VARCHAR(50),
    "portable" VARCHAR(50),
    "specialite" VARCHAR(255),
    "profession" VARCHAR(255),
    "date_serment" DATE,
    "barreau" VARCHAR(255),
    "adresse_id" INTEGER,
    "seniorité" VARCHAR(50),
    "poste" VARCHAR(50),
    "dernier_email_le" DATE,
    "dernier_email_avec" VARCHAR(500),
    "total_emails" INTEGER DEFAULT 0,
    "echanges_avec" TEXT,
    "departement" VARCHAR(100),
    "linkedin_url" VARCHAR(255),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "type_relation_dossier" "TypeRelationPp" NOT NULL,
    "opt_in_email" BOOLEAN NOT NULL DEFAULT true,
    "opt_in_sms" BOOLEAN NOT NULL DEFAULT false,
    "opt_out_global" BOOLEAN NOT NULL DEFAULT false,
    "statut_rgpd" "StatutRgpd",
    "email_invalide" BOOLEAN NOT NULL DEFAULT false,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),
    "modifier_par" VARCHAR(100),

    CONSTRAINT "personnes_physiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rattachements_pp_pm" (
    "id" SERIAL NOT NULL,
    "personne_physique_id" INTEGER NOT NULL,
    "personne_morale_id" INTEGER NOT NULL,
    "titre_fonction" VARCHAR(100),
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rattachements_pp_pm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" SERIAL NOT NULL,
    "entite_id" INTEGER NOT NULL,
    "num_dossier_metier" VARCHAR(100),
    "intitule" VARCHAR(500),
    "matiere" VARCHAR(255),
    "nature" VARCHAR(255),
    "statut" "StatutDossier",
    "date_ouverture" DATE,
    "date_cloture" DATE,
    "source_logiciel" VARCHAR(20) DEFAULT 'EXPERT',
    "source_id" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),
    "modifier_par" VARCHAR(100),

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_intervenants_contexte" (
    "id" SERIAL NOT NULL,
    "dossier_id" INTEGER NOT NULL,
    "contexte_parent_id" INTEGER,
    "personne_physique_id" INTEGER,
    "personne_morale_id" INTEGER,
    "contexte" "ContexteIntervenant" NOT NULL,
    "role_dossier" VARCHAR(50) NOT NULL,
    "expert_role_code" INTEGER,
    "date_entree" DATE,
    "date_sortie" DATE,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossier_intervenants_contexte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "entite_id" INTEGER NOT NULL,
    "dossier_id" INTEGER NOT NULL,
    "contexte_id" INTEGER NOT NULL,
    "numero_facture" VARCHAR(100),
    "montant_ht" DECIMAL(12,2),
    "montant_ttc" DECIMAL(12,2),
    "regle_ttc" DECIMAL(12,2) DEFAULT 0,
    "montant_alloue_ttc" DECIMAL(12,2),
    "regle_alloue_ttc" DECIMAL(12,2) DEFAULT 0,
    "date_facture" DATE,
    "source_logiciel" VARCHAR(20) DEFAULT 'EXPERT',
    "source_id" INTEGER,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),
    "modifier_par" VARCHAR(100),

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_sources" (
    "id" SERIAL NOT NULL,
    "entite_crm" VARCHAR(100) NOT NULL,
    "entite_crm_id" INTEGER NOT NULL,
    "source_nom" VARCHAR(20) NOT NULL,
    "source_id_externe" VARCHAR(100) NOT NULL,
    "date_derniere_synchro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_modifications" (
    "id" SERIAL NOT NULL,
    "entite_id" INTEGER,
    "entite_cible" VARCHAR(100) NOT NULL,
    "entite_cible_id" INTEGER NOT NULL,
    "champ_modifie" VARCHAR(100) NOT NULL,
    "ancienne_valeur" TEXT,
    "nouvelle_valeur" TEXT,
    "source_donnee" VARCHAR(20),
    "utilisateur" VARCHAR(100),
    "date_maj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_modifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_migrations" (
    "id" SERIAL NOT NULL,
    "entite_id" INTEGER,
    "nom_logiciel" VARCHAR(50) NOT NULL,
    "version_logiciel" VARCHAR(50),
    "perimetre" TEXT,
    "date_effet" DATE,
    "date_migration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termine_le" TIMESTAMP(3),
    "statut" "StatutMigration" NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "details_erreurs" TEXT,
    "execute_par" VARCHAR(100),

    CONSTRAINT "journal_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" SERIAL NOT NULL,
    "entite_id" INTEGER NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "output_cibles" TEXT[],
    "conditions" JSONB NOT NULL DEFAULT '{"op":"AND","rules":[]}',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entites_siret_key" ON "entites"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "personnes_morales_email_key" ON "personnes_morales"("email");

-- CreateIndex
CREATE INDEX "idx_pm_raison_sociale" ON "personnes_morales"("raison_sociale");

-- CreateIndex
CREATE INDEX "idx_pm_siret" ON "personnes_morales"("siret_siren");

-- CreateIndex
CREATE INDEX "idx_pm_nom_domaine" ON "personnes_morales"("nom_domaine");

-- CreateIndex
CREATE UNIQUE INDEX "personnes_physiques_email_key" ON "personnes_physiques"("email");

-- CreateIndex
CREATE INDEX "idx_pp_email" ON "personnes_physiques"("email");

-- CreateIndex
CREATE INDEX "idx_pp_portable" ON "personnes_physiques"("portable");

-- CreateIndex
CREATE INDEX "idx_rattachements_pp" ON "rattachements_pp_pm"("personne_physique_id");

-- CreateIndex
CREATE INDEX "idx_rattachements_pm" ON "rattachements_pp_pm"("personne_morale_id");

-- CreateIndex
CREATE INDEX "idx_dossiers_entite" ON "dossiers"("entite_id");

-- CreateIndex
CREATE INDEX "idx_dossiers_statut" ON "dossiers"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_source_id_source_logiciel_key" ON "dossiers"("source_id", "source_logiciel");

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
CREATE INDEX "idx_factures_source" ON "factures"("source_id");

-- CreateIndex
CREATE INDEX "idx_mapping_entite" ON "mapping_sources"("entite_crm", "entite_crm_id");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_sources_entite_crm_source_nom_source_id_externe_key" ON "mapping_sources"("entite_crm", "source_nom", "source_id_externe");

-- CreateIndex
CREATE INDEX "idx_audit_cible" ON "audit_modifications"("entite_cible", "entite_cible_id");

-- CreateIndex
CREATE INDEX "idx_journal_migrations" ON "journal_migrations"("nom_logiciel", "date_migration" DESC);

-- CreateIndex
CREATE INDEX "idx_segments_entite" ON "segments"("entite_id");

-- CreateIndex
CREATE INDEX "idx_segments_conditions" ON "segments" USING GIN ("conditions");

-- CreateIndex
CREATE INDEX "idx_segments_output" ON "segments" USING GIN ("output_cibles");

-- AddForeignKey
ALTER TABLE "entites" ADD CONSTRAINT "entites_entite_parente_id_fkey" FOREIGN KEY ("entite_parente_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_morales" ADD CONSTRAINT "personnes_morales_maison_mere_id_fkey" FOREIGN KEY ("maison_mere_id") REFERENCES "personnes_morales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_morales" ADD CONSTRAINT "personnes_morales_adresse_id_fkey" FOREIGN KEY ("adresse_id") REFERENCES "adresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_physiques" ADD CONSTRAINT "personnes_physiques_adresse_id_fkey" FOREIGN KEY ("adresse_id") REFERENCES "adresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rattachements_pp_pm" ADD CONSTRAINT "rattachements_pp_pm_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_contexte_parent_id_fkey" FOREIGN KEY ("contexte_parent_id") REFERENCES "dossier_intervenants_contexte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_intervenants_contexte" ADD CONSTRAINT "dossier_intervenants_contexte_personne_morale_id_fkey" FOREIGN KEY ("personne_morale_id") REFERENCES "personnes_morales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_contexte_id_fkey" FOREIGN KEY ("contexte_id") REFERENCES "dossier_intervenants_contexte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_modifications" ADD CONSTRAINT "audit_modifications_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_migrations" ADD CONSTRAINT "journal_migrations_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_entite_id_fkey" FOREIGN KEY ("entite_id") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
