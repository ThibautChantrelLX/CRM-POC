import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import type {
  CreatePersonneMoraleInput,
  PersonneMoraleDetail,
  PersonneMoraleListItem,
  PersonneMoraleListQuery,
  PersonneMoraleListResponse,
  UpdatePersonneMoraleInput,
} from "./dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_SORT: Record<string, true> = {
  id: true, raisonSociale: true, email: true, telephone: true,
  siretSiren: true, typeStructure: true, typeRelation: true,
  actif: true, secteurActivite: true, categorieEntreprise: true,
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

function buildWhere(q: PersonneMoraleListQuery): Prisma.PersonneMoraleWhereInput {
  const and: Prisma.PersonneMoraleWhereInput[] = [];

  if (q.search) {
    const s = ilike(q.search);
    and.push({
      OR: [
        { raisonSociale: s },
        { email: s },
        { telephone: s },
        { siretSiren: s },
        { typeStructure: s },
        { secteurActivite: s },
        { nomDomaine: s },
      ],
    });
  }

  if (q.raisonSociale) and.push({ raisonSociale: ilike(q.raisonSociale) });
  if (q.email) and.push({ email: ilike(q.email) });
  if (q.siretSiren) and.push({ siretSiren: ilike(q.siretSiren) });
  if (q.typeStructure) and.push({ typeStructure: ilike(q.typeStructure) });
  if (q.secteurActivite) and.push({ secteurActivite: ilike(q.secteurActivite) });

  if (q.typeRelation?.length) and.push({ typeRelation: { in: q.typeRelation } });
  if (q.actif !== undefined) and.push({ actif: q.actif });

  if (q.creerLeApres || q.creerLeAvant) {
    and.push({
      creerLe: {
        ...(q.creerLeApres && { gte: new Date(q.creerLeApres) }),
        ...(q.creerLeAvant && { lte: new Date(q.creerLeAvant) }),
      },
    });
  }

  return and.length ? { AND: and } : {};
}

