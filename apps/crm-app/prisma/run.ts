#!/usr/bin/env tsx
/**
 * Wrapper Prisma CLI avec support du flag --dev.
 *
 * Par défaut toutes les commandes ciblent la base de test (TEST_DATABASE_URL).
 * Ajouter --dev pour cibler la base de développement (DATABASE_URL).
 *
 * Usage :
 *   npm run db -- migrate dev
 *   npm run db -- migrate dev --dev
 *   npm run db -- db seed
 *   npm run db -- db seed --dev
 *   npm run db -- studio --dev
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const devFlagIndex = args.indexOf("--dev");
const isDevMode = devFlagIndex !== -1;

if (isDevMode) {
  args.splice(devFlagIndex, 1);
}

const env = { ...process.env, DB_ENV: isDevMode ? "dev" : "test" };
const target = isDevMode ? "dev (DATABASE_URL)" : "test (TEST_DATABASE_URL)";

console.log(`[db] Cible : ${target}`);

execSync(`npx prisma ${args.join(" ")}`, { stdio: "inherit", env });
