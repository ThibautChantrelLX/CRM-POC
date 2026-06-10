"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Plus, X } from "lucide-react";
import { inputCls } from "@/components/ui/form-field";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { PmAttachInfo } from "@/lib/client/personnes-morales";

const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  value: PmAttachInfo | null;
  onChange: (pm: PmAttachInfo | null) => void;
  onCreateNew: (query: string) => void;
};

export function PpAttachPmSection({ value, onChange, onCreateNew }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PmAttachInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed || value) return;
    let cancelled = false;
    const run = async () => {
      setIsSearching(true);
      setHasSearched(true);
      const params = new URLSearchParams({ search: trimmed, limit: "10" });
      try {
        const res = await fetch(`/api/personnes-morales?${params}`);
        const data = await res.json();
        if (!cancelled) setResults(data.data ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [debouncedQuery, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 bg-secondary-50 border border-secondary-100 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white border border-secondary-100 flex items-center justify-center shrink-0">
            <Building2 size={15} className="text-secondary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-800 truncate">{value.raisonSociale}</p>
            {value.siretSiren && <p className="text-xs text-zinc-400 font-mono">{value.siretSiren}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-zinc-400 hover:text-red-500 transition cursor-pointer p-1"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className={inputCls + " flex-1"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une organisation (raison sociale, SIRET…)"
        />
        {isSearching && <Loader2 size={14} className="animate-spin text-zinc-400 shrink-0" />}
      </div>

      {!!query.trim() && results.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white divide-y divide-zinc-50 max-h-48 overflow-y-auto">
          {results.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => onChange(pm)}
              className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 transition flex items-center gap-3 cursor-pointer"
            >
              <Building2 size={14} className="text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-800 truncate">{pm.raisonSociale}</div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {pm.siretSiren && <span className="text-xs text-zinc-400 font-mono">{pm.siretSiren}</span>}
                  {pm.typeStructure && <span className="text-xs text-zinc-400">· {pm.typeStructure}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!!query.trim() && hasSearched && !isSearching && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-zinc-400">
            {results.length === 0 ? "Aucune organisation trouvée." : "Vous ne trouvez pas l'organisation ?"}
          </p>
          <button
            type="button"
            onClick={() => onCreateNew(query.trim())}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition cursor-pointer shrink-0"
          >
            <Plus size={12} />
            Créer une nouvelle structure
          </button>
        </div>
      )}
    </div>
  );
}
