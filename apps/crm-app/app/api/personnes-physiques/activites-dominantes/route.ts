import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const rows = await prisma.profilAvocat.findMany({
    where: { activiteDominante: { not: null } },
    select: { activiteDominante: true },
    distinct: ["activiteDominante"],
    orderBy: { activiteDominante: "asc" },
  });
  return NextResponse.json(rows.map(({ activiteDominante }) => activiteDominante).filter(Boolean));
}
