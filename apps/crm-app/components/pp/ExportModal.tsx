"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type {
  PersonnePhysiqueExportFields,
  PersonnePhysiqueExportRattachement,
} from "@/lib/server/modules/personnes-physiques/dto";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldConfig = PersonnePhysiqueExportFields;
type RattachementConfig = PersonnePhysiqueExportRattachement;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  params: URLSearchParams;
  total: number;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FIELDS: FieldConfig = {
  nom: true, prenom: true, email: true, emailProOnly: false, telephone: false, portable: false,
  profession: true, specialite: true, barreau: false, dateSerment: false, activiteDominante: false,
  typeRelation: true, statutRgpd: false, actif: false,
  optInEmail: false, optInSms: false, optOutGlobal: false, emailInvalide: false,
  totalEmails: false, dernierEmailLe: false,
  creerLe: false, modifierLe: false,
};

const DEFAULT_RATTACHEMENT: RattachementConfig = {
  include: false, scope: "actifs", mode: "colonne",
  raisonSociale: true, siretSirenPm: false, titreFonction: true,
  dateDebut: false, dateFin: false,
  emailPm: false, telephonePm: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportModal({ isOpen, onClose, params, total }: Props) {
  const [fields, setFields] = useState<FieldConfig>(DEFAULT_FIELDS);
  const [ratt, setRatt] = useState<RattachementConfig>(DEFAULT_RATTACHEMENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleField = (k: keyof FieldConfig) =>
    setFields((prev) => ({ ...prev, [k]: !prev[k] }));

  const toggleRatt = (k: keyof RattachementConfig) =>
    setRatt((prev) => ({
      ...prev,
      [k]: typeof prev[k] === "boolean" ? !prev[k] : prev[k],
    }));

  const hasFields = Object.values(fields).some(Boolean);

  const handleExport = async () => {
    if (!hasFields) return;
    setLoading(true);
    setError(null);
    try {
      // Forward only filter/search params (strip page/limit)
      const exportParams = new URLSearchParams();
      params.forEach((v, k) => {
        if (k !== "page" && k !== "limit") exportParams.append(k, v);
      });

      const res = await fetch(`/api/personnes-physiques/export?${exportParams.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, ratt }),
      });
      if (!res.ok) throw new Error("Erreur lors de la génération de l'export");

      // Fichier généré côté serveur : on déclenche le téléchargement du blob
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export-pp.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Exporter en Excel"
      subtitle={`${total.toLocaleString("fr-FR")} personne${total > 1 ? "s" : ""} correspondent aux filtres actuels`}
      size="lg"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!hasFields && (
            <p className="text-sm text-amber-600">Sélectionnez au moins un champ à exporter.</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || !hasFields}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {loading ? "Export en cours…" : `Exporter (${total.toLocaleString("fr-FR")} résultats)`}
            </button>
          </div>
        </div>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-6">
        {/* ── Identité ─────────────────────────────────────── */}
        <Section title="Identité">
          <CheckGrid>
            <Check label="Nom" checked={fields.nom} onChange={() => toggleField("nom")} />
            <Check label="Prénom" checked={fields.prenom} onChange={() => toggleField("prenom")} />
            <Check label="Email" checked={fields.email} onChange={() => toggleField("email")} />
            <Check label="Téléphone" checked={fields.telephone} onChange={() => toggleField("telephone")} />
            <Check label="Portable" checked={fields.portable} onChange={() => toggleField("portable")} />
          </CheckGrid>
          {fields.email && (
            <div className="ml-1 mt-0.5">
              <Check
                label="Emails pro uniquement — si plusieurs adresses, exclure @gmail, @orange…"
                checked={fields.emailProOnly}
                onChange={() => toggleField("emailProOnly")}
                subtle
              />
            </div>
          )}
        </Section>

        {/* ── Profil ───────────────────────────────────────── */}
        <Section title="Profil">
          <CheckGrid>
            <Check label="Profession" checked={fields.profession} onChange={() => toggleField("profession")} />
            <Check label="Spécialité" checked={fields.specialite} onChange={() => toggleField("specialite")} />
            <Check label="Barreau" checked={fields.barreau} onChange={() => toggleField("barreau")} />
            <Check label="Date de serment" checked={fields.dateSerment} onChange={() => toggleField("dateSerment")} />
            <Check label="Activité dominante" checked={fields.activiteDominante} onChange={() => toggleField("activiteDominante")} />
          </CheckGrid>
        </Section>

        {/* ── Relation CRM ─────────────────────────────────── */}
        <Section title="Relation CRM">
          <CheckGrid>
            <Check label="Type de relation" checked={fields.typeRelation} onChange={() => toggleField("typeRelation")} />
            <Check label="Statut RGPD" checked={fields.statutRgpd} onChange={() => toggleField("statutRgpd")} />
            <Check label="Actif" checked={fields.actif} onChange={() => toggleField("actif")} />
            <Check label="Opt-in email" checked={fields.optInEmail} onChange={() => toggleField("optInEmail")} />
            <Check label="Opt-in SMS" checked={fields.optInSms} onChange={() => toggleField("optInSms")} />
            <Check label="Opt-out global" checked={fields.optOutGlobal} onChange={() => toggleField("optOutGlobal")} />
            <Check label="Email invalide" checked={fields.emailInvalide} onChange={() => toggleField("emailInvalide")} />
          </CheckGrid>
        </Section>

        {/* ── Activité email ───────────────────────────────── */}
        <Section title="Activité email">
          <CheckGrid>
            <Check label="Total emails" checked={fields.totalEmails} onChange={() => toggleField("totalEmails")} />
            <Check label="Dernier email le" checked={fields.dernierEmailLe} onChange={() => toggleField("dernierEmailLe")} />
          </CheckGrid>
        </Section>

        {/* ── Métadonnées ──────────────────────────────────── */}
        <Section title="Métadonnées">
          <CheckGrid>
            <Check label="Créé le" checked={fields.creerLe} onChange={() => toggleField("creerLe")} />
            <Check label="Modifié le" checked={fields.modifierLe} onChange={() => toggleField("modifierLe")} />
          </CheckGrid>
        </Section>

        {/* ── Rattachements ────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
            <div>
              <div className="text-sm font-semibold text-zinc-800">Entreprises / Rattachements</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Une PP peut appartenir à plusieurs organisations (actives ou archivées)
              </div>
            </div>
            <Toggle checked={ratt.include} onChange={() => toggleRatt("include")} />
          </div>

          {ratt.include && (
            <div className="px-4 py-4 flex flex-col gap-4">
              {/* Périmètre */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Périmètre
                </span>
                <div className="flex gap-4">
                  <Radio
                    label="Actifs uniquement"
                    desc="Rattachements sans date de fin"
                    checked={ratt.scope === "actifs"}
                    onChange={() => setRatt((p) => ({ ...p, scope: "actifs" }))}
                  />
                  <Radio
                    label="Tous (actifs + archivés)"
                    desc="Historique complet"
                    checked={ratt.scope === "tous"}
                    onChange={() => setRatt((p) => ({ ...p, scope: "tous" }))}
                  />
                </div>
              </div>

              {/* Format */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Format
                </span>
                <div className="flex gap-4">
                  <Radio
                    label="Une ligne par personne"
                    desc="Colonnes « Entreprise 1 », « Entreprise 2 »…"
                    checked={ratt.mode === "colonne"}
                    onChange={() => setRatt((p) => ({ ...p, mode: "colonne" }))}
                  />
                  <Radio
                    label="Une ligne par rattachement"
                    desc="Les infos PP sont répétées sur chaque ligne"
                    checked={ratt.mode === "ligne"}
                    onChange={() => setRatt((p) => ({ ...p, mode: "ligne" }))}
                  />
                </div>
              </div>

              {/* Champs du rattachement */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Champs
                </span>
                <CheckGrid>
                  <Check label="Raison sociale" checked={ratt.raisonSociale} onChange={() => toggleRatt("raisonSociale")} />
                  <Check label="SIREN / SIRET" checked={ratt.siretSirenPm} onChange={() => toggleRatt("siretSirenPm")} />
                  <Check label="Poste / Titre" checked={ratt.titreFonction} onChange={() => toggleRatt("titreFonction")} />
                  <Check label="Date de début" checked={ratt.dateDebut} onChange={() => toggleRatt("dateDebut")} />
                  <Check label="Date de fin" checked={ratt.dateFin} onChange={() => toggleRatt("dateFin")} />
                  <Check label="Email entreprise" checked={ratt.emailPm} onChange={() => toggleRatt("emailPm")} />
                  <Check label="Tél. entreprise" checked={ratt.telephonePm} onChange={() => toggleRatt("telephonePm")} />
                </CheckGrid>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</span>
      {children}
    </div>
  );
}

function CheckGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>;
}

function Check({
  label,
  checked,
  onChange,
  subtle = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  subtle?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-zinc-300 text-primary-500 accent-primary-500 cursor-pointer shrink-0"
      />
      <span
        className={cn(
          "transition-colors",
          subtle ? "text-xs" : "text-sm",
          checked ? "text-zinc-700" : "text-zinc-400 group-hover:text-zinc-600",
        )}
      >
        {label}
      </span>
    </label>
  );
}

function Radio({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex-1 flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
        checked
          ? "border-primary-400 bg-primary-50"
          : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-primary-500 cursor-pointer shrink-0"
      />
      <div>
        <div className={cn("text-sm font-medium", checked ? "text-primary-700" : "text-zinc-700")}>
          {label}
        </div>
        <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
      </div>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none shrink-0",
        checked ? "bg-primary-500" : "bg-zinc-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
