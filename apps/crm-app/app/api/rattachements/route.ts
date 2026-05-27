import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: Request) {
  try {
    const { personnePhysiqueId, personneMoraleId, titreFonction, dateDebut } =
      await request.json();

    if (!personnePhysiqueId || !personneMoraleId) {
      return NextResponse.json(
        { error: "personnePhysiqueId et personneMoraleId sont requis" },
        { status: 400 },
      );
    }

    const rattachement = await prisma.rattachementPpPm.create({
      data: {
        personnePhysiqueId: String(personnePhysiqueId),
        personneMoraleId: String(personneMoraleId),
        titreFonction: titreFonction || null,
        dateDebut: dateDebut ? new Date(dateDebut) : new Date(),
      },
    });

    return NextResponse.json(rattachement, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
