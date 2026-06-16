"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, UserPlus, Check, X, ExternalLink } from "lucide-react";
import { ImportParticipantsModal } from "./ImportParticipantsModal";
import type { ParticipantListItem } from "@/lib/server/modules/formations/participants-service";
import { PP_ATTACH_PM_STORAGE_KEY } from "@/lib/client/personnes-morales";
import type { PmAttachInfo } from "@/lib/client/personnes-morales";

const PP_DRAFT_KEY = "pp-create-draft";

type PpFormState = {
  profilType: string;
  nom: string;
  prenom: string;
  email: string;
  extraEmails: string[];
  telephone: string;
  portable: string;
  typeRelation: string;
  statutRgpd: string;
  actif: boolean;
  optInEmail: boolean;
  optInSms: boolean;
  optOutGlobal: boolean;
  barreau: string;
  dateSerment: string;
  specialiteAvocat: string;
  professionAvocat: string;
  activiteDominante: string;
  professionPro: string;
  specialitePro: string;
  civilite: string;
  dateNaissance: string;
  situationFamiliale: string;
};

const EMPTY_FORM: PpFormState = {
  profilType: "PARTICULIER",
  nom: "",
  prenom: "",
  email: "",
  extraEmails: [],
  telephone: "",
  portable: "",
  typeRelation: "CONTACT",
  statutRgpd: "",
  actif: true,
  optInEmail: false,
  optInSms: false,
  optOutGlobal: false,
  barreau: "",
  dateSerment: "",
  specialiteAvocat: "",
  professionAvocat: "",
  activiteDominante: "",
  professionPro: "",
  specialitePro: "",
  civilite: "",
  dateNaissance: "",
  situationFamiliale: "",
};

interface Props {
  formationId: string;
  participants: ParticipantListItem[];
}

export function ParticipantsSection({ formationId, participants }: Props) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [creatingId, setCreatingId] = useState<number | null>(null);

  async function handleCreatePp(p: ParticipantListItem) {
    setCreatingId(p.id);
    try {
      // Try to find the PM by name
      let attachedPm: PmAttachInfo | null = null;
      if (p.entreprise) {
        try {
          const res = await fetch(
            `/api/personnes-morales?search=${encodeURIComponent(p.entreprise)}&limit=1`,
          );
          if (res.ok) {
            const data = await res.json() as { items?: { id: string; raisonSociale: string; siretSiren: string | null; typeStructure: string | null; nomDomaine: string | null }[] };
            const first = data.items?.[0];
            if (first && first.raisonSociale.toLowerCase() === p.entreprise.toLowerCase()) {
              attachedPm = {
                id: first.id,
                raisonSociale: first.raisonSociale,
                siretSiren: first.siretSiren,
                typeStructure: first.typeStructure,
                nomDomaine: first.nomDomaine,
              };
            }
          }
        } catch {
          // PM lookup is best-effort
        }
      }

      const draft = {
        form: {
          ...EMPTY_FORM,
          profilType: p.barreau ? "AVOCAT" : "PARTICULIER",
          nom: p.nom ?? "",
          prenom: p.prenom ?? "",
          email: p.email ?? "",
          barreau: p.barreau ?? "",
        },
        attachedPm,
      };

      localStorage.setItem(PP_DRAFT_KEY, JSON.stringify(draft));
      if (attachedPm) {
        sessionStorage.setItem(PP_ATTACH_PM_STORAGE_KEY, JSON.stringify(attachedPm));
      }
      router.push("/personnes-physiques/nouveau");
    } finally {
      setCreatingId(null);
    }
  }

  const linked = participants.filter((p) => p.personnePhysiqueId !== null);
  const unlinked = participants.filter((p) => p.personnePhysiqueId === null);

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">
            Participants{" "}
            <span className="text-zinc-400 font-normal">({participants.length})</span>
          </h3>
          {unlinked.length > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              {unlinked.length} sans lien personne physique
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors"
        >
          <Upload size={12} /> Importer
        </button>
      </div>

      {participants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <p className="text-sm text-zinc-400">Aucun participant importé</p>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            <Upload size={12} /> Importer le fichier LAP
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                {["Participant", "Email", "Entreprise", "Barreau", "Présence", "Satisfaction", "Personne physique", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {participants.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-zinc-50/60 transition-colors ${!p.personnePhysiqueId ? "bg-amber-50/30" : ""}`}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-zinc-800 whitespace-nowrap">
                      {p.nomAffiche ?? `${p.prenom ?? ""} ${p.nom ?? ""}`.trim()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500 max-w-[160px] truncate">
                    {p.email ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500 max-w-[150px] truncate">
                    {p.entreprise ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                    {p.barreau ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.present ? (
                      <Check size={13} className="text-green-500" />
                    ) : (
                      <X size={13} className="text-zinc-300" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500">
                    {p.satisfaction != null ? `${Math.round(p.satisfaction * 100)} %` : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.personnePhysiqueId ? (
                      <Link
                        href={`/personnes-physiques/${p.personnePhysiqueId}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {p.ppPrenom} {p.ppNom}
                        <ExternalLink size={10} />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        Non lié
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {!p.personnePhysiqueId && (
                      <button
                        type="button"
                        onClick={() => void handleCreatePp(p)}
                        disabled={creatingId === p.id}
                        title={p.entreprise ? `Créer PP — entreprise : ${p.entreprise}` : "Créer la personne physique"}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] hover:bg-zinc-200 transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        <UserPlus size={11} /> Créer PP
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats bar */}
      {participants.length > 0 && (
        <div className="mt-3 flex gap-4 text-xs text-zinc-400">
          <span>{linked.length} liés</span>
          {unlinked.length > 0 && <span className="text-amber-500">{unlinked.length} non liés</span>}
          <span>{participants.filter((p) => p.present).length} présents</span>
        </div>
      )}

      {showImport && (
        <ImportParticipantsModal
          formationId={formationId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
