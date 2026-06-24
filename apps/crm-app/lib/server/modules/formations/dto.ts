// ─── List ─────────────────────────────────────────────────────────────────────

export type FormationListItem = {
  id: string;
  numero: string;
  idDendreo: number | null;
  intitule: string;
  intituleCourt: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  dureeHeures: number | null;
  dureeJours: number | null;
  lieu: string | null;
  modeOrganisation: string | null;
  categorie: string | null;
  nature: string | null;
  avancement: string | null;
  responsable: string | null;
  formateurs: string | null;
  nbInscrits: number | null;
  nbPresents: number | null;
  recettes: number | null;
  depenses: number | null;
  marge: number | null;
  satisfGenerale: number | null;
  satisfFormateur: number | null;
  satisfSalle: number | null;
  tauxReponseChaud: number | null;
  satisfGeneraleFroid: number | null;
  tauxReponseFroid: number | null;
  creerLe: string;
  modifierLe: string;
  creerPar: string | null;
  modifierPar: string | null;
  _count: { participations: number };
};

// ─── Detail ───────────────────────────────────────────────────────────────────

export type FormationDetail = FormationListItem & {
  description: string | null;
};

// ─── Query ────────────────────────────────────────────────────────────────────

export type FormationListQuery = {
  search?: string;
  avancement?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

// ─── Create / Update ──────────────────────────────────────────────────────────

export type CreateFormationInput = {
  numero: string;
  idDendreo?: number | null;
  intitule: string;
  intituleCourt?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  dureeHeures?: number | null;
  dureeJours?: number | null;
  lieu?: string | null;
  modeOrganisation?: string | null;
  categorie?: string | null;
  nature?: string | null;
  avancement?: string | null;
  responsable?: string | null;
  formateurs?: string | null;
  nbInscrits?: number | null;
  nbPresents?: number | null;
  recettes?: number | null;
  depenses?: number | null;
  marge?: number | null;
  description?: string | null;
  satisfGenerale?: number | null;
  satisfFormateur?: number | null;
  satisfSalle?: number | null;
  tauxReponseChaud?: number | null;
  satisfGeneraleFroid?: number | null;
  tauxReponseFroid?: number | null;
};

export type UpdateFormationInput = Partial<Omit<CreateFormationInput, "numero" | "idDendreo">>;

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportConfirmResult = {
  created: number;
};
