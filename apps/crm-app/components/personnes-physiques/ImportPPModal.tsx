"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload, X, Check, AlertTriangle, ChevronDown, ChevronRight,
  Loader2, Users, UserX, Plus, RefreshCw, FileText,
} from "lucide-react";
import type {
  PPImportMatchInput,
  PPImportMatchResult,
  PPImportCreateInput,
  PPImportResult,
  PPCandidate,
} from "@/lib/server/modules/personnes-physiques/import-service";

// ─── Parsers Excel ────────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>;

function parseStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function parseDateField(v: unknown): string | null {
  if (typeof v === "number" && !isNaN(v) && v > 0) {
    return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().split("T")[0];
  }
  if (typeof v === "string" && v.trim()) {
    const raw = v.trim();
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }
  return null;
}

function parseNomComplet(s: string): { nom: string; prenom: string | null } {
  const t = s.trim();
  if (t.includes(",")) {
    const [a, b] = t.split(",", 2).map((p) => p.trim());
    return { nom: a, prenom: b || null };
  }
  const parts = t.split(/\s+/);
  // Detect last run of ALL-CAPS tokens as the family name
  let splitAt = parts.length - 1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[A-ZÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ\-]+$/.test(parts[i])) splitAt = i;
    else break;
  }
  if (splitAt === 0) {
    return { nom: parts[parts.length - 1], prenom: parts.slice(0, -1).join(" ") || null };
  }
  return { nom: parts.slice(splitAt).join(" "), prenom: parts.slice(0, splitAt).join(" ") || null };
}

type RawPP = {
  rowIndex: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  barreau: string | null;
  dateSerment: string | null;
  specialite: string | null;
  activiteDominante: string | null;
  structures: string[];
  siteWeb: string | null;
};

function rowToRawPP(row: RawRow, rowIndex: number): RawPP | null {
  const nomDirect = parseStr(row["Nom"]);
  const prenomDirect = parseStr(row["Prénom"]);
  const nomCompletRaw = parseStr(row["Nom Complet"]);

  let nom: string | null = null;
  let prenom: string | null = null;

  if (nomDirect) {
    nom = nomDirect;
    prenom = prenomDirect;
  } else if (nomCompletRaw) {
    const parsed = parseNomComplet(nomCompletRaw);
    nom = parsed.nom;
    prenom = parsed.prenom;
  }
  if (!nom) return null;

  const telRaw = parseStr(row["Téléphone(s)"] ?? row["Téléphone"]);
  const tels = telRaw ? telRaw.split(/[|;]/).map((t) => t.trim()).filter(Boolean) : [];

  const emailRaw = parseStr(row["Email(s)"] ?? row["Email"]);
  const emails = emailRaw ? emailRaw.split(/[|;]/).map((e) => e.trim()).filter(Boolean) : [];

  const structureRaw = parseStr(row["Structure(s)"] ?? row["Structure"] ?? row["Entreprise"]);
  const structures = structureRaw
    ? structureRaw.split(/[|;]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    rowIndex,
    nom: nom.trim(),
    prenom: prenom?.trim() ?? null,
    email: emails[0] ?? null,
    telephone: tels[0] ?? null,
    portable: tels[1] ?? null,
    barreau: parseStr(row["Barreau"]),
    dateSerment: parseDateField(row["Date serment"]),
    specialite: parseStr(row["Spécialité(s)"] ?? row["Spécialité"]),
    activiteDominante: parseStr(row["Activité(s) dominante(s)"] ?? row["Activité dominante"]),
    structures,
    siteWeb: parseStr(row["Site Web"]),
  };
}

// ─── Entry state ──────────────────────────────────────────────────────────────

type Resolution = "auto-exact" | "auto-create" | "skip" | "linkExisting" | "createNew" | null;

type EntryState = {
  raw: RawPP;
  matchResult: PPImportMatchResult;
  open: boolean;
  resolution: Resolution;
  linkedPpId: string | null;
  pendingCandidate: PPCandidate | null;
};

function isResolved(e: EntryState): boolean {
  return e.resolution !== null;
}

type Phase = "upload" | "matching" | "resolve" | "importing" | "done";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PPImportMatchResult["status"] }) {
  if (status === "exact")
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
        <Check size={10} /> Identique
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={10} /> Conflit
      </span>
    );
  if (status === "multi")
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
        <Users size={10} /> Multiple
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500">
      <Plus size={10} /> À créer
    </span>
  );
}

