import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AuditLogItem } from "@/types";
import { ShieldAlert, Clock, User, ShieldCheck, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AuditLogsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role && role !== "Admin") {
      navigate("/dashboard");
      return;
    }
    loadLogs();
  }, [role, navigate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">سجل التدقيق والأمان الرقمي</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            سجل موثوق وغير قابل للتعديل يوثق جميع العمليات والتغييرات التي تمت على النظام
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            جاري تحميل سجلات التدقيق...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            لا توجد سجلات تدقيق مسجلة حتى الآن.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">
                      {log.action}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                      {log.entityName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span>{log.username} ({log.userRole || "نظام"})</span>
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {new Date(log.createdAt).toLocaleString("ar-SA")}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-[10px] font-mono text-gray-300">
                    {log.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
