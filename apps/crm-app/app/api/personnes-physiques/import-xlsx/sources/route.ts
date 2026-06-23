import { NextResponse } from "next/server";
import { getDistinctSourceNoms } from "@/lib/server/modules/personnes-physiques/import-service";

export async function GET() {
  try {
    const sources = await getDistinctSourceNoms();
    return NextResponse.json(sources);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
