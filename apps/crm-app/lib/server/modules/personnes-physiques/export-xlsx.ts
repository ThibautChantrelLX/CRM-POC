import * as XLSX from "xlsx";
import { splitEmails, filterProEmails } from "@/lib/email-utils";
import type {
  PersonnePhysiqueExportFields,
  PersonnePhysiqueExportItem,
  PersonnePhysiqueExportRattachement,
} from "./dto";

// ─── Labels ───────────────────────────────────────────────────────────────────

const TYPE_RELATION_LABELS: Record<string, string> = {
  CONTACT: "Contact", CLIENT: "Client", HYBRIDE: "Hybride", PROSPECT: "Prospect",
};
const STATUT_RGPD_LABELS: Record<string, string> = {
  OPT_IN: "Opt-in", OPT_OUT: "Opt-out", NON_RENSEIGNE: "Non renseigné",
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

type Cell = string | number | null;
type Row = Cell[];

function buildRows(
  items: PersonnePhysiqueExportItem[],
  fields: PersonnePhysiqueExportFields,
  ratt: PersonnePhysiqueExportRattachement,
): { headers: string[]; rows: Row[] } {
  const headers: string[] = [];

  if (fields.nom) headers.push("Nom");
  if (fields.prenom) headers.push("Prénom");
  if (fields.email) headers.push("Email");
  if (fields.telephone) headers.push("Téléphone");
  if (fields.portable) headers.push("Portable");
  if (fields.profession) headers.push("Profession");
  if (fields.specialite) headers.push("Spécialité");
  if (fields.barreau) headers.push("Barreau");
  if (fields.dateSerment) headers.push("Date de serment");
  if (fields.activiteDominante) headers.push("Activité dominante");
  if (fields.typeRelation) headers.push("Type de relation");
  if (fields.statutRgpd) headers.push("Statut RGPD");
  if (fields.actif) headers.push("Actif");
  if (fields.optInEmail) headers.push("Opt-in email");
  if (fields.optInSms) headers.push("Opt-in SMS");
  if (fields.optOutGlobal) headers.push("Opt-out global");
  if (fields.emailInvalide) headers.push("Email invalide");
  if (fields.totalEmails) headers.push("Total emails");
  if (fields.dernierEmailLe) headers.push("Dernier email le");
  if (fields.creerLe) headers.push("Créé le");
  if (fields.modifierLe) headers.push("Modifié le");

  const baseRow = (pp: PersonnePhysiqueExportItem): Row => {
    const row: Row = [];
    if (fields.nom) row.push(pp.nom);
    if (fields.prenom) row.push(pp.prenom ?? "");
    if (fields.email) {
      const emails = splitEmails(pp.email);
      const kept = fields.emailProOnly ? filterProEmails(emails) : emails;
      row.push(kept.join("; "));
    }
    if (fields.telephone) row.push(pp.telephone ?? "");
    if (fields.portable) row.push(pp.portable ?? "");
    if (fields.profession) row.push(pp.profession ?? "");
    if (fields.specialite) row.push(pp.specialite ?? "");
    if (fields.barreau) row.push(pp.barreau ?? "");
    if (fields.dateSerment) row.push(pp.dateSerment ?? "");
    if (fields.activiteDominante) row.push(pp.activiteDominante ?? "");
    if (fields.typeRelation) row.push(TYPE_RELATION_LABELS[pp.typeRelation] ?? pp.typeRelation);
    if (fields.statutRgpd)
      row.push(pp.statutRgpd ? (STATUT_RGPD_LABELS[pp.statutRgpd] ?? pp.statutRgpd) : "");
    if (fields.actif) row.push(pp.actif ? "Oui" : "Non");
    if (fields.optInEmail) row.push(pp.optInEmail ? "Oui" : "Non");
    if (fields.optInSms) row.push(pp.optInSms ? "Oui" : "Non");
    if (fields.optOutGlobal) row.push(pp.optOutGlobal ? "Oui" : "Non");
    if (fields.emailInvalide) row.push(pp.emailInvalide ? "Oui" : "Non");
    if (fields.totalEmails) row.push(pp.totalEmails ?? "");
    if (fields.dernierEmailLe) row.push(pp.dernierEmailLe ?? "");
    if (fields.creerLe) row.push(pp.creerLe);
    if (fields.modifierLe) row.push(pp.modifierLe);
    return row;
  };

  const rattHeaders = (prefix = ""): string[] => {
    const h: string[] = [];
    if (ratt.raisonSociale) h.push(`${prefix}Entreprise`);
    if (ratt.siretSirenPm) h.push(`${prefix}SIREN / SIRET`);
    if (ratt.titreFonction) h.push(`${prefix}Poste / Titre`);
    if (ratt.dateDebut) h.push(`${prefix}Depuis`);
    if (ratt.dateFin) h.push(`${prefix}Jusqu'au`);
    if (ratt.emailPm) h.push(`${prefix}Email entreprise`);
    if (ratt.telephonePm) h.push(`${prefix}Tél. entreprise`);
    return h;
  };

  const rattRow = (r: PersonnePhysiqueExportItem["rattachements"][0]): Row => {
    const row: Row = [];
    if (ratt.raisonSociale) row.push(r.raisonSociale);
    if (ratt.siretSirenPm) row.push(r.siretSirenPm ?? "");
    if (ratt.titreFonction) row.push(r.titreFonction ?? "");
    if (ratt.dateDebut) row.push(r.dateDebut ?? "");
    if (ratt.dateFin) row.push(r.dateFin ?? "En cours");
    if (ratt.emailPm) row.push(r.emailPm ?? "");
    if (ratt.telephonePm) row.push(r.telephonePm ?? "");
    return row;
  };

  const filterRatts = (pp: PersonnePhysiqueExportItem) =>
    ratt.scope === "actifs" ? pp.rattachements.filter((r) => !r.dateFin) : pp.rattachements;

  if (!ratt.include) {
    return { headers, rows: items.map(baseRow) };
  }

  if (ratt.mode === "ligne") {
    headers.push(...rattHeaders());
    const emptyRatt: Row = rattHeaders().map(() => "");
    const rows: Row[] = [];
    for (const pp of items) {
      const ratts = filterRatts(pp);
      if (ratts.length === 0) {
        rows.push([...baseRow(pp), ...emptyRatt]);
      } else {
        for (const r of ratts) {
          rows.push([...baseRow(pp), ...rattRow(r)]);
        }
      }
    }
    return { headers, rows };
  }

  // mode "colonne" : une ligne par PP, colonnes numérotées
  const maxRatts = items.reduce((m, pp) => Math.max(m, filterRatts(pp).length), 0);
  for (let i = 1; i <= maxRatts; i++) {
    headers.push(...rattHeaders(`Entreprise ${i} — `));
  }
  const emptySlot: Row = rattHeaders().map(() => "");
  const rows = items.map((pp) => {
    const ratts = filterRatts(pp);
    const cols: Row = [];
    for (let i = 0; i < maxRatts; i++) {
      cols.push(...(i < ratts.length ? rattRow(ratts[i]) : emptySlot));
    }
    return [...baseRow(pp), ...cols];
  });
  return { headers, rows };
}

// ─── Workbook ─────────────────────────────────────────────────────────────────

export function buildPersonnesPhysiquesXlsx(
  items: PersonnePhysiqueExportItem[],
  fields: PersonnePhysiqueExportFields,
  ratt: PersonnePhysiqueExportRattachement,
): Buffer {
  const { headers, rows } = buildRows(items, fields, ratt);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Personnes Physiques");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}
