import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import {
  User,
  Building2,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  BarChart2,
  Shield,
  Info,
} from "lucide-react";
import { getPersonnePhysiqueDetail } from "@/lib/server/modules/personnes-physiques/service";
import { Avatar } from "@/components/ui/avatar";
import { DetailSection } from "@/components/detail/DetailSection";
import { InfoGrid, type InfoItem } from "@/components/detail/InfoGrid";
import { RattachementsList } from "@/components/detail/RattachementsList";
import { PpDetailActions } from "@/components/pp/PpDetailActions";
import { cn } from "@/lib/utils";
import type { TypeRelationPp, StatutRgpd } from "@/lib/server/modules/personnes-physiques/dto";
import { TYPE_RELATION_PP_OPTIONS, profilTypeFromPrincipal } from "@/lib/server/modules/personnes-physiques/constants";
import { splitEmails } from "@/lib/email-utils";

// ─── Labels / badges ──────────────────────────────────────────────────────────

const RELATION_LABELS = Object.fromEntries(
  TYPE_RELATION_PP_OPTIONS.map(({ value, label }) => [value, label])
) as Record<TypeRelationPp, string>;
const RELATION_COLORS = Object.fromEntries(
  TYPE_RELATION_PP_OPTIONS.map(({ value, colorBorder }) => [value, colorBorder])
) as Record<TypeRelationPp, string>;
const RGPD_LABELS: Record<StatutRgpd, string> = {
  OPT_IN: "Opt-in",
  OPT_OUT: "Opt-out",
  NON_RENSEIGNE: "Non renseigné",
};
const RGPD_COLORS: Record<StatutRgpd, string> = {
  OPT_IN: "bg-green-100 text-green-700 border-green-200",
  OPT_OUT: "bg-red-100 text-red-700 border-red-200",
  NON_RENSEIGNE: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
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

function BoolBadge({ value, labelTrue, labelFalse }: { value: boolean; labelTrue: string; labelFalse: string }) {
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

export default async function PersonnePhysiquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pp = await getPersonnePhysiqueDetail(id);
  if (!pp) notFound();

  const estAvocat = profilTypeFromPrincipal(pp.typeProfilPrincipal) === "AVOCAT";
  const emails = splitEmails(pp.email);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton />
          <Avatar nom={pp.nom} prenom={pp.prenom} size="md" />
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">
              {pp.prenom} {pp.nom.toUpperCase()}
            </h1>
            <p className="text-sm text-zinc-400 leading-tight">
              {[pp.profession, pp.barreau].filter(Boolean).join(" · ") || "Personne physique"}
            </p>
          </div>
          {!pp.actif && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-400 border border-zinc-200">
              Inactif
            </span>
          )}
          <PpDetailActions
            ppId={pp.id}
            ppNom={`${pp.prenom ?? ""} ${pp.nom}`.trim()}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl mx-auto">
          {/* ── Colonne gauche ── */}
          <div className="flex flex-col gap-4">
            {/* Identité & Coordonnées */}
            <DetailSection title="Identité & Coordonnées" icon={User}>
              <InfoGrid
                cols={2}
                items={[
                  { label: "Nom", value: pp.nom.toUpperCase() },
                  { label: "Prénom", value: pp.prenom },
                  {
                    label: emails.length > 1 ? "Emails" : "Email",
                    value: emails.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {emails.map((email) => (
                          <a
                            key={email}
                            href={`mailto:${email}`}
                            className="text-secondary-600 hover:underline flex items-center gap-1"
                          >
                            <Mail size={12} />
                            {email}
                          </a>
                        ))}
                      </div>
                    ) : null,
                  },
                  {
                    label: "Téléphone",
                    value: pp.telephone ? (
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-zinc-400" />
                        {pp.telephone}
                      </span>
                    ) : null,
                  },
                  {
                    label: "Portable",
                    value: pp.portable ? (
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-zinc-400" />
                        {pp.portable}
                      </span>
                    ) : null,
                  }
                ]}
              />
            </DetailSection>

            {/* Profession & Statut */}
            <DetailSection title="Profession & Statut" icon={Shield}>
              <InfoGrid
                cols={2}
                items={[
                  { label: "Profession", value: pp.profession },
                  { label: "Spécialité", value: pp.specialite, span: 2 },
                  ...(estAvocat
                    ? ([
                        { label: "Activité dominante", value: pp.activiteDominante, span: 2 },
                        { label: "Barreau", value: pp.barreau },
                        { label: "Date de serment", value: fmtDate(pp.dateSerment) },
                      ] satisfies InfoItem[])
                    : []),
                  {
                    label: "Type de relation",
                    value: (
                      <Badge
                        label={RELATION_LABELS[pp.typeRelation]}
                        color={RELATION_COLORS[pp.typeRelation]}
                      />
                    ),
                  },
                  {
                    label: "Statut RGPD",
                    value: pp.statutRgpd ? (
                      <Badge
                        label={RGPD_LABELS[pp.statutRgpd]}
                        color={RGPD_COLORS[pp.statutRgpd]}
                      />
                    ) : null,
                  },
                  {
                    label: "Actif",
                    value: <BoolBadge value={pp.actif} labelTrue="Actif" labelFalse="Inactif" />,
                  },
                  {
                    label: "Opt-in email",
                    value: <BoolBadge value={pp.optInEmail} labelTrue="Opt-in" labelFalse="Opt-out" />,
                  },
                  {
                    label: "Opt-in SMS",
                    value: <BoolBadge value={pp.optInSms} labelTrue="Opt-in" labelFalse="Non" />,
                  },
                  {
                    label: "Opt-out global",
                    value: pp.optOutGlobal ? (
                      <span className="text-red-600 font-medium text-xs">Oui</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Non</span>
                    ),
                  },
                  {
                    label: "Email invalide",
                    value: pp.emailInvalide ? (
                      <span className="text-red-600 font-medium text-xs">Oui</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Non</span>
                    ),
                  },
                ]}
              />
            </DetailSection>

            {/* Données Anaba */}
            <DetailSection title="Données Anaba" icon={BarChart2} variant="anaba">
              <InfoGrid
                cols={2}
                items={[
                  {
                    label: "Total emails",
                    value: pp.totalEmails != null ? (
                      <span className="font-semibold text-zinc-900">{pp.totalEmails.toLocaleString("fr-FR")}</span>
                    ) : null,
                  },
                  { label: "Dernier email le", value: fmtDate(pp.dernierEmailLe) },
                  { label: "Dernier email avec", value: pp.dernierEmailAvec, span: 2 },
                  { label: "Échanges avec", value: pp.echangesAvec, span: 2 },
                  {
                    label: "LinkedIn",
                    value: pp.linkedinUrl ? (
                      <a
                        href={pp.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-secondary-600 hover:underline text-xs"
                      >
                        <ExternalLink size={12} />
                        Voir le profil
                      </a>
                    ) : null,
                  },
                ]}
              />
            </DetailSection>
          </div>

          {/* ── Colonne droite ── */}
          <div className="flex flex-col gap-4">
            {/* Adresse */}
            <DetailSection title="Adresse" icon={MapPin}>
              {pp.adresse ? (
                <InfoGrid
                  cols={2}
                  items={[
                    { label: "Rue", value: pp.adresse.rue, span: 2 },
                    { label: "Complément", value: pp.adresse.complementAdresse, span: 2 },
                    { label: "Code postal", value: pp.adresse.codePostal },
                    { label: "Ville", value: pp.adresse.ville },
                    { label: "Pays", value: pp.adresse.pays },
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
                  { label: "Créé le", value: fmtDate(pp.creerLe) },
                  { label: "Créé par", value: pp.creerPar },
                  { label: "Modifié le", value: fmtDate(pp.modifierLe) },
                  { label: "Modifié par", value: pp.modifierPar },
                  {
                    label: "ID",
                    value: <span className="font-mono text-xs text-zinc-500">{pp.id}</span>,
                  },
                ]}
              />
            </DetailSection>

            {/* Rattachements */}
            <DetailSection title={`Rattachements (${pp.rattachements.length})`} icon={Building2}>
              <RattachementsList
                rattachements={pp.rattachements}
                ppId={pp.id}
                ppNom={`${pp.prenom ?? ""} ${pp.nom}`.trim()}
              />
            </DetailSection>
          </div>
        </div>
      </div>
    </div>
  );
}
