import { prisma } from "@/lib/server/prisma";
import type {
  CreateFormationInput,
  FormationDetail,
  FormationListItem,
  FormationListQuery,
  ImportConfirmResult,
  UpdateFormationInput,
} from "./dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return (d as Date).toISOString();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function rowToListItem(r: ReturnType<typeof mapRow>): FormationListItem {
  return r;
}

function mapRow(r: {
  id: string;
  numero: string;
  idDendreo: number | null;
  intitule: string;
  intituleCourt: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
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
  recettes: unknown;
  depenses: unknown;
  marge: unknown;
  satisfGenerale: number | null;
  satisfFormateur: number | null;
  satisfSalle: number | null;
  tauxReponseChaud: number | null;
  satisfGeneraleFroid: number | null;
  tauxReponseFroid: number | null;
  creerLe: Date;
  modifierLe: Date;
  creerPar: string | null;
  modifierPar: string | null;
  _count: { participations: number };
}): FormationListItem {
  return {
    ...r,
    dateDebut: fmtDatetime(r.dateDebut),
    dateFin: fmtDatetime(r.dateFin),
    recettes: toNum(r.recettes),
    depenses: toNum(r.depenses),
    marge: toNum(r.marge),
    creerLe: (r.creerLe as Date).toISOString(),
    modifierLe: (r.modifierLe as Date).toISOString(),
  };
}

const INCLUDE_COUNT = { _count: { select: { participations: true } } } as const;

// ─── List ─────────────────────────────────────────────────────────────────────

export async function fetchFormations(q: FormationListQuery = {}): Promise<FormationListItem[]> {
  const where = q.search
    ? {
        OR: [
          { intitule: { contains: q.search, mode: "insensitive" as const } },
          { numero: { contains: q.search, mode: "insensitive" as const } },
          { responsable: { contains: q.search, mode: "insensitive" as const } },
          { categorie: { contains: q.search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const rows = await prisma.formation.findMany({
    where,
    include: INCLUDE_COUNT,
    orderBy: { dateDebut: "desc" },
  });

  return rows.map((r) => rowToListItem(mapRow(r)));
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getFormationDetail(id: string): Promise<FormationDetail | null> {
  const r = await prisma.formation.findUnique({
    where: { id },
    include: INCLUDE_COUNT,
  });
  if (!r) return null;
  return { ...rowToListItem(mapRow(r)), description: r.description };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateFormation(
  id: string,
  data: UpdateFormationInput,
  actorName?: string,
): Promise<FormationListItem> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const r = await prisma.formation.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ...clean, modifierPar: actorName ?? null } as any,
    include: INCLUDE_COUNT,
  });
  return rowToListItem(mapRow(r));
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFormation(id: string): Promise<void> {
  await prisma.formation.delete({ where: { id } });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function checkExistingNumeros(numeros: string[]): Promise<string[]> {
  const existing = await prisma.formation.findMany({
    where: { numero: { in: numeros } },
    select: { numero: true },
  });
  return existing.map((f) => f.numero);
}

export async function bulkCreateFormations(
  formations: CreateFormationInput[],
  actorName?: string,
): Promise<ImportConfirmResult> {
  const result = await prisma.formation.createMany({
    data: formations.map((f) => ({
      ...f,
      dateDebut: f.dateDebut ? new Date(f.dateDebut) : null,
      dateFin: f.dateFin ? new Date(f.dateFin) : null,
      creerPar: actorName ?? null,
      modifierPar: actorName ?? null,
    })),
    skipDuplicates: true,
  });
  return { created: result.count };
}
