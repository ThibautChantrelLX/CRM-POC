"use client";

import { Building2, Plus, Trash2, Check } from "lucide-react";
import type { StructureRattachementInput } from "@/lib/server/utils/pm-utils";

export type { StructureRattachementInput };

interface Props {
  structureNom: string;
  existingRattachements: Array<{ id: number; raisonSociale: string }>;
  decision: StructureRattachementInput | null;
  onChange: (d: StructureRattachementInput) => void;
}

export function StructureReconciliationWidget({
  structureNom,
  existingRattachements,
  decision,
  onChange,
}: Props) {
  const alreadyLinked = existingRattachements.some(
    (r) => r.raisonSociale.toLowerCase() === structureNom.toLowerCase(),
  );

  if (alreadyLinked) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        <Check size={11} />
        <span>
          Déjà rattaché à <strong>{structureNom}</strong>
        </span>
      </div>
    );
  }

  const action = decision?.action ?? null;
  const keepIds = decision?.keepIds ?? existingRattachements.map((r) => r.id);

  function setAction(a: StructureRattachementInput["action"]) {
    onChange({ structureNom, action: a, keepIds: a === "addKeepSome" ? keepIds : [] });
  }

  function toggleKeep(id: number) {
    const next = keepIds.includes(id) ? keepIds.filter((k) => k !== id) : [...keepIds, id];
    onChange({ structureNom, action: "addKeepSome", keepIds: next });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Building2 size={11} className="text-zinc-400 shrink-0" />
        <span>
          Structure dans le fichier :{" "}
          <strong className="text-zinc-700">{structureNom}</strong>
        </span>
      </div>

      {existingRattachements.length > 0 && (
        <div className="text-[11px] text-zinc-400">
          Rattachements actuels :{" "}
          {existingRattachements.map((r) => r.raisonSociale).join(", ")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAction("addKeepAll")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
            action === "addKeepAll"
              ? "border-blue-400 bg-blue-50 text-blue-800 font-medium"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          <Plus size={10} />
          Ajouter — garder les anciens
        </button>

        <button
          type="button"
          onClick={() => setAction("addReplaceAll")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
            action === "addReplaceAll"
              ? "border-red-300 bg-red-50 text-red-800 font-medium"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          <Trash2 size={10} />
          Remplacer — supprimer les anciens
        </button>

        {existingRattachements.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                structureNom,
                action: "addKeepSome",
                keepIds: existingRattachements.map((r) => r.id),
              })
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
              action === "addKeepSome"
                ? "border-amber-300 bg-amber-50 text-amber-800 font-medium"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Gérer au cas par cas
          </button>
        )}

        <button
          type="button"
          onClick={() => setAction("skip")}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
            action === "skip"
              ? "border-zinc-400 bg-zinc-100 text-zinc-700 font-medium"
              : "border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50"
          }`}
        >
          Ne pas modifier
        </button>
      </div>

      {/* Per-item management */}
      {action === "addKeepSome" && existingRattachements.length > 0 && (
        <div className="border border-amber-200 rounded-lg p-2.5 space-y-1.5 bg-amber-50/30">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
            Rattachements existants
          </p>
          {existingRattachements.map((r) => {
            const kept = keepIds.includes(r.id);
            return (
              <div key={r.id} className="flex items-center gap-2.5">
                <span className="flex-1 text-zinc-700 truncate">{r.raisonSociale}</span>
                <button
                  type="button"
                  onClick={() => toggleKeep(r.id)}
                  className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    kept
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {kept ? <><Check size={9} /> Garder</> : <><Trash2 size={9} /> Supprimer</>}
                </button>
              </div>
            );
          })}
          <div className="text-[10px] text-zinc-400 pt-0.5">
            + <strong>{structureNom}</strong> sera ajouté
          </div>
        </div>
      )}
    </div>
  );
}
