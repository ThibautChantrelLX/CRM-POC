"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/admin/DataTable";
import { AdminBadge } from "@/components/admin/AdminBadge";
import type { UserListItem } from "@/lib/server/modules/users/service";
import type { Role } from "@/app/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  ASSOCIE: "Associé",
  ACADEMIE: "Académie",
  USER: "Utilisateur",
};

const ROLE_VARIANTS: Record<Role, "default" | "success" | "warning" | "danger" | "info"> = {
  SUPER_ADMIN: "danger",
  ADMIN: "warning",
  ASSOCIE: "info",
  ACADEMIE: "success",
  USER: "default",
};

interface Props {
  users: UserListItem[];
  canEdit: boolean;
  currentUserId: string;
}

export function UsersTable({ users, canEdit, currentUserId }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(user: UserListItem) {
    if (!confirm(`Supprimer le compte de ${user.name} ? Cette action est irréversible.`)) return;
    setDeleting(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erreur lors de la suppression.");
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setDeleting(null);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Nom",
      sortable: true,
      sortValue: (u: UserListItem) => u.name,
      render: (u: UserListItem) => (
        <span className="font-medium text-zinc-800">{u.name}</span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      sortValue: (u: UserListItem) => u.email,
      render: (u: UserListItem) => (
        <span className="text-zinc-500 text-xs font-mono">{u.email}</span>
      ),
    },
    {
      key: "role",
      label: "Rôle",
      sortable: true,
      sortValue: (u: UserListItem) => u.role,
      render: (u: UserListItem) => (
        <AdminBadge label={ROLE_LABELS[u.role]} variant={ROLE_VARIANTS[u.role]} />
      ),
    },
    {
      key: "entiteRaisonSociale",
      label: "Entité",
      sortable: true,
      sortValue: (u: UserListItem) => u.entiteRaisonSociale,
    },
    {
      key: "createdAt",
      label: "Créé le",
      sortable: true,
      sortValue: (u: UserListItem) => new Date(u.createdAt).getTime(),
      render: (u: UserListItem) =>
        new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={users}
      getKey={(u) => u.id}
      searchPlaceholder="Rechercher par nom, email, rôle…"
      searchFilter={(u, q) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q) ||
        u.entiteRaisonSociale.toLowerCase().includes(q)
      }
      emptyMessage="Aucun utilisateur."
      actions={
        canEdit
          ? (u) => (
              <>
                <Link
                  href={`/admin/users/${u.id}/edit`}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={13} />
                </Link>
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deleting === u.id || isPending}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )
          : undefined
      }
    />
  );
}
