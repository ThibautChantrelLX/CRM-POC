"use client";

import { useQuery } from "@tanstack/react-query";
import {
  checkPersonnePhysiqueEmail,
  type PersonnePhysiqueMatch,
} from "@/lib/client/personnes-physiques";
import { useDebouncedValue } from "./useDebouncedValue";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEBOUNCE_MS = 400;

export type PpEmailCheckResult =
  | { status: "idle"; match: null }
  | { status: "checking"; match: null }
  | { status: "available"; match: null }
  | { status: "taken"; match: NonNullable<PersonnePhysiqueMatch> };

export function usePpEmailCheck(email: string): PpEmailCheckResult {
  const trimmed = email.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const isValidFormat = EMAIL_REGEX.test(debounced);
  const settled = debounced === trimmed;

  const { data, isFetching } = useQuery({
    queryKey: ["pp-email-check", debounced],
    queryFn: () => checkPersonnePhysiqueEmail(debounced),
    enabled: isValidFormat,
    placeholderData: (prev) => prev,
  });

  if (!trimmed || !isValidFormat) return { status: "idle", match: null };
  if (!settled || isFetching) return { status: "checking", match: null };
  if (data) return { status: "taken", match: data };
  return { status: "available", match: null };
}
