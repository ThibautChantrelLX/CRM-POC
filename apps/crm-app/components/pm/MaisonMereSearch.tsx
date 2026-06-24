"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Building2, X } from "lucide-react";

export type MaisonMereValue = {
  id: string;
  raisonSociale: string;
  siretSiren: string | null;
};

type Props = {
  value: MaisonMereValue | null;
  onChange: (v: MaisonMereValue | null) => void;
  excludeId?: string;
};

export function MaisonMereSearch({ value, onChange, excludeId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaisonMereValue[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const delay = query.trim() ? 300 : 0;
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/personnes-morales?search=${encodeURIComponent(query)}&limit=10`,
        );
        const data = (await res.json()) as { data: MaisonMereValue[] };
        const filtered = (data.data ?? []).filter((pm) => pm.id !== excludeId);
        setResults(filtered);
        setIsOpen(filtered.length > 0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [query, excludeId]);

  const select = (pm: MaisonMereValue) => {
    onChange(pm);
    setQuery("");
    setIsOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50">
        <Building2 size={14} className="text-zinc-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-zinc-800 truncate block">
            {value.raisonSociale}
          </span>
          {value.siretSiren && (
            <span className="text-xs text-zinc-400">{value.siretSiren}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-white focus-within:border-primary-400 transition-colors">
        <Search size={13} className="text-zinc-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Rechercher par raison sociale, SIRET, SIREN…"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-zinc-300"
        />
        {isLoading && (
          <span className="text-[10px] text-zinc-400 shrink-0">Recherche…</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(pm); }}
              className="w-full text-left px-3 py-2.5 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-zinc-50 last:border-0"
            >
              <div className="text-sm font-medium leading-tight">{pm.raisonSociale}</div>
              {pm.siretSiren && (
                <div className="text-xs text-zinc-400 mt-0.5">{pm.siretSiren}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
