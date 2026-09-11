import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, FilePlus, Files, Menu } from "lucide-react";

export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const { role } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex items-center justify-around py-2 px-3 shadow-lg">
      <Link
        to="/dashboard"
        className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
          location.pathname === "/dashboard"
            ? "text-sky-600 font-semibold"
            : "text-gray-500 hover:text-gray-900"
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>الرئيسية</span>
      </Link>

      {(role === "Sender" || role === "Admin") && (
        <Link
          to="/requests/new"
          className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
            location.pathname === "/requests/new"
              ? "text-sky-600 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <FilePlus className="w-5 h-5" />
          <span>طلب جديد</span>
        </Link>
      )}

      <Link
        to="/requests"
        className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
          location.pathname === "/requests"
            ? "text-sky-600 font-semibold"
            : "text-gray-500 hover:text-gray-900"
        }`}
      >
        <Files className="w-5 h-5" />
        <span>المعاملات</span>
      </Link>

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg text-gray-500 hover:text-gray-900 cursor-pointer"
      >
        <Menu className="w-5 h-5" />
        <span>المزيد</span>
      </button>
    </nav>
  );
}
