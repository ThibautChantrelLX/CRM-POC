import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { updateUser, deleteUser } from "@/lib/server/modules/users/service";
import type { Role } from "@/app/generated/prisma/client";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ADMIN_ROLES.includes(role)) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await updateUser(id, body);
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  try {
    const { id } = await params;
    if (id === session.user.id) return NextResponse.json({ error: "Impossible de supprimer son propre compte." }, { status: 400 });
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
