import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const [avocat, pro] = await Promise.all([
    prisma.profilAvocat.findMany({
      where: { profession: { not: null } },
      select: { profession: true },
      distinct: ["profession"],
    }),
    prisma.profilPro.findMany({
      where: { profession: { not: null } },
      select: { profession: true },
      distinct: ["profession"],
    }),
  ]);

  const values = Array.from(
    new Set([...avocat, ...pro].map((r) => r.profession).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return NextResponse.json(values);
}
