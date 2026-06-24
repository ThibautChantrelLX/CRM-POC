import { NextResponse } from "next/server";
import { fetchFormations } from "@/lib/server/modules/formations/service";

export async function GET() {
  try {
    return NextResponse.json(await fetchFormations());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
