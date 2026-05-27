import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { fetchUsers } from "@/lib/server/modules/users/service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminBadge } from "@/components/admin/AdminBadge";
import type { UserListItem } from "@/lib/server/modules/users/service";
import type { Role } from "@/app/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  ASSOCIE: "Associé",
  ACADEMIE: "Académie",
  USER: "Utilisateur",
};

const ROLE_VARIANTS: Record<Role, "default" | "success" | "warning" | "danger" | "info"> = {
  SUPER_ADMIN: "danger",
  ADMIN: "warning",
  ASSOCIE: "info",
  ACADEMIE: "success",
  USER: "default",
};

const COLUMNS = [
  { key: "name", label: "Nom" },
  { key: "email", label: "Email" },
  {
    key: "role",
    label: "Rôle",
    render: (u: UserListItem) => (
      <AdminBadge label={ROLE_LABELS[u.role]} variant={ROLE_VARIANTS[u.role]} />
    ),
  },
  { key: "entiteRaisonSociale", label: "Entité" },
  {
    key: "emailVerified",
    label: "Vérifié",
    render: (u: UserListItem) => (
      <AdminBadge label={u.emailVerified ? "Oui" : "Non"} variant={u.emailVerified ? "success" : "default"} />
    ),
  },
  {
    key: "createdAt",
    label: "Créé le",
    render: (u: UserListItem) =>
      new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  },
];

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"];

export default async function AdminUsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/personnes-physiques");

  const users = await fetchUsers();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AdminPageHeader
        title="Gestion des utilisateurs"
        description={`${users.length} utilisateur${users.length > 1 ? "s" : ""}`}
      />
      <AdminTable
        columns={COLUMNS}
        rows={users}
        getKey={(u) => u.id}
        emptyMessage="Aucun utilisateur."
      />
    </div>
  );
}
