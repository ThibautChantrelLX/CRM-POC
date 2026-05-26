-- =============================================================================
-- MIGRATION : refactor_pp_profiles_uuid_statut
-- =============================================================================

-- =============================================================================
-- 1. StatutRgpd : suppression des @map avec espaces/tirets
-- =============================================================================

ALTER TYPE "StatutRgpd" RENAME TO "StatutRgpd_old";
CREATE TYPE "StatutRgpd" AS ENUM ('OPT_IN', 'OPT_OUT', 'NON_RENSEIGNE');
ALTER TABLE personnes_physiques
  ALTER COLUMN statut_rgpd TYPE "StatutRgpd"
  USING CASE statut_rgpd::text
    WHEN 'Opt-in'          THEN 'OPT_IN'::"StatutRgpd"
    WHEN 'Opt-out'         THEN 'OPT_OUT'::"StatutRgpd"
    WHEN 'Non renseigné'   THEN 'NON_RENSEIGNE'::"StatutRgpd"
    ELSE NULL
  END;
DROP TYPE "StatutRgpd_old";

-- =============================================================================
-- 2. Nouvel enum TypeProfilPrincipal
-- =============================================================================

CREATE TYPE "TypeProfilPrincipal" AS ENUM (
  'AVOCAT_INTERNE',
  'ASSISTANT_INTERNE',
  'FONCTION_SUPPORT',
  'AVOCAT_EXTERNE',
  'INTERVENANT_JUSTICE',
  'PARTICULIER',
  'CONTACT_PRO',
  'APPRENANT_EXTERNE',
  'FORMATEUR_EXTERNE'
);

-- =============================================================================
-- 3. UUID pour PersonneMorale
-- =============================================================================

-- Ajouter colonne UUID
ALTER TABLE personnes_morales ADD COLUMN id_new UUID NOT NULL DEFAULT gen_random_uuid();

-- Table de mapping old_id → new UUID
CREATE TEMP TABLE pm_id_map AS SELECT id AS old_id, id_new AS new_id FROM personnes_morales;

-- Ajouter colonnes UUID dans les tables dépendantes
ALTER TABLE rattachements_pp_pm        ADD COLUMN personne_morale_id_new UUID;
ALTER TABLE dossier_intervenants_contexte ADD COLUMN personne_morale_id_new UUID;

-- Peupler les FK UUID via mapping
UPDATE rattachements_pp_pm r
  SET personne_morale_id_new = m.new_id
  FROM pm_id_map m WHERE r.personne_morale_id = m.old_id;
-- dossier_intervenants_contexte : 0 lignes, pas d'UPDATE nécessaire

-- Supprimer les FK contraintes pointant vers personnes_morales.id
ALTER TABLE rattachements_pp_pm           DROP CONSTRAINT rattachements_pp_pm_personne_morale_id_fkey;
ALTER TABLE dossier_intervenants_contexte DROP CONSTRAINT dossier_intervenants_contexte_personne_morale_id_fkey;

-- Supprimer la PK de PM (CASCADE supprime aussi personnes_morales_maison_mere_id_fkey)
ALTER TABLE personnes_morales DROP CONSTRAINT personnes_morales_pkey CASCADE;

-- Supprimer les anciennes colonnes Int
ALTER TABLE personnes_morales             DROP COLUMN id;
ALTER TABLE personnes_morales             DROP COLUMN maison_mere_id;
ALTER TABLE rattachements_pp_pm           DROP COLUMN personne_morale_id;
ALTER TABLE dossier_intervenants_contexte DROP COLUMN personne_morale_id;

-- Supprimer les anciens index sur les colonnes FK avant de les supprimer
-- (ils ont été auto-supprimés avec DROP COLUMN ci-dessus)

-- Renommer les nouvelles colonnes
ALTER TABLE personnes_morales             RENAME COLUMN id_new TO id;
ALTER TABLE rattachements_pp_pm           RENAME COLUMN personne_morale_id_new TO personne_morale_id;
ALTER TABLE dossier_intervenants_contexte RENAME COLUMN personne_morale_id_new TO personne_morale_id;

