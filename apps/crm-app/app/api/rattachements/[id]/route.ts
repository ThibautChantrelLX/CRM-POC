import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: { titreFonction?: string | null; dateFin?: Date | null } = {};
    if ("titreFonction" in body) data.titreFonction = body.titreFonction || null;
    if ("dateFin" in body) data.dateFin = body.dateFin ? new Date(body.dateFin) : null;

    const updated = await prisma.rattachementPpPm.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.rattachementPpPm.delete({ where: { id: Number(id) } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
