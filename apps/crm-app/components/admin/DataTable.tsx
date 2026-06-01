"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | Date;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  pageSize?: number;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  emptyMessage?: string;
  actions?: (row: T) => React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

const PAGE_SIZES = [10, 25, 50];

export function DataTable<T>({
  columns,
  rows,
  getKey,
  pageSize: defaultPageSize = 10,
  searchPlaceholder = "Rechercher…",
  searchFilter,
  emptyMessage = "Aucune donnée.",
  actions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchFilter) return rows;
    return rows.filter((r) => searchFilter(r, query.toLowerCase()));
  }, [rows, query, searchFilter]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
    setPage(1);
  }

  function handleSearch(q: string) { setQuery(q); setPage(1); }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown size={13} className="text-zinc-300 ml-1" />;
    if (sortDir === "asc") return <ChevronUp size={13} className="text-primary-500 ml-1" />;
    return <ChevronDown size={13} className="text-primary-500 ml-1" />;
  };

  const hasActions = Boolean(actions);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {searchFilter ? (
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            />
          </div>
        ) : <div />}
        <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
          <span>{sorted.length} résultat{sorted.length > 1 ? "s" : ""}</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-zinc-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "select-none",
                    col.className,
                  )}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-0 hover:text-zinc-600 transition-colors"
                    >
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </button>
                  ) : col.label}
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="px-4 py-10 text-center text-zinc-400 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={getKey(row)}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-zinc-700", col.className)}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">{actions!(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            Page {currentPage} sur {totalPages}
            {" "}({sorted.length} résultat{sorted.length > 1 ? "s" : ""})
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) pageNum = i + 1;
              else if (currentPage <= 4) pageNum = i + 1;
              else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = currentPage - 3 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-7 h-7 rounded-md text-xs border transition-colors",
                    pageNum === currentPage
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "border-zinc-200 hover:bg-zinc-50",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
