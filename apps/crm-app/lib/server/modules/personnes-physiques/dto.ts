export type TypeRelationPp = "CONTACT" | "CLIENT" | "HYBRIDE";
export type StatutRgpd = "OPT_IN" | "OPT_OUT" | "NON_RENSEIGNE";

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
  // Recherche globale
  search?: string;
  // Filtres texte individuels (contains)
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
