"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/constants";
import { LogOut, User as UserIcon, Shield, Menu, Cloud, CloudOff } from "lucide-react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CloudSettingsModal } from "@/components/ui/CloudSettingsModal";

export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, role, logout } = useAuth();
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  useEffect(() => {
    setIsCloud(isSupabaseConfigured());
  }, []);

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Right Side (in RTL): Menu toggle & Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-hidden"
                aria-label="القائمة"
              >
                <Menu className="w-6 h-6" />
              </button>

              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                  ح
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900 text-base sm:text-lg leading-tight">
                    مسار الحج والعمرة
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    نظام إدارة سير المستندات والمعاملات
                  </span>
                </div>
              </Link>
            </div>

            {/* Left Side (in RTL): Cloud status, User info & Logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Cloud Connection Badge / Button */}
              <button
                onClick={() => setCloudModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isCloud
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
                title={isCloud ? "متصل بسحابة Supabase (أونلاين)" : "يعمل محلياً (انقر للربط بالسحابة)"}
              >
                {isCloud ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Cloud className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">سحابي (أونلاين)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    <CloudOff className="w-4 h-4 text-gray-500" />
                    <span className="hidden sm:inline">محلي</span>
                  </>
                )}
              </button>

              {user ? (
                <>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-sm font-semibold text-gray-800">
                      {user.fullName}
                    </span>
                    {role && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block w-fit ${ROLE_LABELS[role]?.color}`}
                      >
                        {ROLE_LABELS[role]?.label}
                      </span>
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                    <UserIcon className="w-5 h-5" />
                  </div>

                  <button
                    onClick={logout}
                    title="تسجيل الخروج"
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">خروج</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-xs"
                >
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Cloud Settings Modal */}
      <CloudSettingsModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        onConnectionChanged={(connected) => setIsCloud(connected)}
      />
    </>
  );
}
