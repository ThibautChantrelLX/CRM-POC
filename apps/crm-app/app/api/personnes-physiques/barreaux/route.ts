import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const rows = await prisma.profilAvocat.findMany({
    where: { barreau: { not: null } },
    select: { barreau: true },
    distinct: ["barreau"],
    orderBy: { barreau: "asc" },
  });
  return NextResponse.json(rows.map(({ barreau }) => barreau).filter(Boolean));
}
