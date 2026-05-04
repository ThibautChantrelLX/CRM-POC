"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LIMIT_OPTIONS = [10, 20, 50, 100];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
};

export function DataTable<T>({
  data,
  columns,
  total,
  page,
  totalPages,
  limit,
  sorting,
  onSortingChange,
  onPageChange,
  onLimitChange,
  isLoading,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <div className="flex flex-col gap-0">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/80 border-b border-zinc-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap select-none uppercase tracking-wide",
                        canSort && "cursor-pointer hover:text-zinc-800",
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-zinc-300">
                            {sorted === "asc" ? (
                              <ChevronUp size={13} />
                            ) : sorted === "desc" ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronsUpDown size={13} />
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-zinc-400 text-sm">
                  Chargement…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-zinc-400 text-sm">
                  Aucun résultat
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-zinc-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-1 py-3 text-sm text-zinc-500">
        {/* Limit selector */}
        <div className="flex items-center gap-2">
          <span>Lignes par page</span>
          <div className="relative">
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange?.(Number(e.target.value));
                onPageChange(1);
              }}
              className="appearance-none pl-2.5 pr-6 py-1 rounded-md border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-orange-400 cursor-pointer"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500 font-medium">
            {total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""}
          </span>
        </div>

        {/* Page nav */}
        <div className="flex items-center gap-2">
          <span>
            Page <span className="font-medium text-zinc-700">{page}</span> sur{" "}
            <span className="font-medium text-zinc-700">{Math.max(1, totalPages)}</span>
          </span>
          <div className="flex items-center gap-0.5">
            <button
              className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
