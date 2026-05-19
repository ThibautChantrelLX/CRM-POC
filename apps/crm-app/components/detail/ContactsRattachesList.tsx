import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ContactRattacheDetail } from "@/lib/server/modules/personnes-morales/dto";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR");
}

type Props = {
  contacts: ContactRattacheDetail[];
};

export function ContactsRattachesList({ contacts }: Props) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-6">
        Aucun contact rattaché
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            {(["Contact", "Titre / Fonction", "Début", "Fin", "Statut"] as const).map((h) => (
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
          {contacts.map((c) => {
            const isActuel = c.dateFin === null;
            const pp = c.personnePhysique;
            return (
              <tr key={c.id} className="hover:bg-zinc-50/60">
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/personnes-physiques/${pp.id}`}
                    className="font-medium text-secondary-600 hover:underline block"
                  >
                    {pp.prenom} {pp.nom.toUpperCase()}
                  </Link>
                  {pp.profession && (
                    <span className="text-[11px] text-zinc-400">{pp.profession}</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-zinc-600">{c.titreFonction ?? "—"}</td>
                <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{fmtDate(c.dateDebut)}</td>
                <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{fmtDate(c.dateFin)}</td>
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
