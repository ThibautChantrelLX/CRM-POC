import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { getPersonnePhysiqueDetail } from "@/lib/server/modules/personnes-physiques/service";
import { PpForm } from "@/components/pp/PpForm";

export default async function PersonnePhysiqueEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pp = await getPersonnePhysiqueDetail(id);
  if (!pp) notFound();

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <User size={18} className="text-zinc-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">
              Modifier {pp.prenom} {pp.nom.toUpperCase()}
            </h1>
            <p className="text-sm text-zinc-400 leading-tight">Personne physique · #{pp.id}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PpForm mode="edit" initialData={pp} ppId={pp.id} />
      </div>
    </div>
  );
}
