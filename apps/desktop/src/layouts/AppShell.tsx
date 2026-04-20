import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/erp/Sidebar";
import { TopBar } from "@/components/erp/TopBar";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <div className={cn(
          "absolute right-0 top-0 h-full transition-transform",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <Sidebar onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}