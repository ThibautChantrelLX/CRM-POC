export type TypeRelationPp = "CONTACT" | "CLIENT" | "HYBRIDE" | "PROSPECT";
export type StatutRgpd = "OPT_IN" | "OPT_OUT" | "NON_RENSEIGNE";

// ─── List ──────────────────────────────────────────────────────────────────────

export type PersonnePhysiqueListItem = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  specialite: string | null;
  profession: string | null;
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

export type PersonnePhysiqueGroupFilter = {
  nom?: string;
  prenom?: string;
  email?: string;
  profession?: string[];
  specialite?: string[];
  activiteDominante?: string[];
  typeRelation?: TypeRelationPp[];
  barreau?: string[];
  creerLeApres?: string;
  creerLeAvant?: string;
  dernierEmailApres?: string;
  dernierEmailAvant?: string;
  dateSermentApres?: string;
  dateSermentAvant?: string;
  minFormations?: number;
  formationIds?: string[];
};

export type PersonnePhysiqueListQuery = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  // Filtres texte (contains) — chemin simple (1 groupe)
  nom?: string;
  prenom?: string;
  email?: string;
  // Filtres multi-select
  profession?: string[];
  specialite?: string[];
  activiteDominante?: string[];
  typeRelation?: TypeRelationPp[];
  statutRgpd?: StatutRgpd[];
  barreau?: string[];
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
  // Filtres formations
  minFormations?: number;
  formationIds?: string[];
  satisfMin?: number;
  satisfMax?: number;
  // Groupes OR (chemin multi-groupes)
  groups?: PersonnePhysiqueGroupFilter[];
};

export type PersonnePhysiqueExportItem = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  profession: string | null;
  specialite: string | null;
  barreau: string | null;
  dateSerment: string | null;
  activiteDominante: string | null;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | null;
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  emailInvalide: boolean;
  totalEmails: number | null;
  dernierEmailLe: string | null;
  creerLe: string;
  modifierLe: string;
  rattachements: {
    raisonSociale: string;
    siretSirenPm: string | null;
    titreFonction: string | null;
    dateDebut: string | null;
    dateFin: string | null;
    emailPm: string | null;
    telephonePm: string | null;
  }[];
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
    id: string;
    raisonSociale: string;
    siretSiren: string | null;
    email: string | null;
    telephone: string | null;
  };
};

export type PersonnePhysiqueDetail = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  typeProfilPrincipal: TypeProfilPrincipal | null;
  // Profil avocat
  specialite: string | null;
  profession: string | null;
  barreau: string | null;
  dateSerment: string | null;
  activiteDominante: string | null;
  // Profil particulier
  civilite: string | null;
  dateNaissance: string | null;
  situationFamiliale: string | null;
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
  linkedinUrl: string | null;
  // Metadata
  creerLe: string;
  modifierLe: string;
  creerPar: string | null;
  modifierPar: string | null;
  // Relations
  participations: {
    id: number;
    formationId: string;
    intitule: string;
    intituleCourt: string | null;
    numero: string;
    dateDebut: string | null;
    dateFin: string | null;
    present: boolean;
    dateInscription: string | null;
  }[];
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

export type ProfilType = "PARTICULIER" | "AVOCAT" | "PRO";

export type TypeProfilPrincipal =
  | "AVOCAT_INTERNE" | "ASSISTANT_INTERNE" | "FONCTION_SUPPORT" | "AVOCAT_EXTERNE"
  | "INTERVENANT_JUSTICE" | "PARTICULIER" | "CONTACT_PRO" | "APPRENANT_EXTERNE"
  | "FORMATEUR_EXTERNE" | "NOTAIRE" | "CLERC_NOTAIRE" | "COMMISSAIRE_JUSTICE"
  | "MAGISTRAT" | "GREFFIER" | "JURISTE" | "FONCTION_SUPPORT_EXTERNE";

export type CreatePersonnePhysiqueInput = {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  portable?: string;
  typeRelation: TypeRelationPp;
  statutRgpd?: StatutRgpd;
  actif?: boolean;
  optInEmail?: boolean;
  optInSms?: boolean;
  optOutGlobal?: boolean;
  profilType: ProfilType;
  // Profil avocat
  barreau?: string;
  dateSerment?: string;
  specialite?: string;
  profession?: string;
  activiteDominante?: string;
  // Profil particulier
  civilite?: string;
  dateNaissance?: string;
  situationFamiliale?: string;
};

export type UpdatePersonnePhysiqueInput = Partial<CreatePersonnePhysiqueInput>;
