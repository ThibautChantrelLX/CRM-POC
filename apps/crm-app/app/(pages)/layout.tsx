import { Sidebar } from "@/components/layout/Sidebar";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
