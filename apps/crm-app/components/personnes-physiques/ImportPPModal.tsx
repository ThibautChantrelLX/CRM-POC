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
  StructureRattachementInput,
} from "@/lib/server/modules/personnes-physiques/import-service";
import { StructureReconciliationWidget } from "@/components/shared/StructureReconciliationWidget";

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
  idExterne: string | null;
  // SIREN résolu via l'annuaire entreprises pour structures[0] — permet de détecter
  // qu'une structure au libellé différent est en fait la même entreprise (raison sociale imparfaite)
  structureSiren: string | null;
};

function rowToRawPP(row: RawRow, rowIndex: number): RawPP | null {
  const idExterne = parseStr(row["Id"] ?? row["ID"] ?? row["Identifiant"]);
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
    idExterne,
    structures,
    structureSiren: null,
    siteWeb: parseStr(row["Site Web"]),
  };
}

// Normalizes a SIRET/SIREN string down to its 9-digit SIREN prefix, for comparison.
function sirenOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : null;
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
  structureRattachement: StructureRattachementInput | null;
  // When linking to an existing PP with a different email
  updatePpEmail: boolean;
};

function linkedCandidate(e: EntryState): PPCandidate | null {
  if (!e.linkedPpId) return null;
  return e.matchResult.candidates.find((c) => c.id === e.linkedPpId) ?? null;
}

function needsStructureDecision(e: EntryState): boolean {
  if (e.raw.structures.length === 0) return false;
  if (e.resolution !== "auto-exact" && e.resolution !== "linkExisting") return false;
  const candidate = linkedCandidate(e);
  if (!candidate) return false;
  const existingNames = new Set(candidate.rattachements.map((r) => r.raisonSociale.toLowerCase()));
  const incomingSiren = sirenOf(e.raw.structureSiren);
  const sameSirenAlreadyLinked =
    !!incomingSiren && candidate.rattachements.some((r) => sirenOf(r.siretSiren) === incomingSiren);
  if (sameSirenAlreadyLinked) return false;
  return e.raw.structures.some((s) => !existingNames.has(s.toLowerCase()));
}

function isFullyResolved(e: EntryState): boolean {
  if (e.resolution === null) return false;
  if (needsStructureDecision(e) && e.structureRattachement === null) return false;
  return true;
}

