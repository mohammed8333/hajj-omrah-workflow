"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AuditLogItem } from "@/types";
import { ShieldAlert, RefreshCw, Layers, Calendar, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuditLogsPage() {
  const { role } = useAuth();
  const router = useRouter();
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
      router.push("/dashboard");
      return;
    }
    loadLogs();
  }, [role, router]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <span>سجل التدقيق الرقمي والعمليات الأمنية</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            سجل غير قابل للتعديل يوثق جميع عمليات الدخول، رفع ومعاينة الوثائق، وتغيير الحالات.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-xs">جاري تحميل سجلات التدقيق...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700">لا توجد سجلات بعد</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">نوع العملية</th>
                  <th className="py-3.5 px-4">الكيان المرتبط</th>
                  <th className="py-3.5 px-4">المستخدم</th>
                  <th className="py-3.5 px-4">عنوان IP</th>
                  <th className="py-3.5 px-4">تفاصيل آمنة</th>
                  <th className="py-3.5 px-4">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      <span className="bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-800">
                      <span className="font-semibold">{log.entityName}</span>
                      <span className="text-gray-400 text-[10px] block font-mono">
                        {log.entityId.length > 18
                          ? `${log.entityId.substring(0, 8)}...`
                          : log.entityId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">
                        {log.username || "نظام"}
                      </div>
                      {log.userRole && (
                        <div className="text-[10px] text-gray-400">
                          {log.userRole}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-500" dir="ltr">
                      {log.ipAddress || "localhost"}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate font-mono text-[11px]">
                      {log.metadataJson || "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
