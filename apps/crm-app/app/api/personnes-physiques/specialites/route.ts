import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const [avocat, pro] = await Promise.all([
    prisma.profilAvocat.findMany({
      where: { specialite: { not: null } },
      select: { specialite: true },
      distinct: ["specialite"],
    }),
    prisma.profilPro.findMany({
      where: { specialite: { not: null } },
      select: { specialite: true },
      distinct: ["specialite"],
    }),
  ]);

  const values = Array.from(
    new Set([...avocat, ...pro].map((r) => r.specialite).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return NextResponse.json(values);
}
