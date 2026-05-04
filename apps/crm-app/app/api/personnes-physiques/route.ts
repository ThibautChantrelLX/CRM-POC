import { NextResponse } from "next/server";
import {
  fetchPersonnesPhysiques,
  createPersonnePhysique,
} from "@/lib/server/modules/personnes-physiques/service";
import type {
  PersonnePhysiqueListQuery,
  TypeRelationPp,
  StatutRgpd,
} from "@/lib/server/modules/personnes-physiques/dto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const g = (k: string) => searchParams.get(k) || undefined;

  const query: PersonnePhysiqueListQuery = {
    page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
    limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    sortBy: g("sortBy"),
    sortOrder: (g("sortOrder") as "asc" | "desc") || undefined,
    search: g("search"),
    nom: g("nom"),
    prenom: g("prenom"),
    email: g("email"),
    profession: g("profession"),
    specialite: g("specialite"),
    typeRelation: searchParams.getAll("typeRelation") as TypeRelationPp[],
    statutRgpd: searchParams.getAll("statutRgpd") as StatutRgpd[],
    actif: searchParams.has("actif") ? searchParams.get("actif") === "true" : undefined,
    creerLeApres: g("creerLeApres"),
    creerLeAvant: g("creerLeAvant"),
    dernierEmailApres: g("dernierEmailApres"),
    dernierEmailAvant: g("dernierEmailAvant"),
    dateSermentApres: g("dateSermentApres"),
    dateSermentAvant: g("dateSermentAvant"),
  };

  try {
    return NextResponse.json(await fetchPersonnesPhysiques(query));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createPersonnePhysique(body), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
