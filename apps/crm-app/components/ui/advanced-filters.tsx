"use client";

import { useState } from "react";
import { X, Plus, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OPERATOR_LABELS,
  defaultOperator,
  defaultValue,
  makeId,
  type FieldDef,
  type FilterCondition,
} from "@/lib/filters";

// ─── Panel ────────────────────────────────────────────────────────────────────

type Props = {
  fields: FieldDef[];
  initialConditions: FilterCondition[];
  onApply: (conditions: FilterCondition[]) => void;
  onClose: () => void;
};

export function AdvancedFilters({ fields, initialConditions, onApply, onClose }: Props) {
  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions);
  const [addOpen, setAddOpen] = useState(false);

  const add = (field: FieldDef) => {
    setConditions((prev) => [
      ...prev,
      {
        id: makeId(),
        fieldKey: field.key,
        operator: defaultOperator(field),
        value: defaultValue(field),
      },
    ]);
    setAddOpen(false);
  };

  const remove = (id: string) => setConditions((prev) => prev.filter((c) => c.id !== id));

  const update = (id: string, patch: Partial<FilterCondition>) =>
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const reset = () => setConditions([]);

  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-full mt-2 z-30 bg-white rounded-xl border border-zinc-200 shadow-xl w-[360px] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="font-semibold text-zinc-900">Filtres avancés</div>
          <div className="text-xs text-zinc-400 mt-0.5">Combinez plusieurs conditions</div>
        </div>

        {/* Conditions */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-2.5 max-h-[420px] overflow-y-auto">
          {conditions.map((cond) => {
            const field = fieldMap.get(cond.fieldKey);
            if (!field) return null;
            return (
              <ConditionRow
                key={cond.id}
                condition={cond}
                field={field}
                onRemove={() => remove(cond.id)}
                onChange={(patch) => update(cond.id, patch)}
              />
            );
          })}

          {/* Add button */}
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border-2 border-dashed border-orange-300 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus size={14} />
                Ajouter une condition
              </span>
              <ChevronDown
                size={14}
                className={cn("transition-transform duration-150", addOpen && "rotate-180")}
              />
            </button>

            {addOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
                <div className="absolute bottom-full mb-1.5 left-0 right-0 z-40 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 overflow-hidden">
                  {fields.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => add(f)}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-orange-50 hover:text-orange-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(conditions);
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Single condition row ─────────────────────────────────────────────────────

function ConditionRow({
  condition,
  field,
  onRemove,
  onChange,
}: {
  condition: FilterCondition;
  field: FieldDef;
  onRemove: () => void;
  onChange: (patch: Partial<FilterCondition>) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">{field.label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-300 hover:text-zinc-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {field.type === "text" && (
        <TextRow condition={condition} onChange={onChange} />
      )}
      {field.type === "select" && field.options && (
        <SelectRow condition={condition} field={field} onChange={onChange} />
      )}
      {field.type === "date" && (
        <DateRow condition={condition} onChange={onChange} />
      )}
    </div>
  );
}

function TextRow({
  condition,
  onChange,
}: {
  condition: FilterCondition;
  onChange: (p: Partial<FilterCondition>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 shrink-0">
        {OPERATOR_LABELS[condition.operator] ?? "Contient"}
      </span>
      <input
        type="text"
        placeholder="Saisir…"
        value={condition.value as string}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm focus:outline-none focus:border-orange-400 placeholder:text-zinc-300"
      />
    </div>
  );
}

function SelectRow({
  condition,
  field,
  onChange,
}: {
  condition: FilterCondition;
  field: FieldDef;
  onChange: (p: Partial<FilterCondition>) => void;
}) {
  const selected = (condition.value as string[]) ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange({ value: next });
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {field.options?.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            selected.includes(opt.value)
              ? "bg-orange-500 border-orange-500 text-white"
              : "border-zinc-200 text-zinc-600 hover:border-orange-300 hover:text-orange-600",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DateRow({
  condition,
  onChange,
}: {
  condition: FilterCondition;
  onChange: (p: Partial<FilterCondition>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={condition.operator}
        onChange={(e) =>
          onChange({
            operator: e.target.value as FilterCondition["operator"],
            value: "",
          })
        }
        className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm bg-white focus:outline-none focus:border-orange-400"
      >
        <option value="gte">Après le</option>
        <option value="lte">Avant le</option>
      </select>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-200">
        <Calendar size={13} className="text-zinc-400 shrink-0" />
        <input
          type="date"
          value={condition.value as string}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 text-sm focus:outline-none bg-transparent text-zinc-700"
        />
      </div>
    </div>
  );
}
