import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import type {
  CreatePersonnePhysiqueInput,
  PersonnePhysiqueDetail,
  PersonnePhysiqueExportItem,
  PersonnePhysiqueGroupFilter,
  PersonnePhysiqueListItem,
  PersonnePhysiqueListQuery,
  PersonnePhysiqueListResponse,
  UpdatePersonnePhysiqueInput,
} from "./dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_SORT: Record<string, true> = {
  id: true, nom: true, prenom: true, email: true, telephone: true,
  portable: true, typeRelation: true,
  statutRgpd: true, actif: true, totalEmails: true, dernierEmailLe: true,
  creerLe: true, modifierLe: true,
};

function ilike(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return (d as Date).toISOString().split("T")[0];
}

// ─── List ─────────────────────────────────────────────────────────────────────

function buildGroupConditions(
  q: PersonnePhysiqueGroupFilter,
): Prisma.PersonnePhysiqueWhereInput[] {
  const and: Prisma.PersonnePhysiqueWhereInput[] = [];

  if (q.nom) and.push({ nom: ilike(q.nom) });
  if (q.prenom) and.push({ prenom: ilike(q.prenom) });
  if (q.email) and.push({ email: ilike(q.email) });
  if (q.profession?.length) and.push({
    OR: [
      { profilAvocat: { profession: { in: q.profession } } },
      { profilPro: { profession: { in: q.profession } } },
    ],
  });
  if (q.specialite?.length) and.push({
    OR: [
      { profilAvocat: { specialite: { in: q.specialite } } },
      { profilPro: { specialite: { in: q.specialite } } },
    ],
  });
  if (q.activiteDominante?.length)
    and.push({ profilAvocat: { activiteDominante: { in: q.activiteDominante } } });
  if (q.typeRelation?.length) and.push({ typeRelation: { in: q.typeRelation } });
  if (q.barreau?.length) and.push({ profilAvocat: { barreau: { in: q.barreau } } });

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

  return and;
}

function buildWhere(
  q: PersonnePhysiqueListQuery,
  formationCountIds?: string[] | null,
): Prisma.PersonnePhysiqueWhereInput {
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
      ],
    });
  }

  if (q.nom) and.push({ nom: ilike(q.nom) });
  if (q.prenom) and.push({ prenom: ilike(q.prenom) });
  if (q.email) and.push({ email: ilike(q.email) });
  if (q.profession?.length) and.push({
    OR: [
      { profilAvocat: { profession: { in: q.profession } } },
      { profilPro: { profession: { in: q.profession } } },
    ],
  });
  if (q.specialite?.length) and.push({
    OR: [
      { profilAvocat: { specialite: { in: q.specialite } } },
      { profilPro: { specialite: { in: q.specialite } } },
    ],
  });
  if (q.activiteDominante?.length) and.push({ profilAvocat: { activiteDominante: { in: q.activiteDominante } } });

  if (q.typeRelation?.length) and.push({ typeRelation: { in: q.typeRelation } });
  if (q.statutRgpd?.length) and.push({ statutRgpd: { in: q.statutRgpd } });
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

  if (q.minFormations === 1)
    and.push({ participations: { some: {} } });
  if (formationCountIds !== null && formationCountIds !== undefined)
    and.push({ id: { in: formationCountIds } });
  if (q.formationIds?.length)
    and.push({ participations: { some: { formationId: { in: q.formationIds } } } });

  if (q.groups?.length === 1) {
    and.push(...buildGroupConditions(q.groups[0]));
  } else if (q.groups && q.groups.length > 1) {
    const orClauses = q.groups
      .map((g) => buildGroupConditions(g))
      .filter((gc) => gc.length > 0)
      .map((gc) => (gc.length === 1 ? gc[0] : { AND: gc }));
    if (orClauses.length > 0) and.push({ OR: orClauses });
  }

  return and.length ? { AND: and } : {};
}

