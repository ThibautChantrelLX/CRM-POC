import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const CABINETS = [
  "LX Aix-en-Provence",
  "LX Amiens",
  "LX Angers",
  "LX Bordeaux",
  "LX Caen",
  "LX Chambéry",
  "LX Colmar",
  "LX Douai",
  "LX Grenoble",
  "LX Limoges",
  "LX Lyon",
  "LX Montpellier",
  "LX Nîmes",
  "LX Orléans",
  "LX Paris",
  "LX Pau",
  "LX Poitiers",
  "LX Reims",
  "LX Rennes",
  "LX Riom - Clermont Ferrand",
  "LX Rouen",
  "LX Toulouse",
  "LX Versailles",
];

async function upsertEntite(raisonSociale: string, extra: { typeEntite: "GROUPE" | "FILIALE"; entiteParenteId?: string }) {
  const existing = await prisma.entite.findFirst({ where: { raisonSociale } });
  if (existing) return existing;
  return prisma.entite.create({ data: { raisonSociale, ...extra } });
}

async function main() {
  const groupe = await upsertEntite("LX GROUPE", { typeEntite: "GROUPE" });
  console.log(`Groupe : ${groupe.raisonSociale} (id=${groupe.id})`);

  for (const raisonSociale of CABINETS) {
    const cabinet = await upsertEntite(raisonSociale, {
      typeEntite: "FILIALE",
      entiteParenteId: groupe.id,
    });
    console.log(`  Cabinet : ${cabinet.raisonSociale} (id=${cabinet.id})`);
  }

  // Super admin user (email/password auth via Better Auth)
  // The account password must be hashed — run the app and use /api/auth/sign-up/email
  // to create users, or use the admin panel once available.
  // This seed only ensures the entite hierarchy exists.
  console.log("\nEntités créées. Pour créer un utilisateur SUPER_ADMIN, utilisez l'API /api/auth/sign-up/email.");
  console.log(`Entité parente pour le SUPER_ADMIN : LX GROUPE (id=${groupe.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
