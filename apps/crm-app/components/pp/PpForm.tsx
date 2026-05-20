"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import type {
  TypeRelationPp,
  StatutRgpd,
  TypeProfilPrincipal,
  PersonnePhysiqueDetail,
} from "@/lib/server/modules/personnes-physiques/dto";
import { isProfilPro, isAvocatProfil } from "@/lib/server/modules/personnes-physiques/dto";

// ─── Labels profil ─────────────────────────────────────────────────────────────

const PROFIL_LABELS: Record<TypeProfilPrincipal, string> = {
  AVOCAT_INTERNE: "Avocat interne",
  ASSISTANT_INTERNE: "Assistant(e) interne",
  FONCTION_SUPPORT: "Fonction support interne",
  AVOCAT_EXTERNE: "Avocat externe",
  NOTAIRE: "Notaire",
  CLERC_NOTAIRE: "Clerc de notaire",
  COMMISSAIRE_JUSTICE: "Commissaire de justice",
  MAGISTRAT: "Magistrat",
  GREFFIER: "Greffier",
  JURISTE: "Juriste",
  INTERVENANT_JUSTICE: "Autre intervenant justice",
  FONCTION_SUPPORT_EXTERNE: "Fonction support externe",
  PARTICULIER: "Particulier",
  CONTACT_PRO: "Contact professionnel",
  APPRENANT_EXTERNE: "Apprenant externe",
  FORMATEUR_EXTERNE: "Formateur externe",
};

const PROFIL_GROUPES: { label: string; options: TypeProfilPrincipal[] }[] = [
  {
    label: "Collaborateurs internes",
    options: ["AVOCAT_INTERNE", "ASSISTANT_INTERNE", "FONCTION_SUPPORT"],
  },
  {
    label: "Professions juridiques",
    options: [
      "AVOCAT_EXTERNE",
      "NOTAIRE",
      "CLERC_NOTAIRE",
      "COMMISSAIRE_JUSTICE",
      "MAGISTRAT",
      "GREFFIER",
      "JURISTE",
      "INTERVENANT_JUSTICE",
    ],
  },
  {
    label: "Support & Conseil externe",
    options: ["FONCTION_SUPPORT_EXTERNE", "CONTACT_PRO"],
  },
  {
    label: "Clients & Prospects",
    options: ["PARTICULIER"],
  },
  {
    label: "Formation",
    options: ["APPRENANT_EXTERNE", "FORMATEUR_EXTERNE"],
  },
];

const SPECIALITES_AVOCAT = [
  "Droit bancaire et boursier",
  "Droit commercial, des affaires et de la concurrence",
  "Droit de la famille, des personnes et de leur patrimoine",
  "Droit de la fiducie",
  "Droit de la propriété intellectuelle",
  "Droit de la santé",
  "Droit de la sécurité sociale et de la protection sociale",
  "Droit de l'arbitrage",
  "Droit de l'environnement",
  "Droit des associations et des fondations",
  "Droit des assurances",
  "Droit des étrangers et de la nationalité",
  "Droit des garanties, des sûretés et des mesures d'exécution",
  "Droit des nouvelles technologies, de l'information et de la communication (NTIC)",
  "Droit des sociétés",
  "Droit des transports",
  "Droit du crédit et de la consommation",
  "Droit du dommage corporel",
  "Droit du sport",
  "Droit du travail",
  "Droit fiscal et droit douanier",
  "Droit immobilier",
  "Droit international et de l'union européenne",
  "Droit pénal",
  "Droit public",
  "Droit rural",
  "Procédure d'Appel",
];

const ACTIVITES_DOMINANTES_AVOCAT = [
  "Contentieux, médiation, arbitrage",
  "Dommages corporels et matériels",
  "Droit de la circulation et des transports",
  "Droit de la consommation",
  "Droit de la faillite et du surendettement",
  "Droit de la famille",
  "Droit de la sécurité sociale",
  "Droit de l'environnement",
  "Droit de l'homme et libertés publiques",
  "Droit de l'immigration et d'asile",
  "Droit de l'UE",
  "Droit de succession",
  "Droit des affaires",
  "Droit des biens",
  "Droit des technologies de l'information",
  "Droit du travail",
  "Droit fiscal",
  "Droit pénal",
  "Droit public",
  "Propriété intellectuelle",
];

function isParticulierProfil(type: TypeProfilPrincipal): boolean {
  return type === "PARTICULIER";
}

// ─── Types formulaire ─────────────────────────────────────────────────────────

