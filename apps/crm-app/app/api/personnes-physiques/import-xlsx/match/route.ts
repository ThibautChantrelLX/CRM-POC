import { NextResponse } from "next/server";
import {
  matchPPsForImport,
  type PPImportMatchInput,
} from "@/lib/server/modules/personnes-physiques/import-service";

export async function POST(req: Request) {
  try {
    const inputs = (await req.json()) as PPImportMatchInput[];
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: "inputs must be a non-empty array" }, { status: 400 });
    }
    const results = await matchPPsForImport(inputs);
    return NextResponse.json(results);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
