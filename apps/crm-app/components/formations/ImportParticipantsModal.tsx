"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Users,
  UserX,
  Plus,
  RefreshCw,
} from "lucide-react";
import { CreatePPForImportModal } from "@/components/formations/CreatePPForImportModal";
import { StructureReconciliationWidget } from "@/components/shared/StructureReconciliationWidget";
import type {
  ParticipantMatchInput,
  ParticipantMatchResult,
  PPCandidate,
  StructureRattachementInput,
} from "@/lib/server/modules/formations/participants-service";

// ─── Excel helpers ────────────────────────────────────────────────────────────

function excelSerialToDateStr(v: unknown): string | null {
  if (typeof v !== "number" || isNaN(v) || v <= 0) return null;
  return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().split("T")[0];
}

function parseStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type RawRow = Record<string, unknown>;

type RawParticipant = {
  idInscription: number;
  nomAffiche: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  entreprise: string | null;
  adresseEntreprise: string | null;
  cpEntreprise: string | null;
  villeEntreprise: string | null;
  barreau: string | null;
  present: boolean;
  satisfaction: number | null;
  dateInscription: string | null;
  prixParticipant: number | null;
};

function rowToParticipant(row: RawRow): RawParticipant | null {
  const id = parseNum(row["ID Inscription"]);
  if (!id) return null;
  return {
    idInscription: Math.round(id),
    nomAffiche: parseStr(row["Participant"]),
    prenom: parseStr(row["Prénom"]),
    nom: parseStr(row["Nom d'usage"]),
    email: parseStr(row["Email"]),
    telephone:
      parseStr(row["Téléphone (Participant)"]) ??
      parseStr(row["Téléphone"]) ??
      null,
    portable:
      parseStr(row["Mobile (Participant)"]) ??
      parseStr(row["Portable (Participant)"]) ??
      parseStr(row["Téléphone portable (Participant)"]) ??
      parseStr(row["Portable"]) ??
      parseStr(row["Mobile"]) ??
      null,
    entreprise:
      parseStr(row["Entreprise (actuelle)"]) ??
      parseStr(row["Entreprise"]) ??
      parseStr(row["Société"]) ??
      parseStr(row["Structure"]) ??
      null,
    adresseEntreprise:
      parseStr(row["Adresse (Entreprise)"]) ??
      parseStr(row["Adresse (actuelle)"]) ??
      parseStr(row["Rue (Entreprise)"]) ??
      parseStr(row["Adresse"]) ??
      null,
    cpEntreprise:
      parseStr(row["Code Postal (Entreprise)"]) ??
      parseStr(row["CP (Entreprise)"]) ??
      parseStr(row["Code Postal (actuel)"]) ??
      parseStr(row["Code Postal"]) ??
      null,
    villeEntreprise:
      parseStr(row["Ville (Entreprise)"]) ??
      parseStr(row["Ville (actuelle)"]) ??
      parseStr(row["Ville"]) ??
      null,
    barreau: parseStr(row["Barreau (Participant)"]),
    present: String(row["Présence ADF"] ?? "").toLowerCase() === "oui",
    satisfaction: parseNum(row["Satisfaction"]),
    dateInscription: excelSerialToDateStr(row["Date d'inscription"]),
    prixParticipant: parseNum(row["Prix total Participant"]),
  };
}

// ─── Entry state ──────────────────────────────────────────────────────────────

type EntryState = {
  raw: RawParticipant;
  matchResult: ParticipantMatchResult;
  open: boolean;
  // Resolution
  ppId: string | null;
  updatePpEmail: boolean;
  skipped: boolean;
  // Multi flow: candidate selected, awaiting email decision
  pendingCandidate: PPCandidate | null;
  // Structure reconciliation (when linked PP has different entreprise)
  structureRattachement: StructureRattachementInput | null;
};

function linkedCandidate(e: EntryState): PPCandidate | null {
  if (!e.ppId) return null;
  return e.matchResult.candidates.find((c) => c.id === e.ppId) ?? null;
}

