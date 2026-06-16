import { NextResponse } from "next/server";
import {
  matchParticipants,
  type ParticipantMatchInput,
} from "@/lib/server/modules/formations/participants-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const inputs = (await req.json()) as ParticipantMatchInput[];
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: "inputs must be a non-empty array" }, { status: 400 });
    }
    const results = await matchParticipants(id, inputs);
    return NextResponse.json(results);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
