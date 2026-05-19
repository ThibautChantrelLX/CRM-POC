import { NextResponse } from "next/server";
import {
  getPersonneMorale,
  updatePersonneMorale,
  deletePersonneMorale,
} from "@/lib/server/modules/personnes-morales/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const pm = await getPersonneMorale(Number(id));
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
    const body = await request.json();
    return NextResponse.json(await updatePersonneMorale(Number(id), body));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await deletePersonneMorale(Number(id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
