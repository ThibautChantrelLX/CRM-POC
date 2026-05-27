import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@better-auth/utils/password";
import * as dotenv from "dotenv";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

dotenv.config({ path: ".env.local" });

const connectionString = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const rl = readline.createInterface({ input, output });

  const email = await rl.question("Email : ");
  const name = await rl.question("Nom affiché : ");
  const password = await rl.question("Mot de passe : ");
  const roleInput = await rl.question("Rôle [SUPER_ADMIN/ADMIN/ASSOCIE/ACADEMIE/USER] (défaut: SUPER_ADMIN) : ");
  const role = (roleInput.trim() || "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN" | "ASSOCIE" | "ACADEMIE" | "USER";

  rl.close();

  // Find root entite (LX GROUPE) to attach user
  const entite = await prisma.entite.findFirst({ where: { typeEntite: "GROUPE" } });
  if (!entite) throw new Error("Aucune entité GROUPE trouvée — lancez d'abord seed_entities.ts");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Un utilisateur avec l'email ${email} existe déjà (id=${existing.id}).`);
    return;
  }

  const id = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);
  const now = new Date();

  await prisma.user.create({
    data: {
      id,
      email,
      name,
      emailVerified: true,
      role,
      entiteId: entite.id,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
  });

  console.log(`\n✓ Utilisateur créé : ${email} (rôle=${role}, entité="${entite.raisonSociale}")`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
