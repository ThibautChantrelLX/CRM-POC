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
import { getActorName } from "@/lib/server/get-actor";

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
    profession: searchParams.getAll("profession"),
    specialite: searchParams.getAll("specialite"),
    activiteDominante: searchParams.getAll("activiteDominante"),
    typeRelation: searchParams.getAll("typeRelation") as TypeRelationPp[],
    statutRgpd: searchParams.getAll("statutRgpd") as StatutRgpd[],
    barreau: searchParams.getAll("barreau"),
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
    const [body, actorName] = await Promise.all([request.json(), getActorName()]);
    if (typeof body?.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "L'email est requis" }, { status: 400 });
    }
    return NextResponse.json(await createPersonnePhysique(body, actorName), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
