"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, AlertTriangle, Globe } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Modal } from "@/components/ui/modal";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { PpDuplicatesDropdown } from "@/components/pp/PpDuplicatesDropdown";
import { PpAttachPmSection } from "@/components/pp/PpAttachPmSection";
import { usePpEmailCheck } from "@/lib/hooks/usePpEmailCheck";
import { usePpPhoneCheck, type PpPhoneCheckResult } from "@/lib/hooks/usePpPhoneCheck";
import { cn } from "@/lib/utils";
import {
  PP_ATTACH_PM_STORAGE_KEY,
  type PmAttachInfo,
} from "@/lib/client/personnes-morales";
import { TYPE_RELATION_PP_OPTIONS, profilTypeFromPrincipal } from "@/lib/server/modules/personnes-physiques/constants";
import type {
  TypeRelationPp,
  StatutRgpd,
  PersonnePhysiqueDetail,
  ProfilType,
} from "@/lib/server/modules/personnes-physiques/dto";

type FormState = {
  profilType: ProfilType;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  portable: string;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | "";
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  // Avocat
  barreau: string;
  dateSerment: string;
  specialiteAvocat: string;
  professionAvocat: string;
  activiteDominante: string;
  // Pro
  professionPro: string;
  specialitePro: string;
  // Particulier
  civilite: string;
  dateNaissance: string;
  situationFamiliale: string;
};

const EMPTY: FormState = {
  profilType: "PARTICULIER",
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  portable: "",
  typeRelation: "CONTACT",
  statutRgpd: "",
  actif: true,
  optInEmail: false,
  optInSms: false,
  optOutGlobal: false,
  barreau: "",
  dateSerment: "",
  specialiteAvocat: "",
  professionAvocat: "",
  activiteDominante: "",
  professionPro: "",
  specialitePro: "",
  civilite: "",
  dateNaissance: "",
  situationFamiliale: "",
};

function fromDetail(pp: PersonnePhysiqueDetail): FormState {
  const profilType = profilTypeFromPrincipal(pp.typeProfilPrincipal);
  return {
    ...EMPTY,
    profilType,
    nom: pp.nom,
    prenom: pp.prenom ?? "",
    email: pp.email ?? "",
    telephone: pp.telephone ?? "",
    portable: pp.portable ?? "",
    typeRelation: pp.typeRelation,
    statutRgpd: pp.statutRgpd ?? "",
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    // Profil avocat
    barreau: pp.barreau ?? "",
    dateSerment: pp.dateSerment ?? "",
    specialiteAvocat: profilType === "AVOCAT" ? (pp.specialite ?? "") : "",
    professionAvocat: profilType === "AVOCAT" ? (pp.profession ?? "") : "",
    activiteDominante: pp.activiteDominante ?? "",
    // Profil pro
    professionPro: profilType === "PRO" ? (pp.profession ?? "") : "",
    specialitePro: profilType === "PRO" ? (pp.specialite ?? "") : "",
    // Profil particulier
    civilite: pp.civilite ?? "",
    dateNaissance: pp.dateNaissance ?? "",
    situationFamiliale: pp.situationFamiliale ?? "",
  };
}

const DRAFT_STORAGE_KEY = "pp-create-draft";

type DraftState = { form: FormState; attachedPm: PmAttachInfo | null };

// Domaines d'emails grand public : on ne propose pas de les associer à une organisation
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", "live.com", "live.fr", "msn.com",
  "yahoo.com", "yahoo.fr",
  "icloud.com", "me.com", "mac.com",
  "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr", "laposte.net", "bbox.fr", "neuf.fr",
  "gmx.com", "gmx.fr", "aol.com", "protonmail.com", "yopmail.com",
]);

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

function PhoneDuplicateWarning({ check, onSelect }: { check: PpPhoneCheckResult; onSelect: () => void }) {
  if (check.status !== "taken") return null;
  return (
    <p className="flex items-center gap-1 text-xs text-amber-600">
      <AlertTriangle size={12} className="shrink-0" />
      Déjà utilisé par{" "}
      <Link
        href={`/personnes-physiques/${check.match.id}`}
        onClick={onSelect}
        className="font-medium underline underline-offset-2 hover:text-amber-700"
      >
        {[check.match.prenom, check.match.nom].filter(Boolean).join(" ")}
      </Link>
    </p>
  );
}

