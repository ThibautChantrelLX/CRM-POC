"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Scale, ArrowLeft, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/formations", label: "Formations", icon: GraduationCap },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-52 shrink-0 bg-white border-r border-zinc-200 h-screen overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
          <Scale size={18} className="text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm text-zinc-900 leading-tight">LexCRM</div>
          <div className="text-[11px] text-zinc-400">Administration</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-2 mb-2">
          Gestion
        </div>
        {ADMIN_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
              )}
            >
              <item.icon size={14} className={active ? "text-white" : "text-zinc-400"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to app */}
      <div className="px-2 py-3 border-t border-zinc-100">
        <Link
          href="/personnes-physiques"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft size={14} className="text-zinc-400" />
          Retour à l&apos;app
        </Link>
      </div>
    </aside>
  );
}
