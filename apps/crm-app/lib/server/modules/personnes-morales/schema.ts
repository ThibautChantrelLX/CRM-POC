import { z } from "zod";

const TypeRelationPmSchema = z.enum([
  "CABINET_POSTULATION",
  "CLIENT_DIRECT",
  "HYBRIDE",
  "AUTRE",
  "PROSPECT",
]);

const AdresseSchema = z.object({
  rue: z.string().optional(),
  complementAdresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
});

export const CreatePersonneMoraleSchema = z.object({
  raisonSociale: z.string().min(1, "La raison sociale est requise"),
  typeRelation: TypeRelationPmSchema,
  email: z
    .string()
    .email("Format email invalide")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  telephone: z.string().optional(),
  siretSiren: z.string().optional(),
  typeStructure: z.string().optional(),
  actif: z.boolean().optional().default(true),
  siteWeb: z.string().optional(),
  secteurActivite: z.string().optional(),
  categorieEntreprise: z.string().optional(),
  nomDomaine: z.string().optional(),
  adresse: AdresseSchema.optional(),
});

export const UpdatePersonneMoraleSchema = z.object({
  raisonSociale: z.string().min(1, "La raison sociale est requise").optional(),
  typeRelation: TypeRelationPmSchema.optional().nullable(),
  email: z
    .string()
    .email("Format email invalide")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  telephone: z.string().optional(),
  siretSiren: z.string().optional(),
  typeStructure: z.string().optional(),
  actif: z.boolean().optional(),
  siteWeb: z.string().optional(),
  secteurActivite: z.string().optional(),
  categorieEntreprise: z.string().optional(),
  sourceOrigine: z.string().optional(),
  nomDomaine: z.string().optional(),
  adresse: AdresseSchema.optional(),
});

export type ValidationError = { error: string; field?: string };

export function formatZodError(err: z.ZodError): ValidationError {
  const first = err.issues[0];
  return { error: first.message, field: first.path.join(".") };
}
