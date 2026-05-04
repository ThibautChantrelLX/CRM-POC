"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Contacts",
    items: [
      { href: "/personnes-physiques", label: "Personnes Physiques", icon: Users },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-white border-r border-zinc-200 min-h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
          <Scale size={18} className="text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm text-zinc-900 leading-tight">LexCRM</div>
          <div className="text-[11px] text-zinc-400">Gestion juridique</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-2 mb-1">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-orange-50 text-orange-600"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
                  )}
                >
                  <item.icon
                    size={15}
                    className={active ? "text-orange-500" : "text-zinc-400"}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
          ML
        </div>
        <span className="text-sm text-zinc-600 truncate">Maître Léa</span>
      </div>
    </aside>
  );
}
