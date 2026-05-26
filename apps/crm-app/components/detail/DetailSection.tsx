import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Variant = "default" | "anaba";

type Props = {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

const STYLES: Record<Variant, { card: string; icon: string; title: string }> = {
  default: {
    card: "bg-white border-zinc-200",
    icon: "text-orange-500",
    title: "text-zinc-600",
  },
  anaba: {
    card: "bg-blue-50/60 border-blue-200",
    icon: "text-blue-500",
    title: "text-blue-700",
  },
};

export function DetailSection({ title, icon: Icon, children, variant = "default", className }: Props) {
  const s = STYLES[variant];
  return (
    <section className={cn("rounded-xl border p-5 flex flex-col gap-4", s.card, className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className={s.icon} />}
        <h3 className={cn("text-xs font-bold uppercase tracking-widest", s.title)}>{title}</h3>
      </div>
      {children}
    </section>
  );
}