function needsStructureDecision(e: EntryState): boolean {
  const entreprise = e.raw.entreprise;
  if (!entreprise) return false;
  const candidate = linkedCandidate(e);
  if (!candidate) return false;
  return !candidate.rattachements.some(
    (r) => r.raisonSociale.toLowerCase() === entreprise.toLowerCase(),
  );
}

function isResolved(e: EntryState): boolean {
  const identityOk = e.matchResult.status === "exact" || e.ppId !== null || e.skipped;
  if (!identityOk) return false;
  if (!e.skipped && needsStructureDecision(e) && e.structureRattachement === null) return false;
  return true;
}

type Phase = "upload" | "matching" | "resolve" | "importing" | "done";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ParticipantMatchResult["status"] }) {
  if (status === "exact")
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
        <Check size={10} /> Exact
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={10} /> Partiel
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
      <UserX size={10} /> Sans correspondance
    </span>
  );
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function CompareRow({
  label,
  excelVal,
  ppVal,
  matches,
}: {
  label: string;
  excelVal: string | null;
  ppVal: string | null;
  matches: boolean;
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
  entry,
  onUpdate,
  onOpenCreatePP,
}: {
  entry: EntryState;
  onUpdate: (u: Partial<EntryState>) => void;
  onOpenCreatePP: () => void;
}) {
  const { raw, matchResult, open, ppId, skipped, pendingCandidate } = entry;
  const identityResolved = ppId !== null || skipped;
  const structureNeeded = ppId !== null && needsStructureDecision(entry);
  const fullyResolved = isResolved(entry);
  const status = matchResult.status;
  const label = raw.nomAffiche ?? `${raw.prenom ?? ""} ${raw.nom ?? ""}`.trim();
  const candidate = matchResult.candidates[0] ?? null;
  const md = matchResult.matchDetail;

  const rowBorder = fullyResolved
    ? "border-zinc-100"
    : identityResolved && structureNeeded
      ? "border-amber-200"
      : status === "partial"
        ? "border-amber-200"
        : status === "multi"
          ? "border-blue-200"
          : "border-zinc-200";

  const rowBg = fullyResolved
    ? "bg-zinc-50/40"
    : identityResolved && structureNeeded
      ? "bg-amber-50/10"
      : status === "partial"
        ? "bg-amber-50/20"
        : status === "multi"
          ? "bg-blue-50/10"
          : "bg-zinc-50/30";

  return (
    <div className={`border rounded-lg overflow-hidden ${rowBorder} ${rowBg}`}>
      {/* Header */}
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
          {raw.email && (
            <span className="text-xs text-zinc-400 truncate">{raw.email}</span>
          )}
        </span>
        <span className="shrink-0">
          {fullyResolved ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
              {ppId ? (
                <><Check size={10} className="text-green-500" /> Lié</>
              ) : (
                <><UserX size={10} /> Sans lien</>
              )}
            </span>
          ) : identityResolved && structureNeeded ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
              <AlertTriangle size={10} /> Structure à traiter
            </span>
          ) : (
            <StatusBadge status={status} />
          )}
        </span>
      </button>

      {/* Structure reconciliation — always visible when identity resolved but org differs */}
      {structureNeeded && (
        <div className="px-3 py-2.5 border-t border-amber-100 bg-amber-50/20">
          <StructureReconciliationWidget
            structureNom={raw.entreprise!}
            existingRattachements={linkedCandidate(entry)?.rattachements ?? []}
            decision={entry.structureRattachement}
            onChange={(d) => onUpdate({ structureRattachement: d })}
          />
        </div>
      )}

      {/* Body — unresolved identity */}
      {open && !identityResolved && (
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 space-y-2.5">

          {/* ── PARTIAL ─────────────────────────────────────────────────── */}
          {status === "partial" && candidate && md && (() => {
            const ppHasEmail = !!candidate.email;
            const excelHasEmail = !!raw.email;

            const confirmBtn = (
              updateEmail: boolean,
              label: string,
              variant: "default" | "amber" = "default",
            ) => (
              <button
                type="button"
                onClick={() => onUpdate({ ppId: candidate.id, updatePpEmail: updateEmail, open: false })}
                className={`flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border text-left leading-tight transition-colors ${
                  variant === "amber"
                    ? "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                }`}
              >
                <Check size={10} className="inline mr-1 opacity-60" />
                {label}
              </button>
            );

            return (
              <>
                {/* Comparison table */}
                <div className="bg-white border border-zinc-100 rounded-lg px-3 py-2">
                  <div className="grid grid-cols-[64px_1fr_18px_1fr] gap-x-2 pb-1 mb-1 border-b border-zinc-100 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <span />
                    <span>Fichier Excel</span>
                    <span />
                    <span>PP trouvée</span>
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

                {/* Action buttons — adapt to email scenario */}
                <div className="flex flex-wrap gap-2 items-center">
                  {md.emailMatch ? (
                    // Email matches, names differ
                    confirmBtn(false, "Confirmer le lien")
                  ) : !excelHasEmail ? (
                    // Excel has no email — just confirm
                    confirmBtn(false, "Confirmer le lien")
                  ) : ppHasEmail ? (
                    // Both have email but different
                    <>
                      {confirmBtn(false, `Garder · ${candidate.email}`)}
                      {confirmBtn(true, `Utiliser · ${raw.email}`, "amber")}
                    </>
                  ) : (
                    // PP has no email, Excel has email
                    <>
                      {confirmBtn(false, "Confirmer · sans email")}
                      {confirmBtn(true, `Ajouter · ${raw.email}`, "amber")}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdate({ skipped: true, open: false })}
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                  >
                    Sans lien PP
                  </button>
                </div>
              </>
            );
          })()}

          {/* ── MULTI ───────────────────────────────────────────────────── */}
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
                            onUpdate({ ppId: c.id, updatePpEmail: false, open: false });
                          } else {
                            onUpdate({ pendingCandidate: c });
                          }
                        }}
                        className="text-left border border-zinc-200 rounded-lg p-2.5 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="text-xs font-semibold text-zinc-800">
                          {c.prenom} {c.nom}
                        </div>
                        {c.email && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{c.email}</div>
                        )}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.barreau && (
                            <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px]">
                              {c.barreau}
                            </span>
                          )}
                          {c.entreprise && (
                            <span className="px-1 py-0.5 rounded bg-zinc-50 text-zinc-500 text-[9px] max-w-22.5 truncate">
                              {c.entreprise}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-[10px] text-zinc-400">Aucune de ces personnes ?</span>
                    <button
                      type="button"
                      onClick={onOpenCreatePP}
                      className="text-xs px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={11} /> Créer une PP
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdate({ skipped: true, open: false })}
                      className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                    >
                      Sans lien PP
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
                    <Check size={11} className="text-zinc-400 shrink-0" />
                    <span className="text-zinc-600">
                      Sélection :{" "}
                      <strong>
                        {pendingCandidate.prenom} {pendingCandidate.nom}
                      </strong>
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
                          ppId: pendingCandidate.id,
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
                          ppId: pendingCandidate.id,
                          updatePpEmail: true,
                          pendingCandidate: null,
                          open: false,
                        })
                      }
                      className="flex-1 min-w-40 text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-left leading-tight"
                    >
                      Utiliser <span className="font-mono">{raw.email ?? "—"}</span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── NONE ────────────────────────────────────────────────────── */}
          {status === "none" && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-zinc-500 flex-1">
                Aucune personne physique trouvée dans le CRM.
              </p>
              <button
                type="button"
                onClick={onOpenCreatePP}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 flex items-center gap-1 shrink-0 transition-colors"
              >
                <Plus size={11} /> Créer PP
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ skipped: true, open: false })}
                className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 shrink-0"
              >
                Sans lien
              </button>
            </div>
          )}
        </div>
      )}

      {/* Body — resolved (info text, only when no structure decision pending) */}
      {open && identityResolved && !structureNeeded && (
        <div className="px-3 pb-2 pt-1.5 border-t border-zinc-100 text-[11px] text-zinc-400">
          {ppId
            ? `Lié${entry.updatePpEmail ? " · email PP mis à jour" : ""}`
            : "Importé sans lien personne physique."}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  formationId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportParticipantsModal({ formationId, onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntryState[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  // Which entry is currently opening the PP creation modal (by idInscription)
  const [createPPForEntryId, setCreatePPForEntryId] = useState<number | null>(null);

  function updateEntry(id: number, u: Partial<EntryState>) {
    setEntries((prev) =>
      prev.map((e) => (e.raw.idInscription === id ? { ...e, ...u } : e)),
    );
  }

  // ─── Step 1: parse + match ──────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    setPhase("matching");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null });
      if (rows[0]) console.log("[LAP colonnes]", Object.keys(rows[0]));

      const parsed = rows.map(rowToParticipant).filter(Boolean) as RawParticipant[];
      if (parsed.length === 0) {
        setError("Aucun participant trouvé dans ce fichier.");
        setPhase("upload");
        return;
      }

      const matchInputs: ParticipantMatchInput[] = parsed.map((p) => ({
        idInscription: p.idInscription,
        email: p.email,
        nom: p.nom,
        prenom: p.prenom,
        barreau: p.barreau,
      }));

      const res = await fetch(`/api/formations/${formationId}/participants/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchInputs),
      });

      if (!res.ok) throw new Error("Erreur lors de l'analyse des correspondances.");

      const matchResults: ParticipantMatchResult[] = await res.json();

      setExistingCount(matchResults.filter((r) => r.existing).length);

      const newEntries: EntryState[] = parsed
        .map((raw): EntryState | null => {
          const mr = matchResults.find((r) => r.idInscription === raw.idInscription)!;
          if (mr.existing) return null;
          return {
            raw,
            matchResult: mr,
            open: false,
            ppId: mr.status === "exact" ? (mr.candidates[0]?.id ?? null) : null,
            updatePpEmail: false,
            skipped: false,
            pendingCandidate: null,
            structureRattachement: null,
          };
        })
        .filter(Boolean) as EntryState[];

      setEntries(newEntries);
      setPhase("resolve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("upload");
    }
  }

  // ─── Step 2: confirm import ─────────────────────────────────────────────────

  async function handleConfirm() {
    const unresolved = entries.filter((e) => !isResolved(e));
    if (unresolved.length > 0) {
      setError(
        `${unresolved.length} warning${unresolved.length > 1 ? "s" : ""} non résolus — traitez-les avant d'importer.`,
      );
      return;
    }
    setPhase("importing");
    setError(null);
    try {
      const payload = entries.map((e) => ({
        ...e.raw,
        personnePhysiqueId: e.ppId,
        updatePpEmail: e.updatePpEmail,
        structureRattachement: e.structureRattachement,
      }));

      const res = await fetch(`/api/formations/${formationId}/participants/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erreur lors de l'import.");

      const data = (await res.json()) as { created: number; skipped: number };
      setResult(data);
      setPhase("done");
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPhase("resolve");
    }
  }

  // ─── Derived stats ──────────────────────────────────────────────────────────

  const exactEntries = entries.filter(
    (e) => e.matchResult.status === "exact" && !needsStructureDecision(e),
  );
  const warningEntries = entries.filter(
    (e) => e.matchResult.status !== "exact" || needsStructureDecision(e),
  );
  const unresolvedCount = warningEntries.filter((e) => !isResolved(e)).length;
  const canImport = phase === "resolve" && unresolvedCount === 0;

  // ─── Create PP modal data ───────────────────────────────────────────────────

  const createPPEntry = createPPForEntryId !== null
    ? entries.find((e) => e.raw.idInscription === createPPForEntryId) ?? null
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Users size={14} className="text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Importer les participants</h2>
                <p className="text-[11px] text-zinc-400">Fichier LAP Dendreo (.xlsx)</p>
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
              <div className="flex flex-col items-center gap-4 py-6">
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
                    <p className="font-medium text-zinc-700">Déposer le fichier LAP ici</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      ou cliquer pour sélectionner (.xlsx)
                    </p>
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
                  <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5 w-full">
                    {error}
                  </p>
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

                {/* Stats chips */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "À importer", value: entries.length, color: "bg-zinc-100 text-zinc-700" },
                    { label: "Parfaits", value: exactEntries.length, color: "bg-green-100 text-green-700" },
                    {
                      label:
                        unresolvedCount > 0
                          ? `Warnings · ${unresolvedCount} restant${unresolvedCount > 1 ? "s" : ""}`
                          : "Warnings · tous résolus",
                      value: warningEntries.length,
                      color:
                        unresolvedCount > 0 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500",
                    },
                    ...(existingCount > 0
                      ? [{ label: "Déjà présents", value: existingCount, color: "bg-zinc-50 text-zinc-400" }]
                      : []),
                  ].map((s) => (
                    <div key={s.label} className={`rounded-lg px-3 py-1.5 ${s.color}`}>
                      <span className="text-base font-bold">{s.value}</span>
                      <span className="text-[10px] ml-1.5 opacity-75">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Warnings section */}
                {warningEntries.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                      Warnings à traiter ({warningEntries.length})
                    </h3>
                    {warningEntries.map((e) => (
                      <WarningRow
                        key={e.raw.idInscription}
                        entry={e}
                        onUpdate={(u) => updateEntry(e.raw.idInscription, u)}
                        onOpenCreatePP={() => setCreatePPForEntryId(e.raw.idInscription)}
                      />
                    ))}
                  </div>
                )}

                {/* Exact matches (collapsed) */}
                {exactEntries.length > 0 && (
                  <details>
                    <summary className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer list-none flex items-center gap-1 select-none">
                      <ChevronRight size={11} className="open:rotate-90 transition-transform" />
                      Matchés parfaitement ({exactEntries.length})
                    </summary>
                    <div className="mt-1.5 space-y-0.5">
                      {exactEntries.map((e) => (
                        <div
                          key={e.raw.idInscription}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-50 text-xs"
                        >
                          <Check size={11} className="text-green-500 shrink-0" />
                          <span className="flex-1 text-zinc-700 truncate">
                            {e.raw.nomAffiche ??
                              `${e.raw.prenom ?? ""} ${e.raw.nom ?? ""}`.trim()}
                          </span>
                          {e.raw.email && (
                            <span className="text-zinc-400 font-mono truncate max-w-50">
                              {e.raw.email}
                            </span>
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
                <p className="text-sm text-zinc-500">Import en cours…</p>
              </div>
            )}

            {/* Done */}
            {phase === "done" && result && (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                  <Check size={22} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-zinc-900">
                    {result.created} participant{result.created > 1 ? "s" : ""} importé
                    {result.created > 1 ? "s" : ""}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {result.skipped} déjà présent{result.skipped > 1 ? "s" : ""}
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
                    {unresolvedCount} warning{unresolvedCount > 1 ? "s" : ""} restant
                    {unresolvedCount > 1 ? "s" : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!canImport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  Importer {entries.length} participant{entries.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PP creation sub-modal */}
      {createPPEntry && (
        <CreatePPForImportModal
          formationId={formationId}
          prefilled={{
            nom: createPPEntry.raw.nom ?? "",
            prenom: createPPEntry.raw.prenom ?? "",
            email: createPPEntry.raw.email ?? "",
            telephone: createPPEntry.raw.telephone ?? "",
            portable: createPPEntry.raw.portable ?? "",
            barreau: createPPEntry.raw.barreau ?? "",
            entreprise: createPPEntry.raw.entreprise ?? "",
            adresseEntreprise: createPPEntry.raw.adresseEntreprise ?? "",
            cpEntreprise: createPPEntry.raw.cpEntreprise ?? "",
            villeEntreprise: createPPEntry.raw.villeEntreprise ?? "",
          }}
          onCreated={(ppId) => {
            updateEntry(createPPEntry.raw.idInscription, {
              ppId,
              updatePpEmail: false,
              open: false,
            });
            setCreatePPForEntryId(null);
          }}
          onClose={() => setCreatePPForEntryId(null)}
        />
      )}
    </>
  );
}
