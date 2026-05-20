"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Check, X, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RattachementsPmModal } from "@/components/pp/RattachementsPmModal";
import { inputCls } from "@/components/ui/form-field";

export type RattachementRow = {
  id: number;
  titreFonction: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  personneMorale: {
    id: number;
    raisonSociale: string;
    siretSiren: string | null;
    email: string | null;
    telephone: string | null;
  };
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR");
}

function toInputDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

type EditState = {
  id: number;
  titreFonction: string;
  dateFin: string;
};

type RowProps = {
  r: RattachementRow;
  editing: EditState | null;
  saving: boolean;
  deleting: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditChange: (patch: Partial<EditState>) => void;
  muted?: boolean;
};

function RattachementRow({
  r,
  editing,
  saving,
  deleting,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditChange,
  muted = false,
}: RowProps) {
  const isEditing = editing?.id === r.id;

  return (
    <tr className={cn("group hover:bg-zinc-50/60", muted && "opacity-60")}>
      <td className="py-2.5 pr-4 font-medium">
        <Link
          href={`/personnes-morales/${r.personneMorale.id}`}
          className="text-secondary-600 hover:underline"
        >
          {r.personneMorale.raisonSociale}
        </Link>
        {r.personneMorale.siretSiren && (
          <div className="text-[11px] text-zinc-400 mt-0.5">{r.personneMorale.siretSiren}</div>
        )}
      </td>

      <td className="py-2.5 pr-4">
        {isEditing ? (
          <input
            className={cn(inputCls, "py-1 text-xs w-36")}
            value={editing.titreFonction}
            onChange={(e) => onEditChange({ titreFonction: e.target.value })}
            placeholder="Titre / Poste"
            autoFocus
          />
        ) : (
          <span className="text-zinc-600">{r.titreFonction ?? "—"}</span>
        )}
      </td>

      <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{fmtDate(r.dateDebut)}</td>

      <td className="py-2.5 pr-4 whitespace-nowrap">
        {isEditing ? (
          <input
            type="date"
            className={cn(inputCls, "py-1 text-xs w-36")}
            value={editing.dateFin}
            onChange={(e) => onEditChange({ dateFin: e.target.value })}
          />
        ) : (
          <span className="text-zinc-500">{fmtDate(r.dateFin)}</span>
        )}
      </td>

      <td className="py-2.5 pr-2">
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold",
            !r.dateFin ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500",
          )}
        >
          {!r.dateFin ? "Actuel" : "Terminé"}
        </span>
      </td>

      <td className="py-2.5 pl-1 whitespace-nowrap">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving}
              className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 cursor-pointer"
              title="Enregistrer"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="p-1 rounded text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              title="Annuler"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onStartEdit}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              title="Supprimer"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

const TABLE_HEADERS = ["Organisation", "Titre / Fonction", "Début", "Fin", "Statut", ""] as const;

function RattachementsTable({
  rows,
  editing,
  saving,
  deletingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditChange,
  muted,
}: {
  rows: RattachementRow[];
  editing: EditState | null;
  saving: boolean;
  deletingId: number | null;
  onStartEdit: (r: RattachementRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: number) => void;
  onEditChange: (patch: Partial<EditState>) => void;
  muted?: boolean;
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            {TABLE_HEADERS.map((h) => (
              <th
                key={h}
                className="text-left pb-2 pr-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {rows.map((r) => (
            <RattachementRow
              key={r.id}
              r={r}
              editing={editing?.id === r.id ? editing : null}
              saving={saving && editing?.id === r.id}
              deleting={deletingId === r.id}
              onStartEdit={() =>
                onStartEdit(r)
              }
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onDelete={() => onDelete(r.id)}
              onEditChange={onEditChange}
              muted={muted}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  rattachements: RattachementRow[];
  ppId: number;
  ppNom: string;
};

export function RattachementsList({ rattachements, ppId, ppNom }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const active = rattachements.filter((r) => !r.dateFin);
  const past = rattachements.filter((r) => !!r.dateFin);

  const handleStartEdit = (r: RattachementRow) => {
    setEditing({
      id: r.id,
      titreFonction: r.titreFonction ?? "",
      dateFin: toInputDate(r.dateFin),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/rattachements/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titreFonction: editing.titreFonction || null,
          dateFin: editing.dateFin || null,
        }),
      });
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/rattachements/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    router.refresh();
  };

  const tableProps = {
    editing,
    saving,
    deletingId,
    onStartEdit: handleStartEdit,
    onCancelEdit: () => setEditing(null),
    onSaveEdit: handleSave,
    onDelete: handleDelete,
    onEditChange: (patch: Partial<EditState>) =>
      setEditing((prev) => (prev ? { ...prev, ...patch } : prev)),
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition cursor-pointer shrink-0"
        >
          <Building2 size={13} />
          Rattacher à une organisation
        </button>
      </div>

      {rattachements.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">Aucun rattachement enregistré</p>
      ) : (
        <>
          {active.length > 0 && (
            <RattachementsTable rows={active} {...tableProps} />
          )}

          {past.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-zinc-100" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Anciens rattachements ({past.length})
                </span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
              <RattachementsTable rows={past} {...tableProps} muted />
            </div>
          )}
        </>
      )}

      <RattachementsPmModal
        open={showModal}
        onClose={handleModalClose}
        ppId={ppId}
        ppNom={ppNom}
      />
    </div>
  );
}
