import { NextResponse } from "next/server";
import { checkExistingNumeros } from "@/lib/server/modules/formations/service";

export async function POST(req: Request) {
  try {
    const { numeros } = (await req.json()) as { numeros: string[] };
    if (!Array.isArray(numeros)) {
      return NextResponse.json({ error: "numeros must be an array" }, { status: 400 });
    }
    const existing = await checkExistingNumeros(numeros);
    return NextResponse.json({ existing });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