const PROFIL_TABS: { value: ProfilType; label: string }[] = [
  { value: "PARTICULIER", label: "Particulier" },
  { value: "AVOCAT", label: "Avocat" },
  { value: "PRO", label: "Professionnel" },
];

type Props =
  | { mode: "create" }
  | { mode: "edit"; initialData: PersonnePhysiqueDetail; ppId: string };

export function PpForm(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const [form, setForm] = useState<FormState>(
    props.mode === "edit" ? fromDetail(props.initialData) : EMPTY,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identityFocused, setIdentityFocused] = useState(false);
  const [attachedPm, setAttachedPm] = useState<PmAttachInfo | null>(null);
  const [domainPrompt, setDomainPrompt] = useState<{ domain: string; pm: PmAttachInfo } | null>(null);
  const domainPromptResolveRef = useRef<((associate: boolean) => void) | null>(null);
  const emailCheck = usePpEmailCheck(isCreate ? form.email : "");
  const emailTaken = isCreate && emailCheck.status === "taken";
  const telephoneCheck = usePpPhoneCheck("telephone", isCreate ? form.telephone : "");
  const portableCheck = usePpPhoneCheck("portable", isCreate ? form.portable : "");

  // Restaure le brouillon laissé avant de consulter une fiche depuis la liste de doublons,
  // ou la PM nouvellement créée depuis la recherche de rattachement
  useEffect(() => {
    if (!isCreate) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as DraftState;
        setForm(draft.form);
        setAttachedPm(draft.attachedPm);
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {}
    try {
      const rawPm = sessionStorage.getItem(PP_ATTACH_PM_STORAGE_KEY);
      if (rawPm) {
        setAttachedPm(JSON.parse(rawPm) as PmAttachInfo);
        sessionStorage.removeItem(PP_ATTACH_PM_STORAGE_KEY);
      }
    } catch {}
  }, [isCreate]);

  const saveDraft = () => {
    if (!isCreate) return;
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ form, attachedPm } satisfies DraftState));
    } catch {}
  };

  const handleCreateNewPm = (query: string) => {
    saveDraft();
    const params = new URLSearchParams({ returnTo: "pp-create" });
    if (query) params.set("raisonSociale", query);
    router.push(`/personnes-morales/nouveau?${params}`);
  };

  const askDomainAssociation = (domain: string, pm: PmAttachInfo): Promise<boolean> =>
    new Promise((resolve) => {
      domainPromptResolveRef.current = resolve;
      setDomainPrompt({ domain, pm });
    });

  const resolveDomainPrompt = (associate: boolean) => {
    domainPromptResolveRef.current?.(associate);
    domainPromptResolveRef.current = null;
    setDomainPrompt(null);
  };

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

  const handleSubmit = async () => {
    if (!form.nom.trim()) return;
    if (isCreate && !form.email.trim()) return;
    if (emailTaken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const body = {
        nom: form.nom.trim(),
        prenom: form.prenom || undefined,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        portable: form.portable || undefined,
        typeRelation: form.typeRelation,
        statutRgpd: (form.statutRgpd as StatutRgpd) || undefined,
        actif: form.actif,
        optInEmail: form.optInEmail,
        optInSms: form.optInSms,
        optOutGlobal: form.optOutGlobal,
        profilType: form.profilType,
        ...(form.profilType === "AVOCAT" && {
          barreau: form.barreau || undefined,
          dateSerment: form.dateSerment || undefined,
          specialite: form.specialiteAvocat || undefined,
          profession: form.professionAvocat || undefined,
          activiteDominante: form.activiteDominante || undefined,
        }),
        ...(form.profilType === "PRO" && {
          profession: form.professionPro || undefined,
          specialite: form.specialitePro || undefined,
        }),
        ...(form.profilType === "PARTICULIER" && {
          civilite: form.civilite || undefined,
          dateNaissance: form.dateNaissance || undefined,
          situationFamiliale: form.situationFamiliale || undefined,
        }),
      };

      const url =
        props.mode === "create"
          ? "/api/personnes-physiques"
          : `/api/personnes-physiques/${props.ppId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      const pp = await res.json();
      const targetId = props.mode === "create" ? pp.id : props.ppId;

      if (isCreate) {
        try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}

        if (attachedPm) {
          await fetch("/api/rattachements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personnePhysiqueId: pp.id, personneMoraleId: attachedPm.id }),
          }).catch(() => {});

          const domain = emailDomain(form.email);
          if (domain && !GENERIC_EMAIL_DOMAINS.has(domain) && attachedPm.nomDomaine !== domain) {
            const associate = await askDomainAssociation(domain, attachedPm);
            if (associate) {
              await fetch(`/api/personnes-morales/${attachedPm.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nomDomaine: domain }),
              }).catch(() => {});
            }
          }
        }
      }

      router.push(`/personnes-physiques/${targetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelHref =
    props.mode === "create" ? "/personnes-physiques" : `/personnes-physiques/${props.ppId}`;

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-6">

      {/* Type de profil */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Type de profil</h3>
        <div className="flex gap-2">
          {PROFIL_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, profilType: tab.value }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
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
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Identité</h3>
        <div
          className="relative grid grid-cols-2 gap-4"
          onFocus={() => setIdentityFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIdentityFocused(false);
            }
          }}
        >
          <FormField label="Nom" required>
            <input className={inputCls} value={form.nom} onChange={patch("nom")} placeholder="DUPONT" />
          </FormField>
          <FormField label="Prénom">
            <input className={inputCls} value={form.prenom} onChange={patch("prenom")} placeholder="Jean" />
          </FormField>
          {isCreate && identityFocused && (
            <PpDuplicatesDropdown nom={form.nom} prenom={form.prenom} onSelect={saveDraft} />
          )}
        </div>
      </section>

      {/* Coordonnées */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Coordonnées</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email" required={isCreate}>
            <input
              type="email"
              className={cn(
                inputCls,
                isCreate && emailCheck.status === "available" &&
                  "border-green-400 focus:border-green-400 focus:ring-green-500/10",
                isCreate && emailCheck.status === "taken" &&
                  "border-red-400 focus:border-red-400 focus:ring-red-500/10",
              )}
              value={form.email}
              onChange={patch("email")}
              placeholder="jean.dupont@cabinet.fr"
            />
            {isCreate && emailCheck.status === "available" && (
              <p className="flex items-center gap-1 text-xs text-green-600">
                <Check size={12} /> Email disponible
              </p>
            )}
            {isCreate && emailCheck.status === "taken" && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle size={12} className="shrink-0" />
                Déjà utilisé par{" "}
                <Link
                  href={`/personnes-physiques/${emailCheck.match.id}`}
                  onClick={saveDraft}
                  className="font-medium underline underline-offset-2 hover:text-red-700"
                >
                  {[emailCheck.match.prenom, emailCheck.match.nom].filter(Boolean).join(" ")}
                </Link>
              </p>
            )}
          </FormField>
          <FormField label="Téléphone">
            <input
              className={cn(
                inputCls,
                isCreate && telephoneCheck.status === "taken" &&
                  "border-amber-400 focus:border-amber-400 focus:ring-amber-500/10",
              )}
              value={form.telephone}
              onChange={patch("telephone")}
              placeholder="01 23 45 67 89"
            />
            {isCreate && <PhoneDuplicateWarning check={telephoneCheck} onSelect={saveDraft} />}
          </FormField>
          <FormField label="Portable" className="col-span-2">
            <input
              className={cn(
                inputCls,
                isCreate && portableCheck.status === "taken" &&
                  "border-amber-400 focus:border-amber-400 focus:ring-amber-500/10",
              )}
              value={form.portable}
              onChange={patch("portable")}
              placeholder="06 12 34 56 78"
            />
            {isCreate && <PhoneDuplicateWarning check={portableCheck} onSelect={saveDraft} />}
          </FormField>
        </div>
      </section>

      {/* Rattachement à une organisation */}
      {isCreate && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Rattachement à une organisation
          </h3>
          <PpAttachPmSection value={attachedPm} onChange={setAttachedPm} onCreateNew={handleCreateNewPm} />
        </section>
      )}

      {/* Profil avocat */}
      {form.profilType === "AVOCAT" && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil avocat</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Barreau">
              <input className={inputCls} value={form.barreau} onChange={patch("barreau")} placeholder="Paris" />
            </FormField>
            <FormField label="Date de serment">
              <input type="date" className={inputCls} value={form.dateSerment} onChange={patch("dateSerment")} />
            </FormField>
            <FormField label="Profession">
              <input className={inputCls} value={form.professionAvocat} onChange={patch("professionAvocat")} placeholder="Avocat" />
            </FormField>
            <FormField label="Spécialité">
              <input className={inputCls} value={form.specialiteAvocat} onChange={patch("specialiteAvocat")} placeholder="Droit des affaires" />
            </FormField>
            <FormField label="Activité dominante" className="col-span-2">
              <input className={inputCls} value={form.activiteDominante} onChange={patch("activiteDominante")} placeholder="Contentieux" />
            </FormField>
          </div>
        </section>
      )}

      {/* Profil professionnel */}
      {form.profilType === "PRO" && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil professionnel</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Profession">
              <input className={inputCls} value={form.professionPro} onChange={patch("professionPro")} placeholder="Notaire" />
            </FormField>
            <FormField label="Spécialité">
              <input className={inputCls} value={form.specialitePro} onChange={patch("specialitePro")} placeholder="Droit immobilier" />
            </FormField>
          </div>
        </section>
      )}

      {/* Profil particulier */}
      {form.profilType === "PARTICULIER" && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil particulier</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Civilité">
              <select className={selectCls} value={form.civilite} onChange={patch("civilite")}>
                <option value="">— Choisir —</option>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </FormField>
            <FormField label="Date de naissance">
              <input type="date" className={inputCls} value={form.dateNaissance} onChange={patch("dateNaissance")} />
            </FormField>
            <FormField label="Situation familiale" className="col-span-2">
              <select className={selectCls} value={form.situationFamiliale} onChange={patch("situationFamiliale")}>
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
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Statut & RGPD</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type de relation" required>
            <select className={selectCls} value={form.typeRelation} onChange={patch("typeRelation")}>
              {TYPE_RELATION_PP_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Statut RGPD">
            <select className={selectCls} value={form.statutRgpd} onChange={patch("statutRgpd")}>
              <option value="">— Non renseigné —</option>
              <option value="OPT_IN">Opt-in</option>
              <option value="OPT_OUT">Opt-out</option>
              <option value="NON_RENSEIGNE">Non renseigné</option>
            </select>
          </FormField>
          <FormField label="Statut">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.actif} onChange={patch("actif")} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-700">Actif</span>
            </label>
          </FormField>
          <FormField label="Opt-in email">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.optInEmail} onChange={patch("optInEmail")} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-700">Opt-in email</span>
            </label>
          </FormField>
          <FormField label="Opt-in SMS">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.optInSms} onChange={patch("optInSms")} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-700">Opt-in SMS</span>
            </label>
          </FormField>
          <FormField label="Opt-out global">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.optOutGlobal} onChange={patch("optOutGlobal")} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-700">Opt-out global</span>
            </label>
          </FormField>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
        >
          Annuler
        </button>
        <SubmitButton
          isLoading={isSubmitting}
          onClick={handleSubmit}
          disabled={!form.nom.trim() || (isCreate && !form.email.trim()) || emailTaken}
        >
          {props.mode === "create" ? "Créer la personne physique" : "Enregistrer les modifications"}
        </SubmitButton>
      </div>

      <Modal
        open={domainPrompt !== null}
        onClose={() => resolveDomainPrompt(false)}
        title="Associer le domaine à l'organisation"
        size="sm"
      >
        {domainPrompt && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-primary-600" />
              </div>
              <p className="text-sm text-zinc-600">
                L'email renseigné utilise le domaine{" "}
                <span className="font-medium text-zinc-900">@{domainPrompt.domain}</span>.
                Souhaitez-vous l'associer à l'organisation{" "}
                <span className="font-medium text-zinc-900">{domainPrompt.pm.raisonSociale}</span> ?
              </p>
            </div>
            <div className="flex justify-end gap-2 pb-1">
              <button
                type="button"
                onClick={() => resolveDomainPrompt(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
              >
                Non merci
              </button>
              <SubmitButton onClick={() => resolveDomainPrompt(true)}>
                Associer le domaine
              </SubmitButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
