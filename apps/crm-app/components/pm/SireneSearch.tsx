"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputCls } from "@/components/ui/form-field";
import type { SireneResult } from "@/app/api/sirene/route";

type Props = {
  onSelect: (result: SireneResult) => void;
};

export function SireneSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SireneResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setIsLoading(true);
    setError(null);
    setResults([]);
    try {
      const digits = q.replace(/\s/g, "");
      const param =
        /^\d{14}$/.test(digits)
          ? `siret=${encodeURIComponent(digits)}`
          : /^\d{9}$/.test(digits)
            ? `siren=${encodeURIComponent(digits)}`
            : `q=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/sirene?${param}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur SIRENE");
      setResults(data.results ?? []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const handleSelect = (result: SireneResult) => {
    onSelect(result);
    setQuery(result.raisonSociale);
    setResults([]);
  };

  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-zinc-500">
        Pré-remplir depuis SIRENE (SIRET, SIREN ou nom)
      </p>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="732829320, 73282932000074 ou La Poste…"
        />
        <SubmitButton isLoading={isLoading} onClick={search} variant="secondary">
          <Search size={14} />
        </SubmitButton>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {searched && results.length === 0 && !isLoading && (
        <p className="text-xs text-zinc-400">Aucun résultat.</p>
      )}

      {results.length > 0 && (
        <div className="border border-zinc-100 rounded-lg shadow-sm overflow-hidden bg-white">
          {results.map((r) => (
            <button
              key={r.siret}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-secondary-50 transition border-b last:border-b-0 border-zinc-50 group"
              onClick={() => handleSelect(r)}
            >
              <div className="font-medium text-sm text-zinc-800 group-hover:text-secondary-700">
                {r.raisonSociale}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                {r.siret}
                {r.adresse.ville && ` · ${r.adresse.ville}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
