import { NextResponse } from "next/server";
import {
  getPersonnePhysique,
  updatePersonnePhysique,
  deletePersonnePhysique,
  DuplicateActifError,
  PpLieeADossierError,
} from "@/lib/server/modules/personnes-physiques/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const pp = await getPersonnePhysique(id);
    if (!pp) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(pp);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const pp = await updatePersonnePhysique(id, body);
    return NextResponse.json(pp);
  } catch (err) {
    if (err instanceof DuplicateActifError) {
      return NextResponse.json(
        { error: "Une autre personne active possède déjà cet email ou ce portable.", conflicts: err.conflicts },
        { status: 409 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await deletePersonnePhysique(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof PpLieeADossierError) {
      return NextResponse.json(
        {
          error: `Cette personne est intervenant dans ${err.count} dossier${err.count > 1 ? "s" : ""} et ne peut pas être supprimée. Retirez-la d'abord des dossiers concernés.`,
        },
        { status: 409 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
