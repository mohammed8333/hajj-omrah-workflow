import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/constants";
import { LogOut, User as UserIcon, Menu, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { BackupModal } from "../ui/BackupModal";

export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, role, logout } = useAuth();
  const [showBackupModal, setShowBackupModal] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Right Side (in RTL): Menu toggle & Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-hidden cursor-pointer"
                aria-label="القائمة"
              >
                <Menu className="w-6 h-6" />
              </button>

              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                  ح
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-base sm:text-lg leading-tight">
                      مسار الحج والعمرة
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                      نسخة GitHub
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    نظام إدارة سير المستندات والمعاملات
                  </span>
                </div>
              </Link>
            </div>

            {/* Left Side (in RTL): User info, Backup & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Backup & Data Button */}
              <button
                onClick={() => setShowBackupModal(true)}
                title="النسخ الاحتياطي والبيانات"
                className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-xl transition-colors border border-sky-200 cursor-pointer"
              >
                <Database className="w-4 h-4 text-sky-600" />
                <span className="hidden sm:inline">البيانات والنسخ</span>
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
                  to="/login"
                  className="text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-xs"
                >
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </>
  );
}
