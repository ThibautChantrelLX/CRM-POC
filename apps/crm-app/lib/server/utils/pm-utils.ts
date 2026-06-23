import { prisma } from "@/lib/server/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StructureRattachementInput = {
  structureNom: string;
  action: "addKeepAll" | "addReplaceAll" | "addKeepSome" | "skip";
  keepIds: number[];
};

// ─── SIREN ────────────────────────────────────────────────────────────────────

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

// Normalizes a SIRET/SIREN string down to its 9-digit SIREN prefix, for comparison.
export function sirenOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : null;
}

export async function searchSirene(nom: string): Promise<SireneResult | null> {
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
    const naf =
      r.activite_principale && r.libelle_activite_principale
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

// ─── PM lookup / create ───────────────────────────────────────────────────────

export async function findOrCreatePM(
  raisonSociale: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.personneMorale.findFirst({
    where: { raisonSociale: { equals: raisonSociale.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const sirene = await searchSirene(raisonSociale);

  // The free-text name may not match any existing PM, but SIRENE can resolve it to a
  // company already in the CRM under a different (canonical) raison sociale — reuse it
  // instead of creating a duplicate.
  const siren = sirenOf(sirene?.siret ?? sirene?.siren ?? null);
  if (siren) {
    // SIRET always starts with the 9-digit SIREN, so this matches both 9- and 14-digit storage.
    const bySiren = await prisma.personneMorale.findFirst({
      where: { siretSiren: { startsWith: siren } },
      select: { id: true },
    });
    if (bySiren) return { id: bySiren.id, created: false };
  }

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

// ─── Rattachement reconciliation ──────────────────────────────────────────────

export async function reconcileRattachements(
  ppId: string,
  input: StructureRattachementInput,
): Promise<{ pmCreee: boolean }> {
  if (input.action === "skip") return { pmCreee: false };

  const { id: pmId, created } = await findOrCreatePM(input.structureNom);

  if (input.action === "addReplaceAll") {
    await prisma.rattachementPpPm.deleteMany({ where: { personnePhysiqueId: ppId } });
  } else if (input.action === "addKeepSome") {
    await prisma.rattachementPpPm.deleteMany({
      where: { personnePhysiqueId: ppId, id: { notIn: input.keepIds } },
    });
  }

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

  return { pmCreee: created };
}
