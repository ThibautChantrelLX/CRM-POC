import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { fetchFormations } from "@/lib/server/modules/formations/service";
import { FormationsClient } from "@/components/formations/FormationsClient";
import type { Role } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"];

export default async function AdminFormationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/personnes-physiques");

  const formations = await fetchFormations();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <FormationsClient initialFormations={formations} />
    </div>
  );
}
