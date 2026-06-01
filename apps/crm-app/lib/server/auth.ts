import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/server/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "USER" },
      entiteId: { type: "string", required: true },
      personnePhysiqueId: { type: "string", required: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});

export type Session = typeof auth.$Infer.Session;
