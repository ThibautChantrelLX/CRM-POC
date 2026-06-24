import type {
  CreatePersonnePhysiqueInput,
  PersonnePhysiqueListItem,
  PersonnePhysiqueListResponse,
  UpdatePersonnePhysiqueInput,
} from "@/lib/server/modules/personnes-physiques/dto";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listPersonnesPhysiques(
  params: URLSearchParams,
): Promise<PersonnePhysiqueListResponse> {
  const res = await fetch(`/api/personnes-physiques?${params.toString()}`);
  return handleResponse(res);
}

export type PersonnePhysiqueMatch = { id: string; nom: string; prenom: string | null } | null;

export async function checkPersonnePhysiqueEmail(
  email: string,
  excludeId?: string,
): Promise<PersonnePhysiqueMatch> {
  const params = new URLSearchParams({ email });
  if (excludeId) params.set("excludeId", excludeId);
  const res = await fetch(`/api/personnes-physiques/check-email?${params.toString()}`);
  return handleResponse(res);
}

export async function checkPersonnePhysiquePhone(
  field: "telephone" | "portable",
  value: string,
): Promise<PersonnePhysiqueMatch> {
  const res = await fetch(
    `/api/personnes-physiques/check-phone?field=${field}&value=${encodeURIComponent(value)}`,
  );
  return handleResponse(res);
}

export async function getPersonnePhysique(id: number): Promise<PersonnePhysiqueListItem> {
  const res = await fetch(`/api/personnes-physiques/${id}`);
  return handleResponse(res);
}

export async function createPersonnePhysique(
  data: CreatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const res = await fetch("/api/personnes-physiques", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updatePersonnePhysique(
  id: number,
  data: UpdatePersonnePhysiqueInput,
): Promise<PersonnePhysiqueListItem> {
  const res = await fetch(`/api/personnes-physiques/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deletePersonnePhysique(id: number): Promise<void> {
  const res = await fetch(`/api/personnes-physiques/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
