"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  FilePlus,
  Files,
  Users,
  ShieldAlert,
  Settings,
  X,
  Plane,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const links = [
    {
      href: "/dashboard",
      label: "لوحة التحكم",
      icon: LayoutDashboard,
      roles: ["Sender", "SafaEmployee", "SaudiAgent", "Admin"],
    },
    {
      href: "/requests/new",
      label: "إنشاء طلب جديد",
      icon: FilePlus,
      roles: ["Sender", "Admin"],
    },
    {
      href: "/requests",
      label: "قائمة المعاملات",
      icon: Files,
      roles: ["Sender", "SafaEmployee", "SaudiAgent", "Admin"],
    },
    {
      href: "/admin/users",
      label: "إدارة المستخدمين",
      icon: Users,
      roles: ["Admin"],
    },
    {
      href: "/admin/audit-logs",
      label: "سجل التدقيق والأمان",
      icon: ShieldAlert,
      roles: ["Admin"],
    },
    {
      href: "/admin/settings",
      label: "إعدادات النظام",
      icon: Settings,
      roles: ["Admin"],
    },
  ];

  const allowedLinks = links.filter((link) => (role ? link.roles.includes(role) : false));

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
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {allowedLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sky-50 text-sky-700 font-semibold shadow-xs"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-sky-600" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info box */}
        <div className="p-4 border-t border-gray-100">
          <div className="bg-sky-50/70 rounded-xl p-3 text-xs text-sky-900">
            <p className="font-semibold mb-0.5">بوابة نسك وصفا</p>
            <p className="text-gray-600 text-[11px]">
              النظام متوافق مع متطلبات تسجيل صفا وربط أرقام مجموعات نسك الرسمية.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
