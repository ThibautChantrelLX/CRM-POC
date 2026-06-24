"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Upload, Eye, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/admin/DataTable";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { ImportFormationsModal, fmtDatetime } from "@/components/formations/ImportFormationsModal";
import type { FormationListItem } from "@/lib/server/modules/formations/dto";

function AvancementBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-300">—</span>;
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

interface Props {
  initialFormations: FormationListItem[];
}

export function FormationsClient({ initialFormations }: Props) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [formations, setFormations] = useState(initialFormations);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleImported = useCallback(() => {
    router.refresh();
  }, [router]);

  async function handleDelete(f: FormationListItem) {
    if (!confirm(`Supprimer la formation "${f.intitule}" ?\nCette action supprimera aussi toutes les participations associées.`)) return;
    setDeletingId(f.id);
    try {
      const res = await fetch(`/api/formations/${f.id}`, { method: "DELETE" });
      if (res.ok) {
        setFormations((prev) => prev.filter((x) => x.id !== f.id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "numero",
      label: "Numéro",
      sortable: true,
      sortValue: (r: FormationListItem) => r.numero,
      render: (r: FormationListItem) => (
        <span className="font-mono text-xs text-zinc-400">{r.numero}</span>
      ),
    },
    {
      key: "intitule",
      label: "Intitulé",
      sortable: true,
      sortValue: (r: FormationListItem) => r.intitule,
      render: (r: FormationListItem) => (
        <div className="max-w-xs">
          <p className="text-sm font-medium text-zinc-800 truncate" title={r.intitule}>{r.intitule}</p>
          {r.categorie && <p className="text-xs text-zinc-400 truncate">{r.categorie}</p>}
        </div>
      ),
    },
    {
      key: "dateDebut",
      label: "Début",
      sortable: true,
      sortValue: (r: FormationListItem) => r.dateDebut ?? "",
      render: (r: FormationListItem) => (
        <span className="text-xs text-zinc-500 whitespace-nowrap">{fmtDatetime(r.dateDebut)}</span>
      ),
    },
    {
      key: "dateFin",
      label: "Fin",
      sortable: true,
      sortValue: (r: FormationListItem) => r.dateFin ?? "",
      render: (r: FormationListItem) => (
        <span className="text-xs text-zinc-500 whitespace-nowrap">{fmtDatetime(r.dateFin)}</span>
      ),
    },
    {
      key: "dureeHeures",
      label: "Durée",
      render: (r: FormationListItem) => (
        <span className="text-xs text-zinc-500">
          {r.dureeHeures != null ? `${r.dureeHeures} h` : "—"}
        </span>
      ),
    },
    {
      key: "avancement",
      label: "Avancement",
      sortable: true,
      sortValue: (r: FormationListItem) => r.avancement ?? "",
      render: (r: FormationListItem) => <AvancementBadge value={r.avancement} />,
    },
    {
      key: "nbInscrits",
      label: "Inscrits",
      sortable: true,
      sortValue: (r: FormationListItem) => r.nbInscrits ?? 0,
      render: (r: FormationListItem) => (
        <span className="text-xs text-zinc-500">{r.nbInscrits ?? "—"}</span>
      ),
    },
    {
      key: "responsable",
      label: "Responsable",
      render: (r: FormationListItem) => (
        <span className="text-xs text-zinc-500 truncate max-w-30 block">{r.responsable ?? "—"}</span>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Formations"
        description={`${formations.length} formation${formations.length > 1 ? "s" : ""}`}
        actions={
          <AdminButton variant="primary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Importer
          </AdminButton>
        }
      />

      {formations.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <GraduationCap size={26} className="text-zinc-300" />
          </div>
          <div>
            <p className="font-medium text-zinc-600">Aucune formation</p>
            <p className="text-sm text-zinc-400 mt-1">Importez le fichier Dendreo pour commencer.</p>
          </div>
          <AdminButton variant="primary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Importer des formations
          </AdminButton>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={formations}
          getKey={(r) => r.id}
          searchPlaceholder="Rechercher par intitulé, numéro, responsable…"
          searchFilter={(r, q) =>
            r.intitule.toLowerCase().includes(q) ||
            r.numero.toLowerCase().includes(q) ||
            (r.responsable ?? "").toLowerCase().includes(q) ||
            (r.categorie ?? "").toLowerCase().includes(q)
          }
          actions={(r) => (
            <>
              <Link
                href={`/admin/formations/${r.id}`}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                title="Voir"
              >
                <Eye size={14} />
              </Link>
              <Link
                href={`/admin/formations/${r.id}/edit`}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                title="Modifier"
              >
                <Pencil size={14} />
              </Link>
              <button
                onClick={() => void handleDelete(r)}
                disabled={deletingId === r.id}
                className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-40"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        />
      )}

      {showImport && (
        <ImportFormationsModal
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
    </>
  );
}
