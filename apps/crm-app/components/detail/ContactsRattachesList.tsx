"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RattachementsModal } from "@/components/pm/RattachementsModal";
import type { ContactRattacheDetail } from "@/lib/server/modules/personnes-morales/dto";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR");
}

type Props = {
  contacts: ContactRattacheDetail[];
  pmId: number;
  pmNom: string;
  pmNomDomaine: string | null;
};

export function ContactsRattachesList({ contacts, pmId, pmNom, pmNomDomaine }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showRattach, setShowRattach] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const pp = c.personnePhysique;
      return (
        pp.nom.toLowerCase().includes(q) ||
        (pp.prenom?.toLowerCase().includes(q) ?? false) ||
        (pp.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [contacts, search]);

  const handleRattachDone = () => {
    setShowRattach(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom, email…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-primary-400 focus:bg-white transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowRattach(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition cursor-pointer shrink-0"
        >
          <UserPlus size={13} />
          Rattacher
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">
          {contacts.length === 0 ? "Aucun contact rattaché" : "Aucun résultat"}
        </p>
      ) : (
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
              {filtered.map((c) => {
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
                          isActuel ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500",
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
      )}

      <RattachementsModal
        open={showRattach}
        onClose={handleRattachDone}
        pmId={pmId}
        pmNom={pmNom}
        pmNomDomaine={pmNomDomaine}
      />
    </div>
  );
}
