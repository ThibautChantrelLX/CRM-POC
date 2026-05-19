import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Users,
  Info,
  Layers,
} from "lucide-react";
import { getPersonneMoraleDetail } from "@/lib/server/modules/personnes-morales/service";
import { DetailSection } from "@/components/detail/DetailSection";
import { InfoGrid } from "@/components/detail/InfoGrid";
import { ContactsRattachesList } from "@/components/detail/ContactsRattachesList";
import { PmDetailActions } from "@/components/pm/PmDetailActions";
import { cn } from "@/lib/utils";
import type { TypeRelationPm } from "@/lib/server/modules/personnes-morales/dto";

// ─── Labels / badges ──────────────────────────────────────────────────────────

const RELATION_LABELS: Record<TypeRelationPm, string> = {
  CABINET_POSTULATION: "Cabinet postulation",
  CLIENT_DIRECT: "Client direct",
  HYBRIDE: "Hybride",
};
const RELATION_COLORS: Record<TypeRelationPm, string> = {
  CABINET_POSTULATION: "bg-secondary-100 text-secondary-700 border-secondary-200",
  CLIENT_DIRECT: "bg-primary-100 text-primary-700 border-primary-200",
  HYBRIDE: "bg-purple-100 text-purple-700 border-purple-200",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
        color,
      )}
    >
      {label}
    </span>
  );
}

function BoolBadge({
  value,
  labelTrue,
  labelFalse,
}: {
  value: boolean;
  labelTrue: string;
  labelFalse: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border",
        value
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-zinc-100 text-zinc-400 border-zinc-200",
      )}
    >
      {value ? labelTrue : labelFalse}
    </span>
  );
}

function fmtDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR");
}

// ─── Page (server component) ──────────────────────────────────────────────────

