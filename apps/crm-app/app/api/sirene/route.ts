import { NextResponse } from "next/server";

const ANNUAIRE_BASE = "https://recherche-entreprises.api.gouv.fr/search";

export type SireneResult = {
  siret: string;
  siren: string;
  raisonSociale: string;
  adresse: {
    rue: string | null;
    codePostal: string | null;
    ville: string | null;
  };
  secteurActivite: string | null;
  categorieEntreprise: string | null;
};

import { nafLabel } from "@/lib/naf";

type AnnuaireEntreprise = {
  siren: string;
  nom_raison_sociale: string;
  categorie_entreprise: string | null;
  siege: {
    siret: string;
    activite_principale: string | null;
    libelle_activite_principale: string | null;
    numero_voie: string | null;
    type_voie: string | null;
    libelle_voie: string | null;
    code_postal: string | null;
    libelle_commune: string | null;
    libelle_commune_etranger: string | null;
  };
};

function mapEntreprise(e: AnnuaireEntreprise): SireneResult {
  const s = e.siege ?? {};
  const parts = [s.numero_voie, s.type_voie, s.libelle_voie].filter(Boolean);
  const code = s.activite_principale ?? null;
  const label = s.libelle_activite_principale ?? (code ? nafLabel(code) : null);
  return {
    siret: s.siret ?? "",
    siren: e.siren ?? "",
    raisonSociale: e.nom_raison_sociale ?? "",
    adresse: {
      rue: parts.join(" ") || null,
      codePostal: s.code_postal ?? null,
      ville: s.libelle_commune ?? s.libelle_commune_etranger ?? null,
    },
    secteurActivite: label ?? code,
    categorieEntreprise: e.categorie_entreprise ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siret = searchParams.get("siret")?.replace(/\s/g, "");
  const siren = searchParams.get("siren")?.replace(/\s/g, "");
  const q = searchParams.get("q")?.trim();

  try {
    if (siret || siren) {
      const identifier = siret ?? siren!;
      const params = new URLSearchParams({ q: identifier, type: "identifiant", limite: "10" });
      const res = await fetch(`${ANNUAIRE_BASE}?${params}`);
      if (!res.ok) return NextResponse.json({ error: "Erreur annuaire entreprises" }, { status: res.status });
      const data = await res.json();
      const results = ((data.results ?? []) as AnnuaireEntreprise[]).map(mapEntreprise);
      return NextResponse.json({ results });
    }

    if (q) {
      const params = new URLSearchParams({ q, limite: "10" });
      const res = await fetch(`${ANNUAIRE_BASE}?${params}`);
      if (!res.ok) return NextResponse.json({ error: "Erreur annuaire entreprises" }, { status: res.status });
      const data = await res.json();
      const results = ((data.results ?? []) as AnnuaireEntreprise[]).map(mapEntreprise);
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "Paramètre siret, siren ou q requis" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
