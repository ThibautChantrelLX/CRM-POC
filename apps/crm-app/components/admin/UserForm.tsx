"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { inputCls, selectCls, FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Role } from "@/app/generated/prisma/client";

const ROLES: { value: Role; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "ASSOCIE", label: "Associé" },
  { value: "ACADEMIE", label: "Académie" },
  { value: "USER", label: "Utilisateur" },
];

interface Entite { id: string; raisonSociale: string; typeEntite: string }

interface UserFormProps {
  mode: "create" | "edit";
  userId?: string;
  defaultValues?: {
    name: string;
    email: string;
    role: Role;
    entiteId: string;
  };
}

export function UserForm({ mode, userId, defaultValues }: UserFormProps) {
  const router = useRouter();
  const [entites, setEntites] = useState<Entite[]>([]);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(defaultValues?.role ?? "USER");
  const [entiteId, setEntiteId] = useState(defaultValues?.entiteId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/entites").then((r) => r.json()).then(setEntites).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/admin/users" : `/api/admin/users/${userId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body: Record<string, string> = { name, email, role, entiteId };
      if (password) body.password = password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      router.push("/admin/users");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nom complet" required className="col-span-2">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Dupont"
            required
          />
        </FormField>

        <FormField label="Adresse email" required className="col-span-2">
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jean.dupont@lx.legal"
            required
          />
        </FormField>

        <FormField
          label={mode === "create" ? "Mot de passe" : "Nouveau mot de passe"}
          required={mode === "create"}
          className="col-span-2"
        >
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "edit" ? "Laisser vide pour ne pas modifier" : "Minimum 8 caractères"}
            minLength={mode === "create" ? 8 : undefined}
            required={mode === "create"}
          />
        </FormField>

        <FormField label="Rôle" required>
          <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as Role)} required>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </FormField>

        <FormField label="Entité" required>
          <select className={selectCls} value={entiteId} onChange={(e) => setEntiteId(e.target.value)} required>
            <option value="">— Choisir —</option>
            {entites.map((e) => (
              <option key={e.id} value={e.id}>{e.raisonSociale}</option>
            ))}
          </select>
        </FormField>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton isLoading={loading} disabled={!name || !email || !entiteId}>
          {mode === "create" ? "Créer l'utilisateur" : "Enregistrer les modifications"}
        </SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
