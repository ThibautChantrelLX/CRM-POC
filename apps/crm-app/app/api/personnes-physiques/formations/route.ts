import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const rows = await prisma.formation.findMany({
    where: { participations: { some: { personnePhysiqueId: { not: null } } } },
    select: { id: true, intitule: true, intituleCourt: true, numero: true, dateDebut: true },
    orderBy: { dateDebut: "desc" },
  });
  return NextResponse.json(
    rows.map((f) => ({
      value: f.id,
      label: f.intituleCourt ?? f.intitule,
      sub: f.numero,
    })),
  );
}
