// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldType = "text" | "select" | "date";

export type SelectOption = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  param?: string;      // text/select → query param name (select: repeatable)
  paramGte?: string;   // date → gte param name
  paramLte?: string;   // date → lte param name
};

export type FilterCondition = {
  id: string;
  fieldKey: string;
  operator: "contains" | "in" | "gte" | "lte";
  value: string | string[];
};

export type FilterState = {
  search: string;
  conditions: FilterCondition[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const OPERATOR_LABELS: Record<string, string> = {
  contains: "Contient",
  in: "Est l'un de",
  gte: "Après le",
  lte: "Avant le",
};

export function defaultOperator(field: FieldDef): FilterCondition["operator"] {
  if (field.type === "select") return "in";
  if (field.type === "date") return "gte";
  return "contains";
}

export function defaultValue(field: FieldDef): string | string[] {
  if (field.type === "select") return [];
  return "";
}

// ─── Query builder ────────────────────────────────────────────────────────────

export function buildQueryParams(state: FilterState, fields: FieldDef[]): URLSearchParams {
  const p = new URLSearchParams();
  if (state.search) p.set("search", state.search);
  p.set("sortBy", state.sortBy);
  p.set("sortOrder", state.sortOrder);
  p.set("page", String(state.page));
  p.set("limit", String(state.limit));

  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  for (const cond of state.conditions) {
    const field = fieldMap.get(cond.fieldKey);
    if (!field) continue;
    if (!cond.value || (Array.isArray(cond.value) && cond.value.length === 0)) continue;

    if (field.type === "text" && field.param) {
      p.set(field.param, cond.value as string);
    } else if (field.type === "select" && field.param) {
      (cond.value as string[]).forEach((v) => p.append(field.param!, v));
    } else if (field.type === "date") {
      const v = cond.value as string;
      if (!v) continue;
      if (cond.operator === "gte" && field.paramGte) p.set(field.paramGte, v);
      if (cond.operator === "lte" && field.paramLte) p.set(field.paramLte, v);
    }
  }

  return p;
}
