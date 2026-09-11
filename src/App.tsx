import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import RequestsListPage from "@/pages/RequestsListPage";
import NewRequestPage from "@/pages/NewRequestPage";
import RequestDetailPage from "@/pages/RequestDetailPage";
import UsersManagementPage from "@/pages/UsersManagementPage";
import AuditLogsPage from "@/pages/AuditLogsPage";

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/requests" element={<RequestsListPage />} />
            <Route path="/requests/new" element={<NewRequestPage />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />
            <Route path="/admin/users" element={<UsersManagementPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </HashRouter>
  );
}
