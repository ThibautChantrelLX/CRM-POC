"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { PersonnePhysiqueExportItem } from "@/lib/server/modules/personnes-physiques/dto";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldConfig = {
  nom: boolean; prenom: boolean; email: boolean; telephone: boolean; portable: boolean;
  profession: boolean; specialite: boolean; barreau: boolean; dateSerment: boolean; activiteDominante: boolean;
  typeRelation: boolean; statutRgpd: boolean; actif: boolean;
  optInEmail: boolean; optInSms: boolean; optOutGlobal: boolean; emailInvalide: boolean;
  totalEmails: boolean; dernierEmailLe: boolean;
  creerLe: boolean; modifierLe: boolean;
};

type RattachementConfig = {
  include: boolean;
  scope: "actifs" | "tous";
  mode: "colonne" | "ligne";
  raisonSociale: boolean; siretSirenPm: boolean; titreFonction: boolean;
  dateDebut: boolean; dateFin: boolean;
  emailPm: boolean; telephonePm: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  params: URLSearchParams;
  total: number;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FIELDS: FieldConfig = {
  nom: true, prenom: true, email: true, telephone: false, portable: false,
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

// ─── Labels ───────────────────────────────────────────────────────────────────

const TYPE_RELATION_LABELS: Record<string, string> = {
  CONTACT: "Contact", CLIENT: "Client", HYBRIDE: "Hybride", PROSPECT: "Prospect",
};
const STATUT_RGPD_LABELS: Record<string, string> = {
  OPT_IN: "Opt-in", OPT_OUT: "Opt-out", NON_RENSEIGNE: "Non renseigné",
};

// ─── XLSX builder ─────────────────────────────────────────────────────────────

type Cell = string | number | null;
type Row = Cell[];

function buildXlsx(
  items: PersonnePhysiqueExportItem[],
  fields: FieldConfig,
  ratt: RattachementConfig,
): { headers: string[]; rows: Row[] } {
  const headers: string[] = [];

  if (fields.nom) headers.push("Nom");
  if (fields.prenom) headers.push("Prénom");
  if (fields.email) headers.push("Email");
  if (fields.telephone) headers.push("Téléphone");
  if (fields.portable) headers.push("Portable");
  if (fields.profession) headers.push("Profession");
  if (fields.specialite) headers.push("Spécialité");
  if (fields.barreau) headers.push("Barreau");
  if (fields.dateSerment) headers.push("Date de serment");
  if (fields.activiteDominante) headers.push("Activité dominante");
  if (fields.typeRelation) headers.push("Type de relation");
  if (fields.statutRgpd) headers.push("Statut RGPD");
  if (fields.actif) headers.push("Actif");
  if (fields.optInEmail) headers.push("Opt-in email");
  if (fields.optInSms) headers.push("Opt-in SMS");
  if (fields.optOutGlobal) headers.push("Opt-out global");
  if (fields.emailInvalide) headers.push("Email invalide");
  if (fields.totalEmails) headers.push("Total emails");
  if (fields.dernierEmailLe) headers.push("Dernier email le");
  if (fields.creerLe) headers.push("Créé le");
  if (fields.modifierLe) headers.push("Modifié le");

  const baseRow = (pp: PersonnePhysiqueExportItem): Row => {
    const row: Row = [];
    if (fields.nom) row.push(pp.nom);
    if (fields.prenom) row.push(pp.prenom ?? "");
    if (fields.email) row.push(pp.email ?? "");
    if (fields.telephone) row.push(pp.telephone ?? "");
    if (fields.portable) row.push(pp.portable ?? "");
    if (fields.profession) row.push(pp.profession ?? "");
    if (fields.specialite) row.push(pp.specialite ?? "");
    if (fields.barreau) row.push(pp.barreau ?? "");
    if (fields.dateSerment) row.push(pp.dateSerment ?? "");
    if (fields.activiteDominante) row.push(pp.activiteDominante ?? "");
    if (fields.typeRelation) row.push(TYPE_RELATION_LABELS[pp.typeRelation] ?? pp.typeRelation);
    if (fields.statutRgpd)
      row.push(pp.statutRgpd ? (STATUT_RGPD_LABELS[pp.statutRgpd] ?? pp.statutRgpd) : "");
    if (fields.actif) row.push(pp.actif ? "Oui" : "Non");
    if (fields.optInEmail) row.push(pp.optInEmail ? "Oui" : "Non");
    if (fields.optInSms) row.push(pp.optInSms ? "Oui" : "Non");
    if (fields.optOutGlobal) row.push(pp.optOutGlobal ? "Oui" : "Non");
    if (fields.emailInvalide) row.push(pp.emailInvalide ? "Oui" : "Non");
    if (fields.totalEmails) row.push(pp.totalEmails ?? "");
    if (fields.dernierEmailLe) row.push(pp.dernierEmailLe ?? "");
    if (fields.creerLe) row.push(pp.creerLe);
    if (fields.modifierLe) row.push(pp.modifierLe);
    return row;
  };

  const rattHeaders = (prefix = ""): string[] => {
    const h: string[] = [];
    if (ratt.raisonSociale) h.push(`${prefix}Entreprise`);
    if (ratt.siretSirenPm) h.push(`${prefix}SIREN / SIRET`);
    if (ratt.titreFonction) h.push(`${prefix}Poste / Titre`);
    if (ratt.dateDebut) h.push(`${prefix}Depuis`);
    if (ratt.dateFin) h.push(`${prefix}Jusqu'au`);
    if (ratt.emailPm) h.push(`${prefix}Email entreprise`);
    if (ratt.telephonePm) h.push(`${prefix}Tél. entreprise`);
    return h;
  };

  const rattRow = (r: PersonnePhysiqueExportItem["rattachements"][0]): Row => {
    const row: Row = [];
    if (ratt.raisonSociale) row.push(r.raisonSociale);
    if (ratt.siretSirenPm) row.push(r.siretSirenPm ?? "");
    if (ratt.titreFonction) row.push(r.titreFonction ?? "");
    if (ratt.dateDebut) row.push(r.dateDebut ?? "");
    if (ratt.dateFin) row.push(r.dateFin ?? "En cours");
    if (ratt.emailPm) row.push(r.emailPm ?? "");
    if (ratt.telephonePm) row.push(r.telephonePm ?? "");
    return row;
  };

  const filterRatts = (pp: PersonnePhysiqueExportItem) =>
    ratt.scope === "actifs" ? pp.rattachements.filter((r) => !r.dateFin) : pp.rattachements;

  if (!ratt.include) {
    return { headers, rows: items.map(baseRow) };
  }

  if (ratt.mode === "ligne") {
    headers.push(...rattHeaders());
    const emptyRatt: Row = rattHeaders().map(() => "");
    const rows: Row[] = [];
    for (const pp of items) {
      const ratts = filterRatts(pp);
      if (ratts.length === 0) {
        rows.push([...baseRow(pp), ...emptyRatt]);
      } else {
        for (const r of ratts) {
          rows.push([...baseRow(pp), ...rattRow(r)]);
        }
      }
    }
    return { headers, rows };
  }

  // mode "colonne" : une ligne par PP, colonnes numérotées
  const maxRatts = items.reduce((m, pp) => Math.max(m, filterRatts(pp).length), 0);
  for (let i = 1; i <= maxRatts; i++) {
    headers.push(...rattHeaders(`Entreprise ${i} — `));
  }
  const emptySlot: Row = rattHeaders().map(() => "");
  const rows = items.map((pp) => {
    const ratts = filterRatts(pp);
    const cols: Row = [];
    for (let i = 0; i < maxRatts; i++) {
      cols.push(...(i < ratts.length ? rattRow(ratts[i]) : emptySlot));
    }
    return [...baseRow(pp), ...cols];
  });
  return { headers, rows };
}

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

      const res = await fetch(`/api/personnes-physiques/export?${exportParams.toString()}`);
      if (!res.ok) throw new Error("Erreur lors de la récupération des données");
      const data: PersonnePhysiqueExportItem[] = await res.json();

      const { headers, rows } = buildXlsx(data, fields, ratt);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Personnes Physiques");
      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `export-pp-${date}.xlsx`);
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
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-zinc-300 text-primary-500 accent-primary-500 cursor-pointer"
      />
      <span className={cn("text-sm transition-colors", checked ? "text-zinc-800" : "text-zinc-400 group-hover:text-zinc-600")}>
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
