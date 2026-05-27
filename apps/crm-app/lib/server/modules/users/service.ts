import { prisma } from "@/lib/server/prisma";
import type { Role } from "@/app/generated/prisma/client";

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  entiteId: string;
  entiteRaisonSociale: string;
  emailVerified: boolean;
  createdAt: Date;
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { entite: { select: { raisonSociale: true } } },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    entiteId: u.entiteId,
    entiteRaisonSociale: u.entite.raisonSociale,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  }));
}
