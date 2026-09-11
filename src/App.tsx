import React from "react";
import { HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import DashboardPage from "@/app/dashboard/page";
import RequestsListPage from "@/app/requests/page";
import UnifiedNewRequestPage from "@/app/requests/new/page";
import RequestDetailPage from "@/app/requests/[id]/page";
import UsersManagementPage from "@/app/admin/users/page";
import AuditLogsPage from "@/app/admin/audit-logs/page";

function RequestDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return <RequestDetailPage params={Promise.resolve({ id: id || "" })} />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/requests" element={<RequestsListPage />} />
            <Route path="/requests/new" element={<UnifiedNewRequestPage />} />
            <Route path="/requests/:id" element={<RequestDetailWrapper />} />
            <Route path="/admin/users" element={<UsersManagementPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </HashRouter>
  );
}
