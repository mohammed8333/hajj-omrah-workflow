"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { exportRequestsToExcel } from "@/lib/excelExport";
import {
  Settings,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Database,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Users,
  Files,
  X,
  FileText,
  Hourglass,
  Clock,
  Archive,
  Plane,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { role, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Storage Stats
  const [stats, setStats] = useState({
    requestsCount: 0,
    travelersCount: 0,
    documentsCount: 0,
    usersCount: 0,
    storageSizeKb: 0,
  });

  // Wipe Modal State
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeType, setWipeType] = useState<"requests" | "full">("requests");
  const [confirmInput, setConfirmInput] = useState("");

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getStorageStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "فشل تحميل إحصائيات التخزين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role && role !== "Admin") {
      router.push("/dashboard");
      return;
    }
    loadStats();
  }, [role, router]);

  // Handle Export to Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      setError(null);
      setSuccess(null);

      const allRequests = await api.admin.getAllRequestsFull();
      if (!allRequests || allRequests.length === 0) {
        setError("لا توجد معاملات مسجلة في النظام لتصديرها.");
        setExporting(false);
        return;
      }

      exportRequestsToExcel(allRequests);
      setSuccess(
        `تم تصدير (${allRequests.length}) معاملة و (${stats.travelersCount}) مسافر إلى ملف Excel (.xlsx) بنجاح!`
      );
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تصدير ملف الإكسيل");
    } finally {
      setExporting(false);
    }
  };

  // Handle Wipe Data
  const handleConfirmWipe = async () => {
    if (confirmInput.trim() !== "مسح") {
      setError('يرجى كتابة كلمة "مسح" في المربع للتأكيد قبل المتابعة.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      if (wipeType === "requests") {
        await api.admin.clearAllRequests();
        setSuccess(
          "تم مسح كافة المعاملات والمرفقات وسجلات المسافرين بنجاح من قاعدة البيانات المحلية."
        );
      } else {
        await api.admin.wipeAllData();
        setSuccess(
          "تمت إعادة ضبط المصنع ومسح كافة البيانات بالكامل. تم استعادة الحسابات الافتراضية."
        );
      }

      setWipeModalOpen(false);
      setConfirmInput("");
      await loadStats();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء مسح البيانات");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Run Auto Maintenance
  const handleRunMaintenance = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      const res = await api.requests.runAutoMaintenance();
      setSuccess(
        `تم تشغيل الصيانة التلقائية بنجاح: تم حذف (${res.deletedCount}) معاملة تجاوزت 30 يوماً، وأرشفة (${res.archivedCount}) معاملة انقضى موعد سفرها.`
      );
      await loadStats();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تشغيل الصيانة");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-700">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إعدادات النظام وقاعدة البيانات</h1>
            <p className="text-sm text-gray-500 mt-1">
              إدارة التخزين المحلي، تصدير التقارير، ومسح أو تهيئة بيانات المعاملات.
            </p>
          </div>
        </div>

        <button
          onClick={loadStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
          <span>تحديث الإحصائيات</span>
        </button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Files className="w-4 h-4 text-sky-600" />
            <span>إجمالي المعاملات</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.requestsCount}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>المعتمرون والمسافرون</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.travelersCount}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <FileText className="w-4 h-4 text-teal-600" />
            <span>المستندات والمرفقات</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.documentsCount}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <HardDrive className="w-4 h-4 text-purple-600" />
            <span>حجم التخزين المستهلك</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.storageSizeKb} <span className="text-xs font-normal text-gray-500">KB</span>
          </div>
        </div>
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Export to Excel */}
        <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">تصدير بيانات المعاملات كـ Excel</h2>
                <p className="text-xs text-gray-500">ملف جدول بيانات رسمي بصيغة XLSX</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              يمكنك تصدير كافة المعاملات المحفوظة وجميع بيانات المعتمرين والمسافرين في ملف Excel شامل يحتوي على ورقتي عمل:
            </p>

            <ul className="text-xs text-gray-600 space-y-2 mb-6 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span><strong>ورقة 1 (المعاملات):</strong> رقم المعاملة، الفوج، الحالة بالعربي، وكيل الإرسال، موظف الصفا، أرقام نسك، الهاتف، وتفاصيل الاستضافة.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span><strong>ورقة 2 (المعتمرون والمسافرون):</strong> تفاصيل كل معتمر، رقم الجواز، الجنسية، تاريخ الميلاد، وحالة تدقيق المستندات.</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || stats.requestsCount === 0}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري تجهيز وتصدير ملف Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>تحميل ملف Excel الآن ({stats.requestsCount} معاملة)</span>
              </>
            )}
          </button>
        </div>

        {/* Section 2: Wipe Data */}
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">مسح البيانات بالكامل</h2>
                <p className="text-xs text-rose-600 font-medium">إجراء حرج وإعادة تهيئة</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              يتيح لمدير النظام تفريغ قاعدة البيانات بالكامل أو مسح جميع المعاملات والمستندات والبدء من جديد.
            </p>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 mb-6 text-xs text-rose-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">تحذير مهم:</strong>
                  سيتم حذف البيانات نهائياً من ذاكرة المتصفح و IndexedDB. لا يمكن التراجع عن هذا الإجراء إلا إذا قمت بعمل نسخة احتياطية أو تصدير إكسيل مسبقاً.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                setWipeType("requests");
                setConfirmInput("");
                setWipeModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium rounded-xl border border-amber-300 transition-colors text-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-amber-700" />
              <span>مسح المعاملات فقط</span>
            </button>

            <button
              onClick={() => {
                setWipeType("full");
                setConfirmInput("");
                setWipeModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl shadow-xs transition-colors text-sm cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>مسح البيانات بالكامل (ضبط المصنع)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Automatic Maintenance & Lifecycle Rules */}
      <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-amber-500" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                جدولة الصيانة والتدوير الذاتي للمعاملات
              </h2>
              <p className="text-xs text-gray-500">
                مؤقتات وقواعد إدارة دورة حياة الطلبات المطبقة في النظام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunMaintenance}
            disabled={actionLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-xs text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
            <span>تشغيل فحص الصيانة التلقائية الآن</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Rule 1: 30-Day Deletion */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <Hourglass className="w-4 h-4 text-amber-600" />
              <span>قاعدة الحذف التلقائي (30 يوماً من الإنشاء)</span>
            </div>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              يقوم النظام تلقائياً وبشكل دوري بفحص كافة المعاملات وحذف أي معاملة مر على تاريخ إنشائها 30 يوماً بشكل كامل مع مسح كافة مرفقاتها ووثائق المعتمرين التابعة لها من الذاكرة المحلية (IndexedDB).
            </p>
            <div className="text-[10px] text-amber-700 font-medium bg-amber-100/70 px-2.5 py-1 rounded-md inline-block">
              ✓ تطبق تلقائياً عند فتح قائمة المعاملات أو تشغيل الصيانة
            </div>
          </div>

          {/* Rule 2: Travel Date Archival */}
          <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sky-900 text-sm">
              <Plane className="w-4 h-4 text-sky-600" />
              <span>قاعدة الأرشفة التلقائية (عند موعد السفر)</span>
            </div>
            <p className="text-sky-800 leading-relaxed text-[11px]">
              تتحول أي معاملة نشطة تلقائياً إلى حالة «مؤرشف» فور انقضاء موعد وتاريخ إقلاع الرحلة المحدد لها لحفظها في الأرشيف التاريخي للنظام وتفادي تكدس المعاملات المنتهية.
            </p>
            <div className="text-[10px] text-sky-700 font-medium bg-sky-100/70 px-2.5 py-1 rounded-md inline-block">
              ✓ تظهر شارة «مؤرشف» ويمكن لمدير النظام إلغاء أرشفتها في أي وقت
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {wipeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
                <AlertTriangle className="w-6 h-6" />
                <span>
                  {wipeType === "requests" ? "تأكيد مسح المعاملات" : "تأكيد مسح البيانات بالكامل"}
                </span>
              </div>
              <button
                onClick={() => setWipeModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              {wipeType === "requests" ? (
                <p>
                  أنت على وشك <strong>حذف كافة المعاملات والمستندات وبيانات المعتمرين ({stats.requestsCount} معاملة)</strong> نهائياً. سيتم الاحتفاظ بحسابات المستخدمين لتتمكن من مواصلة العمل.
                </p>
              ) : (
                <p>
                  أنت على وشك <strong>مسح قاعدة البيانات بالكامل</strong> بما فيها كافة المعاملات وسجلات التدقيق، وإعادة ضبط حسابات المستخدمين الافتراضية لمرحلة التثبيت الأولى.
                </p>
              )}
              <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-lg">
                للتأكيد، يرجى كتابة كلمة <span className="underline font-bold text-rose-700">مسح</span> في الحقل أدناه:
              </p>
            </div>

            <div>
              <input
                type="text"
                placeholder='اكتب "مسح" هنا للتأكيد'
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setWipeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmWipe}
                disabled={actionLoading || confirmInput.trim() !== "مسح"}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>نعم، امسح الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
