import { NextResponse } from "next/server";
import {
  fetchPersonnesMorales,
  createPersonneMorale,
} from "@/lib/server/modules/personnes-morales/service";
import { getActorName } from "@/lib/server/get-actor";
import {
  CreatePersonneMoraleSchema,
  formatZodError,
} from "@/lib/server/modules/personnes-morales/schema";
import type {
  PersonneMoraleListQuery,
  TypeRelationPm,
} from "@/lib/server/modules/personnes-morales/dto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const g = (k: string) => searchParams.get(k) || undefined;

  const query: PersonneMoraleListQuery = {
    page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
    limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    sortBy: g("sortBy"),
    sortOrder: (g("sortOrder") as "asc" | "desc") || undefined,
    search: g("search"),
    raisonSociale: g("raisonSociale"),
    email: g("email"),
    siretSiren: g("siretSiren"),
    typeStructure: g("typeStructure"),
    secteurActivite: g("secteurActivite"),
    typeRelation: searchParams.getAll("typeRelation") as TypeRelationPm[],
    actif: searchParams.has("actif") ? searchParams.get("actif") === "true" : undefined,
    creerLeApres: g("creerLeApres"),
    creerLeAvant: g("creerLeAvant"),
  };

  try {
    return NextResponse.json(await fetchPersonnesMorales(query));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const [body, actorName] = await Promise.all([request.json(), getActorName()]);
    const parsed = CreatePersonneMoraleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }
    return NextResponse.json(await createPersonneMorale(parsed.data, actorName), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
