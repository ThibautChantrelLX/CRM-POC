import { cn } from "@/lib/utils";

const COLORS = [
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-600",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(nom: string, prenom?: string | null): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  if (p && n) return (p[0] + n[0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

type AvatarProps = {
  nom: string;
  prenom?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({ nom, prenom, size = "md", className }: AvatarProps) {
  const color = hashColor(nom + (prenom ?? ""));
  const text = initials(nom, prenom);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none",
        color,
        size === "sm" && "w-7 h-7 text-[10px]",
        size === "md" && "w-9 h-9 text-sm",
        size === "lg" && "w-11 h-11 text-base",
        className,
      )}
    >
      {text}
    </div>
  );
}
