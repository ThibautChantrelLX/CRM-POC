import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Mail, Phone, Smartphone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/lib/filters";
import type {
  PersonnePhysiqueListItem,
  TypeRelationPp,
  StatutRgpd,
} from "@/lib/server/modules/personnes-physiques/dto";
import { TYPE_RELATION_PP_OPTIONS } from "@/lib/server/modules/personnes-physiques/constants";

// ─── Field definitions (query builder) ───────────────────────────────────────

export const PP_FIELDS: FieldDef[] = [
  { key: "nom", label: "Nom", type: "text", param: "nom" },
  { key: "prenom", label: "Prénom", type: "text", param: "prenom" },
  { key: "email", label: "Email", type: "text", param: "email" },
  {
    key: "profession",
    label: "Profession",
    type: "select",
    param: "profession",
    optionsUrl: "/api/personnes-physiques/professions",
  },
  {
    key: "specialite",
    label: "Spécialité",
    type: "select",
    param: "specialite",
    optionsUrl: "/api/personnes-physiques/specialites",
  },
  {
    key: "activiteDominante",
    label: "Activité dominante",
    type: "select",
    param: "activiteDominante",
    optionsUrl: "/api/personnes-physiques/activites-dominantes",
  },
  {
    key: "barreau",
    label: "Barreau",
    type: "select",
    param: "barreau",
    optionsUrl: "/api/personnes-physiques/barreaux",
  },
  {
    key: "typeRelation",
    label: "Type de relation",
    type: "select",
    param: "typeRelation",
    options: [
      ...TYPE_RELATION_PP_OPTIONS,
    ],
  },
  {
    key: "dateSerment",
    label: "Date de serment",
    type: "date",
    paramGte: "dateSermentApres",
    paramLte: "dateSermentAvant",
  },
  {
    key: "dernierEmailLe",
    label: "Dernier email le",
    type: "date",
    paramGte: "dernierEmailApres",
    paramLte: "dernierEmailAvant",
  },
  {
    key: "creerLe",
    label: "Créé le",
    type: "date",
    paramGte: "creerLeApres",
    paramLte: "creerLeAvant",
  },
];

// ─── Badge styles ─────────────────────────────────────────────────────────────

const RELATION_LABELS = Object.fromEntries(
  TYPE_RELATION_PP_OPTIONS.map(({ value, label }) => [value, label])
) as Record<TypeRelationPp, string>;
const RELATION_COLORS = Object.fromEntries(
  TYPE_RELATION_PP_OPTIONS.map(({ value, color }) => [value, color])
) as Record<TypeRelationPp, string>;
const RGPD_LABELS: Record<StatutRgpd, string> = {
  OPT_IN: "Opt-in",
  OPT_OUT: "Opt-out",
  NON_RENSEIGNE: "Non renseigné",
};
const RGPD_COLORS: Record<StatutRgpd, string> = {
  OPT_IN: "bg-green-100 text-green-700",
  OPT_OUT: "bg-red-100 text-red-700",
  NON_RENSEIGNE: "bg-zinc-100 text-zinc-500",
};

// ─── Column definitions ───────────────────────────────────────────────────────

const col = createColumnHelper<PersonnePhysiqueListItem>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PP_COLUMNS: ColumnDef<PersonnePhysiqueListItem, any>[] = [
  col.display({
    id: "avatar",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Avatar nom={row.original.nom} prenom={row.original.prenom} size="md" />
    ),
  }),
  col.accessor("nom", {
    id: "nom",
    header: "Nom & Prénom",
    enableSorting: true,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="min-w-40">
          <div className="font-semibold text-zinc-900 leading-tight">
            {r.nom.toUpperCase()}
          </div>
          {r.prenom && (
            <div className="text-zinc-600 leading-tight">{r.prenom}</div>
          )}
          {r.profession && (
            <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-55">
              {r.profession}
            </div>
          )}
        </div>
      );
    },
  }),
  col.accessor("email", {
    header: "Email",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <a
          href={`mailto:${v}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-secondary-600 hover:underline max-w-50"
        >
          <Mail size={12} className="shrink-0 text-secondary-400" />
          <span className="truncate">{v}</span>
        </a>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
  col.accessor("telephone", {
    header: "Téléphone",
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original;
      const tel = r.telephone || r.portable;
      const mobile = !r.telephone && !!r.portable;
      return tel ? (
        <span className="flex items-center gap-1.5 text-zinc-600 whitespace-nowrap">
          {mobile ? (
            <Smartphone size={12} className="text-zinc-400 shrink-0" />
          ) : (
            <Phone size={12} className="text-zinc-400 shrink-0" />
          )}
          {tel}
        </span>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
  col.accessor("specialite", {
    header: "Spécialité",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <span className="text-zinc-600 max-w-50 truncate block">{v}</span>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
  col.accessor("typeRelation", {
    header: "Relation",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<TypeRelationPp>();
      return (
        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", RELATION_COLORS[v])}>
          {RELATION_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("statutRgpd", {
    header: "RGPD",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<StatutRgpd | null>();
      if (!v) return <span className="text-zinc-300">—</span>;
      return (
        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", RGPD_COLORS[v])}>
          {RGPD_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("totalEmails", {
    header: "Emails",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      return v != null ? (
        <span className="text-zinc-600 font-medium">{v}</span>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
];
