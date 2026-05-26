"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "submit" | "button" | "reset";
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
};

const VARIANTS: Record<NonNullable<SubmitButtonProps["variant"]>, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 disabled:bg-primary-200 disabled:text-primary-400",
  secondary:
    "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 disabled:bg-zinc-100 disabled:text-zinc-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-200 disabled:text-red-400",
};

export function SubmitButton({
  isLoading = false,
  children,
  onClick,
  type = "button",
  variant = "primary",
  className,
  disabled,
}: SubmitButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
    >
      {isLoading && <Loader2 size={14} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}
