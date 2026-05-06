export type TypeRelationPp = "CONTACT" | "CLIENT" | "HYBRIDE";
export type StatutRgpd = "OPT_IN" | "OPT_OUT" | "NON_RENSEIGNE";

// ─── List ──────────────────────────────────────────────────────────────────────

export type PersonnePhysiqueListItem = {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  specialite: string | null;
  profession: string | null;
  poste: string | null;
  barreau: string | null;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | null;
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  emailInvalide: boolean;
  totalEmails: number | null;
  dernierEmailLe: string | null;
  dateSerment: string | null;
  linkedinUrl: string | null;
  creerLe: string;
  modifierLe: string;
  adresse?: {
    ville: string | null;
    codePostal: string | null;
    pays: string | null;
  } | null;
};

export type PersonnePhysiqueListQuery = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  // Filtres texte (contains)
  nom?: string;
  prenom?: string;
  email?: string;
  profession?: string;
  specialite?: string;
  // Filtres multi-select
  typeRelation?: TypeRelationPp[];
  statutRgpd?: StatutRgpd[];
  // Filtres booléens
  actif?: boolean;
  optOutGlobal?: boolean;
  emailInvalide?: boolean;
  // Filtres dates
  creerLeApres?: string;
  creerLeAvant?: string;
  dernierEmailApres?: string;
  dernierEmailAvant?: string;
  dateSermentApres?: string;
  dateSermentAvant?: string;
};

export type PersonnePhysiqueListResponse = {
  data: PersonnePhysiqueListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── Detail ────────────────────────────────────────────────────────────────────

export type RattachementDetail = {
  id: number;
  titreFonction: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  personneMorale: {
    id: number;
    raisonSociale: string;
    siretSiren: string | null;
    email: string | null;
    telephone: string | null;
  };
};

export type PersonnePhysiqueDetail = {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  specialite: string | null;
  profession: string | null;
  poste: string | null;
  barreau: string | null;
  dateSerment: string | null;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | null;
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  emailInvalide: boolean;
  // Anaba
  totalEmails: number | null;
  dernierEmailLe: string | null;
  dernierEmailAvec: string | null;
  echangesAvec: string | null;
  departement: string | null;
  linkedinUrl: string | null;
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
  rattachements: RattachementDetail[];
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export type CreatePersonnePhysiqueInput = {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  portable?: string;
  specialite?: string;
  profession?: string;
  poste?: string;
  barreau?: string;
  typeRelation: TypeRelationPp;
  statutRgpd?: StatutRgpd;
  actif?: boolean;
  optInEmail?: boolean;
  optInSms?: boolean;
  optOutGlobal?: boolean;
};

export type UpdatePersonnePhysiqueInput = Partial<CreatePersonnePhysiqueInput>;
