"use client";

import { useQuery } from "@tanstack/react-query";
import { listPersonnesPhysiques } from "@/lib/client/personnes-physiques";

export function usePersonnesPhysiques(params: URLSearchParams) {
  const key = params.toString();
  return useQuery({
    queryKey: ["personnes-physiques", key],
    queryFn: () => listPersonnesPhysiques(params),
    placeholderData: (prev) => prev,
  });
}
