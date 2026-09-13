import React from "react";
import { HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { DialogProvider } from "@/lib/dialog-context";
import { AppShell } from "@/components/layout/AppShell";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import DashboardPage from "@/app/dashboard/page";
import RequestsListPage from "@/app/requests/page";
import UnifiedNewRequestPage from "@/app/requests/new/page";
import RequestDetailPage from "@/app/requests/[id]/page";
import UsersManagementPage from "@/app/admin/users/page";
import AuditLogsPage from "@/app/admin/audit-logs/page";
import AdminSettingsPage from "@/app/admin/settings/page";

function RequestDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const cleanId = (id || "").split("?")[0];
  return <RequestDetailPage requestId={cleanId} />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DialogProvider>
          <AppShell>
            <React.Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">جاري التحميل...</span>
                  </div>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/requests" element={<RequestsListPage />} />
                <Route path="/requests/new" element={<UnifiedNewRequestPage />} />
                <Route path="/requests/:id" element={<RequestDetailWrapper />} />
                <Route path="/admin/users" element={<UsersManagementPage />} />
                <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </AppShell>
        </DialogProvider>
      </AuthProvider>
    </HashRouter>
  );
}
