import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createPersonnePhysique } from "@/lib/server/modules/personnes-physiques/service";
import type { TypeRelationPp, ProfilType } from "@/lib/server/modules/personnes-physiques/dto";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const nom = typeof body.nom === "string" ? body.nom.trim() : "";
    if (!nom) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }

    const str = (k: string): string | undefined => {
      const v = body[k];
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const bool = (k: string, def: boolean): boolean =>
      typeof body[k] === "boolean" ? (body[k] as boolean) : def;

    const profilType: ProfilType =
      body.profilType === "AVOCAT" ? "AVOCAT" :
      body.profilType === "PRO" ? "PRO" : "PARTICULIER";

    const typeRelation: TypeRelationPp =
      body.typeRelation === "CONTACT" ? "CONTACT" :
      body.typeRelation === "CLIENT" ? "CLIENT" :
      body.typeRelation === "HYBRIDE" ? "HYBRIDE" : "PROSPECT";

    const pp = await createPersonnePhysique({
      nom,
      prenom: str("prenom"),
      email: str("email"),
      telephone: str("telephone"),
      portable: str("portable"),
      typeRelation,
      profilType,
      statutRgpd: str("statutRgpd") as "OPT_IN" | "OPT_OUT" | "NON_RENSEIGNE" | undefined,
      actif: bool("actif", true),
      optInEmail: bool("optInEmail", false),
      optInSms: bool("optInSms", false),
      optOutGlobal: bool("optOutGlobal", false),
      ...(profilType === "AVOCAT" && {
        barreau: str("barreau"),
        dateSerment: str("dateSerment"),
        specialite: str("specialite"),
        profession: str("profession"),
        activiteDominante: str("activiteDominante"),
      }),
      ...(profilType === "PRO" && {
        profession: str("professionPro"),
        specialite: str("specialitePro"),
      }),
      ...(profilType === "PARTICULIER" && {
        civilite: str("civilite"),
        dateNaissance: str("dateNaissance"),
        situationFamiliale: str("situationFamiliale"),
      }),
    });

    // Optionally link to an existing PM
    const pmId = typeof body.pmId === "string" ? body.pmId : null;
    if (pmId) {
      await prisma.rattachementPpPm.create({
        data: {
          personnePhysiqueId: pp.id,
          personneMoraleId: pmId,
          dateDebut: new Date(),
          titreFonction: str("titreFonction") ?? null,
        },
      });
    }

    return NextResponse.json({ id: pp.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}