export async function fetchPersonnesPhysiques(
  q: PersonnePhysiqueListQuery,
): Promise<PersonnePhysiqueListResponse> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const sortBy = ALLOWED_SORT[q.sortBy ?? ""] ? q.sortBy! : "nom";
  const sortOrder = q.sortOrder === "desc" ? "desc" : "asc";

  // Filtre "au moins N formations" — nécessite une sous-requête SQL pour N > 1
  let formationCountIds: string[] | null = null;
  if (q.minFormations && q.minFormations >= 1) {
    if (q.minFormations === 1) {
      // Cas simple géré dans buildWhere via Prisma
    } else {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT personne_physique_id::text AS id
        FROM participations_formations
        WHERE personne_physique_id IS NOT NULL
        GROUP BY personne_physique_id
        HAVING COUNT(*) >= ${BigInt(q.minFormations)}
      `;
      formationCountIds = rows.map((r) => r.id);
    }
  }

  const where = buildWhere(q, formationCountIds);

  const [total, rows] = await Promise.all([
    prisma.personnePhysique.count({ where }),
    prisma.personnePhysique.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        adresse: { select: { ville: true, codePostal: true, pays: true } },
        profilAvocat: { select: { profession: true, specialite: true, barreau: true, dateSerment: true } },
        profilPro: { select: { profession: true } },
      },
    }),
  ]);

  const data: PersonnePhysiqueListItem[] = rows.map((r) => ({
    ...r,
    profession: r.profilAvocat?.profession ?? r.profilPro?.profession ?? null,
    specialite: r.profilAvocat?.specialite ?? null,
    barreau: r.profilAvocat?.barreau ?? null,
    dateSerment: fmtDate(r.profilAvocat?.dateSerment),
    dernierEmailLe: fmtDate(r.dernierEmailLe),
    creerLe: (r.creerLe as Date).toISOString(),
    modifierLe: (r.modifierLe as Date).toISOString(),
  })) as unknown as PersonnePhysiqueListItem[];

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportPersonnesPhysiques(
  q: PersonnePhysiqueListQuery,
): Promise<PersonnePhysiqueExportItem[]> {
  const where = buildWhere(q);

  const rows = await prisma.personnePhysique.findMany({
    where,
    orderBy: { nom: "asc" },
    take: 10000,
    include: {
      profilAvocat: {
        select: {
          profession: true, specialite: true, barreau: true,
          dateSerment: true, activiteDominante: true,
        },
      },
      profilPro: { select: { profession: true, specialite: true } },
      rattachements: {
        include: {
          personneMorale: { select: { raisonSociale: true, siretSiren: true, email: true, telephone: true } },
        },
        orderBy: [
          { dateFin: { sort: "asc", nulls: "first" } },
          { dateDebut: "desc" },
        ],
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    prenom: r.prenom,
    email: r.email,
    telephone: r.telephone,
    portable: r.portable,
    profession: r.profilAvocat?.profession ?? r.profilPro?.profession ?? null,
    specialite: r.profilAvocat?.specialite ?? r.profilPro?.specialite ?? null,
    barreau: r.profilAvocat?.barreau ?? null,
    dateSerment: fmtDate(r.profilAvocat?.dateSerment),
    activiteDominante: r.profilAvocat?.activiteDominante ?? null,
    typeRelation: r.typeRelation as PersonnePhysiqueExportItem["typeRelation"],
    statutRgpd: r.statutRgpd as PersonnePhysiqueExportItem["statutRgpd"],
    actif: r.actif,
    optInEmail: r.optInEmail,
    optInSms: r.optInSms,
    optOutGlobal: r.optOutGlobal,
    emailInvalide: r.emailInvalide,
    totalEmails: r.totalEmails,
    dernierEmailLe: fmtDate(r.dernierEmailLe),
    creerLe: (r.creerLe as Date).toISOString().split("T")[0],
    modifierLe: (r.modifierLe as Date).toISOString().split("T")[0],
    rattachements: r.rattachements.map((ratt) => ({
      raisonSociale: ratt.personneMorale.raisonSociale,
      siretSirenPm: ratt.personneMorale.siretSiren,
      titreFonction: ratt.titreFonction,
      dateDebut: fmtDate(ratt.dateDebut as Date | null),
      dateFin: fmtDate(ratt.dateFin),
      emailPm: ratt.personneMorale.email,
      telephonePm: ratt.personneMorale.telephone,
    })),
  }));
}

// ─── Detail (liste + rattachements) ───────────────────────────────────────────

export async function getPersonnePhysiqueDetail(
  id: string,
): Promise<PersonnePhysiqueDetail | null> {
  const pp = await prisma.personnePhysique.findUnique({
    where: { id },
    include: {
      adresse: true,
      profilAvocat: { select: { profession: true, specialite: true, barreau: true, dateSerment: true, activiteDominante: true } },
      profilPro: { select: { profession: true, specialite: true } },
      profilParticulier: { select: { civilite: true, dateNaissance: true, situationFamiliale: true } },
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
      participations: {
        include: {
          formation: {
            select: {
              id: true,
              numero: true,
              intitule: true,
              intituleCourt: true,
              dateDebut: true,
              dateFin: true,
            },
          },
        },
        orderBy: { formation: { dateDebut: "desc" } },
      },
    },
  });

  if (!pp) return null;

  return {
    id: pp.id,
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    telephone: pp.telephone,
    portable: pp.portable,
    typeProfilPrincipal: pp.typeProfilPrincipal ?? null,
    specialite: pp.profilAvocat?.specialite ?? pp.profilPro?.specialite ?? null,
    profession: pp.profilAvocat?.profession ?? pp.profilPro?.profession ?? null,
    barreau: pp.profilAvocat?.barreau ?? null,
    dateSerment: fmtDate(pp.profilAvocat?.dateSerment),
    activiteDominante: pp.profilAvocat?.activiteDominante ?? null,
    civilite: pp.profilParticulier?.civilite ?? null,
    dateNaissance: fmtDate(pp.profilParticulier?.dateNaissance),
    situationFamiliale: pp.profilParticulier?.situationFamiliale ?? null,
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
    participations: pp.participations.map((p) => ({
      id: p.id,
      formationId: p.formation.id,
      intitule: p.formation.intitule,
      intituleCourt: p.formation.intituleCourt,
      numero: p.formation.numero,
      dateDebut: fmtDate(p.formation.dateDebut),
      dateFin: fmtDate(p.formation.dateFin),
      present: p.present,
      dateInscription: fmtDate(p.dateInscription),
    })),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getPersonnePhysique(id: string): Promise<PersonnePhysiqueListItem | null> {
  const pp = await prisma.personnePhysique.findUnique({
    where: { id },
    include: { adresse: { select: { ville: true, codePostal: true, pays: true } } },
  });
  if (!pp) return null;
  return {
    ...pp,
    profession: null,
    specialite: null,
    barreau: null,
    dateSerment: null,
    dernierEmailLe: fmtDate(pp.dernierEmailLe),
    creerLe: (pp.creerLe as Date).toISOString(),
    modifierLe: (pp.modifierLe as Date).toISOString(),
  } as unknown as PersonnePhysiqueListItem;
}

export async function createPersonnePhysique(
  data: CreatePersonnePhysiqueInput,
  actorName?: string,
): Promise<PersonnePhysiqueListItem> {
  const {
    profilType,
    barreau, dateSerment, specialite, profession, activiteDominante,
    civilite, dateNaissance, situationFamiliale,
    ...ppData
  } = data;

  const typeProfilPrincipal =
    profilType === "AVOCAT" ? "AVOCAT_INTERNE" :
    profilType === "PRO" ? "CONTACT_PRO" : "PARTICULIER";

  const pp = await prisma.personnePhysique.create({
    data: {
      ...ppData,
      typeProfilPrincipal,
      creerPar: actorName ?? null,
      modifierPar: actorName ?? null,
      ...(profilType === "AVOCAT" && {
        profilAvocat: {
          create: {
            barreau: barreau ?? null,
            dateSerment: dateSerment ? new Date(dateSerment) : null,
            specialite: specialite ?? null,
            profession: profession ?? null,
            activiteDominante: activiteDominante ?? null,
          },
        },
      }),
      ...(profilType === "PRO" && {
        profilPro: {
          create: {
            profession: profession ?? null,
            specialite: specialite ?? null,
          },
        },
      }),
      ...(profilType === "PARTICULIER" && {
        profilParticulier: {
          create: {
            civilite: civilite ?? null,
            dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
            situationFamiliale: situationFamiliale ?? null,
          },
        },
      }),
    },
  });
  return pp as unknown as PersonnePhysiqueListItem;
}

export async function updatePersonnePhysique(
  id: string,
  data: UpdatePersonnePhysiqueInput,
  actorName?: string,
): Promise<PersonnePhysiqueListItem> {
  const {
    profilType,
    barreau, dateSerment, specialite, profession, activiteDominante,
    civilite, dateNaissance, situationFamiliale,
    ...ppData
  } = data;

  const pp = await prisma.personnePhysique.update({
    where: { id },
    data: { ...ppData, modifierPar: actorName ?? null },
  });

  if (profilType === "AVOCAT") {
    const profilData = {
      barreau: barreau ?? null,
      dateSerment: dateSerment ? new Date(dateSerment) : null,
      specialite: specialite ?? null,
      profession: profession ?? null,
      activiteDominante: activiteDominante ?? null,
    };
    await prisma.profilAvocat.upsert({
      where: { personnePhysiqueId: id },
      create: { personnePhysiqueId: id, ...profilData },
      update: profilData,
    });
  } else if (profilType === "PRO") {
    const profilData = { profession: profession ?? null, specialite: specialite ?? null };
    await prisma.profilPro.upsert({
      where: { personnePhysiqueId: id },
      create: { personnePhysiqueId: id, ...profilData },
      update: profilData,
    });
  } else if (profilType === "PARTICULIER") {
    const profilData = {
      civilite: civilite ?? null,
      dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
      situationFamiliale: situationFamiliale ?? null,
    };
    await prisma.profilParticulier.upsert({
      where: { personnePhysiqueId: id },
      create: { personnePhysiqueId: id, ...profilData },
      update: profilData,
    });
  }

  return pp as unknown as PersonnePhysiqueListItem;
}

export async function deletePersonnePhysique(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.profilAvocat.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.profilPro.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.profilParticulier.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.rattachementPpPm.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.dossierIntervenantContexte.deleteMany({ where: { personnePhysiqueId: id } }),
    prisma.personnePhysique.delete({ where: { id } }),
  ]);
}
