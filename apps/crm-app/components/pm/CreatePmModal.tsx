"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, UserPlus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { SireneSearch } from "@/components/pm/SireneSearch";
import type { TypeRelationPm } from "@/lib/server/modules/personnes-morales/dto";
import type { SireneResult } from "@/app/api/sirene/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type PmFormState = {
  raisonSociale: string;
  siretSiren: string;
  typeStructure: string;
  email: string;
  telephone: string;
  siteWeb: string;
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

type PpResult = {
  id: number;
  nom: string;
  prenom: string | null;
  profession: string | null;
};

type PendingRattachement = {
  pp: PpResult;
  titreFonction: string;
  dateDebut: string;
};

const EMPTY_FORM: PmFormState = {
  raisonSociale: "",
  siretSiren: "",
  typeStructure: "Cabinet d'Avocats",
  email: "",
  telephone: "",
  siteWeb: "",
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

// ─── Step 1 — Formulaire PM ───────────────────────────────────────────────────

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
      onChange({ [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

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

      {/* Identité */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Raison sociale" required className="col-span-2">
          <input
            className={inputCls}
            value={form.raisonSociale}
            onChange={field("raisonSociale")}
            placeholder="Cabinet DUPONT & ASSOCIÉS"
          />
        </FormField>
        <FormField label="SIRET / SIREN">
          <input
            className={inputCls}
            value={form.siretSiren}
            onChange={field("siretSiren")}
            placeholder="14 ou 9 chiffres"
          />
        </FormField>
        <FormField label="Type de structure">
          <input
            className={inputCls}
            value={form.typeStructure}
            onChange={field("typeStructure")}
            placeholder="Cabinet d'Avocats"
          />
        </FormField>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email">
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={field("email")}
            placeholder="contact@cabinet.fr"
          />
        </FormField>
        <FormField label="Téléphone">
          <input
            className={inputCls}
            value={form.telephone}
            onChange={field("telephone")}
            placeholder="01 23 45 67 89"
          />
        </FormField>
        <FormField label="Site web" className="col-span-2">
          <input
            className={inputCls}
            value={form.siteWeb}
            onChange={field("siteWeb")}
            placeholder="https://www.cabinet.fr"
          />
        </FormField>
      </div>

      {/* Relation & Statut */}
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
            <input
              type="checkbox"
              checked={form.actif}
              onChange={field("actif")}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">Actif</span>
          </label>
        </FormField>
      </div>

      {/* Adresse */}
      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Adresse</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rue" className="col-span-2">
            <input
              className={inputCls}
              value={form.rue}
              onChange={field("rue")}
              placeholder="15 rue de la Paix"
            />
          </FormField>
          <FormField label="Code postal">
            <input
              className={inputCls}
              value={form.codePostal}
              onChange={field("codePostal")}
              placeholder="75001"
            />
          </FormField>
          <FormField label="Ville">
            <input
              className={inputCls}
              value={form.ville}
              onChange={field("ville")}
              placeholder="Paris"
            />
          </FormField>
          <FormField label="Pays" className="col-span-2">
            <input
              className={inputCls}
              value={form.pays}
              onChange={field("pays")}
              placeholder="France"
            />
          </FormField>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pb-2">
        <SubmitButton
          isLoading={isSubmitting}
          onClick={onSubmit}
          disabled={!form.raisonSociale.trim()}
        >
          Créer la structure →
        </SubmitButton>
      </div>
    </div>
  );
}

// ─── Step 2 — Rattachements ───────────────────────────────────────────────────

function StepRattachements({
  pmId,
  pmNom,
  onDone,
}: {
  pmId: number;
  pmNom: string;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [ppResults, setPpResults] = useState<PpResult[]>([]);
  const [selectedPp, setSelectedPp] = useState<PpResult | null>(null);
  const [titreFonction, setTitreFonction] = useState("");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split("T")[0]);
  const [rattachements, setRattachements] = useState<PendingRattachement[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRattaching, setIsRattaching] = useState(false);
  const [errorRatt, setErrorRatt] = useState<string | null>(null);

  const searchPp = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPpResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/personnes-physiques?search=${encodeURIComponent(q)}&limit=10`,
      );
      const data = await res.json();
      setPpResults(data.data ?? []);
    } catch {
      setPpResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    searchPp(e.target.value);
  };

  const handleRattacher = async () => {
    if (!selectedPp) return;
    setIsRattaching(true);
    setErrorRatt(null);
    try {
      const res = await fetch("/api/rattachements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnePhysiqueId: selectedPp.id,
          personneMoraleId: pmId,
          titreFonction: titreFonction || null,
          dateDebut,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erreur lors du rattachement");
      }
      setRattachements((prev) => [...prev, { pp: selectedPp, titreFonction, dateDebut }]);
      setSelectedPp(null);
      setTitreFonction("");
      setSearch("");
      setPpResults([]);
    } catch (e) {
      setErrorRatt(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsRattaching(false);
    }
  };

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Confirmation création */}
      <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2.5 text-sm">
        <CheckCircle size={15} className="shrink-0" />
        <span>
          Structure créée : <span className="font-semibold">{pmNom}</span>
        </span>
      </div>

      {/* Recherche PP */}
      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Rattacher une personne physique
        </p>
        <div className="relative">
          <input
            className={inputCls}
            value={search}
            onChange={handleSearchChange}
            placeholder="Rechercher par nom…"
            disabled={!!selectedPp}
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300">
              …
            </span>
          )}
        </div>

        {ppResults.length > 0 && !selectedPp && (
          <div className="mt-1 border border-zinc-100 rounded-lg shadow-sm overflow-hidden bg-white">
            {ppResults.map((pp) => (
              <button
                key={pp.id}
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 transition border-b last:border-b-0 border-zinc-50"
                onClick={() => {
                  setSelectedPp(pp);
                  setSearch(`${pp.prenom ?? ""} ${pp.nom}`.trim());
                  setPpResults([]);
                }}
              >
                <span className="font-medium text-sm text-zinc-800">
                  {pp.prenom} {pp.nom}
                </span>
                {pp.profession && (
                  <span className="text-xs text-zinc-400 ml-2">{pp.profession}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire rattachement */}
      {selectedPp && (
        <div className="border border-zinc-100 rounded-xl p-4 space-y-3 bg-zinc-50">
          <p className="text-sm font-medium text-zinc-700">
            {selectedPp.prenom} {selectedPp.nom}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Titre / Fonction">
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
          {errorRatt && <p className="text-xs text-red-500">{errorRatt}</p>}
          <div className="flex gap-2">
            <SubmitButton isLoading={isRattaching} onClick={handleRattacher}>
              <UserPlus size={14} />
              Rattacher
            </SubmitButton>
            <SubmitButton
              variant="secondary"
              onClick={() => {
                setSelectedPp(null);
                setSearch("");
              }}
            >
              Annuler
            </SubmitButton>
          </div>
        </div>
      )}

      {/* Liste des rattachements ajoutés */}
      {rattachements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Rattachements ajoutés ({rattachements.length})
          </p>
          {rattachements.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white border border-zinc-100 rounded-lg px-3 py-2 text-sm"
            >
              <div className="truncate">
                <span className="font-medium text-zinc-800">
                  {r.pp.prenom} {r.pp.nom}
                </span>
                {r.titreFonction && (
                  <span className="text-zinc-400 ml-2">— {r.titreFonction}</span>
                )}
                <span className="text-zinc-300 ml-2 text-xs">
                  depuis {new Date(r.dateDebut).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <button
                type="button"
                className="ml-2 shrink-0 text-zinc-300 hover:text-red-400 transition cursor-pointer"
                onClick={() => setRattachements((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pb-2">
        <SubmitButton onClick={onDone}>Terminer →</SubmitButton>
      </div>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreatePmModal({ open, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<PmFormState>(EMPTY_FORM);
  const [createdPm, setCreatedPm] = useState<{ id: number; raisonSociale: string } | null>(null);
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
          <StepRattachements pmId={createdPm.id} pmNom={createdPm.raisonSociale} onDone={handleDone} />
        )
      )}
    </Modal>
  );
}
