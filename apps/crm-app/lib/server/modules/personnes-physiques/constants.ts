import type { ProfilType } from "./dto";

export function profilTypeFromPrincipal(t: string | null | undefined): ProfilType {
  if (!t) return "PARTICULIER";
  if (t === "PARTICULIER") return "PARTICULIER";
  if (t === "AVOCAT_INTERNE" || t === "AVOCAT_EXTERNE") return "AVOCAT";
  return "PRO";
}

export const TYPE_RELATION_PP_OPTIONS = [
  { value: "CONTACT", label: "Contact", color: "bg-secondary-100 text-secondary-700", colorBorder: "bg-secondary-100 text-secondary-700 border-secondary-200" },
  { value: "CLIENT", label: "Client", color: "bg-primary-100 text-primary-700", colorBorder: "bg-primary-100 text-primary-700 border-primary-200" },
  { value: "HYBRIDE", label: "Hybride", color: "bg-purple-100 text-purple-700", colorBorder: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "PROSPECT", label: "Prospect", color: "bg-orange-100 text-orange-700", colorBorder: "bg-orange-100 text-orange-700 border-orange-200" },
] as const;
