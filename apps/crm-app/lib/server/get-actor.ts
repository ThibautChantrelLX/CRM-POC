import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";

export async function getActorName(): Promise<string | undefined> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.name ?? undefined;
  } catch {
    return undefined;
  }
}
