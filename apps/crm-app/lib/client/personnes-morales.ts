import type {
  CreatePersonneMoraleInput,
  PersonneMoraleListItem,
  PersonneMoraleListResponse,
  UpdatePersonneMoraleInput,
} from "@/lib/server/modules/personnes-morales/dto";

export type PmAttachInfo = {
  id: string;
  raisonSociale: string;
  siretSiren: string | null;
  typeStructure: string | null;
  nomDomaine: string | null;
};

/** Clé sessionStorage utilisée pour transmettre la PM nouvellement créée
 *  lors d'un retour vers le formulaire de création de personne physique. */
export const PP_ATTACH_PM_STORAGE_KEY = "pp-create-attach-pm";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listPersonnesMorales(
  params: URLSearchParams,
): Promise<PersonneMoraleListResponse> {
  const res = await fetch(`/api/personnes-morales?${params.toString()}`);
  return handleResponse(res);
}

export async function getPersonneMorale(id: number): Promise<PersonneMoraleListItem> {
  const res = await fetch(`/api/personnes-morales/${id}`);
  return handleResponse(res);
}

export async function createPersonneMorale(
  data: CreatePersonneMoraleInput,
): Promise<PersonneMoraleListItem> {
  const res = await fetch("/api/personnes-morales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updatePersonneMorale(
  id: number,
  data: UpdatePersonneMoraleInput,
): Promise<PersonneMoraleListItem> {
  const res = await fetch(`/api/personnes-morales/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deletePersonneMorale(id: number): Promise<void> {
  const res = await fetch(`/api/personnes-morales/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
