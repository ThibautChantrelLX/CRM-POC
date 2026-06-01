import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });

const isDevMode = process.env.DB_ENV === "dev";
const url = isDevMode
  ? process.env.DATABASE_URL
  : (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? "postgresql://lx:password@localhost:5441/crm_shadow",
  },
});
