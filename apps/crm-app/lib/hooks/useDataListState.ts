"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { buildQueryParams, type FieldDef, type FilterGroup, type FilterState } from "@/lib/filters";
import { urlToState, stateToURL } from "@/lib/url-state";

export type DataListStateOptions = {
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultLimit?: number;
};

export type DataListState = {
  // Derived from URL
  search: string;
  groups: FilterGroup[];
  conditionCount: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
  // Computed
  params: URLSearchParams;
  sorting: SortingState;
  // Actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSorting: OnChangeFn<SortingState>;
  setSearch: (search: string) => void;
  setGroups: (groups: FilterGroup[]) => void;
  removeCondition: (id: string) => void;
  clearGroups: () => void;
};

export function useDataListState(
  fields: FieldDef[],
  options: DataListStateOptions = {},
): DataListState {
  const { defaultSortBy = "id", defaultSortOrder = "asc", defaultLimit = 20 } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filterState: FilterState = useMemo(
    () => ({
      ...urlToState(searchParams, fields),
      sortBy: searchParams.get("sortBy") ?? defaultSortBy,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") ?? defaultSortOrder,
      limit: Number(searchParams.get("limit") ?? defaultLimit),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const params = useMemo(() => buildQueryParams(filterState, fields), [filterState]);

  const conditionCount = useMemo(
    () => filterState.groups.reduce((acc, g) => acc + g.conditions.length, 0),
    [filterState.groups],
  );

  const sorting: SortingState = useMemo(
    () =>
      filterState.sortBy
        ? [{ id: filterState.sortBy, desc: filterState.sortOrder === "desc" }]
        : [],
    [filterState.sortBy, filterState.sortOrder],
  );

  const push = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...filterState, ...patch };
      const qs = stateToURL(next, fields);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterState, pathname, router],
  );

  return {
    ...filterState,
    conditionCount,
    params,
    sorting,
    setPage: (page) => push({ page }),
    setLimit: (limit) => push({ limit, page: 1 }),
    setSorting: (updater) => {
      const current: SortingState = filterState.sortBy
        ? [{ id: filterState.sortBy, desc: filterState.sortOrder === "desc" }]
        : [];
      const next = typeof updater === "function" ? updater(current) : updater;
      push({
        sortBy: next[0]?.id ?? defaultSortBy,
        sortOrder: next[0]?.desc ? "desc" : "asc",
        page: 1,
      });
    },
    setSearch: (search) => push({ search, page: 1 }),
    setGroups: (groups) => push({ groups, page: 1 }),
    removeCondition: (id) => {
      const updated = filterState.groups
        .map((g) => ({ ...g, conditions: g.conditions.filter((c) => c.id !== id) }))
        .filter((g) => g.conditions.length > 0);
      push({ groups: updated, page: 1 });
    },
    clearGroups: () => push({ groups: [], page: 1 }),
  };
}
