"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, Mail, Phone, Smartphone } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdvancedFilters } from "@/components/ui/advanced-filters";
import { FilterBadges } from "@/components/ui/filter-badges";
import { Avatar } from "@/components/ui/avatar";
import { usePersonnesPhysiques } from "@/lib/hooks/usePersonnesPhysiques";
import { buildQueryParams, type FieldDef, type FilterCondition, type FilterState } from "@/lib/filters";
import { urlToState, stateToURL } from "@/lib/url-state";
import type {
  PersonnePhysiqueListItem,
  TypeRelationPp,
  StatutRgpd,
} from "@/lib/server/modules/personnes-physiques/dto";
import { cn } from "@/lib/utils";

// ─── Field definitions ────────────────────────────────────────────────────────

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

// ─── Badges / colors ──────────────────────────────────────────────────────────

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

// ─── Columns ──────────────────────────────────────────────────────────────────

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
            <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[220px]">
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
          className="flex items-center gap-1.5 text-blue-600 hover:underline max-w-[200px]"
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
        <span className="text-zinc-600 max-w-[200px] truncate block">{v}</span>
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

// ─── Inner content (needs Suspense) ───────────────────────────────────────────

function PersonnesPhysiquesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Entire filter state is derived from URL
  const state = useMemo(() => urlToState(searchParams, PP_FIELDS), [searchParams]);
  const params = useMemo(() => buildQueryParams(state, PP_FIELDS), [state]);

  const { data, isLoading, isFetching } = usePersonnesPhysiques(params);

  const sorting: SortingState = useMemo(
    () =>
      state.sortBy ? [{ id: state.sortBy, desc: state.sortOrder === "desc" }] : [],
    [state.sortBy, state.sortOrder],
  );

  // Push a partial state change to URL
  const push = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...state, ...patch };
      const qs = stateToURL(next, PP_FIELDS);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [state, pathname, router],
  );

  // Local search input (debounced)
  const [searchInput, setSearchInput] = useState(state.search);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (v: string) => {
    setSearchInput(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push({ search: v, page: 1 }), 300);
  };

  const handleSorting = (
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    push({
      sortBy: next[0]?.id ?? "nom",
      sortOrder: next[0]?.desc ? "desc" : "asc",
      page: 1,
    });
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKey, setFilterKey] = useState(0);

  const openFilters = () => {
    setFilterKey((k) => k + 1);
    setFilterOpen(true);
  };

  const applyFilters = (conditions: FilterCondition[]) =>
    push({ conditions, page: 1 });

  const removeCondition = (id: string) =>
    push({ conditions: state.conditions.filter((c) => c.id !== id), page: 1 });

  const clearConditions = () => push({ conditions: [], page: 1 });

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
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
                state.conditions.length > 0
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              <SlidersHorizontal size={15} />
              Filtres
              {state.conditions.length > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {state.conditions.length}
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
      </div>

      {/* Active filter badges */}
      {state.conditions.length > 0 && (
        <div className="bg-white border-b border-zinc-100 pt-2 pb-2">
          <FilterBadges
            conditions={state.conditions}
            fields={PP_FIELDS}
            onRemove={removeCondition}
            onClearAll={clearConditions}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 px-6 py-5 flex flex-col gap-4 overflow-auto">
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

        <DataTable
          data={data?.data ?? []}
          columns={COLUMNS}
          total={data?.total ?? 0}
          page={data?.page ?? state.page}
          totalPages={data?.totalPages ?? 1}
          limit={state.limit}
          sorting={sorting}
          onSortingChange={handleSorting}
          onPageChange={(page) => push({ page })}
          onLimitChange={(limit) => push({ limit, page: 1 })}
          onRowClick={(row) => router.push(`/personnes-physiques/${row.id}`)}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

// ─── Page (requires Suspense for useSearchParams) ─────────────────────────────

export default function PersonnesPhysiquesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-32 text-sm text-zinc-400">
          Chargement…
        </div>
      }
    >
      <PersonnesPhysiquesContent />
    </Suspense>
  );
}
