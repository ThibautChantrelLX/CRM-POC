import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { getPersonneMoraleDetail } from "@/lib/server/modules/personnes-morales/service";
import { PmEditForm } from "@/components/pm/PmEditForm";

export default async function PersonneMoraleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pm = await getPersonneMoraleDetail(Number(id));
  if (!pm) notFound();

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/personnes-morales/${pm.id}`}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-zinc-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">
              Modifier {pm.raisonSociale}
            </h1>
            <p className="text-sm text-zinc-400 leading-tight">Personne morale · #{pm.id}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PmEditForm pm={pm} />
      </div>
    </div>
  );
}
