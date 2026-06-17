import { prisma } from "@/lib/server/prisma";
import type { PPCandidate } from "@/lib/server/modules/formations/participants-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { PPCandidate };

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
  resolution: "auto-create" | "createNew" | "linkExisting";
  linkedPpId: string | null;
};

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
    take: 1,
    select: { personneMorale: { select: { raisonSociale: true } } },
  },
} as const;

type PpRow = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  profilAvocat: { barreau: string | null } | null;
  rattachements: Array<{ personneMorale: { raisonSociale: string } }>;
};

function toCandidate(pp: PpRow): PPCandidate {
  return {
    id: pp.id,
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    barreau: pp.profilAvocat?.barreau ?? null,
    entreprise: pp.rattachements[0]?.personneMorale.raisonSociale ?? null,
  };
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

// ─── SIREN enrichment ─────────────────────────────────────────────────────────

type SireneResult = {
  raisonSociale: string;
  siret: string | null;
  siren: string | null;
  typeStructure: string | null;
  secteurActivite: string | null;
  rue: string | null;
  codePostal: string | null;
  ville: string | null;
};

async function searchSirene(nom: string): Promise<SireneResult | null> {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(nom)}&per_page=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      results?: Array<{
        nom_complet?: string;
        nom_raison_sociale?: string;
        siren?: string;
        forme_juridique?: string;
        activite_principale?: string;
        libelle_activite_principale?: string;
        siege?: {
          siret?: string;
          numero_voie?: string;
          type_voie?: string;
          libelle_voie?: string;
          adresse?: string;
          code_postal?: string;
          libelle_commune?: string;
        };
      }>;
    };
    const r = json.results?.[0];
    if (!r) return null;
    const siege = r.siege ?? {};
    const rueParts = [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean);
    const rue = rueParts.length > 0 ? rueParts.join(" ") : (siege.adresse ?? null);
    const naf = r.activite_principale && r.libelle_activite_principale
      ? `${r.activite_principale} - ${r.libelle_activite_principale}`
      : (r.activite_principale ?? null);
    return {
      raisonSociale: r.nom_complet ?? r.nom_raison_sociale ?? nom,
      siret: siege.siret ?? null,
      siren: r.siren ?? null,
      typeStructure: r.forme_juridique ?? null,
      secteurActivite: naf,
      rue: rue ?? null,
      codePostal: siege.code_postal ?? null,
      ville: siege.libelle_commune ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Structure lookup / create ────────────────────────────────────────────────

async function findOrCreatePM(raisonSociale: string): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.personneMorale.findFirst({
    where: { raisonSociale: { equals: raisonSociale.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const sirene = await searchSirene(raisonSociale);

  let adresseId: number | null = null;
  if (sirene && (sirene.rue || sirene.codePostal || sirene.ville)) {
    const adresse = await prisma.adresse.create({
      data: {
        rue: sirene.rue ?? null,
        codePostal: sirene.codePostal ?? null,
        ville: sirene.ville ?? null,
        pays: "France",
        typeAdresse: "SIEGE",
      },
    });
    adresseId = adresse.id;
  }

  const pm = await prisma.personneMorale.create({
    data: {
      raisonSociale: sirene?.raisonSociale ?? raisonSociale.trim(),
      siretSiren: sirene?.siret ?? sirene?.siren ?? null,
      typeStructure: sirene?.typeStructure ?? "cabinet d'avocats",
      secteurActivite: sirene?.secteurActivite ?? null,
      sourceOrigine: sirene ? "XLSX+SIRENE" : "XLSX",
      adresseId,
    },
  });
  return { id: pm.id, created: true };
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importPPs(rows: PPImportCreateInput[]): Promise<PPImportResult> {
  let ppCreees = 0;
  let ppIgnorees = 0;
  let structuresCreees = 0;

  for (const row of rows) {
    try {
      let ppId: string;

      if (row.resolution === "linkExisting" && row.linkedPpId) {
        ppId = row.linkedPpId;
        ppIgnorees++;
      } else {
        // Create PP
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
      }

      // Structures + rattachements
      for (const structureNom of row.structures) {
        if (!structureNom.trim()) continue;
        const { id: pmId, created } = await findOrCreatePM(structureNom);
        if (created) structuresCreees++;

        // Avoid duplicate rattachements
        const existing = await prisma.rattachementPpPm.findFirst({
          where: { personnePhysiqueId: ppId, personneMoraleId: pmId },
        });
        if (!existing) {
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
    } catch (err) {
      console.error(`[importPPs] Erreur ligne ${row.rowIndex}:`, err);
      ppIgnorees++;
    }
  }

  return { ppCreees, ppIgnorees, structuresCreees };
}
