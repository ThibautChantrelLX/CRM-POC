"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { SireneSearch } from "@/components/pm/SireneSearch";
import type { TypeRelationPm } from "@/lib/server/modules/personnes-morales/dto";
import type { SireneResult } from "@/app/api/sirene/route";
import { TYPE_RELATION_PM_OPTIONS } from "@/lib/server/modules/personnes-morales/constants";
import { PP_ATTACH_PM_STORAGE_KEY, type PmAttachInfo } from "@/lib/client/personnes-morales";

type FormState = {
  raisonSociale: string;
  siretSiren: string;
  typeStructure: string;
  email: string;
  telephone: string;
  siteWeb: string;
  nomDomaine: string;
  typeRelation: TypeRelationPm | "";
  actif: boolean;
  secteurActivite: string;
  categorieEntreprise: string;
  rue: string;
  complementAdresse: string;
  codePostal: string;
  ville: string;
  pays: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  raisonSociale: "",
  siretSiren: "",
  typeStructure: "",
  email: "",
  telephone: "",
  siteWeb: "",
  nomDomaine: "",
  typeRelation: "",
  actif: true,
  secteurActivite: "",
  categorieEntreprise: "",
  rue: "",
  complementAdresse: "",
  codePostal: "",
  ville: "",
  pays: "France",
};

export function PmCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = searchParams.get("returnTo");
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    raisonSociale: searchParams.get("raisonSociale") ?? EMPTY.raisonSociale,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

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

  const handleSireneSelect = (result: SireneResult) => {
    setForm((prev) => ({
      ...prev,
      raisonSociale: result.raisonSociale,
      siretSiren: result.siret,
      secteurActivite: result.secteurActivite ?? prev.secteurActivite,
      categorieEntreprise: result.categorieEntreprise ?? prev.categorieEntreprise,
      rue: result.adresse.rue ?? prev.rue,
      codePostal: result.adresse.codePostal ?? prev.codePostal,
      ville: result.adresse.ville ?? prev.ville,
      pays: "France",
    }));
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};
    if (!form.raisonSociale.trim()) errors.raisonSociale = "La raison sociale est requise";
    if (!form.typeRelation) errors.typeRelation = "Le type de relation est requis";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const adresse = {
        rue: form.rue || undefined,
        complementAdresse: form.complementAdresse || undefined,
        codePostal: form.codePostal || undefined,
        ville: form.ville || undefined,
        pays: form.pays || undefined,
      };
      const hasAdresse = Object.values(adresse).some(Boolean);

      const res = await fetch("/api/personnes-morales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raisonSociale: form.raisonSociale.trim(),
          siretSiren: form.siretSiren || undefined,
          typeStructure: form.typeStructure || undefined,
          email: form.email || undefined,
          telephone: form.telephone || undefined,
          siteWeb: form.siteWeb || undefined,
          nomDomaine: form.nomDomaine || undefined,
          typeRelation: (form.typeRelation as TypeRelationPm) || undefined,
          actif: form.actif,
          secteurActivite: form.secteurActivite || undefined,
          categorieEntreprise: form.categorieEntreprise || undefined,
          ...(hasAdresse ? { adresse } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      const pm = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["personnes-morales"] });

      if (returnTo === "pp-create") {
        const attached: PmAttachInfo = {
          id: pm.id,
          raisonSociale: pm.raisonSociale,
          siretSiren: pm.siretSiren ?? null,
          typeStructure: pm.typeStructure ?? null,
          nomDomaine: pm.nomDomaine ?? null,
        };
        try {
          sessionStorage.setItem(PP_ATTACH_PM_STORAGE_KEY, JSON.stringify(attached));
        } catch {}
        router.push("/personnes-physiques/nouveau");
        return;
      }

      router.push(`/personnes-morales/${pm.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-6">
      {/* SIRENE */}
      <SireneSearch onSelect={handleSireneSelect} />

      {/* Identité */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Identité</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Raison sociale" required className="col-span-2" error={formErrors.raisonSociale}>
            <input className={inputCls} value={form.raisonSociale} onChange={patch("raisonSociale")} placeholder="Cabinet DUPONT & ASSOCIÉS" />
          </FormField>
          <FormField label="SIRET / SIREN">
            <input className={inputCls} value={form.siretSiren} onChange={patch("siretSiren")} placeholder="14 ou 9 chiffres" />
          </FormField>
          <FormField label="Type de structure">
            <input className={inputCls} value={form.typeStructure} onChange={patch("typeStructure")} placeholder="Cabinet d'Avocats" />
          </FormField>
        </div>
      </section>

      {/* Coordonnées */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Coordonnées</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={patch("email")} placeholder="contact@cabinet.fr" />
          </FormField>
          <FormField label="Téléphone">
            <input className={inputCls} value={form.telephone} onChange={patch("telephone")} placeholder="01 23 45 67 89" />
          </FormField>
          <FormField label="Site web">
            <input className={inputCls} value={form.siteWeb} onChange={patch("siteWeb")} placeholder="https://www.cabinet.fr" />
          </FormField>
          <FormField label="Nom de domaine">
            <input className={inputCls} value={form.nomDomaine} onChange={patch("nomDomaine")} placeholder="cabinet.fr" />
          </FormField>
        </div>
      </section>

      {/* Activité & Statut */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Activité & Statut</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type de relation" required error={formErrors.typeRelation}>
            <select className={selectCls} value={form.typeRelation} onChange={patch("typeRelation")}>
              <option value="">— Sélectionner —</option>
              {TYPE_RELATION_PM_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Statut">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.actif} onChange={patch("actif")} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-700">Actif</span>
            </label>
          </FormField>
          <FormField label="Secteur d'activité" className="col-span-2">
            <input className={inputCls} value={form.secteurActivite} onChange={patch("secteurActivite")} />
          </FormField>
          <FormField label="Catégorie entreprise" className="col-span-2">
            <input className={inputCls} value={form.categorieEntreprise} onChange={patch("categorieEntreprise")} />
          </FormField>
        </div>
      </section>

      {/* Adresse */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Adresse</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rue" className="col-span-2">
            <input className={inputCls} value={form.rue} onChange={patch("rue")} placeholder="15 rue de la Paix" />
          </FormField>
          <FormField label="Complément" className="col-span-2">
            <input className={inputCls} value={form.complementAdresse} onChange={patch("complementAdresse")} />
          </FormField>
          <FormField label="Code postal">
            <input className={inputCls} value={form.codePostal} onChange={patch("codePostal")} placeholder="75001" />
          </FormField>
          <FormField label="Ville">
            <input className={inputCls} value={form.ville} onChange={patch("ville")} placeholder="Paris" />
          </FormField>
          <FormField label="Pays" className="col-span-2">
            <input className={inputCls} value={form.pays} onChange={patch("pays")} placeholder="France" />
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
          onClick={() => router.push(returnTo === "pp-create" ? "/personnes-physiques/nouveau" : "/personnes-morales")}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
        >
          Annuler
        </button>
        <SubmitButton isLoading={isSubmitting} onClick={handleSubmit}>
          Créer la structure
        </SubmitButton>
      </div>
    </div>
  );
}
