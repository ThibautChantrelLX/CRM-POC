import { NextResponse } from "next/server";
import {
  importParticipants,
  type ParticipantCreateInput,
} from "@/lib/server/modules/formations/participants-service";
import { getActorName } from "@/lib/server/get-actor";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [data] = await Promise.all([
      req.json() as Promise<ParticipantCreateInput[]>,
      getActorName(),
    ]);
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "data must be a non-empty array" }, { status: 400 });
    }
    const result = await importParticipants(id, data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
