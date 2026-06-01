import { NextResponse } from "next/server";
import {
  getPersonneMorale,
  updatePersonneMorale,
  deletePersonneMorale,
} from "@/lib/server/modules/personnes-morales/service";
import { getActorName } from "@/lib/server/get-actor";
import {
  UpdatePersonneMoraleSchema,
  formatZodError,
} from "@/lib/server/modules/personnes-morales/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const pm = await getPersonneMorale(id);
    if (!pm) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(pm);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const [body, actorName] = await Promise.all([request.json(), getActorName()]);
    const parsed = UpdatePersonneMoraleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }
    return NextResponse.json(await updatePersonneMorale(id, parsed.data, actorName));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await deletePersonneMorale(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
