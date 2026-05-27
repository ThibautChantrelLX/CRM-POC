import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
