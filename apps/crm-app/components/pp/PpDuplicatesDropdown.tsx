"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { listPersonnesPhysiques } from "@/lib/client/personnes-physiques";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

const MIN_NOM_LENGTH = 2;
const DEBOUNCE_MS = 400;

type Props = {
  nom: string;
  prenom: string;
  onSelect: () => void;
};

export function PpDuplicatesDropdown({ nom, prenom, onSelect }: Props) {
  const debouncedNom = useDebouncedValue(nom.trim(), DEBOUNCE_MS);
  const debouncedPrenom = useDebouncedValue(prenom.trim(), DEBOUNCE_MS);
  const enabled = debouncedNom.length >= MIN_NOM_LENGTH;

  const params = new URLSearchParams();
  params.set("nom", debouncedNom);
  if (debouncedPrenom) params.set("prenom", debouncedPrenom);
  params.set("limit", "6");
  params.set("sortBy", "nom");
  params.set("sortOrder", "asc");
  const key = params.toString();

  const { data } = useQuery({
    queryKey: ["pp-duplicates", key],
    queryFn: () => listPersonnesPhysiques(params),
    enabled,
    placeholderData: (prev) => prev,
  });

  const results = enabled ? (data?.data ?? []) : [];
  if (results.length === 0) return null;

  return (
    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
      <p className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-100">
        {results.length} personne{results.length > 1 ? "s" : ""} existante{results.length > 1 ? "s" : ""} avec ce nom — cliquez pour voir sa fiche
      </p>
      <div className="max-h-64 overflow-y-auto">
        {results.map((pp) => (
          <Link
            key={pp.id}
            href={`/personnes-physiques/${pp.id}`}
            onClick={onSelect}
            className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 transition-colors"
          >
            <Avatar nom={pp.nom} prenom={pp.prenom} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">
                {[pp.prenom, pp.nom].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-zinc-400 truncate">
                {[pp.email, pp.profession].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
