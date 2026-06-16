"use client";

import { useState, useEffect } from "react";
import { X, Plus, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OPERATOR_LABELS,
  defaultOperator,
  defaultValue,
  makeId,
  type FieldDef,
  type FilterCondition,
  type FilterGroup,
} from "@/lib/filters";

type SelectOption = { value: string; label: string };

// ─── Panel ────────────────────────────────────────────────────────────────────

type Props = {
  fields: FieldDef[];
  initialGroups: FilterGroup[];
  onApply: (groups: FilterGroup[]) => void;
  onClose: () => void;
};

export function AdvancedFilters({ fields, initialGroups, onApply, onClose }: Props) {
  const [groups, setGroups] = useState<FilterGroup[]>(
    initialGroups.length > 0 ? initialGroups : [{ id: makeId(), conditions: [] }],
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const addGroup = () => {
    const newGroup: FilterGroup = { id: makeId(), conditions: [] };
    setGroups((prev) => [...prev, newGroup]);
  };

  const removeGroup = (id: string) =>
    setGroups((prev) => prev.filter((g) => g.id !== id));

  const addConditionToGroup = (groupId: string, field: FieldDef) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: [
                ...g.conditions,
                {
                  id: makeId(),
                  fieldKey: field.key,
                  operator: defaultOperator(field),
                  value: defaultValue(field),
                },
              ],
            }
          : g,
      ),
    );
    setExpandedGroupId(null);
  };

  const removeConditionFromGroup = (groupId: string, condId: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== condId) }
          : g,
      ),
    );

  const updateConditionInGroup = (
    groupId: string,
    condId: string,
    patch: Partial<FilterCondition>,
  ) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) => (c.id === condId ? { ...c, ...patch } : c)),
            }
          : g,
      ),
    );

  const reset = () => {
    setGroups([{ id: makeId(), conditions: [] }]);
    setExpandedGroupId(null);
  };

  const isMultiGroup = groups.length > 1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-full mt-2 z-30 bg-white rounded-xl border border-zinc-200 shadow-xl w-100 flex flex-col max-h-145">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 shrink-0">
          <div className="font-semibold text-zinc-900">Filtres avancés</div>
          <div className="text-xs text-zinc-400 mt-0.5">
            ET au sein d&apos;un groupe · OU entre les groupes
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2.5">
          {groups.map((group, idx) => (
            <div key={group.id}>
              {isMultiGroup && idx > 0 && (
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-zinc-200" />
                  <span className="text-xs font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded-full px-2.5 py-0.5">
                    OU
                  </span>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>
              )}

              <GroupCard
                group={group}
                groupIndex={idx}
                fields={fields}
                showHeader={isMultiGroup}
                canRemove={isMultiGroup}
                isAddOpen={expandedGroupId === group.id}
                onToggleAdd={() =>
                  setExpandedGroupId((prev) => (prev === group.id ? null : group.id))
                }
                onAddCondition={(f) => addConditionToGroup(group.id, f)}
                onRemoveGroup={() => removeGroup(group.id)}
                onRemoveCondition={(cId) => removeConditionFromGroup(group.id, cId)}
                onUpdateCondition={(cId, patch) => updateConditionInGroup(group.id, cId, patch)}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-lg border-2 border-dashed border-zinc-300 text-sm text-zinc-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors mt-1"
          >
            <Plus size={14} />
            Ajouter un groupe (OU)
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2 shrink-0">
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
              onApply(groups);
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  groupIndex,
  fields,
  showHeader,
  canRemove,
  isAddOpen,
  onToggleAdd,
  onAddCondition,
  onRemoveGroup,
  onRemoveCondition,
  onUpdateCondition,
}: {
  group: FilterGroup;
  groupIndex: number;
  fields: FieldDef[];
  showHeader: boolean;
  canRemove: boolean;
  isAddOpen: boolean;
  onToggleAdd: () => void;
  onAddCondition: (f: FieldDef) => void;
  onRemoveGroup: () => void;
  onRemoveCondition: (id: string) => void;
  onUpdateCondition: (id: string, patch: Partial<FilterCondition>) => void;
}) {
  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  return (
    <div className="rounded-xl border border-zinc-200">
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 rounded-t-xl">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Groupe {groupIndex + 1}
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemoveGroup}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <div className="px-3 py-2.5 flex flex-col gap-2">
        {group.conditions.map((cond) => {
          const field = fieldMap.get(cond.fieldKey);
          if (!field) return null;
          return (
            <ConditionRow
              key={cond.id}
              condition={cond}
              field={field}
              onRemove={() => onRemoveCondition(cond.id)}
              onChange={(patch) => onUpdateCondition(cond.id, patch)}
            />
          );
        })}

        {/* Inline accordion — expands in-place, no floating dropdown */}
        <button
          type="button"
          onClick={onToggleAdd}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-primary-300 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
        >
          <Plus size={13} />
          <span className="flex-1 text-left">Ajouter une condition</span>
          <ChevronDown
            size={13}
            className={cn("transition-transform duration-150", isAddOpen && "rotate-180")}
          />
        </button>

        {isAddOpen && (
          <div className="rounded-lg border border-zinc-200 bg-white py-1">
            {fields.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onAddCondition(f)}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
      {field.type === "text" && <TextRow condition={condition} onChange={onChange} />}
      {field.type === "number" && <NumberRow condition={condition} onChange={onChange} />}
      {field.type === "select" && field.optionsUrl && (
        <SelectSearchRow condition={condition} field={field} onChange={onChange} />
      )}
      {field.type === "select" && !field.optionsUrl && field.options && (
        <SelectRow condition={condition} field={field} onChange={onChange} />
      )}
      {field.type === "date" && <DateRow condition={condition} onChange={onChange} />}
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
        className="flex-1 px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm focus:outline-none focus:border-primary-400 placeholder:text-zinc-300"
      />
    </div>
  );
}

function NumberRow({
  condition,
  onChange,
}: {
  condition: FilterCondition;
  onChange: (p: Partial<FilterCondition>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 shrink-0">Au moins</span>
      <input
        type="number"
        min={1}
        placeholder="1"
        value={condition.value as string}
        onChange={(e) => onChange({ value: e.target.value })}
        className="w-20 px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm focus:outline-none focus:border-primary-400"
      />
      <span className="text-xs text-zinc-400">formation(s)</span>
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
              ? "bg-primary-500 border-primary-500 text-white"
              : "border-zinc-200 text-zinc-600 hover:border-primary-300 hover:text-primary-600",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SelectSearchRow({
  condition,
  field,
  onChange,
}: {
  condition: FilterCondition;
  field: FieldDef;
  onChange: (p: Partial<FilterCondition>) => void;
}) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!field.optionsUrl) return;
    fetch(field.optionsUrl)
      .then((r) => r.json())
      .then((data: unknown) => {
        const arr = data as Array<string | { value: string; label: string }>;
        if (!arr.length) return;
        if (typeof arr[0] === "string") {
          setOptions((arr as string[]).map((v) => ({ value: v, label: v })));
        } else {
          setOptions((arr as { value: string; label: string }[]).map(({ value, label }) => ({ value, label })));
        }
      })
      .catch(() => {});
  }, [field.optionsUrl]);

  const selected = (condition.value as string[]) ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange({ value: next });
  };

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Rechercher…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm focus:outline-none focus:border-primary-400 placeholder:text-zinc-300"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((v) => {
            const label = options.find((o) => o.value === v)?.label ?? v;
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500 text-white text-xs font-medium"
              >
                {label}
                <button type="button" onClick={() => toggle(v)} className="hover:opacity-75">
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="max-h-35 overflow-y-auto flex flex-col gap-0.5 pr-1">
        {filtered.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors",
              selected.includes(opt.value)
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-zinc-600 hover:bg-zinc-50",
            )}
          >
            {opt.label}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-400 px-2.5 py-1.5">Aucun résultat</p>
        )}
      </div>
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
          onChange({ operator: e.target.value as FilterCondition["operator"], value: "" })
        }
        className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 text-sm bg-white focus:outline-none focus:border-primary-400"
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
