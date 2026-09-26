"use client";

import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">جاري تحميل النظام...</span>
        </div>
      </div>
    );
  }

  // If on public pages like login, don't show the full dashboard shell
  if (!user) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 print:bg-white print:min-h-0 print:p-0 print:m-0 print:block">
      <div className="print:hidden">
        <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
      </div>

      <div className="flex-1 flex w-full pb-16 md:pb-0 print:pb-0 print:p-0 print:block">
        <div className="print:hidden">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
        <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 w-full print:p-0 print:m-0 print:w-full print:block">{children}</main>
      </div>

      <div className="print:hidden">
        <MobileNav onOpenMenu={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
}
