import { NextResponse } from "next/server";
import { getFormationParticipants } from "@/lib/server/modules/formations/participants-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getFormationParticipants(id));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
