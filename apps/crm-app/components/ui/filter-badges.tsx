"use client";

import { X } from "lucide-react";
import { conditionBadgeLabel } from "@/lib/url-state";
import type { FieldDef, FilterCondition } from "@/lib/filters";

type Props = {
  conditions: FilterCondition[];
  fields: FieldDef[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

export function FilterBadges({ conditions, fields, onRemove, onClearAll }: Props) {
  if (conditions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-6 pb-2">
      {conditions.map((cond) => {
        const label = conditionBadgeLabel(cond, fields);
        if (!label) return null;
        return (
          <span
            key={cond.id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-medium border border-primary-200"
          >
            {label}
            <button
              type="button"
              aria-label="Supprimer ce filtre"
              onClick={() => onRemove(cond.id)}
              className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 ml-1"
      >
        Effacer tous les filtres
      </button>
    </div>
  );
}
