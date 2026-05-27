"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Building2, Scale, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "@/lib/client/auth";

const NAV_SECTIONS = [
  {
    label: "Contacts",
    items: [
      { href: "/personnes-physiques", label: "Personnes Physiques", icon: Users },
      { href: "/personnes-morales", label: "Personnes Morales", icon: Building2 },
    ],
  },
];

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "ASSOCIE", "ACADEMIE"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const isAdmin = role && (ADMIN_ROLES as readonly string[]).includes(role);

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-white border-r border-zinc-200 min-h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
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
                      ? "bg-primary-50 text-primary-600"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
                  )}
                >
                  <item.icon size={15} className={active ? "text-primary-500" : "text-zinc-400"} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {isAdmin && (
          <div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-2 mb-1">
              Administration
            </div>
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/admin/users")
                  ? "bg-primary-50 text-primary-600"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
              )}
            >
              <ShieldCheck size={15} className={pathname.startsWith("/admin/users") ? "text-primary-500" : "text-zinc-400"} />
              Utilisateurs
            </Link>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-secondary-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
            {user ? initials(user.name) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-700 font-medium truncate">{user?.name ?? "…"}</div>
            <div className="text-[10px] text-zinc-400 truncate">{user?.email ?? ""}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
