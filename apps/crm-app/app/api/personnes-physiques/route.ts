import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  fetchPersonnesPhysiques,
  createPersonnePhysique,
} from "@/lib/server/modules/personnes-physiques/service";
import type {
  PersonnePhysiqueGroupFilter,
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
    minFormations: searchParams.has("minFormations")
      ? Number(searchParams.get("minFormations"))
      : undefined,
    formationIds: searchParams.getAll("formationIds"),
    creerLeApres: g("creerLeApres"),
    creerLeAvant: g("creerLeAvant"),
    dernierEmailApres: g("dernierEmailApres"),
    dernierEmailAvant: g("dernierEmailAvant"),
    dateSermentApres: g("dateSermentApres"),
    dateSermentAvant: g("dateSermentAvant"),
  };

  const groupsRaw = searchParams.get("groups");
  if (groupsRaw) {
    try {
      const parsed = JSON.parse(groupsRaw) as Array<Record<string, unknown>>;
      query.groups = parsed.map((obj): PersonnePhysiqueGroupFilter => ({
        nom: typeof obj.nom === "string" ? obj.nom : undefined,
        prenom: typeof obj.prenom === "string" ? obj.prenom : undefined,
        email: typeof obj.email === "string" ? obj.email : undefined,
        profession: Array.isArray(obj.profession) ? (obj.profession as string[]) : undefined,
        specialite: Array.isArray(obj.specialite) ? (obj.specialite as string[]) : undefined,
        activiteDominante: Array.isArray(obj.activiteDominante)
          ? (obj.activiteDominante as string[])
          : undefined,
        typeRelation: Array.isArray(obj.typeRelation)
          ? (obj.typeRelation as TypeRelationPp[])
          : undefined,
        barreau: Array.isArray(obj.barreau) ? (obj.barreau as string[]) : undefined,
        creerLeApres: typeof obj.creerLeApres === "string" ? obj.creerLeApres : undefined,
        creerLeAvant: typeof obj.creerLeAvant === "string" ? obj.creerLeAvant : undefined,
        dernierEmailApres:
          typeof obj.dernierEmailApres === "string" ? obj.dernierEmailApres : undefined,
        dernierEmailAvant:
          typeof obj.dernierEmailAvant === "string" ? obj.dernierEmailAvant : undefined,
        dateSermentApres:
          typeof obj.dateSermentApres === "string" ? obj.dateSermentApres : undefined,
        dateSermentAvant:
          typeof obj.dateSermentAvant === "string" ? obj.dateSermentAvant : undefined,
      }));
    } catch {
      // invalid JSON, ignore
    }
  }

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
    const existing = await prisma.personnePhysique.findFirst({
      where: { email: { equals: body.email.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Une personne physique existe déjà avec cet email" }, { status: 409 });
    }
    return NextResponse.json(await createPersonnePhysique(body, actorName), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