-- Rétablir la PK et le DEFAULT
ALTER TABLE personnes_morales ADD PRIMARY KEY (id);
ALTER TABLE personnes_morales ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Rétablir maison_mere_id en UUID (nullable, aucune donnée à restaurer)
ALTER TABLE personnes_morales ADD COLUMN maison_mere_id UUID;
ALTER TABLE personnes_morales
  ADD CONSTRAINT personnes_morales_maison_mere_id_fkey
  FOREIGN KEY (maison_mere_id) REFERENCES personnes_morales(id);

-- Rétablir les FK dans les dépendants
ALTER TABLE rattachements_pp_pm ALTER COLUMN personne_morale_id SET NOT NULL;
ALTER TABLE rattachements_pp_pm
  ADD CONSTRAINT rattachements_pp_pm_personne_morale_id_fkey
  FOREIGN KEY (personne_morale_id) REFERENCES personnes_morales(id);

ALTER TABLE dossier_intervenants_contexte
  ADD CONSTRAINT dossier_intervenants_contexte_personne_morale_id_fkey
  FOREIGN KEY (personne_morale_id) REFERENCES personnes_morales(id);

-- Recréer l'index
CREATE INDEX idx_rattachements_pm ON rattachements_pp_pm (personne_morale_id);
CREATE INDEX idx_dic_pm ON dossier_intervenants_contexte (personne_morale_id);

-- =============================================================================
-- 4. UUID pour PersonnePhysique + TypeProfilPrincipal
-- =============================================================================

-- Ajouter colonnes UUID et profil
ALTER TABLE personnes_physiques ADD COLUMN id_new UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE personnes_physiques ADD COLUMN type_profil_principal "TypeProfilPrincipal";

-- Tous les PP existants sont des avocats externes
UPDATE personnes_physiques SET type_profil_principal = 'AVOCAT_EXTERNE';
ALTER TABLE personnes_physiques ALTER COLUMN type_profil_principal SET NOT NULL;

-- Table de mapping
CREATE TEMP TABLE pp_id_map AS SELECT id AS old_id, id_new AS new_id FROM personnes_physiques;

-- Ajouter colonnes UUID dans les dépendants
ALTER TABLE rattachements_pp_pm        ADD COLUMN personne_physique_id_new UUID;
ALTER TABLE dossier_intervenants_contexte ADD COLUMN personne_physique_id_new UUID;

-- Peupler les FK UUID
UPDATE rattachements_pp_pm r
  SET personne_physique_id_new = m.new_id
  FROM pp_id_map m WHERE r.personne_physique_id = m.old_id;
-- dossier_intervenants_contexte : 0 lignes

-- Supprimer les FK contraintes
ALTER TABLE rattachements_pp_pm           DROP CONSTRAINT rattachements_pp_pm_personne_physique_id_fkey;
ALTER TABLE dossier_intervenants_contexte DROP CONSTRAINT dossier_intervenants_contexte_personne_physique_id_fkey;

-- Supprimer la PK de PP
ALTER TABLE personnes_physiques DROP CONSTRAINT personnes_physiques_pkey CASCADE;

-- Supprimer les anciennes colonnes
ALTER TABLE personnes_physiques           DROP COLUMN id;
ALTER TABLE rattachements_pp_pm           DROP COLUMN personne_physique_id;
ALTER TABLE dossier_intervenants_contexte DROP COLUMN personne_physique_id;

-- Renommer
ALTER TABLE personnes_physiques           RENAME COLUMN id_new TO id;
ALTER TABLE rattachements_pp_pm           RENAME COLUMN personne_physique_id_new TO personne_physique_id;
ALTER TABLE dossier_intervenants_contexte RENAME COLUMN personne_physique_id_new TO personne_physique_id;

