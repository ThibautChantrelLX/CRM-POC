import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const entites = await prisma.entite.findMany({
    select: { id: true, raisonSociale: true, typeEntite: true },
    orderBy: [{ typeEntite: "asc" }, { raisonSociale: "asc" }],
  });
  return NextResponse.json(entites);
}