export async function fetchPersonnesMorales(
  q: PersonneMoraleListQuery,
): Promise<PersonneMoraleListResponse> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const sortBy = ALLOWED_SORT[q.sortBy ?? ""] ? q.sortBy! : "raisonSociale";
  const sortOrder = q.sortOrder === "desc" ? "desc" : "asc";
  const where = buildWhere(q);

  const [total, rows] = await Promise.all([
    prisma.personneMorale.count({ where }),
    prisma.personneMorale.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        adresse: { select: { ville: true, codePostal: true, pays: true } },
        _count: { select: { rattachements: true } },
      },
    }),
  ]);

  const data: PersonneMoraleListItem[] = rows.map((r) => ({
    ...r,
    creerLe: (r.creerLe as Date).toISOString(),
    modifierLe: (r.modifierLe as Date).toISOString(),
  })) as unknown as PersonneMoraleListItem[];

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getPersonneMoraleDetail(
  id: string,
): Promise<PersonneMoraleDetail | null> {
  const pm = await prisma.personneMorale.findUnique({
    where: { id },
    include: {
      adresse: true,
      maisonMere: { select: { id: true, raisonSociale: true, siretSiren: true } },
      filiales: {
        select: { id: true, raisonSociale: true, siretSiren: true, actif: true },
        orderBy: { raisonSociale: "asc" },
      },
      rattachements: {
        include: {
          personnePhysique: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              profilAvocat: { select: { profession: true } },
              profilPro: { select: { profession: true } },
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

  if (!pm) return null;

  return {
    id: pm.id,
    raisonSociale: pm.raisonSociale,
    email: pm.email,
    telephone: pm.telephone,
    siretSiren: pm.siretSiren,
    nomDomaine: pm.nomDomaine,
    typeStructure: pm.typeStructure,
    typeRelation: (pm.typeRelation ?? null) as PersonneMoraleDetail["typeRelation"],
    actif: pm.actif,
    sourceOrigine: pm.sourceOrigine,
    categorieEntreprise: pm.categorieEntreprise,
    secteurActivite: pm.secteurActivite,
    siteWeb: pm.siteWeb,
    creerLe: (pm.creerLe as Date).toISOString(),
    modifierLe: (pm.modifierLe as Date).toISOString(),
    creerPar: pm.creerPar,
    modifierPar: pm.modifierPar,
    adresse: pm.adresse
      ? {
          rue: pm.adresse.rue,
          complementAdresse: pm.adresse.complementAdresse,
          codePostal: pm.adresse.codePostal,
          ville: pm.adresse.ville,
          pays: pm.adresse.pays,
        }
      : null,
    maisonMere: pm.maisonMere,
    filiales: pm.filiales,
    contacts: pm.rattachements.map((r) => ({
      id: r.id,
      titreFonction: r.titreFonction,
      dateDebut: fmtDate(r.dateDebut as Date),
      dateFin: fmtDate(r.dateFin),
      personnePhysique: {
        id: r.personnePhysique.id,
        nom: r.personnePhysique.nom,
        prenom: r.personnePhysique.prenom,
        email: r.personnePhysique.email,
        profession: r.personnePhysique.profilAvocat?.profession ?? r.personnePhysique.profilPro?.profession ?? null,
      },
    })),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getPersonneMorale(id: string): Promise<PersonneMoraleListItem | null> {
  const pm = await prisma.personneMorale.findUnique({
    where: { id },
    include: { adresse: { select: { ville: true, codePostal: true, pays: true } } },
  });
  if (!pm) return null;
  return {
    ...pm,
    creerLe: (pm.creerLe as Date).toISOString(),
    modifierLe: (pm.modifierLe as Date).toISOString(),
  } as unknown as PersonneMoraleListItem;
}

export async function createPersonneMorale(
  data: CreatePersonneMoraleInput,
  actorName?: string,
): Promise<PersonneMoraleListItem> {
  const { adresse, ...rest } = data;

  let adresseId: number | undefined;
  if (adresse && Object.values(adresse).some(Boolean)) {
    const created = await prisma.adresse.create({
      data: {
        rue: adresse.rue ?? null,
        complementAdresse: adresse.complementAdresse ?? null,
        codePostal: adresse.codePostal ?? null,
        ville: adresse.ville ?? null,
        pays: adresse.pays ?? null,
      },
    });
    adresseId = created.id;
  }

  const cleanRest = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );

  const pm = await prisma.personneMorale.create({
    data: {
      ...cleanRest,
      ...(adresseId !== undefined ? { adresseId } : {}),
      creerPar: actorName ?? null,
      modifierPar: actorName ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    include: { adresse: { select: { ville: true, codePostal: true, pays: true } } },
  });

  return {
    ...pm,
    creerLe: (pm.creerLe as Date).toISOString(),
    modifierLe: (pm.modifierLe as Date).toISOString(),
  } as unknown as PersonneMoraleListItem;
}

export async function updatePersonneMorale(
  id: string,
  data: UpdatePersonneMoraleInput,
  actorName?: string,
): Promise<PersonneMoraleListItem> {
  const { adresse, ...rest } = data;

  let adresseIdPatch: { adresseId: number } | undefined;
  if (adresse !== undefined) {
    const existing = await prisma.personneMorale.findUnique({
      where: { id },
      select: { adresseId: true },
    });
    const adresseData = {
      rue: adresse.rue ?? null,
      complementAdresse: adresse.complementAdresse ?? null,
      codePostal: adresse.codePostal ?? null,
      ville: adresse.ville ?? null,
      pays: adresse.pays ?? null,
    };
    if (existing?.adresseId) {
      await prisma.adresse.update({ where: { id: existing.adresseId }, data: adresseData });
    } else if (Object.values(adresse).some(Boolean)) {
      const created = await prisma.adresse.create({ data: adresseData });
      adresseIdPatch = { adresseId: created.id };
    }
  }

  const cleanRest = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );

  const pm = await prisma.personneMorale.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ...cleanRest, ...adresseIdPatch, modifierPar: actorName ?? null } as any,
    include: { adresse: { select: { ville: true, codePostal: true, pays: true } } },
  });

  return {
    ...pm,
    creerLe: (pm.creerLe as Date).toISOString(),
    modifierLe: (pm.modifierLe as Date).toISOString(),
  } as unknown as PersonneMoraleListItem;
}

export async function deletePersonneMorale(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.rattachementPpPm.deleteMany({ where: { personneMoraleId: id } }),
    prisma.personneMorale.delete({ where: { id } }),
  ]);
}
