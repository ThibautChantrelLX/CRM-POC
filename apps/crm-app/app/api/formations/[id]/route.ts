import { NextResponse } from "next/server";
import {
  getFormationDetail,
  updateFormation,
  deleteFormation,
} from "@/lib/server/modules/formations/service";
import { getActorName } from "@/lib/server/get-actor";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formation = await getFormationDetail(id);
    if (!formation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(formation);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [body, actorName] = await Promise.all([req.json(), getActorName()]);
    const updated = await updateFormation(id, body, actorName);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteFormation(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
