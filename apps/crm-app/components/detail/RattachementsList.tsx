import Link from "next/link";
import { cn } from "@/lib/utils";

export type RattachementRow = {
  id: number;
  titreFonction: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  personneMorale: {
    id: number;
    raisonSociale: string;
    siretSiren: string | null;
    email: string | null;
    telephone: string | null;
  };
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR");
}

type Props = {
  rattachements: RattachementRow[];
};

export function RattachementsList({ rattachements }: Props) {
  if (rattachements.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-6">
        Aucun rattachement enregistré
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            {(["Organisation", "Titre / Fonction", "Début", "Fin", "Statut"] as const).map((h) => (
              <th
                key={h}
                className="text-left pb-2 pr-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {rattachements.map((r) => {
            const isActuel = r.dateFin === null;
            return (
              <tr key={r.id} className="hover:bg-zinc-50/60">
                <td className="py-2.5 pr-4 font-medium">
                  <Link
                    href={`/personnes-morales/${r.personneMorale.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.personneMorale.raisonSociale}
                  </Link>
                  {r.personneMorale.siretSiren && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {r.personneMorale.siretSiren}
                    </div>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-zinc-600">
                  {r.titreFonction ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">
                  {fmtDate(r.dateDebut)}
                </td>
                <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">
                  {fmtDate(r.dateFin)}
                </td>
                <td className="py-2.5">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold",
                      isActuel
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-100 text-zinc-500",
                    )}
                  >
                    {isActuel ? "Actuel" : "Terminé"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
