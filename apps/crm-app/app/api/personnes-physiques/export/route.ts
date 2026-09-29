import { NextResponse } from "next/server";
import { exportPersonnesPhysiques } from "@/lib/server/modules/personnes-physiques/service";
import { buildPersonnesPhysiquesXlsx } from "@/lib/server/modules/personnes-physiques/export-xlsx";
import { parsePersonnePhysiqueListQuery } from "@/lib/server/modules/personnes-physiques/query-params";
import type { PersonnePhysiqueExportOptions } from "@/lib/server/modules/personnes-physiques/dto";

// Filtres dans la query string (mêmes params que la liste), options d'export dans le body.
export async function POST(request: Request) {
  const query = parsePersonnePhysiqueListQuery(new URL(request.url).searchParams);

  let options: PersonnePhysiqueExportOptions;
  try {
    options = await request.json();
    if (!options?.fields || !options?.ratt) throw new Error();
  } catch {
    return NextResponse.json({ error: "Options d'export invalides" }, { status: 400 });
  }

  try {
    const data = await exportPersonnesPhysiques(query);
    const file = buildPersonnesPhysiquesXlsx(data, options.fields, options.ratt);
    const date = new Date().toISOString().split("T")[0];
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export-pp-${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
