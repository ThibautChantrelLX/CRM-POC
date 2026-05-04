import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import type {
  CreatePersonnePhysiqueInput,
  PersonnePhysiqueListItem,
  PersonnePhysiqueListQuery,
  PersonnePhysiqueListResponse,
  UpdatePersonnePhysiqueInput,
} from "./dto";

const ALLOWED_SORT: Record<string, true> = {
  id: true, nom: true, prenom: true, email: true, telephone: true,
  portable: true, specialite: true, profession: true, typeRelation: true,
  statutRgpd: true, actif: true, totalEmails: true, dernierEmailLe: true,
  dateSerment: true, creerLe: true, modifierLe: true,
};

const INCLUDE = {
  adresse: { select: { ville: true, codePostal: true, pays: true } },
} as const;

function ilike(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

function buildWhere(q: PersonnePhysiqueListQuery): Prisma.PersonnePhysiqueWhereInput {
  const and: Prisma.PersonnePhysiqueWhereInput[] = [];

  if (q.search) {
    const s = ilike(q.search);
    and.push({
      OR: [
        { nom: s }, { prenom: s }, { email: s },
        { telephone: s }, { portable: s },
        { profession: s }, { specialite: s }, { poste: s },
      ],
    });
  }

  if (q.nom) and.push({ nom: ilike(q.nom) });
  if (q.prenom) and.push({ prenom: ilike(q.prenom) });
  if (q.email) and.push({ email: ilike(q.email) });
  if (q.profession) and.push({ profession: ilike(q.profession) });
  if (q.specialite) and.push({ specialite: ilike(q.specialite) });

  if (q.typeRelation?.length) and.push({ typeRelation: { in: q.typeRelation } });
  if (q.statutRgpd?.length) and.push({ statutRgpd: { in: q.statutRgpd } });

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
      dateSerment: {
        ...(q.dateSermentApres && { gte: new Date(q.dateSermentApres) }),
        ...(q.dateSermentAvant && { lte: new Date(q.dateSermentAvant) }),
      },
    });
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
  const where = buildWhere(q);

  const [total, data] = await Promise.all([
    prisma.personnePhysique.count({ where }),
    prisma.personnePhysique.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
  ]);

  return {
    data: data as unknown as PersonnePhysiqueListItem[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPersonnePhysique(id: number): Promise<PersonnePhysiqueListItem | null> {
  const pp = await prisma.personnePhysique.findUnique({ where: { id }, include: INCLUDE });
  return pp as unknown as PersonnePhysiqueListItem | null;
}

export async function createPersonnePhysique(
  data: CreatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const pp = await prisma.personnePhysique.create({ data });
  return pp as unknown as PersonnePhysiqueListItem;
}

export async function updatePersonnePhysique(
  id: number,
  data: UpdatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const pp = await prisma.personnePhysique.update({ where: { id }, data });
  return pp as unknown as PersonnePhysiqueListItem;
}

export async function deletePersonnePhysique(id: number): Promise<void> {
  await prisma.personnePhysique.delete({ where: { id } });
}
