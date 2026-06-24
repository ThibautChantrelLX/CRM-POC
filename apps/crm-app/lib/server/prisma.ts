import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)!;
  const ssl = process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined;
  const adapter = new PrismaPg({ connectionString, ssl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
