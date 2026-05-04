"use client";

import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Search, SlidersHorizontal, Mail, Phone, Smartphone } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdvancedFilters } from "@/components/ui/advanced-filters";
import { Avatar } from "@/components/ui/avatar";
import { usePersonnesPhysiques } from "@/lib/hooks/usePersonnesPhysiques";
import {
  buildQueryParams,
  type FieldDef,
  type FilterCondition,
  type FilterState,
} from "@/lib/filters";
import type {
  PersonnePhysiqueListItem,
  TypeRelationPp,
  StatutRgpd,
} from "@/lib/server/modules/personnes-physiques/dto";
import { cn } from "@/lib/utils";

// ─── Field definitions (generic query builder) ────────────────────────────────

const PP_FIELDS: FieldDef[] = [
  { key: "nom", label: "Nom", type: "text", param: "nom" },
  { key: "prenom", label: "Prénom", type: "text", param: "prenom" },
  { key: "email", label: "Email", type: "text", param: "email" },
  { key: "profession", label: "Profession", type: "text", param: "profession" },
  { key: "specialite", label: "Spécialité", type: "text", param: "specialite" },
  {
    key: "typeRelation",
    label: "Type de relation",
    type: "select",
    param: "typeRelation",
    options: [
      { value: "CONTACT", label: "Contact" },
      { value: "CLIENT", label: "Client" },
      { value: "HYBRIDE", label: "Hybride" },
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

// ─── Labels / badges ──────────────────────────────────────────────────────────

const RELATION_LABELS: Record<TypeRelationPp, string> = {
  CONTACT: "Contact",
  CLIENT: "Client",
  HYBRIDE: "Hybride",
};
const RELATION_COLORS: Record<TypeRelationPp, string> = {
  CONTACT: "bg-blue-100 text-blue-700",
  CLIENT: "bg-orange-100 text-orange-700",
  HYBRIDE: "bg-purple-100 text-purple-700",
};
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
const COLUMNS: ColumnDef<PersonnePhysiqueListItem, any>[] = [
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
        <div className="min-w-[160px]">
          <div className="font-semibold text-zinc-900 leading-tight">
            {r.nom.toUpperCase()}
          </div>
          {r.prenom && (
            <div className="text-zinc-600 leading-tight">{r.prenom}</div>
          )}
          {r.profession && (
            <div className="text-xs text-zinc-400 leading-tight mt-0.5 truncate max-w-[200px]">
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
          className="flex items-center gap-1.5 text-blue-600 hover:underline max-w-[200px] truncate"
        >
          <Mail size={12} className="shrink-0 text-blue-400" />
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
      const v = getValue<TypeRelationPp>();
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
  col.accessor("statutRgpd", {
    header: "RGPD",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue<StatutRgpd | null>();
      if (!v) return <span className="text-zinc-300">—</span>;
      return (
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
            RGPD_COLORS[v],
          )}
        >
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: FilterState = {
  search: "",
  conditions: [],
  sortBy: "nom",
  sortOrder: "asc",
  page: 1,
  limit: 20,
};

export default function PersonnesPhysiquesPage() {
  const [state, setState] = useState<FilterState>(INITIAL_STATE);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKey, setFilterKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Build query params from filter state
  const params = useMemo(() => buildQueryParams(state, PP_FIELDS), [state]);

  const { data, isLoading, isFetching } = usePersonnesPhysiques(params);

  // Derived sorting for the table
  const sorting: SortingState = useMemo(
    () => (state.sortBy ? [{ id: state.sortBy, desc: state.sortOrder === "desc" }] : []),
    [state.sortBy, state.sortOrder],
  );

  const set = (patch: Partial<FilterState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(
      setTimeout(() => set({ search: value, page: 1 }), 300),
    );
  };

  const handleSorting = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    set({
      sortBy: next[0]?.id ?? "nom",
      sortOrder: next[0]?.desc ? "desc" : "asc",
      page: 1,
    });
  };

  const applyFilters = (conditions: FilterCondition[]) => {
    set({ conditions, page: 1 });
  };

  const openFilters = () => {
    setFilterKey((k) => k + 1);
    setFilterOpen(true);
  };

  const activeConditions = state.conditions.length;

  return (
    <div className="flex flex-col h-full">
      {/* Top search bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="relative flex-1 max-w-lg">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Rechercher par nom, email, téléphone…"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Filtres button */}
        <div className="relative">
          <button
            type="button"
            onClick={openFilters}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              activeConditions > 0
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
            )}
          >
            <SlidersHorizontal size={15} />
            Filtres
            {activeConditions > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeConditions}
              </span>
            )}
          </button>

          {filterOpen && (
            <AdvancedFilters
              key={filterKey}
              fields={PP_FIELDS}
              initialConditions={state.conditions}
              onApply={applyFilters}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 py-5 flex flex-col gap-4 overflow-auto">
        {/* Title + count */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900">Personnes Physiques</h1>
          {data && (
            <span className="bg-orange-100 text-orange-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {data.total.toLocaleString("fr-FR")}
            </span>
          )}
          {isFetching && !isLoading && (
            <span className="text-xs text-zinc-400 animate-pulse">Mise à jour…</span>
          )}
        </div>

        {/* Table */}
        <DataTable
          data={data?.data ?? []}
          columns={COLUMNS}
          total={data?.total ?? 0}
          page={data?.page ?? state.page}
          totalPages={data?.totalPages ?? 1}
          limit={state.limit}
          sorting={sorting}
          onSortingChange={handleSorting}
          onPageChange={(page) => set({ page })}
          onLimitChange={(limit) => set({ limit, page: 1 })}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
