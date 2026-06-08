import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();
  if (!email) return NextResponse.json(null);

  const pp = await prisma.personnePhysique.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, nom: true, prenom: true },
  });

  return NextResponse.json(pp);
}
