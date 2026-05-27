import { NextResponse } from "next/server";
import {
  getPersonnePhysique,
  updatePersonnePhysique,
  deletePersonnePhysique,
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
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
