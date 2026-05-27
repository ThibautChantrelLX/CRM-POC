interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  emptyMessage?: string;
}

export function AdminTable<T>({ columns, rows, getKey, emptyMessage = "Aucune donnée." }: AdminTableProps<T>) {
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-zinc-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getKey(row)} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-zinc-700">
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