// ─── Compare row ──────────────────────────────────────────────────────────────

function CompareRow({
  label, excelVal, ppVal, matches,
}: {
  label: string; excelVal: string | null; ppVal: string | null; matches: boolean;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr_18px_1fr] gap-x-2 items-center py-0.5 text-xs">
      <span className="text-zinc-400 text-[10px]">{label}</span>
      <span className="text-zinc-700 font-mono truncate">
        {excelVal ?? <em className="text-zinc-300 not-italic">—</em>}
      </span>
      <span className={`text-center text-[11px] ${matches ? "text-green-500" : "text-red-400"}`}>
        {matches ? "✓" : "✗"}
      </span>
      <span className="text-zinc-500 font-mono truncate">
        {ppVal ?? <em className="text-zinc-300 not-italic">—</em>}
      </span>
    </div>
  );
}

// ─── Warning row ──────────────────────────────────────────────────────────────

function WarningRow({
  entry, onUpdate,
}: {
  entry: EntryState;
  onUpdate: (u: Partial<EntryState>) => void;
}) {
  const { raw, matchResult, open, resolution, pendingCandidate } = entry;
  const resolved = resolution !== null;
  const status = matchResult.status;
  const label = `${raw.prenom ?? ""} ${raw.nom}`.trim();
  const candidate = matchResult.candidates[0] ?? null;
  const md = matchResult.matchDetail;

  const rowBorder = resolved ? "border-zinc-100"
    : status === "partial" ? "border-amber-200"
    : "border-blue-200";

  const rowBg = resolved ? "bg-zinc-50/40"
    : status === "partial" ? "bg-amber-50/20"
    : "bg-blue-50/10";

  return (
    <div className={`border rounded-lg overflow-hidden ${rowBorder} ${rowBg}`}>
      <button
        type="button"
        onClick={() => onUpdate({ open: !open })}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/2 transition-colors"
      >
        <span className="text-zinc-300 shrink-0">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
          <span className="text-sm font-medium text-zinc-800 shrink-0">{label}</span>
          {raw.email && <span className="text-xs text-zinc-400 truncate">{raw.email}</span>}
        </span>
        <span className="shrink-0">
          {resolved ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
              {resolution === "linkExisting" ? (
                <><Check size={10} className="text-green-500" /> Lié</>
              ) : resolution === "createNew" ? (
                <><Plus size={10} className="text-blue-500" /> À créer</>
              ) : (
                <><UserX size={10} /> Ignoré</>
              )}
            </span>
          ) : (
            <StatusBadge status={status} />
          )}
        </span>
      </button>

      {open && !resolved && (
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 space-y-2.5">

          {/* ── PARTIAL ── */}
          {status === "partial" && candidate && md && (
            <>
              <div className="bg-white border border-zinc-100 rounded-lg px-3 py-2">
                <div className="grid grid-cols-[64px_1fr_18px_1fr] gap-x-2 pb-1 mb-1 border-b border-zinc-100 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <span /><span>Fichier Excel</span><span /><span>PP trouvée</span>
                </div>
                <CompareRow label="Nom" excelVal={raw.nom} ppVal={candidate.nom} matches={md.nomMatch} />
                <CompareRow label="Prénom" excelVal={raw.prenom} ppVal={candidate.prenom} matches={md.prenomMatch} />
                <CompareRow label="Email" excelVal={raw.email} ppVal={candidate.email} matches={md.emailMatch} />
                {(candidate.barreau ?? candidate.entreprise) && (
                  <p className="text-[10px] text-zinc-400 mt-1 pt-1 border-t border-zinc-50">
                    {[candidate.barreau, candidate.entreprise].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ resolution: "linkExisting", linkedPpId: candidate.id, open: false })}
                  className="flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-left"
                >
                  <Check size={10} className="inline mr-1 opacity-60" />
                  C&apos;est la même personne — lier
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ resolution: "createNew", open: false })}
                  className="flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-left"
                >
                  <Plus size={10} className="inline mr-1 opacity-60" />
                  Personne différente — créer
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ resolution: "skip", open: false })}
                  className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                >
                  Ignorer
                </button>
              </div>
            </>
          )}

          {/* ── MULTI ── */}
          {status === "multi" && (
            <>
              {!pendingCandidate ? (
                <>
                  <p className="text-xs text-zinc-500">
                    {matchResult.candidates.length} personnes trouvées — sélectionnez la bonne :
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {matchResult.candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onUpdate({ resolution: "linkExisting", linkedPpId: c.id, open: false })}
                        className="text-left border border-zinc-200 rounded-lg p-2.5 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="text-xs font-semibold text-zinc-800">{c.prenom} {c.nom}</div>
                        {c.email && <div className="text-[10px] text-zinc-400 truncate mt-0.5">{c.email}</div>}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.barreau && (
                            <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px]">{c.barreau}</span>
                          )}
                          {c.entreprise && (
                            <span className="px-1 py-0.5 rounded bg-zinc-50 text-zinc-500 text-[9px] max-w-[90px] truncate">{c.entreprise}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-[10px] text-zinc-400">Aucune de ces personnes ?</span>
                    <button
                      type="button"
                      onClick={() => onUpdate({ resolution: "createNew", open: false })}
                      className="text-xs px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 flex items-center gap-1"
                    >
                      <Plus size={11} /> Créer nouvelle PP
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdate({ resolution: "skip", open: false })}
                      className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                    >
                      Ignorer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
                    <Check size={11} className="text-zinc-400 shrink-0" />
                    <span className="text-zinc-600">
                      Sélection : <strong>{pendingCandidate.prenom} {pendingCandidate.nom}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdate({ pendingCandidate: null })}
                      className="ml-auto text-zinc-400 hover:text-zinc-600"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {open && resolved && (
        <div className="px-3 pb-2 pt-1.5 border-t border-zinc-100 text-[11px] text-zinc-400">
          {resolution === "linkExisting" && "Lié à une PP existante — structure sera rattachée si renseignée."}
          {resolution === "createNew" && "Nouvelle PP sera créée lors de l'import."}
          {resolution === "skip" && "Ligne ignorée, aucune action."}
        </div>
      )}
    </div>
  );
}

