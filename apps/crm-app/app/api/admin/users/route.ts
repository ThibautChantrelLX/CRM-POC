import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { createUser } from "@/lib/server/modules/users/service";
import type { Role } from "@/app/generated/prisma/client";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ADMIN_ROLES.includes(role)) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, email, password, role, entiteId } = body;
    if (!name || !email || !password || !role || !entiteId)
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    const user = await createUser({ name, email, password, role, entiteId });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
