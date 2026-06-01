export type TypeRelationPm = "CABINET_POSTULATION" | "CLIENT_DIRECT" | "HYBRIDE" | "AUTRE" | "PROSPECT";

// ─── List ──────────────────────────────────────────────────────────────────────

export type PersonneMoraleListItem = {
  id: string;
  raisonSociale: string;
  email: string | null;
  telephone: string | null;
  siretSiren: string | null;
  nomDomaine: string | null;
  typeStructure: string | null;
  typeRelation: TypeRelationPm | null;
  actif: boolean;
  sourceOrigine: string | null;
  secteurActivite: string | null;
  categorieEntreprise: string | null;
  siteWeb: string | null;
  creerLe: string;
  modifierLe: string;
  adresse?: { ville: string | null; codePostal: string | null; pays: string | null } | null;
  _count?: { rattachements: number };
};

export type PersonneMoraleListQuery = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  // Filtres texte (contains)
  raisonSociale?: string;
  email?: string;
  siretSiren?: string;
  typeStructure?: string;
  secteurActivite?: string;
  // Filtres select
  typeRelation?: TypeRelationPm[];
  // Filtres booléens
  actif?: boolean;
  // Filtres dates
  creerLeApres?: string;
  creerLeAvant?: string;
};

export type PersonneMoraleListResponse = {
  data: PersonneMoraleListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── Detail ────────────────────────────────────────────────────────────────────

export type ContactRattacheDetail = {
  id: number;
  titreFonction: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  personnePhysique: {
    id: string;
    nom: string;
    prenom: string | null;
    email: string | null;
    profession: string | null;
  };
};

export type PersonneMoraleDetail = {
  id: string;
  raisonSociale: string;
  email: string | null;
  telephone: string | null;
  siretSiren: string | null;
  nomDomaine: string | null;
  typeStructure: string | null;
  typeRelation: TypeRelationPm | null;
  actif: boolean;
  sourceOrigine: string | null;
  // Anaba
  categorieEntreprise: string | null;
  secteurActivite: string | null;
  siteWeb: string | null;
  // Metadata
  creerLe: string;
  modifierLe: string;
  creerPar: string | null;
  modifierPar: string | null;
  // Relations
  adresse: {
    rue: string | null;
    complementAdresse: string | null;
    codePostal: string | null;
    ville: string | null;
    pays: string | null;
  } | null;
  maisonMere: { id: string; raisonSociale: string; siretSiren: string | null } | null;
  filiales: { id: string; raisonSociale: string; siretSiren: string | null; actif: boolean }[];
  contacts: ContactRattacheDetail[];
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export type CreatePersonneMoraleInput = {
  raisonSociale: string;
  email?: string;
  telephone?: string;
  siretSiren?: string;
  typeStructure?: string;
  typeRelation?: TypeRelationPm;
  actif?: boolean;
  siteWeb?: string;
  secteurActivite?: string;
  categorieEntreprise?: string;
  nomDomaine?: string;
  adresse?: {
    rue?: string;
    complementAdresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
  };
};

export type UpdatePersonneMoraleInput = Partial<Omit<CreatePersonneMoraleInput, "typeRelation">> & {
  typeRelation?: TypeRelationPm | null;
  sourceOrigine?: string;
};
