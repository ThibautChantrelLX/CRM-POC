import { NextResponse } from "next/server";
import { bulkCreateFormations } from "@/lib/server/modules/formations/service";
import { getActorName } from "@/lib/server/get-actor";
import type { CreateFormationInput } from "@/lib/server/modules/formations/dto";

export async function POST(req: Request) {
  try {
    const [formations, actorName] = await Promise.all([
      req.json() as Promise<CreateFormationInput[]>,
      getActorName(),
    ]);
    if (!Array.isArray(formations) || formations.length === 0) {
      return NextResponse.json({ error: "formations must be a non-empty array" }, { status: 400 });
    }
    const result = await bulkCreateFormations(formations, actorName);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
