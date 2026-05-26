import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import type {
  CreatePersonnePhysiqueInput,
  PersonnePhysiqueDetail,
  PersonnePhysiqueListItem,
  PersonnePhysiqueListQuery,
  PersonnePhysiqueListResponse,
  UpdatePersonnePhysiqueInput,
} from "./dto";

// ─── Unicité email/portable sur PP actives ────────────────────────────────────

export type ConflictPp = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  portable: string | null;
};

export class DuplicateActifError extends Error {
  constructor(public readonly conflicts: ConflictPp[]) {
    super("Doublon email/portable sur une PP active");
    this.name = "DuplicateActifError";
  }
}

async function checkUniciteActif(
  email: string | null | undefined,
  portable: string | null | undefined,
  excludeId?: string,
): Promise<void> {
  const orConditions: Prisma.PersonnePhysiqueWhereInput[] = [];
  if (email) orConditions.push({ email: { equals: email, mode: "insensitive" } });
  if (portable) orConditions.push({ portable: { equals: portable, mode: "insensitive" } });
  if (orConditions.length === 0) return;

  const conflicts = await prisma.personnePhysique.findMany({
    where: {
      actif: true,
      OR: orConditions,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true, nom: true, prenom: true, email: true, portable: true },
  });

  if (conflicts.length > 0) throw new DuplicateActifError(conflicts);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_SORT: Record<string, true> = {
  id: true, nom: true, prenom: true, email: true, telephone: true,
  portable: true, typeProfilPrincipal: true, typeRelation: true,
  statutRgpd: true, actif: true, totalEmails: true, dernierEmailLe: true,
  creerLe: true, modifierLe: true,
};

// Champs triables via profilAvocat (relation 1:1)
const AVOCAT_SORT: Record<string, true> = {
  specialite: true, profession: true, barreau: true, dateSerment: true,
};

function ilike(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return (d as Date).toISOString().split("T")[0];
}

// ─── List ─────────────────────────────────────────────────────────────────────

function buildWhere(q: PersonnePhysiqueListQuery): Prisma.PersonnePhysiqueWhereInput {
  const and: Prisma.PersonnePhysiqueWhereInput[] = [];

  if (q.search) {
    const s = ilike(q.search);
    and.push({
      OR: [
        { nom: s }, { prenom: s }, { email: s },
        { telephone: s }, { portable: s },
        { profilAvocat: { profession: s } },
        { profilAvocat: { specialite: s } },
        { profilPro: { profession: s } },
        { profilPro: { specialite: s } },
      ],
    });
  }

  if (q.nom) and.push({ nom: ilike(q.nom) });
  if (q.prenom) and.push({ prenom: ilike(q.prenom) });
  if (q.email) and.push({ email: ilike(q.email) });
  if (q.profession) and.push({ OR: [{ profilAvocat: { profession: ilike(q.profession) } }, { profilPro: { profession: ilike(q.profession) } }] });
  if (q.specialite) and.push({ OR: [{ profilAvocat: { specialite: ilike(q.specialite) } }, { profilPro: { specialite: ilike(q.specialite) } }] });

  if (q.typeRelation?.length) and.push({ typeRelation: { in: q.typeRelation } });
  if (q.statutRgpd?.length) and.push({ statutRgpd: { in: q.statutRgpd } });
  if (q.typeProfilPrincipal?.length) and.push({ typeProfilPrincipal: { in: q.typeProfilPrincipal } });
  if (q.barreau?.length) and.push({ profilAvocat: { barreau: { in: q.barreau } } });

  if (q.actif !== undefined) and.push({ actif: q.actif });
  if (q.optOutGlobal !== undefined) and.push({ optOutGlobal: q.optOutGlobal });
  if (q.emailInvalide !== undefined) and.push({ emailInvalide: q.emailInvalide });

  if (q.creerLeApres || q.creerLeAvant) {
    and.push({
      creerLe: {
        ...(q.creerLeApres && { gte: new Date(q.creerLeApres) }),
        ...(q.creerLeAvant && { lte: new Date(q.creerLeAvant) }),
      },
    });
  }
  if (q.dernierEmailApres || q.dernierEmailAvant) {
    and.push({
      dernierEmailLe: {
        ...(q.dernierEmailApres && { gte: new Date(q.dernierEmailApres) }),
        ...(q.dernierEmailAvant && { lte: new Date(q.dernierEmailAvant) }),
      },
    });
  }
  if (q.dateSermentApres || q.dateSermentAvant) {
    and.push({
      profilAvocat: {
        dateSerment: {
          ...(q.dateSermentApres && { gte: new Date(q.dateSermentApres) }),
          ...(q.dateSermentAvant && { lte: new Date(q.dateSermentAvant) }),
        },
      },
    });
  }

  return and.length ? { AND: and } : {};
}

function buildOrderBy(
  sortBy: string,
  sortOrder: "asc" | "desc",
): Prisma.PersonnePhysiqueOrderByWithRelationInput {
  if (AVOCAT_SORT[sortBy]) {
    return { profilAvocat: { [sortBy]: sortOrder } };
  }
  return { [sortBy]: sortOrder };
}

export async function fetchPersonnesPhysiques(
  q: PersonnePhysiqueListQuery,
): Promise<PersonnePhysiqueListResponse> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const rawSort = q.sortBy ?? "nom";
  const sortBy = ALLOWED_SORT[rawSort] || AVOCAT_SORT[rawSort] ? rawSort : "nom";
  const sortOrder = q.sortOrder === "desc" ? "desc" : "asc";
  const where = buildWhere(q);

  const [total, rows] = await Promise.all([
    prisma.personnePhysique.count({ where }),
    prisma.personnePhysique.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        adresse: { select: { ville: true, codePostal: true, pays: true } },
        profilAvocat: {
          select: { barreau: true, specialite: true, activiteDominante: true, profession: true, dateSerment: true },
        },
        profilPro: { select: { profession: true, specialite: true } },
      },
    }),
  ]);

  const data: PersonnePhysiqueListItem[] = rows.map((r) => ({
    id: r.id,
    typeProfilPrincipal: r.typeProfilPrincipal as PersonnePhysiqueListItem["typeProfilPrincipal"],
    nom: r.nom,
    prenom: r.prenom,
    email: r.email,
    telephone: r.telephone,
    portable: r.portable,
    typeRelation: r.typeRelation as PersonnePhysiqueListItem["typeRelation"],
    statutRgpd: r.statutRgpd as PersonnePhysiqueListItem["statutRgpd"],
    actif: r.actif,
    optInEmail: r.optInEmail,
    optInSms: r.optInSms,
    optOutGlobal: r.optOutGlobal,
    emailInvalide: r.emailInvalide,
    totalEmails: r.totalEmails,
    dernierEmailLe: fmtDate(r.dernierEmailLe),
    linkedinUrl: r.linkedinUrl,
    creerLe: (r.creerLe as Date).toISOString(),
    modifierLe: (r.modifierLe as Date).toISOString(),
    profilAvocat: r.profilAvocat
      ? {
          barreau: r.profilAvocat.barreau,
          specialite: r.profilAvocat.specialite,
          activiteDominante: r.profilAvocat.activiteDominante,
          profession: r.profilAvocat.profession,
          dateSerment: fmtDate(r.profilAvocat.dateSerment),
        }
      : null,
    profilPro: r.profilPro
      ? { profession: r.profilPro.profession, specialite: r.profilPro.specialite }
      : null,
    adresse: r.adresse ?? null,
  }));

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getPersonnePhysiqueDetail(
  id: string,
): Promise<PersonnePhysiqueDetail | null> {
  const pp = await prisma.personnePhysique.findUnique({
    where: { id },
    include: {
      adresse: true,
      profilAvocat: true,
      profilParticulier: true,
      profilPro: true,
      rattachements: {
        include: {
          personneMorale: {
            select: {
              id: true,
              raisonSociale: true,
              siretSiren: true,
              email: true,
              telephone: true,
            },
          },
        },
        orderBy: [
          { dateFin: { sort: "asc", nulls: "first" } },
          { dateDebut: "desc" },
        ],
      },
    },
  });

  if (!pp) return null;

  return {
    id: pp.id,
    typeProfilPrincipal: pp.typeProfilPrincipal as PersonnePhysiqueDetail["typeProfilPrincipal"],
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    telephone: pp.telephone,
    portable: pp.portable,
    typeRelation: pp.typeRelation as PersonnePhysiqueDetail["typeRelation"],
    statutRgpd: pp.statutRgpd as PersonnePhysiqueDetail["statutRgpd"],
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    emailInvalide: pp.emailInvalide,
    totalEmails: pp.totalEmails,
    dernierEmailLe: fmtDate(pp.dernierEmailLe),
    dernierEmailAvec: pp.dernierEmailAvec,
    echangesAvec: pp.echangesAvec,
    linkedinUrl: pp.linkedinUrl,
    creerLe: (pp.creerLe as Date).toISOString(),
    modifierLe: (pp.modifierLe as Date).toISOString(),
    creerPar: pp.creerPar,
    modifierPar: pp.modifierPar,
    profilAvocat: pp.profilAvocat
      ? {
          barreau: pp.profilAvocat.barreau,
          dateSerment: fmtDate(pp.profilAvocat.dateSerment),
          specialite: pp.profilAvocat.specialite,
          activiteDominante: pp.profilAvocat.activiteDominante,
          profession: pp.profilAvocat.profession,
        }
      : null,
    profilParticulier: pp.profilParticulier
      ? {
          dateNaissance: fmtDate(pp.profilParticulier.dateNaissance),
          civilite: pp.profilParticulier.civilite,
          situationFamiliale: pp.profilParticulier.situationFamiliale,
        }
      : null,
    profilPro: pp.profilPro
      ? { profession: pp.profilPro.profession, specialite: pp.profilPro.specialite }
      : null,
    adresse: pp.adresse
      ? {
          rue: pp.adresse.rue,
          complementAdresse: pp.adresse.complementAdresse,
          codePostal: pp.adresse.codePostal,
          ville: pp.adresse.ville,
          pays: pp.adresse.pays,
        }
      : null,
    rattachements: pp.rattachements.map((r) => ({
      id: r.id,
      titreFonction: r.titreFonction,
      dateDebut: fmtDate(r.dateDebut as Date),
      dateFin: fmtDate(r.dateFin),
      personneMorale: r.personneMorale,
    })),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getPersonnePhysique(id: string): Promise<PersonnePhysiqueListItem | null> {
  const pp = await prisma.personnePhysique.findUnique({
    where: { id },
    include: {
      adresse: { select: { ville: true, codePostal: true, pays: true } },
      profilAvocat: {
        select: { barreau: true, specialite: true, activiteDominante: true, profession: true, dateSerment: true },
      },
      profilPro: { select: { profession: true, specialite: true } },
    },
  });
  if (!pp) return null;
  return {
    id: pp.id,
    typeProfilPrincipal: pp.typeProfilPrincipal as PersonnePhysiqueListItem["typeProfilPrincipal"],
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    telephone: pp.telephone,
    portable: pp.portable,
    typeRelation: pp.typeRelation as PersonnePhysiqueListItem["typeRelation"],
    statutRgpd: pp.statutRgpd as PersonnePhysiqueListItem["statutRgpd"],
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    emailInvalide: pp.emailInvalide,
    totalEmails: pp.totalEmails,
    dernierEmailLe: fmtDate(pp.dernierEmailLe),
    linkedinUrl: pp.linkedinUrl,
    creerLe: (pp.creerLe as Date).toISOString(),
    modifierLe: (pp.modifierLe as Date).toISOString(),
    profilAvocat: pp.profilAvocat
      ? {
          barreau: pp.profilAvocat.barreau,
          specialite: pp.profilAvocat.specialite,
          activiteDominante: pp.profilAvocat.activiteDominante,
          profession: pp.profilAvocat.profession,
          dateSerment: fmtDate(pp.profilAvocat.dateSerment),
        }
      : null,
    profilPro: pp.profilPro
      ? { profession: pp.profilPro.profession, specialite: pp.profilPro.specialite }
      : null,
    adresse: pp.adresse ?? null,
  };
}

export async function createPersonnePhysique(
  input: CreatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const { profilAvocat, profilParticulier, profilPro, ...ppData } = input;

  if (input.actif !== false) {
    await checkUniciteActif(input.email, input.portable);
  }

  const pp = await prisma.personnePhysique.create({
    data: {
      ...ppData,
      ...(profilAvocat && {
        profilAvocat: {
          create: {
            barreau: profilAvocat.barreau,
            dateSerment: profilAvocat.dateSerment ? new Date(profilAvocat.dateSerment) : undefined,
            specialite: profilAvocat.specialite,
            activiteDominante: profilAvocat.activiteDominante,
            profession: profilAvocat.profession,
          },
        },
      }),
      ...(profilParticulier && {
        profilParticulier: {
          create: {
            dateNaissance: profilParticulier.dateNaissance
              ? new Date(profilParticulier.dateNaissance)
              : undefined,
            civilite: profilParticulier.civilite,
            situationFamiliale: profilParticulier.situationFamiliale,
          },
        },
      }),
      ...(profilPro && {
        profilPro: {
          create: {
            profession: profilPro.profession,
            specialite: profilPro.specialite,
          },
        },
      }),
    },
    include: {
      adresse: { select: { ville: true, codePostal: true, pays: true } },
      profilAvocat: {
        select: { barreau: true, specialite: true, activiteDominante: true, profession: true, dateSerment: true },
      },
      profilPro: { select: { profession: true, specialite: true } },
    },
  });

  return {
    id: pp.id,
    typeProfilPrincipal: pp.typeProfilPrincipal as PersonnePhysiqueListItem["typeProfilPrincipal"],
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    telephone: pp.telephone,
    portable: pp.portable,
    typeRelation: pp.typeRelation as PersonnePhysiqueListItem["typeRelation"],
    statutRgpd: pp.statutRgpd as PersonnePhysiqueListItem["statutRgpd"],
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    emailInvalide: pp.emailInvalide,
    totalEmails: pp.totalEmails,
    dernierEmailLe: fmtDate(pp.dernierEmailLe),
    linkedinUrl: pp.linkedinUrl,
    creerLe: (pp.creerLe as Date).toISOString(),
    modifierLe: (pp.modifierLe as Date).toISOString(),
    profilAvocat: pp.profilAvocat
      ? {
          barreau: pp.profilAvocat.barreau,
          specialite: pp.profilAvocat.specialite,
          activiteDominante: pp.profilAvocat.activiteDominante,
          profession: pp.profilAvocat.profession,
          dateSerment: fmtDate(pp.profilAvocat.dateSerment),
        }
      : null,
    profilPro: pp.profilPro
      ? { profession: pp.profilPro.profession, specialite: pp.profilPro.specialite }
      : null,
    adresse: pp.adresse ?? null,
  };
}

export async function updatePersonnePhysique(
  id: string,
  input: UpdatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const { profilAvocat, profilParticulier, profilPro, ...ppData } = input;

  // Récupérer l'état courant pour calculer les valeurs finales
  const current = await prisma.personnePhysique.findUnique({
    where: { id },
    select: { actif: true, email: true, portable: true },
  });
  if (!current) throw new Error("Personne physique introuvable");

  const finalActif = ppData.actif !== undefined ? ppData.actif : current.actif;
  const finalEmail = "email" in ppData ? (ppData.email ?? null) : current.email;
  const finalPortable = "portable" in ppData ? (ppData.portable ?? null) : current.portable;

  if (finalActif) {
    await checkUniciteActif(finalEmail, finalPortable, id);
  }

  const pp = await prisma.personnePhysique.update({
    where: { id },
    data: {
      ...ppData,
      ...(profilAvocat && {
        profilAvocat: {
          upsert: {
            create: {
              barreau: profilAvocat.barreau,
              dateSerment: profilAvocat.dateSerment ? new Date(profilAvocat.dateSerment) : undefined,
              specialite: profilAvocat.specialite,
              activiteDominante: profilAvocat.activiteDominante,
              profession: profilAvocat.profession,
            },
            update: {
              barreau: profilAvocat.barreau,
              dateSerment: profilAvocat.dateSerment ? new Date(profilAvocat.dateSerment) : null,
              specialite: profilAvocat.specialite,
              activiteDominante: profilAvocat.activiteDominante,
              profession: profilAvocat.profession,
            },
          },
        },
      }),
      ...(profilParticulier && {
        profilParticulier: {
          upsert: {
            create: {
              dateNaissance: profilParticulier.dateNaissance
                ? new Date(profilParticulier.dateNaissance)
                : undefined,
              civilite: profilParticulier.civilite,
              situationFamiliale: profilParticulier.situationFamiliale,
            },
            update: {
              dateNaissance: profilParticulier.dateNaissance
                ? new Date(profilParticulier.dateNaissance)
                : null,
              civilite: profilParticulier.civilite,
              situationFamiliale: profilParticulier.situationFamiliale,
            },
          },
        },
      }),
      ...(profilPro && {
        profilPro: {
          upsert: {
            create: {
              profession: profilPro.profession,
              specialite: profilPro.specialite,
            },
            update: {
              profession: profilPro.profession,
              specialite: profilPro.specialite,
            },
          },
        },
      }),
    },
    include: {
      adresse: { select: { ville: true, codePostal: true, pays: true } },
      profilAvocat: {
        select: { barreau: true, specialite: true, activiteDominante: true, profession: true, dateSerment: true },
      },
      profilPro: { select: { profession: true, specialite: true } },
    },
  });

  return {
    id: pp.id,
    typeProfilPrincipal: pp.typeProfilPrincipal as PersonnePhysiqueListItem["typeProfilPrincipal"],
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    telephone: pp.telephone,
    portable: pp.portable,
    typeRelation: pp.typeRelation as PersonnePhysiqueListItem["typeRelation"],
    statutRgpd: pp.statutRgpd as PersonnePhysiqueListItem["statutRgpd"],
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    emailInvalide: pp.emailInvalide,
    totalEmails: pp.totalEmails,
    dernierEmailLe: fmtDate(pp.dernierEmailLe),
    linkedinUrl: pp.linkedinUrl,
    creerLe: (pp.creerLe as Date).toISOString(),
    modifierLe: (pp.modifierLe as Date).toISOString(),
    profilAvocat: pp.profilAvocat
      ? {
          barreau: pp.profilAvocat.barreau,
          specialite: pp.profilAvocat.specialite,
          activiteDominante: pp.profilAvocat.activiteDominante,
          profession: pp.profilAvocat.profession,
          dateSerment: fmtDate(pp.profilAvocat.dateSerment),
        }
      : null,
    profilPro: pp.profilPro
      ? { profession: pp.profilPro.profession, specialite: pp.profilPro.specialite }
      : null,
    adresse: pp.adresse ?? null,
  };
}

export class PpLieeADossierError extends Error {
  constructor(public readonly count: number) {
    super("PP référencée dans des dossiers");
    this.name = "PpLieeADossierError";
  }
}

export async function deletePersonnePhysique(id: string): Promise<void> {
  const dossiersCount = await prisma.dossierIntervenantContexte.count({
    where: { personnePhysiqueId: id },
  });
  if (dossiersCount > 0) throw new PpLieeADossierError(dossiersCount);

  await prisma.$transaction([
    prisma.rattachementPpPm.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.profilAvocat.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.profilParticulier.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.profilPro.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.personnePhysique.delete({ where: { id } }),
  ]);
}
