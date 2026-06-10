import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();
  if (!email) return NextResponse.json(null);

  // excludeId permet d'ignorer la fiche en cours lors d'une édition
  const excludeId = searchParams.get("excludeId") || undefined;

  // Les emails sont stockés seuls ou en multi-valeur séparés par "|".
  // On détecte les quatre positions possibles : seul, premier, dernier, milieu.
  const pp = await prisma.personnePhysique.findFirst({
    where: {
      AND: [
        excludeId ? { id: { not: excludeId } } : {},
        {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            { email: { startsWith: `${email}|`, mode: "insensitive" } },
            { email: { endsWith: `|${email}`, mode: "insensitive" } },
            { email: { contains: `|${email}|`, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, nom: true, prenom: true },
  });

  return NextResponse.json(pp);
}
