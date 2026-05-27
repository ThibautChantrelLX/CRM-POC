"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import type { TypeRelationPp, StatutRgpd, PersonnePhysiqueDetail } from "@/lib/server/modules/personnes-physiques/dto";

type FormState = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  portable: string;
  profession: string;
  specialite: string;
  barreau: string;
  typeRelation: TypeRelationPp;
  statutRgpd: StatutRgpd | "";
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
};

const EMPTY: FormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  portable: "",
  profession: "",
  specialite: "",
  barreau: "",
  typeRelation: "CONTACT",
  statutRgpd: "",
  actif: true,
  optInEmail: false,
  optInSms: false,
  optOutGlobal: false,
};

function fromDetail(pp: PersonnePhysiqueDetail): FormState {
  return {
    nom: pp.nom,
    prenom: pp.prenom ?? "",
    email: pp.email ?? "",
    telephone: pp.telephone ?? "",
    portable: pp.portable ?? "",
    profession: pp.profession ?? "",
    specialite: pp.specialite ?? "",
    barreau: pp.barreau ?? "",
    typeRelation: pp.typeRelation,
    statutRgpd: pp.statutRgpd ?? "",
    actif: pp.actif,
    optInEmail: pp.optInEmail,
    optInSms: pp.optInSms,
    optOutGlobal: pp.optOutGlobal,
  };
}

type Props =
  | { mode: "create" }
  | { mode: "edit"; initialData: PersonnePhysiqueDetail; ppId: string };

export function PpForm(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    props.mode === "edit" ? fromDetail(props.initialData) : EMPTY,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setIsSubmitting(true);
    setError(null);
    try {
      const body = {
        nom: form.nom.trim(),
        prenom: form.prenom || undefined,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        portable: form.portable || undefined,
        profession: form.profession || undefined,
        specialite: form.specialite || undefined,
        barreau: form.barreau || undefined,
        typeRelation: form.typeRelation,
        statutRgpd: (form.statutRgpd as StatutRgpd) || undefined,
        actif: form.actif,
        optInEmail: form.optInEmail,
        optInSms: form.optInSms,
        optOutGlobal: form.optOutGlobal,
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
      {/* Identité */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Identité</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nom" required>
            <input className={inputCls} value={form.nom} onChange={patch("nom")} placeholder="DUPONT" />
          </FormField>
          <FormField label="Prénom">
            <input className={inputCls} value={form.prenom} onChange={patch("prenom")} placeholder="Jean" />
          </FormField>
        </div>
      </section>

      {/* Coordonnées */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Coordonnées</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email">
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

      {/* Profession & Barreau */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profession & Barreau</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Profession">
            <input className={inputCls} value={form.profession} onChange={patch("profession")} placeholder="Avocat" />
          </FormField>
          <FormField label="Spécialité">
            <input className={inputCls} value={form.specialite} onChange={patch("specialite")} placeholder="Droit des affaires" />
          </FormField>
          <FormField label="Barreau" className="col-span-2">
            <input className={inputCls} value={form.barreau} onChange={patch("barreau")} placeholder="Paris" />
          </FormField>
        </div>
      </section>

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
        <SubmitButton isLoading={isSubmitting} onClick={handleSubmit} disabled={!form.nom.trim()}>
          {props.mode === "create" ? "Créer la personne physique" : "Enregistrer les modifications"}
        </SubmitButton>
      </div>
    </div>
  );
}
