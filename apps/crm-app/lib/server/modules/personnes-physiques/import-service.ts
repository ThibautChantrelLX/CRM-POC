import { prisma } from "@/lib/server/prisma";
import type { PPCandidate } from "@/lib/server/modules/formations/participants-service";
import {
  findOrCreatePM,
  reconcileRattachements,
  type StructureRattachementInput,
} from "@/lib/server/utils/pm-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { PPCandidate, StructureRattachementInput };

export type PPImportMatchInput = {
  rowIndex: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  barreau: string | null;
};

export type PPImportMatchResult = {
  rowIndex: number;
  status: "exact" | "partial" | "multi" | "none";
  candidates: PPCandidate[];
  matchDetail?: { nomMatch: boolean; prenomMatch: boolean; emailMatch: boolean };
};

export type PPImportCreateInput = {
  rowIndex: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  barreau: string | null;
  dateSerment: string | null;
  specialite: string | null;
  activiteDominante: string | null;
  structures: string[];
  siteWeb: string | null;
  resolution: "auto-create" | "createNew" | "linkExisting" | "auto-exact";
  linkedPpId: string | null;
  // When linking to an existing PP: reconciliation of PM rattachements
  structureRattachement: StructureRattachementInput | null;
  // When linking to an existing PP with a different email: use the xlsx email instead of keeping the existing one
  updatePpEmail: boolean;
  // External ID mapping (mapping_sources) — set when the xlsx has an "Id" column
  idExterne: string | null;
  sourceLogiciel: string | null;
};

// Merges two "|"-separated multi-value fields, de-duplicating case-insensitively.
function mergeListField(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  const existingParts = existing.split("|").map((s) => s.trim()).filter(Boolean);
  const incomingParts = incoming.split("|").map((s) => s.trim()).filter(Boolean);
  const merged = [...existingParts];
  for (const p of incomingParts) {
    if (!merged.some((m) => m.toLowerCase() === p.toLowerCase())) merged.push(p);
  }
  return merged.join(" | ");
}

export type PPImportResult = {
  ppCreees: number;
  ppIgnorees: number;
  structuresCreees: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PP_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  profilAvocat: { select: { barreau: true } },
  rattachements: {
    select: { id: true, personneMorale: { select: { raisonSociale: true } } },
  },
} as const;

type PpRow = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  profilAvocat: { barreau: string | null } | null;
  rattachements: Array<{ id: number; personneMorale: { raisonSociale: string } }>;
};

function toCandidate(pp: PpRow): PPCandidate {
  return {
    id: pp.id,
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    barreau: pp.profilAvocat?.barreau ?? null,
    entreprise: pp.rattachements[0]?.personneMorale.raisonSociale ?? null,
    rattachements: pp.rattachements.map((r) => ({ id: r.id, raisonSociale: r.personneMorale.raisonSociale })),
  };
}

// ─── Sources (mapping_sources) ─────────────────────────────────────────────────

export async function getDistinctSourceNoms(): Promise<string[]> {
  const rows = await prisma.mappingSource.findMany({
    distinct: ["sourceNom"],
    select: { sourceNom: true },
    orderBy: { sourceNom: "asc" },
  });
  return rows.map((r) => r.sourceNom);
}

// ─── Match ────────────────────────────────────────────────────────────────────

