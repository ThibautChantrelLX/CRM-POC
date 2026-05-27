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

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  entiteId: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  entiteId?: string;
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

export async function fetchUserById(id: string): Promise<UserListItem | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    include: { entite: { select: { raisonSociale: true } } },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    entiteId: u.entiteId,
    entiteRaisonSociale: u.entite.raisonSociale,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const { hashPassword } = await import("@better-auth/utils/password");
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("Un utilisateur avec cet email existe déjà.");

  const id = crypto.randomUUID();
  const now = new Date();
  const hashedPassword = await hashPassword(input.password);

  const u = await prisma.user.create({
    data: {
      id,
      name: input.name,
      email: input.email,
      emailVerified: true,
      role: input.role,
      entiteId: input.entiteId,
      createdAt: now,
      updatedAt: now,
    },
    include: { entite: { select: { raisonSociale: true } } },
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

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    entiteId: u.entiteId,
    entiteRaisonSociale: u.entite.raisonSociale,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserListItem> {
  if (input.email) {
    const existing = await prisma.user.findFirst({ where: { email: input.email, NOT: { id } } });
    if (existing) throw new Error("Cet email est déjà utilisé.");
  }

  if (input.password) {
    const { hashPassword } = await import("@better-auth/utils/password");
    const hashedPassword = await hashPassword(input.password);
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPassword },
    });
  }

  const u = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.email && { email: input.email }),
      ...(input.role && { role: input.role }),
      ...(input.entiteId && { entiteId: input.entiteId }),
      updatedAt: new Date(),
    },
    include: { entite: { select: { raisonSociale: true } } },
  });

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    entiteId: u.entiteId,
    entiteRaisonSociale: u.entite.raisonSociale,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.account.deleteMany({ where: { userId: id } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
}
