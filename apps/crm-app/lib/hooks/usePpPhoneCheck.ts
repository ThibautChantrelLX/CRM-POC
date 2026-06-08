"use client";

import { useQuery } from "@tanstack/react-query";
import {
  checkPersonnePhysiquePhone,
  type PersonnePhysiqueMatch,
} from "@/lib/client/personnes-physiques";
import { useDebouncedValue } from "./useDebouncedValue";

const DEBOUNCE_MS = 400;
const MIN_LENGTH = 6;

export type PpPhoneCheckResult =
  | { status: "idle"; match: null }
  | { status: "checking"; match: null }
  | { status: "available"; match: null }
  | { status: "taken"; match: NonNullable<PersonnePhysiqueMatch> };

export function usePpPhoneCheck(field: "telephone" | "portable", value: string): PpPhoneCheckResult {
  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const settled = debounced === trimmed;
  const enabled = debounced.length >= MIN_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ["pp-phone-check", field, debounced],
    queryFn: () => checkPersonnePhysiquePhone(field, debounced),
    enabled,
    placeholderData: (prev) => prev,
  });

  if (!trimmed || trimmed.length < MIN_LENGTH) return { status: "idle", match: null };
  if (!settled || isFetching) return { status: "checking", match: null };
  if (data) return { status: "taken", match: data };
  return { status: "available", match: null };
}
