import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/server/auth";
import { UserForm } from "@/components/admin/UserForm";
import type { Role } from "@/app/generated/prisma/client";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

export default async function NewUserPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/admin/users");

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-400 mb-6">
        <Link href="/admin/users" className="hover:text-zinc-700 transition-colors">Utilisateurs</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-700">Nouvel utilisateur</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Nouvel utilisateur</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Créer un compte d'accès à LexCRM</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
