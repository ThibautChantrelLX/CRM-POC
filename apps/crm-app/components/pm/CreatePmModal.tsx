"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { SireneSearch } from "@/components/pm/SireneSearch";
import { StepRattachements } from "@/components/pm/StepRattachements";
import type { TypeRelationPm } from "@/lib/server/modules/personnes-morales/dto";
import type { SireneResult } from "@/app/api/sirene/route";

// ─── Form state ───────────────────────────────────────────────────────────────

type PmFormState = {
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

const EMPTY_FORM: PmFormState = {
  raisonSociale: "",
  siretSiren: "",
  typeStructure: "Cabinet d'Avocats",
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

// ─── Step 1 — PM form ────────────────────────────────────────────────────────

function StepPmForm({
  form,
  onChange,
  onSubmit,
  isSubmitting,
  error,
}: {
  form: PmFormState;
  onChange: (patch: Partial<PmFormState>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const field =
    (key: keyof PmFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({
        [key]:
          e.target.type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      });

  const handleSireneSelect = (result: SireneResult) => {
    onChange({
      raisonSociale: result.raisonSociale,
      siretSiren: result.siret,
      secteurActivite: result.secteurActivite ?? "",
      categorieEntreprise: result.categorieEntreprise ?? "",
      rue: result.adresse.rue ?? "",
      codePostal: result.adresse.codePostal ?? "",
      ville: result.adresse.ville ?? "",
      pays: "France",
    });
  };

  return (
    <div className="px-6 py-5 space-y-6">
      <SireneSearch onSelect={handleSireneSelect} />

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Raison sociale" required className="col-span-2">
          <input className={inputCls} value={form.raisonSociale} onChange={field("raisonSociale")} placeholder="Cabinet DUPONT & ASSOCIÉS" />
        </FormField>
        <FormField label="SIRET / SIREN">
          <input className={inputCls} value={form.siretSiren} onChange={field("siretSiren")} placeholder="14 ou 9 chiffres" />
        </FormField>
        <FormField label="Type de structure">
          <input className={inputCls} value={form.typeStructure} onChange={field("typeStructure")} placeholder="Cabinet d'Avocats" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email">
          <input type="email" className={inputCls} value={form.email} onChange={field("email")} placeholder="contact@cabinet.fr" />
        </FormField>
        <FormField label="Téléphone">
          <input className={inputCls} value={form.telephone} onChange={field("telephone")} placeholder="01 23 45 67 89" />
        </FormField>
        <FormField label="Site web">
          <input className={inputCls} value={form.siteWeb} onChange={field("siteWeb")} placeholder="https://www.cabinet.fr" />
        </FormField>
        <FormField label="Nom de domaine">
          <input className={inputCls} value={form.nomDomaine} onChange={field("nomDomaine")} placeholder="cabinet.fr" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Type de relation">
          <select className={selectCls} value={form.typeRelation} onChange={field("typeRelation")}>
            <option value="">— Aucun —</option>
            <option value="CABINET_POSTULATION">Cabinet postulation</option>
            <option value="CLIENT_DIRECT">Client direct</option>
            <option value="HYBRIDE">Hybride</option>
          </select>
        </FormField>
        <FormField label="Statut">
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={form.actif} onChange={field("actif")} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm text-zinc-700">Actif</span>
          </label>
        </FormField>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Adresse</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rue" className="col-span-2">
            <input className={inputCls} value={form.rue} onChange={field("rue")} placeholder="15 rue de la Paix" />
          </FormField>
          <FormField label="Code postal">
            <input className={inputCls} value={form.codePostal} onChange={field("codePostal")} placeholder="75001" />
          </FormField>
          <FormField label="Ville">
            <input className={inputCls} value={form.ville} onChange={field("ville")} placeholder="Paris" />
          </FormField>
          <FormField label="Pays" className="col-span-2">
            <input className={inputCls} value={form.pays} onChange={field("pays")} placeholder="France" />
          </FormField>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pb-2">
        <SubmitButton isLoading={isSubmitting} onClick={onSubmit} disabled={!form.raisonSociale.trim()}>
          Créer la structure →
        </SubmitButton>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreatePmModal({ open, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<PmFormState>(EMPTY_FORM);
  const [createdPm, setCreatedPm] = useState<{ id: string; raisonSociale: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setForm(EMPTY_FORM);
      setCreatedPm(null);
      setError(null);
    }, 200);
  };

  const handleCreatePm = async () => {
    if (!form.raisonSociale.trim()) return;
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
      setCreatedPm({ id: pm.id, raisonSociale: pm.raisonSociale });
      await queryClient.invalidateQueries({ queryKey: ["personnes-morales"] });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    if (createdPm) router.push(`/personnes-morales/${createdPm.id}`);
    resetAndClose();
  };

  return (
    <Modal
      open={open}
      onClose={step === 1 ? resetAndClose : () => {}}
      title={step === 1 ? "Nouvelle personne morale" : "Rattachements"}
      subtitle={
        step === 1
          ? "Étape 1 / 2 — Informations de la structure"
          : "Étape 2 / 2 — Contacts rattachés (optionnel)"
      }
      size="lg"
    >
      {step === 1 ? (
        <StepPmForm
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={handleCreatePm}
          isSubmitting={isSubmitting}
          error={error}
        />
      ) : (
        createdPm && (
          <StepRattachements
            pmId={createdPm.id}
            pmNom={createdPm.raisonSociale}
            pmNomDomaine={form.nomDomaine || null}
            onDone={handleDone}
            showCreatedBanner={true}
          />
        )
      )}
    </Modal>
  );
}
