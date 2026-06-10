import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/server/auth";
import { fetchUserById } from "@/lib/server/modules/users/service";
import { UserForm } from "@/components/admin/UserForm";
import type { Role } from "@/app/generated/prisma/client";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/admin/users");

  const { id } = await params;
  const user = await fetchUserById(id);
  if (!user) notFound();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-400 mb-6">
        <Link href="/admin/users" className="hover:text-zinc-700 transition-colors">Utilisateurs</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-700">{user.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Modifier l&apos;utilisateur</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{user.email}</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <UserForm
          mode="edit"
          userId={id}
          defaultValues={{
            name: user.name,
            email: user.email,
            role: user.role,
            entiteId: user.entiteId,
          }}
        />
      </div>
    </div>
  );
}