export default async function PersonneMoralePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pm = await getPersonneMoraleDetail(Number(id));
  if (!pm) notFound();

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/personnes-morales"
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-zinc-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">{pm.raisonSociale}</h1>
            <p className="text-sm text-zinc-400 leading-tight">
              {[pm.typeStructure, pm.siretSiren].filter(Boolean).join(" · ") || "Personne morale"}
            </p>
          </div>
          {!pm.actif && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-400 border border-zinc-200">
              Inactif
            </span>
          )}
          <PmDetailActions
            pmId={pm.id}
            pmNom={pm.raisonSociale}
            pmNomDomaine={pm.nomDomaine ?? null}
            contacts={pm.contacts}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl mx-auto">
          {/* ── Colonne gauche ── */}
          <div className="flex flex-col gap-4">
            {/* Identité & Coordonnées */}
            <DetailSection title="Identité & Coordonnées" icon={Building2}>
              <InfoGrid
                cols={2}
                items={[
                  { label: "Raison sociale", value: pm.raisonSociale, span: 2 },
                  { label: "SIRET / SIREN", value: pm.siretSiren },
                  { label: "Type de structure", value: pm.typeStructure },
                  {
                    label: "Email",
                    value: pm.email ? (
                      <a
                        href={`mailto:${pm.email}`}
                        className="text-secondary-600 hover:underline flex items-center gap-1"
                      >
                        <Mail size={12} />
                        {pm.email}
                      </a>
                    ) : null,
                  },
                  {
                    label: "Téléphone",
                    value: pm.telephone ? (
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-zinc-400" />
                        {pm.telephone}
                      </span>
                    ) : null,
                  },
                  {
                    label: "Site web",
                    value: pm.siteWeb ? (
                      <a
                        href={pm.siteWeb.startsWith("http") ? pm.siteWeb : `https://${pm.siteWeb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-secondary-600 hover:underline text-xs"
                      >
                        <Globe size={12} />
                        {pm.siteWeb}
                      </a>
                    ) : null,
                  },
                  { label: "Nom de domaine", value: pm.nomDomaine },
                ]}
              />
            </DetailSection>

            {/* Activité & Statut */}
            <DetailSection title="Activité & Statut" icon={Layers}>
              <InfoGrid
                cols={2}
                items={[
                  { label: "Secteur d'activité", value: pm.secteurActivite, span: 2 },
                  { label: "Catégorie entreprise", value: pm.categorieEntreprise },
                  { label: "Source d'origine", value: pm.sourceOrigine },
                  {
                    label: "Type de relation",
                    value: pm.typeRelation ? (
                      <Badge
                        label={RELATION_LABELS[pm.typeRelation]}
                        color={RELATION_COLORS[pm.typeRelation]}
                      />
                    ) : null,
                  },
                  {
                    label: "Actif",
                    value: <BoolBadge value={pm.actif} labelTrue="Actif" labelFalse="Inactif" />,
                  },
                ]}
              />
            </DetailSection>

            {/* Maison mère & Filiales */}
            {(pm.maisonMere || pm.filiales.length > 0) && (
              <DetailSection title="Groupe" icon={Building2}>
                <InfoGrid
                  cols={2}
                  items={[
                    {
                      label: "Maison mère",
                      span: 2,
                      value: pm.maisonMere ? (
                        <Link
                          href={`/personnes-morales/${pm.maisonMere.id}`}
                          className="text-secondary-600 hover:underline font-medium"
                        >
                          {pm.maisonMere.raisonSociale}
                          {pm.maisonMere.siretSiren && (
                            <span className="text-zinc-400 font-normal text-xs ml-1">
                              ({pm.maisonMere.siretSiren})
                            </span>
                          )}
                        </Link>
                      ) : null,
                    },
                  ]}
                />
                {pm.filiales.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Filiales ({pm.filiales.length})
                    </div>
                    <div className="flex flex-col gap-1">
                      {pm.filiales.map((f) => (
                        <div key={f.id} className="flex items-center gap-2">
                          <Link
                            href={`/personnes-morales/${f.id}`}
                            className="text-secondary-600 hover:underline text-sm font-medium"
                          >
                            {f.raisonSociale}
                          </Link>
                          {f.siretSiren && (
                            <span className="text-xs text-zinc-400 font-mono">{f.siretSiren}</span>
                          )}
                          {!f.actif && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400">
                              Inactif
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DetailSection>
            )}
          </div>

          {/* ── Colonne droite ── */}
          <div className="flex flex-col gap-4">
            {/* Adresse */}
            <DetailSection title="Adresse" icon={MapPin}>
              {pm.adresse ? (
                <InfoGrid
                  cols={2}
                  items={[
                    { label: "Rue", value: pm.adresse.rue, span: 2 },
                    { label: "Complément", value: pm.adresse.complementAdresse, span: 2 },
                    { label: "Code postal", value: pm.adresse.codePostal },
                    { label: "Ville", value: pm.adresse.ville },
                    { label: "Pays", value: pm.adresse.pays },
                  ]}
                />
              ) : (
                <p className="text-sm text-zinc-400">Aucune adresse enregistrée</p>
              )}
            </DetailSection>

            {/* Métadonnées */}
            <DetailSection title="Métadonnées" icon={Info}>
              <InfoGrid
                cols={2}
                items={[
                  { label: "Créé le", value: fmtDate(pm.creerLe) },
                  { label: "Créé par", value: pm.creerPar },
                  { label: "Modifié le", value: fmtDate(pm.modifierLe) },
                  { label: "Modifié par", value: pm.modifierPar },
                  {
                    label: "ID",
                    value: <span className="font-mono text-xs text-zinc-500">{pm.id}</span>,
                  },
                ]}
              />
            </DetailSection>

            {/* Contacts rattachés */}
            <DetailSection title={`Contacts (${pm.contacts.length})`} icon={Users}>
              <ContactsRattachesList contacts={pm.contacts} />
            </DetailSection>
          </div>
        </div>
      </div>
    </div>
  );
}
