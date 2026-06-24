"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  Plus,
  Building2,
  ArrowLeft,
  Copy,
} from "lucide-react";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { SPECIALITES, ACTIVITES_DOMINANTES } from "@/lib/constants/specialites";
import { PpAttachPmSection } from "@/components/pp/PpAttachPmSection";
import { SireneSearch } from "@/components/pm/SireneSearch";
import { MaisonMereSearch, type MaisonMereValue } from "@/components/pm/MaisonMereSearch";
import { usePpEmailCheck } from "@/lib/hooks/usePpEmailCheck";
import { cn } from "@/lib/utils";
import { TYPE_RELATION_PP_OPTIONS } from "@/lib/server/modules/personnes-physiques/constants";
import type { PmAttachInfo } from "@/lib/client/personnes-morales";
import type { SireneResult } from "@/app/api/sirene/route";
import type { ProfilType, TypeRelationPp } from "@/lib/server/modules/personnes-physiques/dto";

// ─── Email domain helpers ──────────────────────────────────────────────────────

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", "live.com", "live.fr",
  "yahoo.com", "yahoo.fr",
  "icloud.com", "me.com",
  "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr", "laposte.net",
  "protonmail.com", "yopmail.com",
]);

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  profilType: ProfilType;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  portable: string;
  typeRelation: TypeRelationPp;
  statutRgpd: string;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  actif: boolean;
  barreau: string;
  dateSerment: string;
  specialite: string[];
  profession: string;
  activiteDominante: string[];
  professionPro: string;
  specialitePro: string;
  civilite: string;
  dateNaissance: string;
  situationFamiliale: string;
  titreFonction: string;
};

type TypeRelationPm = "CABINET_POSTULATION" | "CLIENT_DIRECT" | "HYBRIDE" | "AUTRE" | "PROSPECT";

type PmDraftState = {
  raisonSociale: string;
  typeRelation: TypeRelationPm;
  siretSiren: string;
  typeStructure: string;
  email: string;
  telephone: string;
  siteWeb: string;
  nomDomaine: string;
  maisonMere: MaisonMereValue | null;
  rue: string;
  codePostal: string;
  ville: string;
  pays: string;
};

interface Props {
  formationId: string;
  prefilled: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    portable: string;
    barreau: string;
    entreprise: string;
    adresseEntreprise: string;
    cpEntreprise: string;
    villeEntreprise: string;
  };
  onCreated: (ppId: string) => void;
  onClose: () => void;
}

// ─── Copy avocat button ───────────────────────────────────────────────────────

function CopyAvocatButton({
  barreau,
  prenom,
  nom,
}: {
  barreau: string;
  prenom: string;
  nom: string;
}) {
  const [copied, setCopied] = useState(false);

  const text = [
    barreau && `Barreau ${barreau}`,
    [prenom, nom].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  if (!text.trim()) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 transition-colors"
      title={`Copier : ${text}`}
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? "Copié !" : text}
    </button>
  );
}

// ─── Searchable multi-select ──────────────────────────────────────────────────

function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Rechercher…",
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = options.filter(
    (opt) => !value.includes(opt) && opt.toLowerCase().includes(query.toLowerCase()),
  );

  const add = (opt: string) => {
    onChange([...value, opt]);
    setQuery("");
  };

  const remove = (opt: string) => onChange(value.filter((v) => v !== opt));

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-white text-[11px] font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={inputCls}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-md max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(opt);
              }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 border-b last:border-b-0 border-zinc-100 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
      {children}
    </h3>
  );
}

// ─── PM creation drawer ───────────────────────────────────────────────────────
// Rendered inside the PP modal (absolute inset-0) — slides in from the right.
// Remounted via `key` each time it opens so state is always fresh.

