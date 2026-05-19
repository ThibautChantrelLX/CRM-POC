"use client";

import { useQuery } from "@tanstack/react-query";
import { listPersonnesMorales } from "@/lib/client/personnes-morales";

export function usePersonnesMorales(params: URLSearchParams) {
  return useQuery({
    queryKey: ["personnes-morales", params.toString()],
    queryFn: () => listPersonnesMorales(params),
    placeholderData: (prev) => prev,
  });
}
