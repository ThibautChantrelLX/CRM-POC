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

async function main() {
  let groupe = await prisma.entite.findFirst({
    where: { typeEntite: "GROUPE", raisonSociale: "LX Avocats" },
  });
  if (!groupe) {
    groupe = await prisma.entite.create({
      data: { typeEntite: "GROUPE", raisonSociale: "LX Avocats" },
    });
  }

  console.log(`Groupe : ${groupe.raisonSociale} (id=${groupe.id})`);

  for (const raisonSociale of CABINETS) {
    const existing = await prisma.entite.findFirst({
      where: { raisonSociale, typeEntite: "FILIALE" },
    });
    if (existing) {
      console.log(`  Existant : ${existing.raisonSociale} (id=${existing.id})`);
    } else {
      const cabinet = await prisma.entite.create({
        data: { typeEntite: "FILIALE", raisonSociale, entiteParenteId: groupe.id },
      });
      console.log(`  Créé : ${cabinet.raisonSociale} (id=${cabinet.id})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