function PmCreationDrawer({
  initialName,
  ppEmail,
  initialAddress,
  onCreated,
  onClose,
}: {
  initialName: string;
  ppEmail: string;
  initialAddress: { rue: string; codePostal: string; ville: string };
  onCreated: (pm: PmAttachInfo) => void;
  onClose: () => void;
}) {
  const ppDomain = (() => {
    const d = ppEmail ? emailDomain(ppEmail) : null;
    return d && !GENERIC_EMAIL_DOMAINS.has(d) ? d : "";
  })();

  const [draft, setDraft] = useState<PmDraftState>({
    raisonSociale: initialName,
    typeRelation: "HYBRIDE",
    siretSiren: "",
    typeStructure: "",
    email: "",
    telephone: "",
    siteWeb: "",
    nomDomaine: ppDomain,
    maisonMere: null,
    rue: initialAddress.rue,
    codePostal: initialAddress.codePostal,
    ville: initialAddress.ville,
    pays: initialAddress.rue || initialAddress.ville ? "France" : "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch =
    (k: keyof PmDraftState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSireneSelect = (result: SireneResult) => {
    setDraft((prev) => ({
      ...prev,
      raisonSociale: result.raisonSociale,
      siretSiren: result.siret,
      rue: result.adresse.rue ?? prev.rue,
      codePostal: result.adresse.codePostal ?? prev.codePostal,
      ville: result.adresse.ville ?? prev.ville,
      pays: "France",
    }));
  };

  async function handleSubmit() {
    if (!draft.raisonSociale.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const hasAdresse = !!(draft.rue || draft.codePostal || draft.ville);
      const res = await fetch("/api/personnes-morales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raisonSociale: draft.raisonSociale.trim(),
          typeRelation: draft.typeRelation,
          siretSiren: draft.siretSiren || undefined,
          typeStructure: draft.typeStructure || undefined,
          email: draft.email || undefined,
          telephone: draft.telephone || undefined,
          siteWeb: draft.siteWeb || undefined,
          nomDomaine: draft.nomDomaine || undefined,
          maisonMereId: draft.maisonMere?.id ?? undefined,
          ...(hasAdresse && {
            adresse: {
              rue: draft.rue || undefined,
              codePostal: draft.codePostal || undefined,
              ville: draft.ville || undefined,
              pays: draft.pays || undefined,
            },
          }),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const pm = (await res.json()) as {
        id: string;
        raisonSociale: string;
        siretSiren?: string | null;
        typeStructure?: string | null;
      };
      onCreated({
        id: pm.id,
        raisonSociale: pm.raisonSociale,
        siretSiren: pm.siretSiren ?? null,
        typeStructure: pm.typeStructure ?? null,
        nomDomaine: draft.nomDomaine || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white rounded-2xl">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-100 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">
            Créer l&apos;organisation
          </h3>
          <p className="text-[11px] text-zinc-400 truncate">
            {initialName || "Nouvelle personne morale"}
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
        {/* SIRENE — manual search, pre-filled with company name */}
        <SireneSearch onSelect={handleSireneSelect} initialQuery={initialName} />

        {/* Identité */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Raison sociale" required className="col-span-2">
            <input
              className={inputCls}
              value={draft.raisonSociale}
              onChange={patch("raisonSociale")}
              placeholder="Cabinet DUPONT & ASSOCIÉS"
            />
          </FormField>
          <FormField label="Type de relation" required className="col-span-2">
            <select
              className={selectCls}
              value={draft.typeRelation}
              onChange={(e) =>
                setDraft((p) => ({ ...p, typeRelation: e.target.value as TypeRelationPm }))
              }
            >
              <option value="PROSPECT">Prospect</option>
              <option value="CLIENT_DIRECT">Client direct</option>
              <option value="CABINET_POSTULATION">Cabinet de postulation</option>
              <option value="HYBRIDE">Hybride</option>
              <option value="AUTRE">Autre</option>
            </select>
          </FormField>
          <FormField label="SIRET / SIREN">
            <input
              className={inputCls}
              value={draft.siretSiren}
              onChange={patch("siretSiren")}
              placeholder="14 ou 9 chiffres"
            />
          </FormField>
          <FormField label="Type de structure">
            <input
              className={inputCls}
              value={draft.typeStructure}
              onChange={patch("typeStructure")}
              placeholder="Cabinet d'Avocats"
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              className={inputCls}
              value={draft.email}
              onChange={patch("email")}
              placeholder="contact@cabinet.fr"
            />
          </FormField>
          <FormField label="Téléphone">
            <input
              className={inputCls}
              value={draft.telephone}
              onChange={patch("telephone")}
              placeholder="01 23 45 67 89"
            />
          </FormField>
          <FormField label="Site web">
            <input
              className={inputCls}
              value={draft.siteWeb}
              onChange={patch("siteWeb")}
              placeholder="https://cabinet.fr"
            />
          </FormField>
          <FormField label="Nom de domaine">
            <input
              className={inputCls}
              value={draft.nomDomaine}
              onChange={patch("nomDomaine")}
              placeholder="cabinet.fr"
            />
          </FormField>
        </div>

        <FormField label="Maison mère">
          <MaisonMereSearch
            value={draft.maisonMere}
            onChange={(v) => setDraft((prev) => ({ ...prev, maisonMere: v }))}
          />
        </FormField>

        {/* Adresse */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
            Adresse
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Rue" className="col-span-2">
              <input
                className={inputCls}
                value={draft.rue}
                onChange={patch("rue")}
                placeholder="15 rue de la Paix"
              />
            </FormField>
            <FormField label="Code postal">
              <input
                className={inputCls}
                value={draft.codePostal}
                onChange={patch("codePostal")}
                placeholder="75001"
              />
            </FormField>
            <FormField label="Ville">
              <input
                className={inputCls}
                value={draft.ville}
                onChange={patch("ville")}
                placeholder="Paris"
              />
            </FormField>
            <FormField label="Pays" className="col-span-2">
              <input
                className={inputCls}
                value={draft.pays}
                onChange={patch("pays")}
                placeholder="France"
              />
            </FormField>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!draft.raisonSociale.trim() || isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          Valider et associer
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatePPForImportModal({ formationId, prefilled, onCreated, onClose }: Props) {
  const [form, setForm] = useState<FormState>({
    profilType: "AVOCAT",
    nom: prefilled.nom.toUpperCase(),
    prenom: prefilled.prenom,
    email: prefilled.email,
    telephone: prefilled.telephone,
    portable: prefilled.portable,
    typeRelation: "CONTACT",
    statutRgpd: "",
    optInEmail: false,
    optInSms: false,
    optOutGlobal: false,
    actif: true,
    barreau: prefilled.barreau,
    dateSerment: "",
    specialite: [],
    profession: "Avocat",
    activiteDominante: [],
    professionPro: "",
    specialitePro: "",
    civilite: "",
    dateNaissance: "",
    situationFamiliale: "",
    titreFonction: "",
  });

  // Pre-compute whether we'll issue a PM suggestion search
  const willSearchPm = (() => {
    const e = prefilled.entreprise.trim();
    const d = prefilled.email ? emailDomain(prefilled.email) : null;
    return !(!e && (!d || GENERIC_EMAIL_DOMAINS.has(d)));
  })();

  const [attachedPm, setAttachedPm] = useState<PmAttachInfo | null>(null);
  const [pmSuggestions, setPmSuggestions] = useState<PmAttachInfo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(willSearchPm);
  const [suggestionsSearched, setSuggestionsSearched] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);

  // PM drawer
  const [pmDrawerOpen, setPmDrawerOpen] = useState(false);
  const [pmDrawerKey, setPmDrawerKey] = useState(0);
  const [pmInitialName, setPmInitialName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailCheck = usePpEmailCheck(form.email);
  const emailTaken = emailCheck.status === "taken";

  function openPmDrawer(name: string) {
    setPmInitialName(name);
    setPmDrawerKey((k) => k + 1);
    setPmDrawerOpen(true);
  }

  // ─── Auto-suggest PM on open ────────────────────────────────────────────────

  useEffect(() => {
    const entreprise = prefilled.entreprise.trim();
    const domain = prefilled.email ? emailDomain(prefilled.email) : null;
    const isGenericDomain = domain ? GENERIC_EMAIL_DOMAINS.has(domain) : true;

    if (!entreprise && isGenericDomain) return;

    const queries = [
      ...(entreprise ? [entreprise] : []),
      ...(domain && !isGenericDomain ? [domain] : []),
    ];
    const uniqueQueries = [...new Set(queries)];

    void Promise.all(
      uniqueQueries.map((q) =>
        fetch(`/api/personnes-morales?search=${encodeURIComponent(q)}&limit=5`)
          .then((r) => r.json())
          .then((d) => (d.data ?? []) as PmAttachInfo[])
          .catch(() => [] as PmAttachInfo[]),
      ),
    ).then((results) => {
      const all = results.flat();
      const seen = new Set<string>();
      const unique = all.filter((pm) => {
        if (seen.has(pm.id)) return false;
        seen.add(pm.id);
        return true;
      });
      const sorted = unique.sort((a, b) => {
        const aExact = a.raisonSociale.toLowerCase() === entreprise.toLowerCase() ? -1 : 0;
        const bExact = b.raisonSociale.toLowerCase() === entreprise.toLowerCase() ? -1 : 0;
        return aExact - bExact;
      });
      setPmSuggestions(sorted.slice(0, 3));
      setSuggestionsSearched(true);
      setLoadingSuggestions(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const patch =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({
        ...prev,
        [key]:
          e.target.type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      }));

  async function handleSubmit() {
    if (!form.nom.trim() || emailTaken || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/formations/${formationId}/participants/create-pp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom.trim(),
          prenom: form.prenom.trim() || null,
          email: form.email.trim() || null,
          telephone: form.telephone.trim() || null,
          portable: form.portable.trim() || null,
          typeRelation: form.typeRelation,
          profilType: form.profilType,
          statutRgpd: form.statutRgpd || null,
          optInEmail: form.optInEmail,
          optInSms: form.optInSms,
          optOutGlobal: form.optOutGlobal,
          actif: form.actif,
          ...(form.profilType === "AVOCAT" && {
            barreau: form.barreau.trim() || null,
            dateSerment: form.dateSerment || null,
            specialite: form.specialite.length ? form.specialite.join(", ") : null,
            profession: form.profession.trim() || null,
            activiteDominante: form.activiteDominante.length ? form.activiteDominante.join(", ") : null,
          }),
          ...(form.profilType === "PRO" && {
            professionPro: form.professionPro.trim() || null,
            specialitePro: form.specialitePro.trim() || null,
          }),
          ...(form.profilType === "PARTICULIER" && {
            civilite: form.civilite || null,
            dateNaissance: form.dateNaissance || null,
            situationFamiliale: form.situationFamiliale || null,
          }),
          pmId: attachedPm?.id ?? null,
          titreFonction: form.titreFonction.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      const { id } = (await res.json()) as { id: string };
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* relative + overflow-hidden needed for the inline PM drawer */}
      <div className="relative overflow-hidden bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Créer une personne physique
            </h2>
            <p className="text-[11px] text-zinc-400">
              Participant non trouvé dans le CRM — saisie complète requise
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">

          {/* Profil type */}
          <section>
            <SectionTitle>Type de profil</SectionTitle>
            <div className="flex gap-2">
              {(
                [
                  { value: "AVOCAT" as ProfilType, label: "Avocat" },
                  { value: "PRO" as ProfilType, label: "Professionnel" },
                  { value: "PARTICULIER" as ProfilType, label: "Particulier" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, profilType: tab.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    form.profilType === tab.value
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* Identité */}
          <section>
            <SectionTitle>Identité</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nom" required>
                <input
                  className={inputCls}
                  value={form.nom}
                  onChange={patch("nom")}
                  placeholder="DUPONT"
                />
              </FormField>
              <FormField label="Prénom">
                <input
                  className={inputCls}
                  value={form.prenom}
                  onChange={patch("prenom")}
                  placeholder="Jean"
                />
              </FormField>
            </div>
          </section>

          {/* Coordonnées */}
          <section>
            <SectionTitle>Coordonnées</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <FormField label="Email">
                  <input
                    type="email"
                    className={cn(
                      inputCls,
                      emailCheck.status === "available" && "border-green-400",
                      emailCheck.status === "taken" && "border-red-400",
                    )}
                    value={form.email}
                    onChange={patch("email")}
                    placeholder="jean.dupont@cabinet.fr"
                  />
                </FormField>
                {emailCheck.status === "taken" && (
                  <p className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
                    <AlertTriangle size={11} className="shrink-0" />
                    Déjà utilisé par{" "}
                    <Link
                      href={`/personnes-physiques/${emailCheck.match.id}`}
                      className="font-medium underline underline-offset-2 hover:text-red-700"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {[emailCheck.match.prenom, emailCheck.match.nom]
                        .filter(Boolean)
                        .join(" ")}
                    </Link>
                  </p>
                )}
                {emailCheck.status === "available" && (
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                    <Check size={11} /> Email disponible
                  </p>
                )}
              </div>
              <FormField label="Téléphone">
                <input
                  className={inputCls}
                  value={form.telephone}
                  onChange={patch("telephone")}
                  placeholder="01 23 45 67 89"
                />
              </FormField>
              <FormField label="Portable">
                <input
                  className={inputCls}
                  value={form.portable}
                  onChange={patch("portable")}
                  placeholder="06 12 34 56 78"
                />
              </FormField>
            </div>
          </section>

          {/* Organisation (PM) */}
          <section>
            <SectionTitle>Organisation</SectionTitle>

            {/* Loading suggestions */}
            {loadingSuggestions && !attachedPm && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                <Loader2 size={11} className="animate-spin" />
                Recherche d&apos;organisations correspondantes…
              </div>
            )}

            {/* Suggestions from CRM */}
            {!attachedPm && !dismissedSuggestions && suggestionsSearched && pmSuggestions.length > 0 && (
              <div className="mb-3 space-y-1.5">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                  {pmSuggestions.length === 1 ? "Suggestion" : "Suggestions"}{" "}
                  {prefilled.entreprise
                    ? `pour « ${prefilled.entreprise} »`
                    : "basées sur le domaine email"}
                </p>
                {pmSuggestions.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50/50"
                  >
                    <Building2 size={13} className="text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-zinc-800">
                        {pm.raisonSociale}
                      </span>
                      {(pm.siretSiren ?? pm.typeStructure) && (
                        <span className="text-[10px] text-zinc-400 ml-2">
                          {[pm.siretSiren, pm.typeStructure].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedPm(pm)}
                      className="text-[10px] font-medium px-2 py-1 rounded bg-zinc-900 text-white hover:bg-zinc-700 transition-colors shrink-0"
                    >
                      Associer
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDismissedSuggestions(true)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                  >
                    Aucune de ces suggestions
                  </button>
                  {prefilled.entreprise && (
                    <button
                      type="button"
                      onClick={() => openPmDrawer(prefilled.entreprise)}
                      className="text-[10px] font-medium text-zinc-500 hover:text-zinc-800 flex items-center gap-1"
                    >
                      <Plus size={10} /> Créer « {prefilled.entreprise} »
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* No match found — quick create */}
            {!attachedPm && prefilled.entreprise && suggestionsSearched && pmSuggestions.length === 0 && !dismissedSuggestions && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 bg-zinc-50/50">
                <Building2 size={13} className="text-zinc-400 shrink-0" />
                <p className="flex-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">« {prefilled.entreprise} »</span>{" "}
                  introuvable dans le CRM
                </p>
                <button
                  type="button"
                  onClick={() => openPmDrawer(prefilled.entreprise)}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 transition-colors shrink-0 flex items-center gap-1"
                >
                  <Plus size={10} /> Créer
                </button>
              </div>
            )}

            {/* Suggestions dismissed — offer quick create */}
            {!attachedPm && prefilled.entreprise && dismissedSuggestions && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] text-zinc-400">
                  Créer{" "}
                  <span className="font-medium text-zinc-600">« {prefilled.entreprise} »</span>{" "}
                  comme nouvelle organisation ?
                </p>
                <button
                  type="button"
                  onClick={() => openPmDrawer(prefilled.entreprise)}
                  className="text-[10px] font-medium px-2 py-1 rounded border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors shrink-0 flex items-center gap-1"
                >
                  <Plus size={10} /> Créer l&apos;organisation
                </button>
              </div>
            )}

            <PpAttachPmSection
              value={attachedPm}
              onChange={setAttachedPm}
              onCreateNew={(query) => openPmDrawer(query || prefilled.entreprise)}
            />

            {attachedPm && (
              <FormField label="Poste / fonction" className="mt-3">
                <input
                  className={inputCls}
                  value={form.titreFonction}
                  onChange={patch("titreFonction")}
                  placeholder="Avocat associé, Collaborateur…"
                />
              </FormField>
            )}
          </section>

          {/* Profil avocat */}
          {form.profilType === "AVOCAT" && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <SectionTitle>Profil avocat</SectionTitle>
                <CopyAvocatButton
                  barreau={form.barreau}
                  prenom={form.prenom}
                  nom={form.nom}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Barreau">
                  <input
                    className={inputCls}
                    value={form.barreau}
                    onChange={patch("barreau")}
                    placeholder="Paris"
                  />
                </FormField>
                <FormField label="Date de serment">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.dateSerment}
                    onChange={patch("dateSerment")}
                  />
                </FormField>
                <FormField label="Profession">
                  <input
                    className={inputCls}
                    value={form.profession}
                    onChange={patch("profession")}
                    placeholder="Avocat"
                  />
                </FormField>
              </div>
              <FormField label="Spécialité">
                <SearchableMultiSelect
                  options={SPECIALITES}
                  value={form.specialite}
                  onChange={(next) => setForm((p) => ({ ...p, specialite: next }))}
                />
              </FormField>
              <FormField label="Activité dominante" className="mt-3">
                <SearchableMultiSelect
                  options={ACTIVITES_DOMINANTES}
                  value={form.activiteDominante}
                  onChange={(next) => setForm((p) => ({ ...p, activiteDominante: next }))}
                />
              </FormField>
            </section>
          )}

          {/* Profil professionnel */}
          {form.profilType === "PRO" && (
            <section>
              <SectionTitle>Profil professionnel</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Profession">
                  <input
                    className={inputCls}
                    value={form.professionPro}
                    onChange={patch("professionPro")}
                    placeholder="Notaire"
                  />
                </FormField>
                <FormField label="Spécialité">
                  <input
                    className={inputCls}
                    value={form.specialitePro}
                    onChange={patch("specialitePro")}
                  />
                </FormField>
              </div>
            </section>
          )}

          {/* Profil particulier */}
          {form.profilType === "PARTICULIER" && (
            <section>
              <SectionTitle>Profil particulier</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Civilité">
                  <select
                    className={selectCls}
                    value={form.civilite}
                    onChange={patch("civilite")}
                  >
                    <option value="">— Choisir —</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                </FormField>
                <FormField label="Date de naissance">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.dateNaissance}
                    onChange={patch("dateNaissance")}
                  />
                </FormField>
                <FormField label="Situation familiale" className="col-span-2">
                  <select
                    className={selectCls}
                    value={form.situationFamiliale}
                    onChange={patch("situationFamiliale")}
                  >
                    <option value="">— Choisir —</option>
                    <option value="Célibataire">Célibataire</option>
                    <option value="Marié(e)">Marié(e)</option>
                    <option value="Pacsé(e)">Pacsé(e)</option>
                    <option value="Divorcé(e)">Divorcé(e)</option>
                    <option value="Veuf/veuve">Veuf/veuve</option>
                  </select>
                </FormField>
              </div>
            </section>
          )}

          {/* Statut & RGPD */}
          <section>
            <SectionTitle>Statut & RGPD</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type de relation" required>
                <select
                  className={selectCls}
                  value={form.typeRelation}
                  onChange={patch("typeRelation")}
                >
                  {TYPE_RELATION_PP_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Statut RGPD">
                <select
                  className={selectCls}
                  value={form.statutRgpd}
                  onChange={patch("statutRgpd")}
                >
                  <option value="">— Non renseigné —</option>
                  <option value="OPT_IN">Opt-in</option>
                  <option value="OPT_OUT">Opt-out</option>
                  <option value="NON_RENSEIGNE">Non renseigné</option>
                </select>
              </FormField>
              <div className="col-span-2 flex gap-5 pt-1">
                {(
                  [
                    { key: "optInEmail" as const, label: "Opt-in email" },
                    { key: "optInSms" as const, label: "Opt-in SMS" },
                    { key: "optOutGlobal" as const, label: "Opt-out global" },
                    { key: "actif" as const, label: "Actif" },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={patch(key)}
                      className="h-3.5 w-3.5 rounded border-zinc-300"
                    />
                    <span className="text-xs text-zinc-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!form.nom.trim() || emailTaken || isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={13} />
            )}
            Créer et lier au participant
          </button>
        </div>

        {/* PM creation drawer — slides over the PP form within the same modal */}
        {pmDrawerOpen && (
          <PmCreationDrawer
            key={pmDrawerKey}
            initialName={pmInitialName}
            ppEmail={prefilled.email}
            initialAddress={{
              rue: prefilled.adresseEntreprise,
              codePostal: prefilled.cpEntreprise,
              ville: prefilled.villeEntreprise,
            }}
            onCreated={(pm) => {
              setAttachedPm(pm);
              setPmDrawerOpen(false);
            }}
            onClose={() => setPmDrawerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
