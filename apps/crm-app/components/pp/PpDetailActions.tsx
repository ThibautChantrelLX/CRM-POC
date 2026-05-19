"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  ppId: number;
  ppNom: string;
};

export function PpDetailActions({ ppId, ppNom }: Props) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/personnes-physiques/${ppId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      router.push("/personnes-physiques");
      router.refresh();
    } catch {
      setDeleteError("La suppression a échoué. Veuillez réessayer.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDelete(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer ml-auto"
      >
        <Trash2 size={14} />
        Supprimer
      </button>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Supprimer cette personne physique ?
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  <span className="font-medium text-zinc-700">{ppNom}</span> sera définitivement
                  supprimée. Cette action est irréversible.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => { setShowDelete(false); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
              >
                Annuler
              </button>
              <SubmitButton variant="danger" isLoading={isDeleting} onClick={handleDelete}>
                Supprimer définitivement
              </SubmitButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
