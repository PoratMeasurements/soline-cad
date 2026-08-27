import { Sidebar } from "@/components/shell/sidebar";
import { TopNav } from "@/components/shell/top-nav";
import { BottomNav } from "@/components/shell/bottom-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen app-grid-bg">
      <Sidebar />
      <div className="lg:pr-64">
        <TopNav />
        <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
