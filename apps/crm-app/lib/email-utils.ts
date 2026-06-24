export const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.fr",
  "hotmail.com", "hotmail.fr",
  "outlook.com", "outlook.fr",
  "live.com", "live.fr",
  "orange.fr", "orange.com",
  "free.fr",
  "laposte.net", "laposte.fr",
  "sfr.fr", "sfr.net",
  "wanadoo.fr",
  "bbox.fr",
  "numericable.fr",
  "icloud.com", "me.com", "mac.com",
  "msn.com",
  "aol.com",
]);

export function isGenericEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return GENERIC_DOMAINS.has(email.slice(at + 1).toLowerCase());
}

export function splitEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split("|").map((e) => e.trim()).filter(Boolean);
}

/**
 * Retourne uniquement les emails professionnels si la PP en a plusieurs.
 * Si une seule adresse ou si toutes sont génériques, retourne toutes.
 */
export function filterProEmails(emails: string[]): string[] {
  if (emails.length <= 1) return emails;
  const pro = emails.filter((e) => !isGenericEmail(e));
  return pro.length > 0 ? pro : emails;
}
