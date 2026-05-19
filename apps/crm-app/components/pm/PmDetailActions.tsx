"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, AlertTriangle } from "lucide-react";
import { RattachementsModal } from "@/components/pm/RattachementsModal";
import { SubmitButton } from "@/components/ui/submit-button";

type Contact = {
  id: number;
  personnePhysique: { id: number; nom: string; prenom: string | null };
  titreFonction: string | null;
};

type Props = {
  pmId: number;
  pmNom: string;
  pmNomDomaine: string | null;
  contacts: Contact[];
};

export function PmDetailActions({ pmId, pmNom, pmNomDomaine, contacts }: Props) {
  const router = useRouter();
  const [showRattach, setShowRattach] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/personnes-morales/${pmId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      router.push("/personnes-morales");
      router.refresh();
    } catch {
      setDeleteError("La suppression a échoué. Veuillez réessayer.");
      setIsDeleting(false);
    }
  };

  const handleRattachDone = () => {
    setShowRattach(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={() => setShowRattach(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
        >
          <UserPlus size={14} />
          Rattacher
        </button>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
        >
          <Trash2 size={14} />
          Supprimer
        </button>
      </div>

      {/* Rattachement modal */}
      <RattachementsModal
        open={showRattach}
        onClose={handleRattachDone}
        pmId={pmId}
        pmNom={pmNom}
        pmNomDomaine={pmNomDomaine}
      />

      {/* Delete confirmation overlay */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Supprimer cette personne morale ?
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  <span className="font-medium text-zinc-700">{pmNom}</span> sera définitivement
                  supprimée. Cette action est irréversible.
                </p>
              </div>
            </div>

            {contacts.length > 0 && (
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
                <p className="text-xs font-semibold text-primary-700 mb-2">
                  {contacts.length} personne{contacts.length > 1 ? "s" : ""} rattachée
                  {contacts.length > 1 ? "s" : ""} sera{contacts.length > 1 ? "ont" : ""} détachée
                  {contacts.length > 1 ? "s" : ""} :
                </p>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700">
                        {c.personnePhysique.prenom} {c.personnePhysique.nom}
                      </span>
                      {c.titreFonction && (
                        <span className="text-zinc-400">{c.titreFonction}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
