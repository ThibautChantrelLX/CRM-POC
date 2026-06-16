"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  Plus,
  Building2,
} from "lucide-react";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { PpAttachPmSection } from "@/components/pp/PpAttachPmSection";
import { CreatePmModal } from "@/components/pm/CreatePmModal";
import { usePpEmailCheck } from "@/lib/hooks/usePpEmailCheck";
import { cn } from "@/lib/utils";
import { TYPE_RELATION_PP_OPTIONS } from "@/lib/server/modules/personnes-physiques/constants";
import type { PmAttachInfo } from "@/lib/client/personnes-morales";
import type { ProfilType, TypeRelationPp } from "@/lib/server/modules/personnes-physiques/dto";

// ─── Email domain helpers (same set as in PpForm) ─────────────────────────────

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
  // Avocat
  barreau: string;
  dateSerment: string;
  specialite: string;
  profession: string;
  activiteDominante: string;
  // Pro
  professionPro: string;
  specialitePro: string;
  // Particulier
  civilite: string;
  dateNaissance: string;
  situationFamiliale: string;
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
  };
  onCreated: (ppId: string) => void;
  onClose: () => void;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
      {children}
    </h3>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

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
    specialite: "",
    profession: "",
    activiteDominante: "",
    professionPro: "",
    specialitePro: "",
    civilite: "",
    dateNaissance: "",
    situationFamiliale: "",
  });

  const [attachedPm, setAttachedPm] = useState<PmAttachInfo | null>(null);
  const [pmSuggestions, setPmSuggestions] = useState<PmAttachInfo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsSearched, setSuggestionsSearched] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [showCreatePm, setShowCreatePm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailCheck = usePpEmailCheck(form.email);
  const emailTaken = emailCheck.status === "taken";

  // ─── Auto-suggest PM on open ──────────────────────────────────────────────

  useEffect(() => {
    const entreprise = prefilled.entreprise.trim();
    const domain = prefilled.email ? emailDomain(prefilled.email) : null;
    const isGenericDomain = domain ? GENERIC_EMAIL_DOMAINS.has(domain) : true;

    if (!entreprise && isGenericDomain) return;

    setLoadingSuggestions(true);

    const queries: string[] = [];
    if (entreprise) queries.push(entreprise);
    if (domain && !isGenericDomain) queries.push(domain);

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
      // Prioritize exact raison sociale matches
      const sorted = unique.sort((a, b) => {
        const aExact =
          a.raisonSociale.toLowerCase() === entreprise.toLowerCase() ? -1 : 0;
        const bExact =
          b.raisonSociale.toLowerCase() === entreprise.toLowerCase() ? -1 : 0;
        return aExact - bExact;
      });
      setPmSuggestions(sorted.slice(0, 3));
      setSuggestionsSearched(true);
      setLoadingSuggestions(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
            specialite: form.specialite.trim() || null,
            profession: form.profession.trim() || null,
            activiteDominante: form.activiteDominante.trim() || null,
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

  return (
    <>
      {/* Modal overlay — z-60 to sit above the import modal (z-50) */}
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

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

              {/* PM suggestions */}
              {loadingSuggestions && !attachedPm && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                  <Loader2 size={11} className="animate-spin" />
                  Recherche d&apos;organisations correspondantes…
                </div>
              )}

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
                            {[pm.siretSiren, pm.typeStructure]
                              .filter(Boolean)
                              .join(" · ")}
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
                  <button
                    type="button"
                    onClick={() => setDismissedSuggestions(true)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                  >
                    Aucune de ces suggestions
                  </button>
                </div>
              )}

              {!attachedPm && !dismissedSuggestions && suggestionsSearched && pmSuggestions.length === 0 && (prefilled.entreprise || (() => {
                const d = prefilled.email ? emailDomain(prefilled.email) : null;
                return d && !GENERIC_EMAIL_DOMAINS.has(d);
              })()) && (
                <p className="text-[10px] text-zinc-400 mb-2">
                  Aucune organisation trouvée pour{" "}
                  {prefilled.entreprise
                    ? `« ${prefilled.entreprise} »`
                    : `le domaine ${emailDomain(prefilled.email) ?? ""}`}{" "}
                  — recherchez ou créez ci-dessous.
                </p>
              )}

              <PpAttachPmSection
                value={attachedPm}
                onChange={setAttachedPm}
                onCreateNew={(_query) => setShowCreatePm(true)}
              />
            </section>

            {/* Profil avocat */}
            {form.profilType === "AVOCAT" && (
              <section>
                <SectionTitle>Profil avocat</SectionTitle>
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
                  <FormField label="Spécialité">
                    <input
                      className={inputCls}
                      value={form.specialite}
                      onChange={patch("specialite")}
                      placeholder="Droit des affaires"
                    />
                  </FormField>
                  <FormField label="Activité dominante" className="col-span-2">
                    <input
                      className={inputCls}
                      value={form.activiteDominante}
                      onChange={patch("activiteDominante")}
                      placeholder="Contentieux"
                    />
                  </FormField>
                </div>
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
        </div>
      </div>

      {/* Nested PM creation — z-[70] to sit above this modal */}
      <CreatePmModal
        open={showCreatePm}
        onClose={() => setShowCreatePm(false)}
        onCreated={(pm) => {
          setAttachedPm(pm);
          setShowCreatePm(false);
        }}
      />
    </>
  );
}
