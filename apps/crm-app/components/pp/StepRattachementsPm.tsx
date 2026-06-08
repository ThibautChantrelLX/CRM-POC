"use client";

import { useState, useEffect } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls } from "@/components/ui/form-field";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 400;

type PmResult = {
  id: string;
  raisonSociale: string;
  siretSiren: string | null;
  typeStructure: string | null;
};

type Props = {
  ppId: string;
  ppNom: string;
  onDone: () => void;
};

export function StepRattachementsPm({ ppId, ppNom, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PmResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<PmResult | null>(null);

  const [titreFonction, setTitreFonction] = useState("");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split("T")[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setHasSearched(true);
    const params = new URLSearchParams({ search: trimmed, limit: "20" });
    fetch(`/api/personnes-morales?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setResults(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleSubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/rattachements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnePhysiqueId: ppId,
          personneMoraleId: selected.id,
          titreFonction: titreFonction || null,
          dateDebut,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="px-6 py-8 space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <UserCheck size={22} className="text-green-600" />
          </div>
          <p className="font-semibold text-zinc-800">Rattachement créé avec succès</p>
          <p className="text-sm text-zinc-400">{selected?.raisonSociale}</p>
        </div>
        <div className="flex justify-end pb-2">
          <SubmitButton onClick={onDone}>Terminer →</SubmitButton>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 space-y-4">
      {/* Recherche PM */}
      <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-zinc-500">Rechercher une organisation</p>
          {isSearching && <Loader2 size={12} className="animate-spin text-zinc-400" />}
        </div>
        <input
          className={inputCls + " w-full"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Nom, SIRET…"
        />
      </div>

      {hasSearched && results.length === 0 && !isSearching && (
        <p className="text-xs text-zinc-400 text-center py-2">Aucun résultat.</p>
      )}

      {results.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white divide-y divide-zinc-50 max-h-48 overflow-y-auto">
          {results.map((pm) => {
            const isSel = selected?.id === pm.id;
            return (
              <button
                key={pm.id}
                type="button"
                onClick={() => setSelected(isSel ? null : pm)}
                className={`w-full text-left px-3 py-2.5 transition flex items-start gap-3 cursor-pointer ${isSel ? "bg-secondary-50 hover:bg-secondary-100" : "hover:bg-zinc-50"}`}
              >
                <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition ${isSel ? "bg-secondary-600 border-secondary-600" : "border-zinc-300"}`}>
                  {isSel && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-800 truncate">{pm.raisonSociale}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {pm.siretSiren && <span className="text-xs text-zinc-400 font-mono">{pm.siretSiren}</span>}
                    {pm.typeStructure && <span className="text-xs text-zinc-400">· {pm.typeStructure}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Informations du rattachement
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Titre / Poste" className="col-span-2">
              <input
                className={inputCls}
                value={titreFonction}
                onChange={(e) => setTitreFonction(e.target.value)}
                placeholder="Collaborateur, Associé…"
              />
            </FormField>
            <FormField label="Date de début">
              <input
                type="date"
                className={inputCls}
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </FormField>
          </div>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
      )}

      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
        >
          Annuler
        </button>
        <SubmitButton isLoading={isSubmitting} onClick={handleSubmit} disabled={!selected}>
          Confirmer le rattachement →
        </SubmitButton>
      </div>
    </div>
  );
}