type FormState = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  portable: string;
  typeProfilPrincipal: TypeProfilPrincipal;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | "";
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  // ProfilAvocat
  barreau: string;
  specialite: string;
  activiteDominante: string;
  profession: string;
  dateSerment: string;
  // ProfilParticulier
  dateNaissance: string;
  civilite: string;
  situationFamiliale: string;
};

const EMPTY: FormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  portable: "",
  typeProfilPrincipal: "AVOCAT_EXTERNE",
  typeRelation: "CONTACT",
  statutRgpd: "",
  actif: true,
  optInEmail: false,
  optInSms: false,
  optOutGlobal: false,
  barreau: "",
  specialite: "",
  activiteDominante: "",
  profession: "",
  dateSerment: "",
  dateNaissance: "",
  civilite: "",
  situationFamiliale: "",
};

function fromDetail(pp: PersonnePhysiqueDetail): FormState {
  const avocat = isAvocatProfil(pp.typeProfilPrincipal);
  return {
    nom: pp.nom,
    prenom: pp.prenom ?? "",
    email: pp.email ?? "",
    telephone: pp.telephone ?? "",
    portable: pp.portable ?? "",
    typeProfilPrincipal: pp.typeProfilPrincipal,
    typeRelation: pp.typeRelation,
    statutRgpd: pp.statutRgpd ?? "",
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
    barreau: pp.profilAvocat?.barreau ?? "",
    specialite: avocat ? (pp.profilAvocat?.specialite ?? "") : (pp.profilPro?.specialite ?? ""),
    activiteDominante: pp.profilAvocat?.activiteDominante ?? "",
    profession: avocat ? (pp.profilAvocat?.profession ?? "") : (pp.profilPro?.profession ?? ""),
    dateSerment: pp.profilAvocat?.dateSerment ?? "",
    dateNaissance: pp.profilParticulier?.dateNaissance ?? "",
    civilite: pp.profilParticulier?.civilite ?? "",
    situationFamiliale: pp.profilParticulier?.situationFamiliale ?? "",
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

type Props =
  | { mode: "create" }
  | { mode: "edit"; initialData: PersonnePhysiqueDetail; ppId: string };

export function PpForm(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    props.mode === "edit" ? fromDetail(props.initialData) : EMPTY,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    conflicts?: Array<{ id: string; nom: string; prenom: string | null; email: string | null; portable: string | null }>;
  } | null>(null);

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

  const showProSection = isProfilPro(form.typeProfilPrincipal);
  const showAvocatFields = isAvocatProfil(form.typeProfilPrincipal);
  const showParticulierSection = isParticulierProfil(form.typeProfilPrincipal);

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError({ message: "L'adresse email n'est pas valide." });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const body = {
        nom: form.nom.trim(),
        prenom: form.prenom || undefined,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        portable: form.portable || undefined,
        typeProfilPrincipal: form.typeProfilPrincipal,
        typeRelation: form.typeRelation,
        statutRgpd: (form.statutRgpd as StatutRgpd) || undefined,
        actif: form.actif,
        optInEmail: form.optInEmail,
        optInSms: form.optInSms,
        optOutGlobal: form.optOutGlobal,
        ...(showAvocatFields && {
          profilAvocat: {
            profession: form.profession || undefined,
            specialite: form.specialite || undefined,
            activiteDominante: form.activiteDominante || undefined,
            barreau: form.barreau || undefined,
            dateSerment: form.dateSerment || undefined,
          },
        }),
        ...(!showAvocatFields && showProSection && {
          profilPro: {
            profession: form.profession || undefined,
            specialite: form.specialite || undefined,
          },
        }),
        ...(showParticulierSection && {
          profilParticulier: {
            dateNaissance: form.dateNaissance || undefined,
            civilite: form.civilite || undefined,
            situationFamiliale: form.situationFamiliale || undefined,
          },
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

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setError({ message: data.error ?? "Doublon détecté.", conflicts: data.conflicts });
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError({ message: err.error ?? `Erreur ${res.status}` });
        return;
      }

      const pp = await res.json();
      const targetId = props.mode === "create" ? pp.id : props.ppId;
      router.push(`/personnes-physiques/${targetId}`);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelHref =
    props.mode === "create" ? "/personnes-physiques" : `/personnes-physiques/${props.ppId}`;

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-6">
      {/* Type de profil */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Type de profil</h3>
        <FormField label="Profil principal" required>
          <select
            className={selectCls}
            value={form.typeProfilPrincipal}
            onChange={patch("typeProfilPrincipal")}
          >
            {PROFIL_GROUPES.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {PROFIL_LABELS[opt]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FormField>
      </section>

      {/* Identité */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Identité</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nom" required>
            <input className={inputCls} value={form.nom} onChange={patch("nom")} placeholder="DUPONT" />
          </FormField>
          <FormField label="Prénom" required>
            <input className={inputCls} value={form.prenom} onChange={patch("prenom")} placeholder="Jean" />
          </FormField>
        </div>
      </section>

      {/* Coordonnées */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Coordonnées</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email" required>
            <input type="email" className={inputCls} value={form.email} onChange={patch("email")} placeholder="jean.dupont@cabinet.fr" />
          </FormField>
          <FormField label="Téléphone">
            <input className={inputCls} value={form.telephone} onChange={patch("telephone")} placeholder="01 23 45 67 89" />
          </FormField>
          <FormField label="Portable" className="col-span-2">
            <input className={inputCls} value={form.portable} onChange={patch("portable")} placeholder="06 12 34 56 78" />
          </FormField>
        </div>
      </section>

      {/* Profil professionnel — visible pour tous les profils pro */}
      {showProSection && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil professionnel</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Métier / Intitulé de poste">
              <input
                className={inputCls}
                value={form.profession}
                onChange={patch("profession")}
                placeholder="Ex : Ingénieur data, Directeur juridique…"
              />
            </FormField>
            <FormField label="Spécialisation">
              {showAvocatFields ? (
                <>
                  <input
                    list="specialites-avocat"
                    className={inputCls}
                    value={form.specialite}
                    onChange={patch("specialite")}
                    placeholder="Saisir ou sélectionner…"
                  />
                  <datalist id="specialites-avocat">
                    {SPECIALITES_AVOCAT.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </>
              ) : (
                <input
                  className={inputCls}
                  value={form.specialite}
                  onChange={patch("specialite")}
                  placeholder="Ex : Droit des affaires, Data engineering…"
                />
              )}
            </FormField>
            {/* Champs spécifiques avocats */}
            {showAvocatFields && (
              <>
                <FormField label="Activité dominante" className="col-span-2">
                  <input
                    list="activites-dominantes-avocat"
                    className={inputCls}
                    value={form.activiteDominante}
                    onChange={patch("activiteDominante")}
                    placeholder="Saisir ou sélectionner…"
                  />
                  <datalist id="activites-dominantes-avocat">
                    {ACTIVITES_DOMINANTES_AVOCAT.map((a) => <option key={a} value={a} />)}
                  </datalist>
                </FormField>
                <FormField label="Barreau">
                  <input className={inputCls} value={form.barreau} onChange={patch("barreau")} placeholder="Paris" />
                </FormField>
                <FormField label="Date de serment">
                  <input type="date" className={inputCls} value={form.dateSerment} onChange={patch("dateSerment")} />
                </FormField>
              </>
            )}
          </div>
        </section>
      )}

      {/* Profil Particulier — conditionnel */}
      {showParticulierSection && (
        <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil particulier</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Civilité">
              <select className={selectCls} value={form.civilite} onChange={patch("civilite")}>
                <option value="">—</option>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </FormField>
            <FormField label="Date de naissance">
              <input type="date" className={inputCls} value={form.dateNaissance} onChange={patch("dateNaissance")} />
            </FormField>
            <FormField label="Situation familiale" className="col-span-2">
              <select className={selectCls} value={form.situationFamiliale} onChange={patch("situationFamiliale")}>
                <option value="">—</option>
                <option value="Célibataire">Célibataire</option>
                <option value="Marié(e)">Marié(e)</option>
                <option value="Pacsé(e)">Pacsé(e)</option>
                <option value="Divorcé(e)">Divorcé(e)</option>
                <option value="Veuf / Veuve">Veuf / Veuve</option>
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
              <option value="CONTACT">Contact</option>
              <option value="CLIENT">Client</option>
              <option value="HYBRIDE">Hybride</option>
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 space-y-2">
          <p className="font-medium">{error.message}</p>
          {error.conflicts && error.conflicts.length > 0 && (
            <div className="space-y-1">
              {error.conflicts.map((pp) => (
                <div key={pp.id} className="flex items-center gap-2 text-xs">
                  <a
                    href={`/personnes-physiques/${pp.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline hover:text-red-800"
                  >
                    {pp.prenom} {pp.nom.toUpperCase()}
                  </a>
                  <span className="text-red-400">
                    {[pp.email, pp.portable].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
        >
          Annuler
        </button>
        <SubmitButton isLoading={isSubmitting} onClick={handleSubmit} disabled={!form.nom.trim() || !form.prenom.trim() || !form.email.trim()}>
          {props.mode === "create" ? "Créer la personne physique" : "Enregistrer les modifications"}
        </SubmitButton>
      </div>
    </div>
  );
}
