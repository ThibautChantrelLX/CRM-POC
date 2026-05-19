import { cn } from "@/lib/utils";

export type InfoItem = {
  label: string;
  value: React.ReactNode;
  /** How many grid columns this item should span (default 1) */
  span?: 1 | 2;
};

type Props = {
  items: InfoItem[];
  /** Number of grid columns (default 2) */
  cols?: 2 | 3;
};

export function InfoGrid({ items, cols = 2 }: Props) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        cols === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className={cn("flex flex-col gap-0.5", item.span === 2 && "col-span-2")}
        >
          <dt className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            {item.label}
          </dt>
          <dd className="text-sm text-zinc-800 leading-snug break-words">
            {item.value !== null && item.value !== undefined && item.value !== "" ? (
              item.value
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
