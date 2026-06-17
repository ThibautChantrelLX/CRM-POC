"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Pencil, Check, ChevronDown, AlertCircle, Loader2, GraduationCap } from "lucide-react";
import type { CreateFormationInput } from "@/lib/server/modules/formations/dto";

// ─── Datetime helpers ─────────────────────────────────────────────────────────

// Convertit un serial Excel (nombre de jours depuis le 30/12/1899) en "YYYY-MM-DD" UTC.
// On évite cellDates:true qui applique une conversion timezone source d'erreurs.
function excelSerialToDateStr(serial: unknown): string | null {
  if (typeof serial !== "number" || isNaN(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().split("T")[0];
}

// Gère le champ heure : string "09:00", Date (cellDates), ou fraction décimale.
function parseTime(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
  }
  if (v instanceof Date) {
    const h = v.getUTCHours();
    const min = v.getUTCMinutes();
    return h === 0 && min === 0 ? null : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 0 && v < 1) {
    const total = Math.round(v * 1440);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  return null;
}

function buildDatetime(dateSerial: unknown, timeVal: unknown): string | null {
  const dateStr = excelSerialToDateStr(dateSerial);
  if (!dateStr) return null;
  const timeStr = parseTime(timeVal);
  return timeStr ? `${dateStr}T${timeStr}:00.000Z` : `${dateStr}T00:00:00.000Z`;
}

function splitDatetime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = d.toISOString().split("T")[0];
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const time = h === 0 && min === 0 ? "" : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return { date, time };
}

function joinDatetime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00.000Z` : `${date}T00:00:00.000Z`;
}

export function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  if (h === 0 && min === 0) return datePart;
  return `${datePart} · ${String(h).padStart(2, "0")}h${String(min).padStart(2, "0")}`;
}

// ─── Excel → DTO ──────────────────────────────────────────────────────────────

function parseStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseIntVal(v: unknown): number | null {
  const n = parseNum(v);
  return n !== null ? Math.round(n) : null;
}

type RawRow = Record<string, unknown>;

function rowToFormation(row: RawRow): CreateFormationInput | null {
  const numero = parseStr(row["Numéro"]);
  const intitule = parseStr(row["Intitulé"]);
  if (!numero || !intitule) return null;

  return {
    numero,
    idDendreo: parseIntVal(row["ID Dendreo"]),
    intitule,
    intituleCourt: parseStr(row["Intitulé court"]),
    dateDebut: buildDatetime(row["Début"], row["Heure début"]),
    dateFin: buildDatetime(row["Fin"], row["Heure fin"]),
    dureeHeures: parseNum(row["Durée (h)"]),
    dureeJours: parseNum(row["Durée (j)"]),
    lieu: parseStr(row["Lieux"]),
    modeOrganisation: parseStr(row["Mode d'organisation"]),
    categorie: parseStr(row["Catégorie principale"]),
    nature: parseStr(row["Nature de la formation"]),
    avancement: parseStr(row["Avancement"]),
    responsable: parseStr(row["Responsable"]),
    formateurs: parseStr(row["Formateurs"]),
    nbInscrits: parseIntVal(row["Participants inscrits"]),
    nbPresents: parseIntVal(row["Participants présents"]),
    recettes: parseNum(row["Recettes"]),
    depenses: parseNum(row["Dépenses"]),
    marge: parseNum(row["Marge"]),
    description: parseStr(row["Description"]),
    satisfGenerale: parseNum(row["Satisf. générale (à chaud)"]),
    satisfFormateur: parseNum(row["Satisf. générale Formateur (à chaud)"]),
    satisfSalle: parseNum(row["Satisf. générale Salle (à chaud)"]),
    tauxReponseChaud: parseNum(row["Taux de réponse (à chaud)"]),
    satisfGeneraleFroid: parseNum(row["Satisf. générale (à froid)"]),
    tauxReponseFroid: parseNum(row["Taux de réponse (à froid)"]),
  };
}

// ─── Preview row with drawer ──────────────────────────────────────────────────

type PreviewRow = CreateFormationInput & { _key: string };

type DrawerDraft = {
  intitule: string;
  intituleCourt: string;
  dateDebutDate: string;
  dateDebutTime: string;
  dateFinDate: string;
  dateFinTime: string;
  dureeHeures: string;
  dureeJours: string;
  lieu: string;
  modeOrganisation: string;
  categorie: string;
  nature: string;
  avancement: string;
  responsable: string;
  formateurs: string;
};

function rowToDraft(row: PreviewRow): DrawerDraft {
  const debut = splitDatetime(row.dateDebut);
  const fin = splitDatetime(row.dateFin);
  return {
    intitule: row.intitule,
    intituleCourt: row.intituleCourt ?? "",
    dateDebutDate: debut.date,
    dateDebutTime: debut.time,
    dateFinDate: fin.date,
    dateFinTime: fin.time,
    dureeHeures: row.dureeHeures?.toString() ?? "",
    dureeJours: row.dureeJours?.toString() ?? "",
    lieu: row.lieu ?? "",
    modeOrganisation: row.modeOrganisation ?? "",
    categorie: row.categorie ?? "",
    nature: row.nature ?? "",
    avancement: row.avancement ?? "",
    responsable: row.responsable ?? "",
    formateurs: row.formateurs ?? "",
  };
}

function draftToRow(original: PreviewRow, draft: DrawerDraft): PreviewRow {
  return {
    ...original,
    intitule: draft.intitule.trim() || original.intitule,
    intituleCourt: draft.intituleCourt.trim() || null,
    dateDebut: joinDatetime(draft.dateDebutDate, draft.dateDebutTime),
    dateFin: joinDatetime(draft.dateFinDate, draft.dateFinTime),
    dureeHeures: draft.dureeHeures ? Number(draft.dureeHeures) : null,
    dureeJours: draft.dureeJours ? Number(draft.dureeJours) : null,
    lieu: draft.lieu.trim() || null,
    modeOrganisation: draft.modeOrganisation.trim() || null,
    categorie: draft.categorie.trim() || null,
    nature: draft.nature.trim() || null,
    avancement: draft.avancement.trim() || null,
    responsable: draft.responsable.trim() || null,
    formateurs: draft.formateurs.trim() || null,
  };
}

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function AvancementBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-300 text-xs">—</span>;
  const color =
    value === "Terminé" ? "bg-green-100 text-green-700" :
    value === "En cours" ? "bg-blue-100 text-blue-700" :
    value === "Annulé" ? "bg-red-100 text-red-600" :
    "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {value}
    </span>
  );
}

function PreviewTableRow({ row, onSave }: { row: PreviewRow; onSave: (updated: PreviewRow) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DrawerDraft>(() => rowToDraft(row));
  const [savedRow, setSavedRow] = useState<PreviewRow>(row);

  function f(key: keyof DrawerDraft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));
  }

  function handleSave() {
    const updated = draftToRow(savedRow, draft);
    setSavedRow(updated);
    onSave(updated);
    setOpen(false);
  }

  function handleCancel() {
    setDraft(rowToDraft(savedRow));
    setOpen(false);
  }

  return (
    <>
      <tr
        className={`border-b border-zinc-50 transition-colors ${open ? "bg-primary-50/60" : "hover:bg-zinc-50/60"}`}
      >
        <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 whitespace-nowrap">{savedRow.numero}</td>
        <td className="px-3 py-2.5">
          <div className="max-w-sm">
            <p className="text-sm font-medium text-zinc-800 truncate" title={savedRow.intitule}>{savedRow.intitule}</p>
            {savedRow.intituleCourt && (
              <p className="text-xs text-zinc-400 truncate">{savedRow.intituleCourt}</p>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{fmtDatetime(savedRow.dateDebut)}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{fmtDatetime(savedRow.dateFin)}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
          {savedRow.dureeHeures != null ? `${savedRow.dureeHeures} h` : "—"}
        </td>
        <td className="px-3 py-2.5 text-xs text-zinc-500 max-w-35">
          <span className="truncate block">{savedRow.lieu ?? "—"}</span>
        </td>
        <td className="px-3 py-2.5">
          <AvancementBadge value={savedRow.avancement ?? null} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              open
                ? "bg-primary-100 text-primary-700"
                : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            <Pencil size={11} />
            {open ? "Fermer" : "Modifier"}
            <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="p-0 border-b border-primary-100">
            <div className="bg-primary-50/40 border-l-4 border-primary-400 px-6 py-5">
              <div className="grid grid-cols-1 gap-5">
                {/* Titre */}
                <div>
                  <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest mb-3">Titre</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DrawerField label="Intitulé *">
                      <input className={inputCls} value={draft.intitule} onChange={f("intitule")} required />
                    </DrawerField>
                    <DrawerField label="Intitulé court">
                      <input className={inputCls} value={draft.intituleCourt} onChange={f("intituleCourt")} />
                    </DrawerField>
                  </div>
                </div>

                {/* Dates */}
                <div>
                  <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest mb-3">Dates &amp; horaires</p>
                  <div className="grid grid-cols-4 gap-3">
                    <DrawerField label="Date début">
                      <input type="date" className={inputCls} value={draft.dateDebutDate} onChange={f("dateDebutDate")} />
                    </DrawerField>
                    <DrawerField label="Heure début">
                      <input type="time" className={inputCls} value={draft.dateDebutTime} onChange={f("dateDebutTime")} />
                    </DrawerField>
                    <DrawerField label="Date fin">
                      <input type="date" className={inputCls} value={draft.dateFinDate} onChange={f("dateFinDate")} />
                    </DrawerField>
                    <DrawerField label="Heure fin">
                      <input type="time" className={inputCls} value={draft.dateFinTime} onChange={f("dateFinTime")} />
                    </DrawerField>
                  </div>
                </div>

                {/* Logistique */}
                <div>
                  <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest mb-3">Logistique</p>
                  <div className="grid grid-cols-4 gap-3">
                    <DrawerField label="Durée (h)">
                      <input type="number" min={0} step={0.5} className={inputCls} value={draft.dureeHeures} onChange={f("dureeHeures")} />
                    </DrawerField>
                    <DrawerField label="Durée (j)">
                      <input type="number" min={0} step={0.5} className={inputCls} value={draft.dureeJours} onChange={f("dureeJours")} />
                    </DrawerField>
                    <DrawerField label="Lieu">
                      <input className={inputCls} value={draft.lieu} onChange={f("lieu")} />
                    </DrawerField>
                    <DrawerField label="Mode">
                      <input className={inputCls} value={draft.modeOrganisation} onChange={f("modeOrganisation")} />
                    </DrawerField>
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest mb-3">Classification</p>
                  <div className="grid grid-cols-3 gap-3">
                    <DrawerField label="Catégorie">
                      <input className={inputCls} value={draft.categorie} onChange={f("categorie")} />
                    </DrawerField>
                    <DrawerField label="Nature">
                      <input className={inputCls} value={draft.nature} onChange={f("nature")} />
                    </DrawerField>
                    <DrawerField label="Avancement">
                      <input className={inputCls} value={draft.avancement} onChange={f("avancement")} />
                    </DrawerField>
                  </div>
                </div>

                {/* Intervenants */}
                <div>
                  <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest mb-3">Intervenants</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DrawerField label="Responsable">
                      <input className={inputCls} value={draft.responsable} onChange={f("responsable")} />
                    </DrawerField>
                    <DrawerField label="Formateurs">
                      <input className={inputCls} value={draft.formateurs} onChange={f("formateurs")} placeholder="Nom 1, Nom 2…" />
                    </DrawerField>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-primary-100">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Check size={14} /> Confirmer les modifications
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "done";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function ImportFormationsModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback((updated: PreviewRow) => {
    setPreviewRows((prev) => prev.map((r) => (r._key === updated._key ? updated : r)));
  }, []);

  async function processFile(file: File) {
    setError(null);
    setIsChecking(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<RawRow>(ws);

      const parsed: CreateFormationInput[] = [];
      for (const row of rawRows) {
        const f = rowToFormation(row);
        if (f) parsed.push(f);
      }

      if (parsed.length === 0) {
        setError(
          "Aucune formation valide trouvée. Vérifiez que c'est bien le fichier « action_de_formation » exporté depuis Dendreo.",
        );
        setIsChecking(false);
        return;
      }

      const terminated = parsed.filter((f) => f.avancement === "Terminé");
      setFilteredCount(parsed.length - terminated.length);

      if (terminated.length === 0) {
        setError("Aucune formation « Terminé » trouvée dans ce fichier. Seules les formations clôturées sont importées.");
        setIsChecking(false);
        return;
      }

      const numeros = terminated.map((f) => f.numero);
      const res = await fetch("/api/formations/import/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeros }),
      });
      const { existing } = (await res.json()) as { existing: string[] };
      const existingSet = new Set(existing);

      const newFormations = terminated.filter((f) => !existingSet.has(f.numero));
      setSkippedCount(terminated.length - newFormations.length);
      setPreviewRows(newFormations.map((f) => ({ ...f, _key: f.numero })));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la lecture du fichier");
    } finally {
      setIsChecking(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const toCreate = previewRows.map(({ _key, ...f }) => f);
      const res = await fetch("/api/formations/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCreate),
      });
      const data = (await res.json()) as { created?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setCreatedCount(data.created ?? 0);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <GraduationCap size={18} className="text-primary-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Importer des formations</h2>
              <p className="text-xs text-zinc-400">
                {step === "upload" && "Fichier Dendreo « action_de_formation » — formations terminées uniquement"}
                {step === "preview" && (
                  <>
                    {previewRows.length} nouvelle{previewRows.length > 1 ? "s" : ""}
                    {skippedCount > 0 && ` · ${skippedCount} déjà présente${skippedCount > 1 ? "s" : ""}`}
                    {filteredCount > 0 && ` · ${filteredCount} non terminée${filteredCount > 1 ? "s" : ""}`}
                  </>
                )}
                {step === "done" && "Import terminé"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="p-8 flex flex-col items-center gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                  isDragging ? "border-primary-400 bg-primary-50 scale-[1.01]" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {isChecking ? (
                  <Loader2 size={36} className="text-primary-400 animate-spin" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
                    <Upload size={24} className="text-zinc-400" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-700">
                    {isChecking ? "Analyse en cours…" : "Glisser le fichier ou cliquer pour sélectionner"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">Format .xlsx — export Dendreo</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
              <div className="w-full max-w-lg flex items-start gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <span>Seules les formations avec le statut <strong>« Terminé »</strong> sont importées. Les formations en cours, annulées ou à venir sont automatiquement ignorées.</span>
              </div>
              {error && (
                <div className="w-full max-w-lg flex items-start gap-2.5 text-sm text-red-600 bg-red-50 rounded-xl p-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col">
              {previewRows.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-sm">
                  Toutes les formations terminées de ce fichier sont déjà présentes dans la base.
                  {filteredCount > 0 && (
                    <p className="mt-1 text-xs">{filteredCount} formation{filteredCount > 1 ? "s" : ""} non terminée{filteredCount > 1 ? "s" : ""} ignorée{filteredCount > 1 ? "s" : ""}.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        {["Numéro", "Intitulé", "Début", "Fin", "Durée", "Lieu", "Avancement", ""].map((h) => (
                          <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <PreviewTableRow key={row._key} row={row} onSave={handleSave} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div className="mx-6 mb-4 flex items-start gap-2.5 text-sm text-red-600 bg-red-50 rounded-xl p-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-5 py-16">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={28} className="text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-zinc-800">Import terminé</p>
                <p className="text-sm text-zinc-500 mt-1.5">
                  <span className="font-medium text-zinc-700">{createdCount}</span> formation{createdCount > 1 ? "s" : ""} créée{createdCount > 1 ? "s" : ""}
                  {skippedCount > 0 && (
                    <> · <span className="text-zinc-400">{skippedCount} déjà présente{skippedCount > 1 ? "s" : ""}, ignorée{skippedCount > 1 ? "s" : ""}</span></>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 shrink-0 bg-zinc-50/50 rounded-b-2xl">
          {step === "done" ? (
            <>
              <div />
              <button
                onClick={() => { onImported(); onClose(); }}
                className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                Fermer et rafraîchir
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
                Annuler
              </button>
              {step === "preview" && previewRows.length > 0 && (
                <button
                  onClick={() => void handleConfirm()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Valider l&apos;import ({previewRows.length} formation{previewRows.length > 1 ? "s" : ""})
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
