import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { isProfilPro } from "@/lib/server/modules/personnes-physiques/dto";

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

    // Vérifier que la PP a un profil pro
    const pp = await prisma.personnePhysique.findUnique({
      where: { id: String(personnePhysiqueId) },
      select: { typeProfilPrincipal: true },
    });

    if (!pp) {
      return NextResponse.json({ error: "Personne physique introuvable" }, { status: 404 });
    }

    if (!isProfilPro(pp.typeProfilPrincipal as Parameters<typeof isProfilPro>[0])) {
      return NextResponse.json(
        {
          error:
            "Cette personne n'a pas de profil professionnel et ne peut pas être rattachée à une organisation.",
        },
        { status: 422 },
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
