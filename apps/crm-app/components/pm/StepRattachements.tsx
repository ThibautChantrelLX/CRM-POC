"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle,
  ChevronLeft,
  Loader2,
  X,
  Zap,
  UserCheck,
} from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls } from "@/components/ui/form-field";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 400;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PpResult = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  profession: string | null;
  specialite: string | null;
  barreau: string | null;
};

function PpBadge({ pp, onRemove }: { pp: PpResult; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 bg-secondary-50 border border-secondary-100 text-secondary-700 rounded-full pl-3 pr-1.5 py-0.5 text-xs font-medium">
      <span>
        {pp.prenom} {pp.nom}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full hover:bg-secondary-200 transition p-0.5 cursor-pointer"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  pmId: string;
  pmNom: string;
  pmNomDomaine: string | null;
  /** Called when the user clicks "Terminer" or "Passer cette étape" */
  onDone: () => void;
  /** If false, hides the success banner (e.g. when used standalone on detail page) */
  showCreatedBanner?: boolean;
};

export function StepRattachements({
  pmId,
  pmNom,
  pmNomDomaine,
  onDone,
  showCreatedBanner = true,
}: Props) {
  const [subStep, setSubStep] = useState<"selection" | "validation">("selection");

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [barreau, setBarreau] = useState("");

  const [ppResults, setPpResults] = useState<PpResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDomain, setIsLoadingDomain] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selected, setSelected] = useState<Map<string, PpResult>>(new Map());

  const [titreFonction, setTitreFonction] = useState("");
  const [dateDebut, setDateDebut] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const debouncedNom = useDebouncedValue(nom, SEARCH_DEBOUNCE_MS);
  const debouncedPrenom = useDebouncedValue(prenom, SEARCH_DEBOUNCE_MS);
  const debouncedEmail = useDebouncedValue(email, SEARCH_DEBOUNCE_MS);
  const debouncedProfession = useDebouncedValue(profession, SEARCH_DEBOUNCE_MS);
  const debouncedSpecialite = useDebouncedValue(specialite, SEARCH_DEBOUNCE_MS);
  const debouncedBarreau = useDebouncedValue(barreau, SEARCH_DEBOUNCE_MS);

  const buildSearchUrl = useCallback(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (debouncedNom.trim()) params.set("nom", debouncedNom.trim());
    if (debouncedPrenom.trim()) params.set("prenom", debouncedPrenom.trim());
    if (debouncedEmail.trim()) params.set("email", debouncedEmail.trim());
    if (debouncedProfession.trim()) params.set("profession", debouncedProfession.trim());
    if (debouncedSpecialite.trim()) params.set("specialite", debouncedSpecialite.trim());
    if (debouncedBarreau.trim()) params.set("barreau", debouncedBarreau.trim());
    return `/api/personnes-physiques?${params}`;
  }, [debouncedNom, debouncedPrenom, debouncedEmail, debouncedProfession, debouncedSpecialite, debouncedBarreau]);

  const hasAnyQuery = !!(nom.trim() || prenom.trim() || email.trim() || profession.trim() || specialite.trim() || barreau.trim());

  useEffect(() => {
    const hasQuery =
      debouncedNom.trim() ||
      debouncedPrenom.trim() ||
      debouncedEmail.trim() ||
      debouncedProfession.trim() ||
      debouncedSpecialite.trim() ||
      debouncedBarreau.trim();
    if (!hasQuery) return;
    let cancelled = false;
    const run = async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const res = await fetch(buildSearchUrl());
        const data = await res.json();
        if (!cancelled) setPpResults(data.data ?? []);
      } catch {
        if (!cancelled) setPpResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [buildSearchUrl, debouncedNom, debouncedPrenom, debouncedEmail, debouncedProfession, debouncedSpecialite, debouncedBarreau]);

  const toggleSelected = (pp: PpResult) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(pp.id)) next.delete(pp.id);
      else next.set(pp.id, pp);
      return next;
    });
  };

  const handleQuickDomain = useCallback(async () => {
    if (!pmNomDomaine) return;
    setIsLoadingDomain(true);
    try {
      const params = new URLSearchParams({ email: pmNomDomaine, limit: "200" });
      const res = await fetch(`/api/personnes-physiques?${params}`);
      const data = await res.json();
      const pps: PpResult[] = data.data ?? [];
      setSelected((prev) => {
        const next = new Map(prev);
        pps.forEach((pp) => next.set(pp.id, pp));
        return next;
      });
    } catch {
      // silently ignore
    } finally {
      setIsLoadingDomain(false);
    }
  }, [pmNomDomaine]);

  const handleSubmitValidation = async () => {
    if (selected.size === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await Promise.all(
        Array.from(selected.values()).map((pp) =>
          fetch("/api/rattachements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personnePhysiqueId: pp.id,
              personneMoraleId: pmId,
              titreFonction: titreFonction || null,
              dateDebut,
            }),
          }),
        ),
      );
      setDone(true);
    } catch {
      setSubmitError("Erreur lors de la création des rattachements.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Done state
  if (done) {
    return (
      <div className="px-6 py-8 space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <UserCheck size={22} className="text-green-600" />
          </div>
          <p className="font-semibold text-zinc-800">
            {selected.size} rattachement{selected.size > 1 ? "s" : ""} créé
            {selected.size > 1 ? "s" : ""} avec succès
          </p>
          <p className="text-sm text-zinc-400">{pmNom}</p>
        </div>
        <div className="flex justify-end pb-2">
          <SubmitButton onClick={onDone}>Terminer →</SubmitButton>
        </div>
      </div>
    );
  }

  // ── Validation sub-step
  if (subStep === "validation") {
    const pps = Array.from(selected.values());
    return (
      <div className="px-6 py-5 space-y-5">
        {showCreatedBanner && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2.5 text-sm">
            <CheckCircle size={15} className="shrink-0" />
            <span>
              Structure créée : <span className="font-semibold">{pmNom}</span>
            </span>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Personnes à rattacher ({pps.length})
          </p>
          <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white divide-y divide-zinc-50">
            {pps.map((pp) => (
              <div
                key={pp.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-zinc-800">
                    {pp.prenom} {pp.nom}
                  </span>
                  {pp.profession && (
                    <span className="text-zinc-400 ml-2 text-xs">{pp.profession}</span>
                  )}
                  {pp.barreau && (
                    <span className="text-zinc-300 ml-2 text-xs">{pp.barreau}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleSelected(pp)}
                  className="text-zinc-300 hover:text-red-400 transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Informations du rattachement (identiques pour tous)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Titre / Poste" className="col-span-2">
              <input
                className={inputCls}
                value={titreFonction}
                onChange={(e) => setTitreFonction(e.target.value)}
                placeholder="Associé, Collaborateur…"
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

        {submitError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={() => setSubStep("selection")}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition cursor-pointer"
          >
            <ChevronLeft size={15} />
            Retour à la sélection
          </button>
          <SubmitButton
            isLoading={isSubmitting}
            onClick={handleSubmitValidation}
            disabled={selected.size === 0}
          >
            Confirmer {pps.length} rattachement{pps.length > 1 ? "s" : ""} →
          </SubmitButton>
        </div>
      </div>
    );
  }

  // ── Selection sub-step
  return (
    <div className="px-6 py-5 space-y-4">
      {showCreatedBanner && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2.5 text-sm">
          <CheckCircle size={15} className="shrink-0" />
          <span>
            Structure créée : <span className="font-semibold">{pmNom}</span>
          </span>
        </div>
      )}

      {pmNomDomaine && (
        <button
          type="button"
          onClick={handleQuickDomain}
          disabled={isLoadingDomain}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition cursor-pointer disabled:opacity-50"
        >
          {isLoadingDomain ? (
            <Loader2 size={14} className="animate-spin shrink-0" />
          ) : (
            <Zap size={14} className="shrink-0" />
          )}
          <span>
            Sélectionner tous les PP avec le domaine{" "}
            <span className="font-semibold">@{pmNomDomaine}</span>
          </span>
        </button>
      )}

      <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-zinc-500">
            Rechercher une personne physique
          </p>
          {isSearching && <Loader2 size={12} className="animate-spin text-zinc-400" />}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
          <input className={inputCls} value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className={inputCls} value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Profession / Activité" />
          <input className={inputCls} value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Spécialité" />
          <input className={inputCls} value={barreau} onChange={(e) => setBarreau(e.target.value)} placeholder="Barreau" />
        </div>
      </div>

      {hasAnyQuery && hasSearched && ppResults.length === 0 && !isSearching && (
        <p className="text-xs text-zinc-400 text-center py-2">Aucun résultat.</p>
      )}

      {hasAnyQuery && ppResults.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white divide-y divide-zinc-50 max-h-52 overflow-y-auto">
          {ppResults.map((pp) => {
            const isSel = selected.has(pp.id);
            return (
              <button
                key={pp.id}
                type="button"
                onClick={() => toggleSelected(pp)}
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
                  <div className="text-sm font-medium text-zinc-800 truncate">
                    {pp.prenom} {pp.nom}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {pp.email && <span className="text-xs text-zinc-400 truncate">{pp.email}</span>}
                    {pp.profession && <span className="text-xs text-zinc-400">· {pp.profession}</span>}
                    {pp.barreau && <span className="text-xs text-zinc-300">· {pp.barreau}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Sélection ({selected.size})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selected.values()).map((pp) => (
              <PpBadge key={pp.id} pp={pp} onRemove={() => toggleSelected(pp)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
        >
          Passer cette étape
        </button>
        <SubmitButton
          onClick={() => setSubStep("validation")}
          disabled={selected.size === 0}
        >
          Valider {selected.size > 0 ? `${selected.size} ` : ""}sélection →
        </SubmitButton>
      </div>
    </div>
  );
}