-- Rétablir PK et DEFAULT
ALTER TABLE personnes_physiques ADD PRIMARY KEY (id);
ALTER TABLE personnes_physiques ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Rétablir les FK
ALTER TABLE rattachements_pp_pm ALTER COLUMN personne_physique_id SET NOT NULL;
ALTER TABLE rattachements_pp_pm
  ADD CONSTRAINT rattachements_pp_pm_personne_physique_id_fkey
  FOREIGN KEY (personne_physique_id) REFERENCES personnes_physiques(id);

ALTER TABLE dossier_intervenants_contexte
  ADD CONSTRAINT dossier_intervenants_contexte_personne_physique_id_fkey
  FOREIGN KEY (personne_physique_id) REFERENCES personnes_physiques(id);

-- Recréer les index
CREATE INDEX idx_rattachements_pp ON rattachements_pp_pm (personne_physique_id);
CREATE INDEX idx_dic_pp ON dossier_intervenants_contexte (personne_physique_id);

-- =============================================================================
-- 5. UUID pour Entite (0 lignes)
-- =============================================================================

-- Supprimer toutes les FK contraintes référençant entites.id
ALTER TABLE entites              DROP CONSTRAINT entites_entite_parente_id_fkey;
ALTER TABLE dossiers             DROP CONSTRAINT dossiers_entite_id_fkey;
ALTER TABLE factures             DROP CONSTRAINT factures_entite_id_fkey;
ALTER TABLE audit_modifications  DROP CONSTRAINT audit_modifications_entite_id_fkey;
ALTER TABLE journal_migrations   DROP CONSTRAINT journal_migrations_entite_id_fkey;
ALTER TABLE segments             DROP CONSTRAINT segments_entite_id_fkey;

-- Supprimer la PK
ALTER TABLE entites DROP CONSTRAINT entites_pkey;

-- Supprimer et recréer id et entite_parente_id en UUID
ALTER TABLE entites DROP COLUMN id;
ALTER TABLE entites DROP COLUMN entite_parente_id;
ALTER TABLE entites ADD COLUMN id               UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE entites ADD COLUMN entite_parente_id UUID;

-- Rétablir PK et auto-référence
ALTER TABLE entites ADD PRIMARY KEY (id);
ALTER TABLE entites
  ADD CONSTRAINT entites_entite_parente_id_fkey
  FOREIGN KEY (entite_parente_id) REFERENCES entites(id);

-- Mettre à jour entite_id dans les tables dépendantes (0 lignes chacune)
ALTER TABLE dossiers DROP COLUMN entite_id;
ALTER TABLE dossiers ADD COLUMN entite_id UUID NOT NULL;
ALTER TABLE dossiers ADD CONSTRAINT dossiers_entite_id_fkey FOREIGN KEY (entite_id) REFERENCES entites(id);

ALTER TABLE factures DROP COLUMN entite_id;
ALTER TABLE factures ADD COLUMN entite_id UUID NOT NULL;
ALTER TABLE factures ADD CONSTRAINT factures_entite_id_fkey FOREIGN KEY (entite_id) REFERENCES entites(id);

ALTER TABLE audit_modifications DROP COLUMN entite_id;
ALTER TABLE audit_modifications ADD COLUMN entite_id UUID;
ALTER TABLE audit_modifications ADD CONSTRAINT audit_modifications_entite_id_fkey FOREIGN KEY (entite_id) REFERENCES entites(id);

ALTER TABLE journal_migrations DROP COLUMN entite_id;
ALTER TABLE journal_migrations ADD COLUMN entite_id UUID;
ALTER TABLE journal_migrations ADD CONSTRAINT journal_migrations_entite_id_fkey FOREIGN KEY (entite_id) REFERENCES entites(id);

ALTER TABLE segments DROP COLUMN entite_id;
ALTER TABLE segments ADD COLUMN entite_id UUID NOT NULL;
ALTER TABLE segments ADD CONSTRAINT segments_entite_id_fkey FOREIGN KEY (entite_id) REFERENCES entites(id);

-- Recréer les index
CREATE INDEX idx_dossiers_entite  ON dossiers            (entite_id);
CREATE INDEX idx_factures_entite  ON factures             (entite_id);
CREATE INDEX idx_segments_entite  ON segments             (entite_id);

