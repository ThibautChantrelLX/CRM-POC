import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};

interface AdminBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function AdminBadge({ label, variant = "default", className }: AdminBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
