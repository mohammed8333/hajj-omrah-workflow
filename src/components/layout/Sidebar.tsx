import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  FilePlus,
  Files,
  Users,
  ShieldAlert,
  X,
  Plane,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { role } = useAuth();

  const links = [
    {
      to: "/dashboard",
      label: "لوحة التحكم",
      icon: LayoutDashboard,
      roles: ["Sender", "SafaEmployee", "SaudiAgent", "Admin"],
    },
    {
      to: "/requests/new",
      label: "إنشاء طلب جديد",
      icon: FilePlus,
      roles: ["Sender", "Admin"],
    },
    {
      to: "/requests",
      label: "قائمة المعاملات",
      icon: Files,
      roles: ["Sender", "SafaEmployee", "SaudiAgent", "Admin"],
    },
    {
      to: "/admin/users",
      label: "إدارة المستخدمين",
      icon: Users,
      roles: ["Admin"],
    },
    {
      to: "/admin/audit-logs",
      label: "سجل التدقيق والأمان",
      icon: ShieldAlert,
      roles: ["Admin"],
    },
  ];

  const allowedLinks = links.filter((link) =>
    role ? link.roles.includes(role) : false
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header on mobile */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 md:hidden">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-sky-600" />
            <span className="font-bold text-gray-900">القائمة الرئيسية</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {allowedLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sky-50 text-sky-700 font-bold border border-sky-100 shadow-xs"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? "text-sky-600" : "text-gray-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400 text-center space-y-1">
          <div className="font-semibold text-gray-500">
            نسخة مستضافة على GitHub Pages
          </div>
          <div>تعمل 100% بدون خوادم خارجية</div>
        </div>
      </aside>
    </>
  );
}