// ─── Field description box ────────────────────────────────────────────────────

function FieldsInfo() {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-600 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
        <FileText size={15} className="text-zinc-400" />
        Colonnes attendues dans le fichier Excel
      </div>
      <div className="space-y-1.5">
        <p className="font-medium text-zinc-700 text-[11px] uppercase tracking-wide">Obligatoire (au moins un)</p>
        <div className="flex flex-wrap gap-1.5">
          {["`Nom Complet`", "`Nom` + `Prénom`"].map((c) => (
            <code key={c} className="px-2 py-0.5 rounded bg-white border border-zinc-300 text-zinc-700 font-mono text-[11px]">{c}</code>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="font-medium text-zinc-700 text-[11px] uppercase tracking-wide">Optionnels</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "Email(s)", "Téléphone(s)", "Barreau", "Date serment",
            "Spécialité(s)", "Activité(s) dominante(s)", "Structure(s)", "Site Web",
          ].map((c) => (
            <code key={c} className="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-500 font-mono text-[11px]">{c}</code>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        Les colonnes multi-valeurs (<code className="font-mono">Email(s)</code>, <code className="font-mono">Structure(s)</code>, <code className="font-mono">Téléphone(s)</code>) sont séparées par le caractère <code className="font-mono">|</code>.
        Si la structure indiquée n&apos;existe pas dans le CRM, elle sera créée automatiquement avec une recherche SIRENE.
      </p>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function ImportPPModal({ onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntryState[]>([]);
  const [result, setResult] = useState<PPImportResult | null>(null);

  function updateEntry(rowIndex: number, u: Partial<EntryState>) {
    setEntries((prev) => prev.map((e) => (e.raw.rowIndex === rowIndex ? { ...e, ...u } : e)));
  }

  // ─── Step 1: parse + match ─────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    setPhase("matching");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null });

      const parsed = rows.map((r, i) => rowToRawPP(r, i)).filter(Boolean) as RawPP[];
      if (parsed.length === 0) {
        setError("Aucune personne valide trouvée. Vérifiez que la colonne 'Nom Complet' ou 'Nom'/'Prénom' est présente.");
        setPhase("upload");
        return;
      }

      const matchInputs: PPImportMatchInput[] = parsed.map((p) => ({
        rowIndex: p.rowIndex,
        email: p.email,
        nom: p.nom,
        prenom: p.prenom,
        barreau: p.barreau,
      }));

      const res = await fetch("/api/personnes-physiques/import-xlsx/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchInputs),
      });
      if (!res.ok) throw new Error("Erreur lors de l'analyse des correspondances.");
      const matchResults: PPImportMatchResult[] = await res.json();

      const newEntries: EntryState[] = parsed.map((raw): EntryState => {
        const mr = matchResults.find((r) => r.rowIndex === raw.rowIndex)!;
        const resolution: Resolution =
          mr.status === "exact" ? "auto-exact"
          : mr.status === "none" ? "auto-create"
          : null;
        return {
          raw,
          matchResult: mr,
          open: false,
          resolution,
          linkedPpId: mr.status === "exact" ? (mr.candidates[0]?.id ?? null) : null,
          pendingCandidate: null,
        };
      });

      setEntries(newEntries);
      setPhase("resolve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("upload");
    }
  }

  // ─── Step 2: import ────────────────────────────────────────────────────────

  async function handleConfirm() {
    const unresolved = entries.filter((e) => !isResolved(e));
    if (unresolved.length > 0) {
      setError(`${unresolved.length} conflit${unresolved.length > 1 ? "s" : ""} non résolus.`);
      return;
    }
    setPhase("importing");
    setError(null);
    try {
      const payload: PPImportCreateInput[] = entries
        .filter((e) => e.resolution !== "auto-exact" && e.resolution !== "skip")
        .map((e) => ({
          rowIndex: e.raw.rowIndex,
          nom: e.raw.nom,
          prenom: e.raw.prenom,
          email: e.raw.email,
          telephone: e.raw.telephone,
          portable: e.raw.portable,
          barreau: e.raw.barreau,
          dateSerment: e.raw.dateSerment,
          specialite: e.raw.specialite,
          activiteDominante: e.raw.activiteDominante,
          structures: e.raw.structures,
          siteWeb: e.raw.siteWeb,
          resolution: (e.resolution as "auto-create" | "createNew" | "linkExisting"),
          linkedPpId: e.linkedPpId,
        }));

      if (payload.length === 0) {
        setResult({ ppCreees: 0, ppIgnorees: 0, structuresCreees: 0 });
        setPhase("done");
        onImported();
        return;
      }

      const res = await fetch("/api/personnes-physiques/import-xlsx/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erreur lors de l'import.");
      const data = (await res.json()) as PPImportResult;
      setResult(data);
      setPhase("done");
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("resolve");
    }
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const exactEntries = entries.filter((e) => e.matchResult.status === "exact");
  const noneEntries = entries.filter((e) => e.matchResult.status === "none");
  const warningEntries = entries.filter(
    (e) => e.matchResult.status === "partial" || e.matchResult.status === "multi",
  );
  const unresolvedCount = warningEntries.filter((e) => !isResolved(e)).length;
  const canImport = phase === "resolve" && unresolvedCount === 0;
  const toImportCount = entries.filter(
    (e) => e.resolution !== "auto-exact" && e.resolution !== "skip",
  ).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Upload size={14} className="text-zinc-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Importer des avocats</h2>
              <p className="text-[11px] text-zinc-400">Fichier Excel (.xlsx) — format BarOtech ou compatible</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">

          {/* Upload */}
          {phase === "upload" && (
            <div className="flex flex-col gap-4">
              <FieldsInfo />
              <div
                className="w-full border-2 border-dashed border-zinc-200 rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-zinc-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) void handleFile(f);
                }}
              >
                <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center">
                  <Upload size={20} className="text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-zinc-700">Déposer le fichier Excel ici</p>
                  <p className="text-xs text-zinc-400 mt-0.5">ou cliquer pour sélectionner (.xlsx)</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
              )}
            </div>
          )}

          {/* Matching */}
          {phase === "matching" && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 size={28} className="animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Analyse des correspondances…</p>
            </div>
          )}

          {/* Resolve */}
          {phase === "resolve" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Total", value: entries.length, color: "bg-zinc-100 text-zinc-700" },
                  { label: "Déjà présents", value: exactEntries.length, color: "bg-green-100 text-green-700" },
                  { label: "À créer", value: noneEntries.length, color: "bg-blue-100 text-blue-700" },
                  {
                    label: unresolvedCount > 0
                      ? `Conflits · ${unresolvedCount} restant${unresolvedCount > 1 ? "s" : ""}`
                      : warningEntries.length > 0 ? "Conflits · résolus" : "Conflits",
                    value: warningEntries.length,
                    color: unresolvedCount > 0 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500",
                  },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg px-3 py-1.5 ${s.color}`}>
                    <span className="text-base font-bold">{s.value}</span>
                    <span className="text-[10px] ml-1.5 opacity-75">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Conflicts */}
              {warningEntries.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                    Conflits à résoudre ({warningEntries.length})
                  </h3>
                  {warningEntries.map((e) => (
                    <WarningRow
                      key={e.raw.rowIndex}
                      entry={e}
                      onUpdate={(u) => updateEntry(e.raw.rowIndex, u)}
                    />
                  ))}
                </div>
              )}

              {/* À créer (collapsed) */}
              {noneEntries.length > 0 && (
                <details>
                  <summary className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer list-none flex items-center gap-1 select-none">
                    <ChevronRight size={11} />
                    À créer ({noneEntries.length})
                  </summary>
                  <div className="mt-1.5 space-y-0.5">
                    {noneEntries.map((e) => (
                      <div key={e.raw.rowIndex} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-50/50 text-xs">
                        <Plus size={11} className="text-blue-400 shrink-0" />
                        <span className="flex-1 text-zinc-700 truncate">
                          {e.raw.prenom ? `${e.raw.prenom} ${e.raw.nom}` : e.raw.nom}
                        </span>
                        {e.raw.email && (
                          <span className="text-zinc-400 font-mono truncate max-w-[200px]">{e.raw.email}</span>
                        )}
                        {e.raw.barreau && (
                          <span className="text-blue-600 text-[10px] shrink-0">{e.raw.barreau}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Déjà présents (collapsed) */}
              {exactEntries.length > 0 && (
                <details>
                  <summary className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer list-none flex items-center gap-1 select-none">
                    <ChevronRight size={11} />
                    Déjà présents — ignorés ({exactEntries.length})
                  </summary>
                  <div className="mt-1.5 space-y-0.5">
                    {exactEntries.map((e) => (
                      <div key={e.raw.rowIndex} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-50 text-xs">
                        <Check size={11} className="text-green-500 shrink-0" />
                        <span className="flex-1 text-zinc-700 truncate">
                          {e.raw.prenom ? `${e.raw.prenom} ${e.raw.nom}` : e.raw.nom}
                        </span>
                        {e.raw.email && (
                          <span className="text-zinc-400 font-mono truncate max-w-[200px]">{e.raw.email}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* Importing */}
          {phase === "importing" && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 size={28} className="animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Import en cours… (enrichissement SIRENE inclus)</p>
            </div>
          )}

          {/* Done */}
          {phase === "done" && result && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                <Check size={22} className="text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-zinc-900">
                  {result.ppCreees} avocat{result.ppCreees !== 1 ? "s" : ""} importé{result.ppCreees !== 1 ? "s" : ""}
                </p>
                {result.structuresCreees > 0 && (
                  <p className="text-sm text-zinc-500">
                    {result.structuresCreees} structure{result.structuresCreees !== 1 ? "s" : ""} créée{result.structuresCreees !== 1 ? "s" : ""} (enrichissement SIRENE)
                  </p>
                )}
                {result.ppIgnorees > 0 && (
                  <p className="text-xs text-zinc-400">
                    {result.ppIgnorees} ignoré{result.ppIgnorees !== 1 ? "s" : ""} (déjà présents ou erreur)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            {phase === "done" ? "Fermer" : "Annuler"}
          </button>

          {phase === "resolve" && (
            <div className="flex items-center gap-3">
              {unresolvedCount > 0 && (
                <span className="text-xs text-amber-600">
                  {unresolvedCount} conflit{unresolvedCount > 1 ? "s" : ""} restant{unresolvedCount > 1 ? "s" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canImport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Importer {toImportCount} personne{toImportCount !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