-- =============================================================================
-- 6. UUID pour Dossier (0 lignes)
-- =============================================================================

-- Supprimer les FK contraintes référençant dossiers.id
ALTER TABLE dossier_intervenants_contexte DROP CONSTRAINT dossier_intervenants_contexte_dossier_id_fkey;
ALTER TABLE factures                      DROP CONSTRAINT factures_dossier_id_fkey;

-- Supprimer la PK
ALTER TABLE dossiers DROP CONSTRAINT dossiers_pkey;

-- Supprimer et recréer id en UUID
ALTER TABLE dossiers DROP COLUMN id;
ALTER TABLE dossiers ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE dossiers ADD PRIMARY KEY (id);

-- Rétablir les contraintes unique
ALTER TABLE dossiers ADD CONSTRAINT dossiers_source_id_source_logiciel_key UNIQUE (source_id, source_logiciel);
ALTER TABLE dossiers ADD CONSTRAINT dossiers_entite_id_num_dossier_metier_key UNIQUE (entite_id, num_dossier_metier);

-- Mettre à jour dossier_id dans les dépendants (0 lignes)
ALTER TABLE dossier_intervenants_contexte DROP COLUMN dossier_id;
ALTER TABLE dossier_intervenants_contexte ADD COLUMN dossier_id UUID NOT NULL;
ALTER TABLE dossier_intervenants_contexte
  ADD CONSTRAINT dossier_intervenants_contexte_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id);

ALTER TABLE factures DROP COLUMN dossier_id;
ALTER TABLE factures ADD COLUMN dossier_id UUID NOT NULL;
ALTER TABLE factures ADD CONSTRAINT factures_dossier_id_fkey FOREIGN KEY (dossier_id) REFERENCES dossiers(id);

-- Recréer les index
CREATE INDEX idx_dic_dossier   ON dossier_intervenants_contexte (dossier_id);
CREATE INDEX idx_factures_dossier ON factures (dossier_id);

-- =============================================================================
-- 7. Créer profil_avocat et profil_particulier + migration des données
-- =============================================================================

CREATE TABLE profil_avocat (
  id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  personne_physique_id UUID         NOT NULL,
  barreau              VARCHAR(255),
  date_serment         DATE,
  specialite           TEXT,
  profession           TEXT,
  creer_le             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifier_le          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT profil_avocat_pkey                        PRIMARY KEY (id),
  CONSTRAINT profil_avocat_personne_physique_id_key    UNIQUE      (personne_physique_id),
  CONSTRAINT profil_avocat_personne_physique_id_fkey   FOREIGN KEY (personne_physique_id)
    REFERENCES personnes_physiques(id)
);

CREATE TABLE profil_particulier (
  id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  personne_physique_id UUID         NOT NULL,
  date_naissance       DATE,
  civilite             VARCHAR(20),
  situation_familiale  VARCHAR(100),
  creer_le             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifier_le          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT profil_particulier_pkey                        PRIMARY KEY (id),
  CONSTRAINT profil_particulier_personne_physique_id_key    UNIQUE      (personne_physique_id),
  CONSTRAINT profil_particulier_personne_physique_id_fkey   FOREIGN KEY (personne_physique_id)
    REFERENCES personnes_physiques(id)
);

-- Migrer barreau, date_serment, specialite, profession → profil_avocat (tous les PP sont avocats)
INSERT INTO profil_avocat (personne_physique_id, barreau, date_serment, specialite, profession)
SELECT id, barreau, date_serment, specialite, profession
FROM personnes_physiques;

-- =============================================================================
-- 8. Supprimer les colonnes déplacées de personnes_physiques
-- =============================================================================

ALTER TABLE personnes_physiques DROP COLUMN barreau;
ALTER TABLE personnes_physiques DROP COLUMN date_serment;
ALTER TABLE personnes_physiques DROP COLUMN specialite;
ALTER TABLE personnes_physiques DROP COLUMN profession;
