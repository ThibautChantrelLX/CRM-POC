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
  const groupe = await prisma.entite.upsert({
    where: { id: 1 },
    update: {},
    create: { typeEntite: "GROUPE", raisonSociale: "LX Avocats" },
  });

  console.log(`Groupe créé : ${groupe.raisonSociale} (id=${groupe.id})`);

  for (const raisonSociale of CABINETS) {
    const cabinet = await prisma.entite.upsert({
      where: {
        // Upsert par raison sociale — à remplacer par siret une fois les données disponibles
        id: (await prisma.entite.findFirst({ where: { raisonSociale } }))?.id ?? 0,
      },
      update: {},
      create: {
        typeEntite: "FILIALE",
        raisonSociale,
        entiteParenteId: groupe.id,
      },
    });
    console.log(`  Cabinet créé : ${cabinet.raisonSociale} (id=${cabinet.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
