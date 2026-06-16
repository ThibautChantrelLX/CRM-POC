import type { ReadonlyURLSearchParams } from "next/navigation";
import { buildQueryParams, makeId } from "./filters";
import type { FieldDef, FilterCondition, FilterGroup, FilterState } from "./filters";

// ─── URL ↔ FilterState ────────────────────────────────────────────────────────

export function urlToState(sp: ReadonlyURLSearchParams, fields: FieldDef[]): FilterState {
  const groupsRaw = sp.get("groups");
  let groups: FilterGroup[];

  if (groupsRaw) {
    try {
      const parsed = JSON.parse(groupsRaw) as Record<string, string | string[]>[];
      groups = parsed
        .map((obj) => ({ id: makeId(), conditions: decodeGroupObj(obj, fields) }))
        .filter((g) => g.conditions.length > 0);
    } catch {
      groups = [];
    }
  } else {
    const conditions = extractConditions(sp, fields);
    groups = conditions.length > 0 ? [{ id: makeId(), conditions }] : [];
  }

  return {
    search: sp.get("search") ?? "",
    sortBy: sp.get("sortBy") ?? "nom",
    sortOrder: (sp.get("sortOrder") as "asc" | "desc") ?? "asc",
    page: Math.max(1, Number(sp.get("page") ?? 1)),
    limit: Number(sp.get("limit") ?? 20),
    groups,
  };
}

function decodeGroupObj(
  obj: Record<string, string | string[]>,
  fields: FieldDef[],
): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const field of fields) {
    if ((field.type === "text" || field.type === "number") && field.param) {
      const v = obj[field.param];
      if (v && typeof v === "string")
        conditions.push({ id: makeId(), fieldKey: field.key, operator: "contains", value: v });
    } else if (field.type === "select" && field.param) {
      const vs = obj[field.param];
      if (Array.isArray(vs) && vs.length)
        conditions.push({ id: makeId(), fieldKey: field.key, operator: "in", value: vs });
    } else if (field.type === "date") {
      if (field.paramGte) {
        const v = obj[field.paramGte];
        if (v && typeof v === "string")
          conditions.push({ id: makeId(), fieldKey: field.key, operator: "gte", value: v });
      }
      if (field.paramLte) {
        const v = obj[field.paramLte];
        if (v && typeof v === "string")
          conditions.push({ id: makeId(), fieldKey: field.key, operator: "lte", value: v });
      }
    }
  }
  return conditions;
}

function extractConditions(sp: ReadonlyURLSearchParams, fields: FieldDef[]): FilterCondition[] {
  const out: FilterCondition[] = [];
  for (const field of fields) {
    if ((field.type === "text" || field.type === "number") && field.param) {
      const v = sp.get(field.param);
      if (v) out.push({ id: makeId(), fieldKey: field.key, operator: "contains", value: v });
    } else if (field.type === "select" && field.param) {
      const vs = sp.getAll(field.param);
      if (vs.length) out.push({ id: makeId(), fieldKey: field.key, operator: "in", value: vs });
    } else if (field.type === "date") {
      if (field.paramGte) {
        const v = sp.get(field.paramGte);
        if (v) out.push({ id: makeId(), fieldKey: field.key, operator: "gte", value: v });
      }
      if (field.paramLte) {
        const v = sp.get(field.paramLte);
        if (v) out.push({ id: makeId(), fieldKey: field.key, operator: "lte", value: v });
      }
    }
  }
  return out;
}

export function stateToURL(state: FilterState, fields: FieldDef[]): string {
  return buildQueryParams(state, fields).toString();
}

// ─── Badge labels ─────────────────────────────────────────────────────────────

export function conditionBadgeLabel(cond: FilterCondition, fields: FieldDef[]): string {
  const field = fields.find((f) => f.key === cond.fieldKey);
  if (!field) return "";

  if (field.type === "text") {
    return `${field.label} : ${cond.value}`;
  }
  if (field.type === "number") {
    return `${field.label} : ≥ ${cond.value}`;
  }
  if (field.type === "select") {
    const vals = cond.value as string[];
    if (field.optionsUrl) {
      // Labels non disponibles statiquement — afficher le compte
      return `${field.label} : ${vals.length} sélectionné(s)`;
    }
    const labels = vals
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
    return `${field.label} : ${labels}`;
  }
  if (field.type === "date") {
    const op = cond.operator === "gte" ? "après" : "avant";
    const raw = cond.value as string;
    const d = new Date(raw);
    const formatted = isNaN(d.getTime()) ? raw : d.toLocaleDateString("fr-FR");
    return `${field.label} ${op} : ${formatted}`;
  }
  return "";
}
