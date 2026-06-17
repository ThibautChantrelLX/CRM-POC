import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/server/auth";
import { getFormationDetail } from "@/lib/server/modules/formations/service";
import { getFormationParticipants } from "@/lib/server/modules/formations/participants-service";
import { ParticipantsSection } from "@/components/formations/ParticipantsSection";
import type { Role } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"];

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  if (h === 0 && min === 0) return datePart;
  return `${datePart} · ${String(h).padStart(2, "0")}h${String(min).padStart(2, "0")}`;
}

function fmtPct(v: number | null): string | null {
  if (v === null) return null;
  return `${Math.round(v * 100)} %`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-zinc-50 last:border-0">
      <dt className="w-40 shrink-0 text-xs font-medium text-zinc-400 pt-0.5">{label}</dt>
      <dd className="text-sm text-zinc-800 flex-1">{value ?? <span className="text-zinc-300">—</span>}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/60">
        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="px-5 py-2">
        <dl>{children}</dl>
      </div>
    </div>
  );
}

function SatisfBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-zinc-700 w-10 text-right">{pct} %</span>
    </div>
  );
}

export default async function FormationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string })?.role ?? "USER") as Role;
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/personnes-physiques");

  const { id } = await params;
  const [f, participants] = await Promise.all([
    getFormationDetail(id),
    getFormationParticipants(id),
  ]);
  if (!f) notFound();

  const hasSatisfChaud = f.satisfGenerale !== null || f.satisfFormateur !== null || f.satisfSalle !== null;

  return (
    <div className="min-h-screen bg-zinc-50/40">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-8 py-3 flex items-center justify-between">
        <Link
          href="/admin/formations"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={15} />
          Retour aux formations
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/formations/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Modifier
          </Link>
        </div>
      </div>

      <div className="px-8 py-8 max-w-7xl mx-auto">
        {/* Hero header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-1">{f.numero}</p>
              <h1 className="text-2xl font-bold text-zinc-900 leading-snug max-w-3xl">{f.intitule}</h1>
              {f.intituleCourt && (
                <p className="text-sm text-zinc-500 mt-1">{f.intituleCourt}</p>
              )}
            </div>
            {f.avancement && (
              <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shrink-0 ${
                f.avancement === "Terminé" ? "bg-green-100 text-green-700" :
                f.avancement === "En cours" ? "bg-blue-100 text-blue-700" :
                "bg-zinc-100 text-zinc-600"
              }`}>
                {f.avancement}
              </span>
            )}
          </div>

          {/* Key metrics strip */}
          <div className="mt-5 flex items-center gap-6 flex-wrap text-sm">
            {f.dateDebut && (
              <div className="flex items-center gap-1.5 text-zinc-600">
                <span className="text-zinc-400 text-xs">Début</span>
                <span className="font-medium">{fmtDatetime(f.dateDebut)}</span>
              </div>
            )}
            {f.dateFin && (
              <div className="flex items-center gap-1.5 text-zinc-600">
                <span className="text-zinc-400 text-xs">Fin</span>
                <span className="font-medium">{fmtDatetime(f.dateFin)}</span>
              </div>
            )}
            {f.dureeHeures != null && (
              <div className="flex items-center gap-1.5 text-zinc-600">
                <span className="text-zinc-400 text-xs">Durée</span>
                <span className="font-medium">{f.dureeHeures} h{f.dureeJours != null ? ` · ${f.dureeJours} j` : ""}</span>
              </div>
            )}
            {f.lieu && (
              <div className="flex items-center gap-1.5 text-zinc-600">
                <span className="text-zinc-400 text-xs">Lieu</span>
                <span className="font-medium">{f.lieu}</span>
              </div>
            )}
            {f.modeOrganisation && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                {f.modeOrganisation}
              </span>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left column — 2/3 */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* Classification */}
            <Card title="Informations">
              <InfoRow label="Référence" value={<span className="font-mono text-xs">{f.numero}</span>} />
              {f.idDendreo != null && <InfoRow label="ID Dendreo" value={f.idDendreo} />}
              <InfoRow label="Catégorie" value={f.categorie} />
              <InfoRow label="Nature" value={f.nature} />
            </Card>

            {/* Intervenants */}
            <Card title="Intervenants">
              <InfoRow label="Responsable" value={f.responsable} />
              <InfoRow label="Formateurs" value={f.formateurs} />
            </Card>

            {/* Satisfaction */}
            {hasSatisfChaud && (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Satisfaction à chaud</h3>
                  {f.tauxReponseChaud != null && (
                    <span className="text-xs text-zinc-400">{Math.round(f.tauxReponseChaud * 100)} % de réponses</span>
                  )}
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  {f.satisfGenerale != null && <SatisfBar label="Générale" value={f.satisfGenerale} />}
                  {f.satisfFormateur != null && <SatisfBar label="Formateur" value={f.satisfFormateur} />}
                  {f.satisfSalle != null && <SatisfBar label="Salle" value={f.satisfSalle} />}
                  {f.satisfGeneraleFroid != null && (
                    <div className="mt-2 pt-3 border-t border-zinc-50 flex items-center justify-between">
                      <div className="flex flex-col gap-1.5">
                        <SatisfBar label="Générale (à froid)" value={f.satisfGeneraleFroid} />
                      </div>
                      {f.tauxReponseFroid != null && (
                        <span className="text-xs text-zinc-400">{Math.round(f.tauxReponseFroid * 100)} % réponses</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Programme */}
            {f.description && (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/60">
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Programme</h3>
                </div>
                <div className="px-5 py-4 text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {f.description}
                </div>
              </div>
            )}
          </div>

          {/* Right column — 1/3 */}
          <div className="col-span-1 flex flex-col gap-6">
            {/* Participants */}
            <Card title="Participants">
              <InfoRow
                label="Inscrits"
                value={
                  f.nbInscrits != null ? (
                    <span className="font-semibold text-zinc-900">{f.nbInscrits}</span>
                  ) : null
                }
              />
              <InfoRow
                label="Présents"
                value={
                  f.nbPresents != null ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">{f.nbPresents}</span>
                      {f.nbInscrits != null && f.nbInscrits > 0 && (
                        <span className="text-xs text-zinc-400">
                          ({Math.round((f.nbPresents / f.nbInscrits) * 100)} %)
                        </span>
                      )}
                    </div>
                  ) : null
                }
              />
              <InfoRow
                label="Dans le CRM"
                value={
                  participants.length > 0 ? (
                    <span className="font-semibold text-zinc-900">{participants.length}</span>
                  ) : (
                    <span className="text-zinc-300 text-xs">Aucune</span>
                  )
                }
              />
            </Card>

            {/* Financier */}
            {(f.recettes !== null || f.marge !== null) && (
              <Card title="Récapitulatif financier">
                {f.recettes != null && (
                  <InfoRow label="Recettes" value={`${f.recettes.toLocaleString("fr-FR")} €`} />
                )}
                {f.depenses != null && (
                  <InfoRow label="Dépenses" value={`${f.depenses.toLocaleString("fr-FR")} €`} />
                )}
                {f.marge != null && (
                  <InfoRow
                    label="Marge"
                    value={
                      <span className={f.marge >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {f.marge.toLocaleString("fr-FR")} €
                      </span>
                    }
                  />
                )}
              </Card>
            )}

            {/* Satisfaction score recap */}
            {f.satisfGenerale != null && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 text-center">
                <div className="text-4xl font-bold text-zinc-900">{fmtPct(f.satisfGenerale)}</div>
                <div className="text-xs text-zinc-400 mt-1">Satisfaction générale</div>
                {f.tauxReponseChaud != null && (
                  <div className="mt-2 text-xs text-zinc-400">
                    sur {Math.round(f.tauxReponseChaud * 100)} % de participants
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <Card title="Métadonnées">
              <InfoRow label="Créé le" value={fmtDatetime(f.creerLe)} />
              {f.creerPar && <InfoRow label="Créé par" value={f.creerPar} />}
              <InfoRow label="Modifié le" value={fmtDatetime(f.modifierLe)} />
              {f.modifierPar && <InfoRow label="Modifié par" value={f.modifierPar} />}
            </Card>
          </div>
        </div>

        {/* Participants section — full width */}
        <div className="mt-8 bg-white rounded-2xl border border-zinc-200 px-6 py-5">
          <ParticipantsSection formationId={id} participants={participants} />
        </div>
      </div>
    </div>
  );
}
