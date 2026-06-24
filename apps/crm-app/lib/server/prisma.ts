import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)!;
  const ssl = process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined;
  // Le pool est limité par instance de fonction serverless : chaque route Vercel a son
  // propre module/pool, donc un max élevé multiplie vite les connexions vers le pooler Supabase.
  const adapter = new PrismaPg({
    connectionString,
    ssl,
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Réutiliser le singleton dans tous les environnements : en dev pour survivre au Fast Refresh,
// en prod pour réutiliser le même pool entre invocations d'une même instance serverless "warm".
globalForPrisma.prisma = prisma;
