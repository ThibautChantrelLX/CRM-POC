"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { AdvancedFilters } from "@/components/ui/advanced-filters";
import { FilterBadges } from "@/components/ui/filter-badges";
import { cn } from "@/lib/utils";
import type { FieldDef, FilterCondition } from "@/lib/filters";

type DataListPageProps<T> = {
  title: string;
  fields: FieldDef[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  // Data
  data: T[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  isLoading?: boolean;
  isFetching?: boolean;
  // Sort / pagination
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  // Filters
  conditions: FilterCondition[];
  searchValue: string;
  onApplyFilters: (conditions: FilterCondition[]) => void;
  onRemoveCondition: (id: string) => void;
  onClearConditions: () => void;
  onSearch: (value: string) => void;
  // Row interaction
  onRowClick?: (row: T) => void;
  // Slot for action buttons next to the title
  actionSlot?: React.ReactNode;
};

export function DataListPage<T>({
  title,
  fields,
  columns,
  data,
  total,
  totalPages,
  page,
  limit,
  isLoading,
  isFetching,
  sorting,
  onSortingChange,
  onPageChange,
  onLimitChange,
  conditions,
  searchValue,
  onApplyFilters,
  onRemoveCondition,
  onClearConditions,
  onSearch,
  onRowClick,
  actionSlot,
}: DataListPageProps<T>) {
  // Local input value (immediate feedback), synced with URL via effect
  const [searchInput, setSearchInput] = useState(searchValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Sync input when URL changes externally (back/forward navigation)
  useEffect(() => {
    if (!isTypingRef.current) setSearchInput(searchValue);
  }, [searchValue]);

  const handleSearch = (v: string) => {
    isTypingRef.current = true;
    setSearchInput(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onSearch(v);
    }, 300);
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKey, setFilterKey] = useState(0);

  const openFilters = () => {
    setFilterKey((k) => k + 1);
    setFilterOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Search bar ────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone…"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Filtres button + panel */}
          <div className="relative">
            <button
              type="button"
              onClick={openFilters}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                conditions.length > 0
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              <SlidersHorizontal size={15} />
              Filtres
              {conditions.length > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {conditions.length}
                </span>
              )}
            </button>

            {filterOpen && (
              <AdvancedFilters
                key={filterKey}
                fields={fields}
                initialConditions={conditions}
                onApply={onApplyFilters}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Active filter badges ───────────────────────────── */}
      {conditions.length > 0 && (
        <div className="bg-white border-b border-zinc-100 pt-2 pb-2">
          <FilterBadges
            conditions={conditions}
            fields={fields}
            onRemove={onRemoveCondition}
            onClearAll={onClearConditions}
          />
        </div>
      )}

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 px-6 py-5 flex flex-col gap-4 overflow-auto">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
          {!isLoading && (
            <span className="bg-orange-100 text-orange-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {total.toLocaleString("fr-FR")}
            </span>
          )}
          {isFetching && !isLoading && (
            <span className="text-xs text-zinc-400 animate-pulse">Mise à jour…</span>
          )}
          {actionSlot && <div className="ml-auto">{actionSlot}</div>}
        </div>

        <DataTable
          data={data}
          columns={columns}
          total={total}
          page={page}
          totalPages={totalPages}
          limit={limit}
          sorting={sorting}
          onSortingChange={onSortingChange}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
          onRowClick={onRowClick}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