type Phase = "upload" | "configure" | "matching" | "resolve" | "importing" | "done";

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
  const identityResolved = resolution !== null;
  const structureNeeded = resolution === "linkExisting" && needsStructureDecision(entry);
  const fullyResolved = isFullyResolved(entry);
  const status = matchResult.status;
  const label = `${raw.prenom ?? ""} ${raw.nom}`.trim();
  const candidate = matchResult.candidates[0] ?? null;
  const md = matchResult.matchDetail;

  const rowBorder = fullyResolved ? "border-zinc-100"
    : identityResolved && structureNeeded ? "border-amber-300"
    : status === "partial" ? "border-amber-200"
    : "border-blue-200";

  const rowBg = fullyResolved ? "bg-zinc-50/40"
    : identityResolved && structureNeeded ? "bg-amber-50/30"
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
          {identityResolved && structureNeeded ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
              <AlertTriangle size={10} /> Structure à traiter
            </span>
          ) : fullyResolved ? (
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

      {open && !identityResolved && (
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
              <div className="flex flex-wrap gap-2 items-center">
                {(() => {
                  const ppHasEmail = !!candidate.email;
                  const excelHasEmail = !!raw.email;

                  const linkBtn = (
                    updateEmail: boolean,
                    label: string,
                    primary: boolean,
                  ) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          resolution: "linkExisting",
                          linkedPpId: candidate.id,
                          updatePpEmail: updateEmail,
                          open: false,
                        })
                      }
                      className={`flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border text-left leading-tight transition-colors ${
                        primary
                          ? "border-zinc-900 bg-zinc-900 hover:bg-zinc-700 text-white"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      <Check size={10} className="inline mr-1 opacity-60" />
                      {label}
                    </button>
                  );

                  if (md.emailMatch || !excelHasEmail) {
                    return linkBtn(false, "C'est la même personne — lier", true);
                  }
                  if (ppHasEmail) {
                    return (
                      <>
                        {linkBtn(false, `Garder · ${candidate.email}`, false)}
                        {linkBtn(true, `Utiliser · ${raw.email}`, true)}
                      </>
                    );
                  }
                  return (
                    <>
                      {linkBtn(false, "Confirmer · sans email", false)}
                      {linkBtn(true, `Ajouter · ${raw.email}`, true)}
                    </>
                  );
                })()}
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
                        onClick={() => {
                          const emailsMatch =
                            raw.email && c.email
                              ? c.email.toLowerCase() === raw.email.toLowerCase()
                              : false;
                          if (emailsMatch) {
                            onUpdate({ resolution: "linkExisting", linkedPpId: c.id, updatePpEmail: false, open: false });
                          } else {
                            onUpdate({ pendingCandidate: c });
                          }
                        }}
                        className="text-left border border-zinc-200 rounded-lg p-2.5 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="text-xs font-semibold text-zinc-800">{c.prenom} {c.nom}</div>
                        {c.email && <div className="text-[10px] text-zinc-400 truncate mt-0.5">{c.email}</div>}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.barreau && (
                            <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px]">{c.barreau}</span>
                          )}
                          {c.entreprise && (
                            <span className="px-1 py-0.5 rounded bg-zinc-50 text-zinc-500 text-[9px] max-w-22.5 truncate">{c.entreprise}</span>
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
                    {pendingCandidate.email && (
                      <span className="text-zinc-400 font-mono truncate">{pendingCandidate.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdate({ pendingCandidate: null })}
                      className="ml-auto text-zinc-400 hover:text-zinc-600"
                      title="Rechoisir"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    L&apos;email de la PP diffère de celui du fichier. Que conserver ?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          resolution: "linkExisting",
                          linkedPpId: pendingCandidate.id,
                          updatePpEmail: false,
                          pendingCandidate: null,
                          open: false,
                        })
                      }
                      className="flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-left leading-tight"
                    >
                      Garder{" "}
                      <span className="font-mono text-zinc-400">{pendingCandidate.email ?? "—"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          resolution: "linkExisting",
                          linkedPpId: pendingCandidate.id,
                          updatePpEmail: true,
                          pendingCandidate: null,
                          open: false,
                        })
                      }
                      className="flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-900 hover:bg-zinc-700 text-white text-left leading-tight"
                    >
                      Utiliser <span className="font-mono">{raw.email ?? "—"}</span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {structureNeeded && (
        <div className="px-3 py-2.5 border-t border-amber-100 bg-amber-50/20">
          <StructureReconciliationWidget
            structureNom={entry.raw.structures[0]}
            existingRattachements={linkedCandidate(entry)?.rattachements ?? []}
            decision={entry.structureRattachement}
            onChange={(d) => onUpdate({ structureRattachement: d })}
          />
        </div>
      )}

      {open && identityResolved && !structureNeeded && (
        <div className="px-3 pb-2 pt-1.5 border-t border-zinc-100 text-[11px] text-zinc-400">
          {resolution === "linkExisting" &&
            `Lié à une PP existante${entry.updatePpEmail ? " · email mis à jour avec le fichier" : ""}.`}
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
            "Id", "Email(s)", "Téléphone(s)", "Barreau", "Date serment",
            "Spécialité(s)", "Activité(s) dominante(s)", "Structure(s)", "Site Web",
          ].map((c) => (
            <code key={c} className="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-500 font-mono text-[11px]">{c}</code>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        Les colonnes multi-valeurs (<code className="font-mono">Email(s)</code>, <code className="font-mono">Structure(s)</code>, <code className="font-mono">Téléphone(s)</code>) sont séparées par le caractère <code className="font-mono">|</code>.
        Si la structure indiquée n&apos;existe pas dans le CRM, elle sera créée automatiquement avec une recherche SIRENE.
        Si une colonne <code className="font-mono">Id</code> est présente, le nom du logiciel source sera demandé pour enregistrer la correspondance d&apos;identifiant. Sinon, vous pourrez choisir d&apos;activer un rapprochement avec les fiches existantes du CRM.
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

  // ─── Configure step state ───────────────────────────────────────────────────
  const [pendingRows, setPendingRows] = useState<RawPP[]>([]);
  const [hasIdColumn, setHasIdColumn] = useState(false);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<"select" | "other">("select");
  const [sourceLogiciel, setSourceLogiciel] = useState("");
  const [sourceLogicielOther, setSourceLogicielOther] = useState("");
  const [wantsMatching, setWantsMatching] = useState(true);
  const [matchWithEmail, setMatchWithEmail] = useState(false);

  const effectiveSourceLogiciel = (sourceMode === "other" ? sourceLogicielOther : sourceLogiciel).trim();

  function updateEntry(rowIndex: number, u: Partial<EntryState>) {
    setEntries((prev) => prev.map((e) => (e.raw.rowIndex === rowIndex ? { ...e, ...u } : e)));
  }

  // ─── Step 1: parse → configure ───────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
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

      const idColumnPresent = parsed.some((p) => p.idExterne);
      setHasIdColumn(idColumnPresent);
      setPendingRows(parsed);
      setSourceMode("select");
      setSourceLogiciel("");
      setSourceLogicielOther("");
      setWantsMatching(true);
      setMatchWithEmail(false);

      if (idColumnPresent) {
        try {
          const res = await fetch("/api/personnes-physiques/import-xlsx/sources");
          if (res.ok) setAvailableSources(await res.json());
        } catch {
          // Liste de suggestions optionnelle — l'utilisateur peut toujours saisir manuellement
        }
      }

      setPhase("configure");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("upload");
    }
  }

  // ─── Step 2: match (honors configure choices) ───────────────────────────────

  async function runMatch() {
    setError(null);
    setPhase("matching");
    try {
      let matchResults: PPImportMatchResult[];

      if (!hasIdColumn && !wantsMatching) {
        matchResults = pendingRows.map((p) => ({ rowIndex: p.rowIndex, status: "none", candidates: [] }));
      } else {
        const matchInputs: PPImportMatchInput[] = pendingRows.map((p) => ({
          rowIndex: p.rowIndex,
          email: !hasIdColumn && !matchWithEmail ? null : p.email,
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
        matchResults = await res.json();
      }

      // Résout le SIREN de chaque structure citée pour détecter une même entreprise
      // sous un libellé différent (raison sociale imparfaite dans le fichier).
      const uniqueStructureNames = [
        ...new Set(pendingRows.map((p) => p.structures[0]).filter((s): s is string => !!s)),
      ];
      const sirenMap = new Map<string, string | null>();
      await Promise.all(
        uniqueStructureNames.map(async (nom) => {
          try {
            const r = await fetch(`/api/sirene?q=${encodeURIComponent(nom)}`);
            const data = r.ok ? await r.json() : null;
            sirenMap.set(nom, data?.results?.[0]?.siren ?? null);
          } catch {
            sirenMap.set(nom, null);
          }
        }),
      );
      const enrichedRows = pendingRows.map((p) => ({
        ...p,
        structureSiren: p.structures[0] ? (sirenMap.get(p.structures[0]) ?? null) : null,
      }));

      const newEntries: EntryState[] = enrichedRows.map((raw): EntryState => {
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
          structureRattachement: null,
          updatePpEmail: false,
        };
      });

      setEntries(newEntries);
      setPhase("resolve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("configure");
    }
  }

  // ─── Step 2: import ────────────────────────────────────────────────────────

  async function handleConfirm() {
    const unresolved = entries.filter((e) => !isFullyResolved(e));
    if (unresolved.length > 0) {
      setError(`${unresolved.length} conflit${unresolved.length > 1 ? "s" : ""} non résolus.`);
      return;
    }
    setPhase("importing");
    setError(null);
    try {
      const payload: PPImportCreateInput[] = entries
        .filter((e) => e.resolution !== "skip")
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
          resolution: (e.resolution as "auto-create" | "createNew" | "linkExisting" | "auto-exact"),
          linkedPpId: e.linkedPpId,
          structureRattachement: e.structureRattachement,
          updatePpEmail: e.updatePpEmail,
          idExterne: e.raw.idExterne,
          sourceLogiciel: e.raw.idExterne ? effectiveSourceLogiciel : null,
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
  // exact entries that need a structure decision are surfaced in the warnings section
  const exactNeedingStructure = exactEntries.filter((e) => needsStructureDecision(e));
  const exactClean = exactEntries.filter((e) => !needsStructureDecision(e));
  const noneEntries = entries.filter((e) => e.matchResult.status === "none");
  const warningEntries = entries.filter(
    (e) =>
      e.matchResult.status === "partial" ||
      e.matchResult.status === "multi" ||
      exactNeedingStructure.includes(e),
  );
  const unresolvedCount = warningEntries.filter((e) => !isFullyResolved(e)).length;
  const canImport = phase === "resolve" && unresolvedCount === 0;
  const toImportCount = entries.filter((e) => e.resolution !== "skip").length;

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

          {/* Configure */}
          {phase === "configure" && (
            <div className="flex flex-col gap-4">
              {hasIdColumn ? (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-zinc-800">Logiciel source</p>
                  <p className="text-xs text-zinc-500">
                    Le fichier contient une colonne <code className="font-mono">Id</code>. Indiquez le logiciel
                    dont provient cet identifiant — il sera enregistré pour relier chaque fiche à sa source externe.
                  </p>
                  {sourceMode === "select" ? (
                    <select
                      value={sourceLogiciel}
                      onChange={(e) => {
                        if (e.target.value === "__other__") {
                          setSourceMode("other");
                          setSourceLogicielOther("");
                        } else {
                          setSourceLogiciel(e.target.value);
                        }
                      }}
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-700"
                    >
                      <option value="">— Sélectionner —</option>
                      {availableSources.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__other__">Autre…</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={sourceLogicielOther}
                        onChange={(e) => setSourceLogicielOther(e.target.value)}
                        placeholder="Nom du logiciel"
                        className="flex-1 text-sm border border-zinc-300 rounded-lg px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => { setSourceMode("select"); setSourceLogiciel(""); }}
                        className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 shrink-0"
                      >
                        Choisir dans la liste
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-zinc-800">Rapprochement avec le CRM</p>
                  <p className="text-xs text-zinc-500">
                    Le fichier ne contient pas de colonne <code className="font-mono">Id</code>. Voulez-vous
                    rapprocher les lignes des fiches déjà présentes dans le CRM ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWantsMatching(true)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        wantsMatching
                          ? "border-zinc-400 bg-zinc-100 text-zinc-800 font-medium"
                          : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      Oui, rapprocher
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantsMatching(false)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        !wantsMatching
                          ? "border-zinc-400 bg-zinc-100 text-zinc-800 font-medium"
                          : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      Non, tout créer
                    </button>
                  </div>
                  {wantsMatching && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                        Champs utilisés pour le rapprochement
                      </p>
                      <label className="flex items-center gap-2 text-xs text-zinc-600">
                        <input type="checkbox" checked readOnly disabled className="accent-zinc-700" />
                        Nom + Prénom
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-600">
                        <input
                          type="checkbox"
                          checked={matchWithEmail}
                          onChange={(e) => setMatchWithEmail(e.target.checked)}
                          className="accent-zinc-700"
                        />
                        Email
                      </label>
                    </div>
                  )}
                </div>
              )}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
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
                          <span className="text-zinc-400 font-mono truncate max-w-50">{e.raw.email}</span>
                        )}
                        {e.raw.barreau && (
                          <span className="text-blue-600 text-[10px] shrink-0">{e.raw.barreau}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* exact avec structure à réconcilier → dans les warnings */}
              {exactNeedingStructure.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                    Organisation à mettre à jour ({exactNeedingStructure.length})
                  </h3>
                  {exactNeedingStructure.map((e) => {
                    const candidate = linkedCandidate(e);
                    const structureNom = e.raw.structures[0];
                    return (
                      <div key={e.raw.rowIndex} className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50/50 text-xs">
                          <Check size={11} className="text-green-500 shrink-0" />
                          <span className="flex-1 font-medium text-zinc-800">
                            {e.raw.prenom ? `${e.raw.prenom} ${e.raw.nom}` : e.raw.nom}
                          </span>
                          {e.raw.email && <span className="text-zinc-400 font-mono truncate max-w-40">{e.raw.email}</span>}
                        </div>
                        <div className="px-3 py-2.5 border-t border-zinc-100">
                          <StructureReconciliationWidget
                            structureNom={structureNom}
                            existingRattachements={candidate?.rattachements ?? []}
                            decision={e.structureRattachement}
                            onChange={(d) => updateEntry(e.raw.rowIndex, { structureRattachement: d })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Déjà présents — sans conflit structure (collapsed) */}
              {exactClean.length > 0 && (
                <details>
                  <summary className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer list-none flex items-center gap-1 select-none">
                    <ChevronRight size={11} />
                    Déjà présents — ignorés ({exactClean.length})
                  </summary>
                  <div className="mt-1.5 space-y-0.5">
                    {exactClean.map((e) => (
                      <div key={e.raw.rowIndex} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-50 text-xs">
                        <Check size={11} className="text-green-500 shrink-0" />
                        <span className="flex-1 text-zinc-700 truncate">
                          {e.raw.prenom ? `${e.raw.prenom} ${e.raw.nom}` : e.raw.nom}
                        </span>
                        {e.raw.email && (
                          <span className="text-zinc-400 font-mono truncate max-w-50">{e.raw.email}</span>
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

          {phase === "configure" && (
            <button
              type="button"
              onClick={() => void runMatch()}
              disabled={hasIdColumn && !effectiveSourceLogiciel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            >
              Continuer
            </button>
          )}

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
