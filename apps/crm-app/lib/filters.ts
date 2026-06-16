// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldType = "text" | "select" | "date" | "number" | "number-range";

export type SelectOption = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  optionsUrl?: string; // select → URL pour charger les options dynamiquement
  param?: string;      // text/select/number → query param name (select: repeatable)
  paramGte?: string;   // date → gte param name
  paramLte?: string;   // date → lte param name
};

export type FilterCondition = {
  id: string;
  fieldKey: string;
  operator: "contains" | "in" | "gte" | "lte" | "between";
  value: string | string[];
};

export type FilterGroup = {
  id: string;
  conditions: FilterCondition[];
};

export type FilterState = {
  search: string;
  groups: FilterGroup[];
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
  between: "Compris entre",
};

export function defaultOperator(field: FieldDef): FilterCondition["operator"] {
  if (field.type === "select") return "in";
  if (field.type === "date") return "gte";
  if (field.type === "number-range") return "between";
  return "contains";
}

export function defaultValue(field: FieldDef): string | string[] {
  if (field.type === "select") return [];
  if (field.type === "number") return "1";
  if (field.type === "number-range") return "|";
  return "";
}

function isConditionEmpty(cond: FilterCondition): boolean {
  if (Array.isArray(cond.value)) return cond.value.length === 0;
  if (cond.value === "") return true;
  if (cond.value.includes("|")) {
    const [a, b] = cond.value.split("|");
    return !a?.trim() && !b?.trim();
  }
  return false;
}

function encodeGroupToObj(
  group: FilterGroup,
  fieldMap: Map<string, FieldDef>,
): Record<string, string | string[]> {
  const obj: Record<string, string | string[]> = {};
  for (const cond of group.conditions) {
    const field = fieldMap.get(cond.fieldKey);
    if (!field || isConditionEmpty(cond)) continue;
    if ((field.type === "text" || field.type === "number") && field.param) {
      obj[field.param] = cond.value as string;
    } else if (field.type === "select" && field.param) {
      obj[field.param] = cond.value as string[];
    } else if (field.type === "date") {
      const v = cond.value as string;
      if (!v) continue;
      if (cond.operator === "gte" && field.paramGte) obj[field.paramGte] = v;
      if (cond.operator === "lte" && field.paramLte) obj[field.paramLte] = v;
    } else if (field.type === "number-range") {
      const v = cond.value as string;
      const [min, max] = v.split("|");
      if (min?.trim() && field.paramGte) obj[field.paramGte] = min.trim();
      if (max?.trim() && field.paramLte) obj[field.paramLte] = max.trim();
    }
  }
  return obj;
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
  const nonEmptyGroups = state.groups.filter((g) =>
    g.conditions.some((c) => !isConditionEmpty(c)),
  );

  if (nonEmptyGroups.length === 0) return p;

  if (nonEmptyGroups.length === 1) {
    // Groupe unique : params plats (rétro-compatible, URL lisible)
    for (const cond of nonEmptyGroups[0].conditions) {
      const field = fieldMap.get(cond.fieldKey);
      if (!field || isConditionEmpty(cond)) continue;
      if ((field.type === "text" || field.type === "number") && field.param) {
        p.set(field.param, cond.value as string);
      } else if (field.type === "select" && field.param) {
        (cond.value as string[]).forEach((v) => p.append(field.param!, v));
      } else if (field.type === "date") {
        const v = cond.value as string;
        if (!v) continue;
        if (cond.operator === "gte" && field.paramGte) p.set(field.paramGte, v);
        if (cond.operator === "lte" && field.paramLte) p.set(field.paramLte, v);
      } else if (field.type === "number-range") {
        const v = cond.value as string;
        const [min, max] = v.split("|");
        if (min?.trim() && field.paramGte) p.set(field.paramGte, min.trim());
        if (max?.trim() && field.paramLte) p.set(field.paramLte, max.trim());
      }
    }
  } else {
    // Groupes multiples : JSON-encodé
    p.set(
      "groups",
      JSON.stringify(nonEmptyGroups.map((g) => encodeGroupToObj(g, fieldMap))),
    );
  }

  return p;
}
