import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Mail, Phone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/lib/filters";
import type {
  PersonneMoraleListItem,
  TypeRelationPm,
} from "@/lib/server/modules/personnes-morales/dto";

// ─── Field definitions (query builder) ───────────────────────────────────────

export const PM_FIELDS: FieldDef[] = [
  { key: "raisonSociale", label: "Raison sociale", type: "text", param: "raisonSociale" },
  { key: "email", label: "Email", type: "text", param: "email" },
  { key: "siretSiren", label: "SIRET / SIREN", type: "text", param: "siretSiren" },
  { key: "typeStructure", label: "Type de structure", type: "text", param: "typeStructure" },
  { key: "secteurActivite", label: "Secteur d'activité", type: "text", param: "secteurActivite" },
  {
    key: "typeRelation",
    label: "Type de relation",
    type: "select",
    param: "typeRelation",
    options: [
      { value: "CABINET_POSTULATION", label: "Cabinet postulation" },
      { value: "CLIENT_DIRECT", label: "Client direct" },
      { value: "HYBRIDE", label: "Hybride" },
    ],
  },
  {
    key: "actif",
    label: "Actif",
    type: "select",
    param: "actif",
    options: [
      { value: "true", label: "Actif" },
      { value: "false", label: "Inactif" },
    ],
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

const RELATION_LABELS: Record<TypeRelationPm, string> = {
  CABINET_POSTULATION: "Cabinet postulation",
  CLIENT_DIRECT: "Client direct",
  HYBRIDE: "Hybride",
};
const RELATION_COLORS: Record<TypeRelationPm, string> = {
  CABINET_POSTULATION: "bg-secondary-100 text-secondary-700",
  CLIENT_DIRECT: "bg-primary-100 text-primary-700",
  HYBRIDE: "bg-purple-100 text-purple-700",
};

// ─── Column definitions ───────────────────────────────────────────────────────

const col = createColumnHelper<PersonneMoraleListItem>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PM_COLUMNS: ColumnDef<PersonneMoraleListItem, any>[] = [
  col.accessor("raisonSociale", {
    id: "raisonSociale",
    header: "Raison sociale",
    enableSorting: true,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="min-w-[180px]">
          <div className="font-semibold text-zinc-900 leading-tight">{r.raisonSociale}</div>
          {r.typeStructure && (
            <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[260px]">
              {r.typeStructure}
            </div>
          )}
          {r.siretSiren && (
            <div className="text-xs text-zinc-400 font-mono truncate max-w-[260px]">
              {r.siretSiren}
            </div>
          )}
        </div>
      );
    },
  }),
  col.accessor("secteurActivite", {
    header: "Secteur",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <span className="text-zinc-600 max-w-[180px] truncate block">{v}</span>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
  col.accessor("typeRelation", {
    header: "Relation",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<TypeRelationPm | null>();
      if (!v) return <span className="text-zinc-300">—</span>;
      return (
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
            RELATION_COLORS[v],
          )}
        >
          {RELATION_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("actif", {
    header: "Statut",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<boolean>();
      return (
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
            v ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-400",
          )}
        >
          {v ? "Actif" : "Inactif"}
        </span>
      );
    },
  }),
  col.accessor("adresse", {
    header: "Ville",
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue<PersonneMoraleListItem["adresse"]>();
      const ville = v?.ville;
      return ville ? (
        <span className="text-zinc-600">{ville}</span>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
  col.accessor("siteWeb", {
    header: "Site web",
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <a
          href={v.startsWith("http") ? v : `https://${v}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-secondary-600 hover:underline text-xs"
        >
          <Globe size={11} className="shrink-0 text-secondary-400" />
          <span className="truncate max-w-[120px]">{v}</span>
        </a>
      ) : (
        <span className="text-zinc-300">—</span>
      );
    },
  }),
];
