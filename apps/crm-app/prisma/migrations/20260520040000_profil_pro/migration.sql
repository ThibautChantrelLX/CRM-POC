-- CreateTable profil_pro (1:1 avec personnes_physiques, uniquement pour profils non-avocat non-particulier)
CREATE TABLE profil_pro (
  id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  personne_physique_id UUID         NOT NULL,
  profession           TEXT,
  specialite           TEXT,
  creer_le             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifier_le          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT profil_pro_pkey                      PRIMARY KEY (id),
  CONSTRAINT profil_pro_personne_physique_id_key  UNIQUE      (personne_physique_id),
  CONSTRAINT profil_pro_personne_physique_id_fkey FOREIGN KEY (personne_physique_id)
    REFERENCES personnes_physiques(id)
);

-- Migrer les données non-avocat depuis profil_avocat → profil_pro
INSERT INTO profil_pro (personne_physique_id, profession, specialite, creer_le, modifier_le)
SELECT pa.personne_physique_id, pa.profession, pa.specialite, pa.creer_le, pa.modifier_le
FROM profil_avocat pa
JOIN personnes_physiques pp ON pp.id = pa.personne_physique_id
WHERE pp.type_profil_principal NOT IN ('AVOCAT_INTERNE', 'AVOCAT_EXTERNE');

-- Créer des profil_pro vides pour les PP non-avocat, non-particulier sans profil
INSERT INTO profil_pro (personne_physique_id)
SELECT pp.id FROM personnes_physiques pp
WHERE pp.type_profil_principal NOT IN ('AVOCAT_INTERNE', 'AVOCAT_EXTERNE', 'PARTICULIER')
  AND NOT EXISTS (SELECT 1 FROM profil_pro pr WHERE pr.personne_physique_id = pp.id);

-- Supprimer les lignes non-avocat de profil_avocat
DELETE FROM profil_avocat
WHERE personne_physique_id IN (
  SELECT id FROM personnes_physiques
  WHERE type_profil_principal NOT IN ('AVOCAT_INTERNE', 'AVOCAT_EXTERNE')
);
