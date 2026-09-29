import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  fetchPersonnesPhysiques,
  createPersonnePhysique,
} from "@/lib/server/modules/personnes-physiques/service";
import { parsePersonnePhysiqueListQuery } from "@/lib/server/modules/personnes-physiques/query-params";
import { getActorName } from "@/lib/server/get-actor";

export async function GET(request: Request) {
  const query = parsePersonnePhysiqueListQuery(new URL(request.url).searchParams);

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
