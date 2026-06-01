import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { fetchUsers } from "@/lib/server/modules/users/service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { UsersTable } from "@/components/admin/UsersTable";
import type { Role } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"];

export default async function AdminUsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/personnes-physiques");

  const users = await fetchUsers();
  const canEdit = (["SUPER_ADMIN", "ADMIN"] as Role[]).includes(userRole);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <AdminPageHeader
        title="Utilisateurs"
        description={`${users.length} compte${users.length > 1 ? "s" : ""} enregistré${users.length > 1 ? "s" : ""}`}
        actions={
          canEdit ? (
            <Link
              href="/admin/users/nouveau"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              + Nouvel utilisateur
            </Link>
          ) : undefined
        }
      />
      <UsersTable users={users} canEdit={canEdit} currentUserId={session.user.id} />
    </div>
  );
}