export async function matchPPsForImport(
  inputs: PPImportMatchInput[],
): Promise<PPImportMatchResult[]> {
  // Email queries
  const emailMap = new Map<string, PpRow[]>();
  const uniqueEmails = [...new Set(inputs.map((i) => i.email).filter(Boolean) as string[])];
  await Promise.all(
    uniqueEmails.map(async (email) => {
      const matches = await prisma.personnePhysique.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        select: PP_SELECT,
        take: 10,
      });
      emailMap.set(email.toLowerCase(), matches);
    }),
  );

  // Name queries for inputs where email found nothing
  const needsNameQuery = inputs.filter((i) => {
    if (!i.email) return true;
    return (emailMap.get(i.email.toLowerCase()) ?? []).length === 0;
  });

  const nameMap = new Map<string, PpRow[]>();
  await Promise.all(
    needsNameQuery
      .filter((i) => i.nom && i.prenom)
      .map(async (i) => {
        const key = `${i.nom!.toLowerCase()}|${i.prenom!.toLowerCase()}`;
        if (nameMap.has(key)) return;
        const matches = await prisma.personnePhysique.findMany({
          where: {
            nom: { equals: i.nom!, mode: "insensitive" },
            prenom: { equals: i.prenom!, mode: "insensitive" },
          },
          select: PP_SELECT,
          take: 10,
        });
        nameMap.set(key, matches);
      }),
  );

  return inputs.map((input): PPImportMatchResult => {
    if (input.email) {
      const emailMatches = emailMap.get(input.email.toLowerCase()) ?? [];
      if (emailMatches.length > 1) {
        return { rowIndex: input.rowIndex, status: "multi", candidates: emailMatches.map(toCandidate) };
      }
      if (emailMatches.length === 1) {
        const pp = emailMatches[0];
        const nomMatch = pp.nom.toLowerCase() === (input.nom ?? "").toLowerCase();
        const prenomMatch = (pp.prenom ?? "").toLowerCase() === (input.prenom ?? "").toLowerCase();
        if (nomMatch && prenomMatch) {
          return { rowIndex: input.rowIndex, status: "exact", candidates: [toCandidate(pp)] };
        }
        return {
          rowIndex: input.rowIndex,
          status: "partial",
          candidates: [toCandidate(pp)],
          matchDetail: { nomMatch, prenomMatch, emailMatch: true },
        };
      }
    }

    if (input.nom && input.prenom) {
      const nameMatches = nameMap.get(`${input.nom.toLowerCase()}|${input.prenom.toLowerCase()}`) ?? [];
      if (nameMatches.length > 1) {
        return { rowIndex: input.rowIndex, status: "multi", candidates: nameMatches.map(toCandidate) };
      }
      if (nameMatches.length === 1) {
        const pp = nameMatches[0];
        const emailMatch =
          !!input.email && (pp.email ?? "").toLowerCase() === input.email.toLowerCase();
        if (emailMatch) {
          return { rowIndex: input.rowIndex, status: "exact", candidates: [toCandidate(pp)] };
        }
        return {
          rowIndex: input.rowIndex,
          status: "partial",
          candidates: [toCandidate(pp)],
          matchDetail: { nomMatch: true, prenomMatch: true, emailMatch: false },
        };
      }
    }

    return { rowIndex: input.rowIndex, status: "none", candidates: [] };
  });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importPPs(rows: PPImportCreateInput[]): Promise<PPImportResult> {
  let ppCreees = 0;
  let ppIgnorees = 0;
  let structuresCreees = 0;

  for (const row of rows) {
    try {
      const isNew = row.resolution === "auto-create" || row.resolution === "createNew";
      const isLinked = (row.resolution === "linkExisting" || row.resolution === "auto-exact") && row.linkedPpId;

      let ppId: string | undefined;

      if (isLinked) {
        ppId = row.linkedPpId!;
        ppIgnorees++;

        if (row.updatePpEmail && row.email) {
          await prisma.personnePhysique.update({
            where: { id: ppId },
            data: { email: row.email },
          });
        }

        // Merge specialite/activiteDominante with existing values instead of overwriting
        const existingProfil = await prisma.profilAvocat.findUnique({
          where: { personnePhysiqueId: ppId },
        });
        const mergedSpecialite = mergeListField(existingProfil?.specialite ?? null, row.specialite);
        const mergedActivite = mergeListField(existingProfil?.activiteDominante ?? null, row.activiteDominante);
        if (existingProfil) {
          if (mergedSpecialite !== existingProfil.specialite || mergedActivite !== existingProfil.activiteDominante) {
            await prisma.profilAvocat.update({
              where: { personnePhysiqueId: ppId },
              data: { specialite: mergedSpecialite, activiteDominante: mergedActivite },
            });
          }
        } else if (row.specialite || row.activiteDominante || row.barreau || row.dateSerment) {
          await prisma.profilAvocat.create({
            data: {
              personnePhysiqueId: ppId,
              barreau: row.barreau ?? null,
              dateSerment: row.dateSerment ? new Date(row.dateSerment) : null,
              specialite: mergedSpecialite,
              activiteDominante: mergedActivite,
            },
          });
        }

        // Reconcile PM rattachements if user made a structure decision
        if (row.structureRattachement && row.structureRattachement.action !== "skip") {
          const { pmCreee } = await reconcileRattachements(ppId, row.structureRattachement);
          if (pmCreee) structuresCreees++;
        }
      } else if (isNew) {
        const pp = await prisma.personnePhysique.create({
          data: {
            nom: row.nom,
            prenom: row.prenom ?? null,
            email: row.email ?? null,
            telephone: row.telephone ?? null,
            portable: row.portable ?? null,
            typeRelation: "CONTACT",
            typeProfilPrincipal: "AVOCAT_EXTERNE",
            profilAvocat: {
              create: {
                barreau: row.barreau ?? null,
                dateSerment: row.dateSerment ? new Date(row.dateSerment) : null,
                specialite: row.specialite ?? null,
                activiteDominante: row.activiteDominante ?? null,
              },
            },
          },
        });
        ppId = pp.id;
        ppCreees++;

        // For new PP: create rattachements for all structures
        for (const structureNom of row.structures) {
          if (!structureNom.trim()) continue;
          const { id: pmId, created } = await findOrCreatePM(structureNom);
          if (created) structuresCreees++;
          const already = await prisma.rattachementPpPm.findFirst({
            where: { personnePhysiqueId: ppId, personneMoraleId: pmId },
          });
          if (!already) {
            await prisma.rattachementPpPm.create({
              data: {
                personnePhysiqueId: ppId,
                personneMoraleId: pmId,
                titreFonction: "Avocat",
                dateDebut: new Date(),
              },
            });
          }
        }
      }

      if (ppId && row.idExterne && row.sourceLogiciel) {
        await prisma.mappingSource.upsert({
          where: {
            entiteCrm_sourceNom_sourceIdExterne: {
              entiteCrm: "PersonnePhysique",
              sourceNom: row.sourceLogiciel,
              sourceIdExterne: row.idExterne,
            },
          },
          create: {
            entiteCrm: "PersonnePhysique",
            entiteCrmId: ppId,
            sourceNom: row.sourceLogiciel,
            sourceIdExterne: row.idExterne,
          },
          update: {
            entiteCrmId: ppId,
            dateDerniereSynchro: new Date(),
          },
        });
      }
    } catch (err) {
      console.error(`[importPPs] Erreur ligne ${row.rowIndex}:`, err);
      ppIgnorees++;
    }
  }

  return { ppCreees, ppIgnorees, structuresCreees };
}
