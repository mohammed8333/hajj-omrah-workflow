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

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled Application Error:", error, errorInfo);
  }

  handleForceReload = () => {
    try {
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch (_) {}
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center font-sans"
          dir="rtl"
        >
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-gray-200 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              حدث خطأ أثناء عرض الصفحة
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              تم تحديث المنظومة مؤخراً، وقد يكون المتصفح يحتفظ بنسخة قديمة مؤقتة.
              يمكنك الضغط على الزر أدناه لتحديث الصفحة وتجاوز الكاش فوراً.
            </p>
            {this.state.error && (
              <div
                className="p-3 bg-gray-50 rounded-xl text-left text-[11px] font-mono text-gray-600 overflow-auto max-h-28 border border-gray-100"
                dir="ltr"
              >
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleForceReload}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                تحديث المنظومة وتجاوز الكاش 🔄
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = "#/dashboard";
                  window.location.reload();
                }}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                العودة إلى لوحة التحكم
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequestDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const cleanId = (id || "").split("?")[0];
  return <RequestDetailPage requestId={cleanId} />;
}

export default function App() {
  return (
    <GlobalErrorBoundary>
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
  </GlobalErrorBoundary>
  );
}
