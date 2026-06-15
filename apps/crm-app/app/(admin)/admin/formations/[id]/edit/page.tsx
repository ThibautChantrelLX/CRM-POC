import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { getFormationDetail } from "@/lib/server/modules/formations/service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FormationEditForm } from "@/components/formations/FormationEditForm";
import type { Role } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"];

export default async function FormationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/personnes-physiques");

  const { id } = await params;
  const formation = await getFormationDetail(id);
  if (!formation) notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <AdminPageHeader
        title="Modifier la formation"
        description={formation.numero}
      />
      <FormationEditForm formation={formation} />
    </div>
  );
}
