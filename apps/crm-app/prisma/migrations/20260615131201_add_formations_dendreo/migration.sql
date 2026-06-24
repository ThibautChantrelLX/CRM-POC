-- CreateTable
CREATE TABLE "formations" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "id_dendreo" INTEGER,
    "intitule" TEXT NOT NULL,
    "intitule_court" TEXT,
    "date_debut" DATE,
    "date_fin" DATE,
    "duree_heures" DOUBLE PRECISION,
    "duree_jours" DOUBLE PRECISION,
    "lieu" TEXT,
    "mode_organisation" TEXT,
    "categorie" TEXT,
    "nature" TEXT,
    "avancement" TEXT,
    "responsable" TEXT,
    "formateurs" TEXT,
    "nb_inscrits" INTEGER,
    "nb_presents" INTEGER,
    "recettes" DECIMAL(12,2),
    "depenses" DECIMAL(12,2),
    "marge" DECIMAL(12,2),
    "description" TEXT,
    "satisf_generale" DOUBLE PRECISION,
    "satisf_formateur" DOUBLE PRECISION,
    "satisf_salle" DOUBLE PRECISION,
    "taux_reponse_chaud" DOUBLE PRECISION,
    "satisf_generale_froid" DOUBLE PRECISION,
    "taux_reponse_froid" DOUBLE PRECISION,
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifier_le" TIMESTAMP(3) NOT NULL,
    "creer_par" VARCHAR(100),
    "modifier_par" VARCHAR(100),

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations_formations" (
    "id" SERIAL NOT NULL,
    "id_inscription" INTEGER NOT NULL,
    "formation_id" UUID NOT NULL,
    "personne_physique_id" UUID,
    "nom_affiche" TEXT,
    "prenom" TEXT,
    "nom" TEXT,
    "email" TEXT,
    "entreprise" TEXT,
    "barreau" TEXT,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "satisfaction" DOUBLE PRECISION,
    "date_inscription" DATE,
    "prix_participant" DECIMAL(10,2),
    "creer_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participations_formations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formations_numero_key" ON "formations"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "formations_id_dendreo_key" ON "formations"("id_dendreo");

-- CreateIndex
CREATE INDEX "idx_formations_date_debut" ON "formations"("date_debut");

-- CreateIndex
CREATE INDEX "idx_formations_avancement" ON "formations"("avancement");

-- CreateIndex
CREATE UNIQUE INDEX "participations_formations_id_inscription_key" ON "participations_formations"("id_inscription");

-- CreateIndex
CREATE INDEX "idx_participations_formation" ON "participations_formations"("formation_id");

-- CreateIndex
CREATE INDEX "idx_participations_pp" ON "participations_formations"("personne_physique_id");

-- AddForeignKey
ALTER TABLE "participations_formations" ADD CONSTRAINT "participations_formations_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations_formations" ADD CONSTRAINT "participations_formations_personne_physique_id_fkey" FOREIGN KEY ("personne_physique_id") REFERENCES "personnes_physiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
