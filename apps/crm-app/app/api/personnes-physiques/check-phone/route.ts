import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get("field");
  const value = searchParams.get("value")?.trim();

  if ((field !== "telephone" && field !== "portable") || !value) {
    return NextResponse.json(null);
  }

  const pp = await prisma.personnePhysique.findFirst({
    where: field === "telephone" ? { telephone: value } : { portable: value },
    select: { id: true, nom: true, prenom: true },
  });

  return NextResponse.json(pp);
}
