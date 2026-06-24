import { NextResponse } from "next/server";
import {
  importPPs,
  type PPImportCreateInput,
} from "@/lib/server/modules/personnes-physiques/import-service";

export async function POST(req: Request) {
  try {
    const rows = (await req.json()) as PPImportCreateInput[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
    }
    const result = await importPPs(rows);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
