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
  Check,
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
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Cloud,
  CloudOff,
  UploadCloud,
  MessageCircle,
} from "lucide-react";
import {
  getGeminiApiKey,
  setGeminiApiKey,
  removeGeminiApiKey,
  testGeminiApiKey,
} from "@/lib/geminiVision";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CloudSettingsModal } from "@/components/ui/CloudSettingsModal";

export default function AdminSettingsPage() {
  const { role, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gemini AI Vision State
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{
    checked: boolean;
    valid: boolean;
    message: string;
  } | null>(null);

  // WhatsApp Group Settings State
  const [waGroup, setWaGroup] = useState("");
  const [waLink, setWaLink] = useState("");
  const [waBridgeConnected, setWaBridgeConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setIsCloud(isSupabaseConfigured());
    const saved = getGeminiApiKey();
    if (saved) {
      setGeminiKey(saved);
    }
    // Also load from database (Supabase cloud) so that key stored on one machine shows on all machines!
    api.settings.get("gemini_ai_api_key").then((cloudKey) => {
      if (cloudKey && cloudKey.trim()) {
        setGeminiKey(cloudKey.trim());
        setGeminiApiKey(cloudKey.trim(), false);
      }
    }).catch(console.warn);

    if (typeof window !== "undefined") {
      setWaGroup(localStorage.getItem("safa_whatsapp_target_group") || "");
      setWaLink(localStorage.getItem("safa_whatsapp_target_link") || "");
      fetch("http://localhost:5055/status")
        .then((r) => r.json())
        .then((d) => setWaBridgeConnected(Boolean(d.connected)))
        .catch(() => setWaBridgeConnected(false));
    }
  }, []);

  const handleSaveWaSettings = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("safa_whatsapp_target_group", waGroup.trim());
      localStorage.setItem("safa_whatsapp_target_link", waLink.trim());
      setSuccess("تم حفظ إعدادات مجموعة الواتساب المستهدفة بنجاح!");
    }
  };

  const handleSaveGeminiKey = async () => {
    const trimmed = geminiKey.trim();
    if (!trimmed) {
      removeGeminiApiKey();
      try {
        await api.settings.set("gemini_ai_api_key", "");
      } catch (e) {
        console.warn(e);
      }
      setSuccess("تم حذف مفتاح Gemini AI والاعتماد على المحرك الافتراضي.");
      setGeminiTestStatus(null);
      return;
    }
    try {
      setGeminiApiKey(trimmed, true);
      await api.settings.set("gemini_ai_api_key", trimmed);
      setSuccess("تم حفظ مفتاح Google Gemini AI بنجاح في قاعدة البيانات! سيعمل تلقائياً وبشكل مباشر على جميع الأجهزة والمتصفحات المتصلة بالموقع.");
    } catch (e: any) {
      setSuccess("تم حفظ المفتاح محلياً! (ملاحظة: " + (e?.message || "") + ")");
    }
  };

  const handleTestGeminiKey = async () => {
    const trimmed = geminiKey.trim();
    if (!trimmed) {
      setError("يرجى كتابة أو لصق مفتاح الـ API أولاً قبل الاختبار.");
      return;
    }
    try {
      setTestingGemini(true);
      setGeminiTestStatus(null);
      const res = await testGeminiApiKey(trimmed);
      setGeminiTestStatus({
        checked: true,
        valid: res.success,
        message: res.message,
      });
      if (res.success) {
        setGeminiApiKey(trimmed, true);
        await api.settings.set("gemini_ai_api_key", trimmed);
        setSuccess("المفتاح سليم 100%! تم حفظه وتفعيله في قاعدة البيانات ليعمل على كافة الأجهزة فوراً.");
      } else {
        setError(`فشل الاتصال: ${res.message}`);
      }
    } catch (e: any) {
      setGeminiTestStatus({
        checked: true,
        valid: false,
        message: e.message || "فشل الاتصال بخادم Google Gemini",
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleRemoveGeminiKey = async () => {
    removeGeminiApiKey();
    try {
      await api.settings.set("gemini_ai_api_key", "");
    } catch (e) {
      console.warn(e);
    }
    setGeminiKey("");
    setGeminiTestStatus(null);
    setSuccess("تم مسح مفتاح Gemini AI من النظام وقاعدة البيانات بنجاح.");
  };

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
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (role !== "Admin") {
      router.push("/dashboard");
      return;
    }
    loadStats();
  }, [user, role, authLoading, router]);

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

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-sm font-medium">جاري التحقق من صلاحيات النظام...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-md mx-auto my-12 shadow-xs">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-800 mb-1">تسجيل الدخول مطلوب</h2>
        <p className="text-xs text-gray-500 mb-4">يرجى تسجيل الدخول بحساب مدير النظام للوصول إلى الإعدادات.</p>
        <button
          onClick={() => router.push("/login")}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          الانتقال لصفحة تسجيل الدخول
        </button>
      </div>
    );
  }

  if (role !== "Admin") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-md mx-auto my-12 shadow-xs">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-800 mb-1">غير مصرح بالدخول</h2>
        <p className="text-xs text-gray-500 mb-4">هذه الصفحة مخصصة لمدير النظام (Admin) فقط.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
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

      {/* Supabase Cloud Database & Online Sync */}
      <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-xs relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-teal-500 via-sky-600 to-indigo-600" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isCloud ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
              }`}
            >
              {isCloud ? <Cloud className="w-6 h-6" /> : <CloudOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  قاعدة البيانات السحابية والمزامنة أونلاين (Supabase Cloud Sync)
                </h2>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isCloud
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {isCloud ? "🟢 سحابي (متصل أونلاين)" : "⚪ وضع محلي"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                ربط النظام بسحابة Supabase لمشاركة المعاملات والملفات والعمل الجماعي بين عدة أجهزة في الوقت الفعلي مجاناً.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCloudModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>إعدادات الربط السحابي والترحيل</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-gray-600">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <strong className="block text-gray-800 mb-0.5">تزامن فوري بين الأجهزة:</strong>
              أي معاملة ينشئها المرسل أو يعتمدها موظف الصفا تظهر فوراً للوكيل السعودي على جهازه في نفس اللحظة.
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <strong className="block text-gray-800 mb-0.5">تخزين سحابي للمستندات:</strong>
              رفع الجوازات والتذاكر والهويات في حاوية تخزين آمنة بروابط مباشرة وتصفح سريع ومجاني.
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <strong className="block text-gray-800 mb-0.5">ترحيل محلي إلى سحابي:</strong>
              يمكنك بضغطة زر واحدة نقل جميع بياناتك المحلية الحالية إلى السحابة دون فقدان أي معاملة.
            </div>
          </div>
        </div>
      </div>

      {/* AI Vision Engine Settings (Google Gemini) */}
      <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-xs relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  محرك الذكاء الاصطناعي لفحص المستندات (Google Gemini AI Vision)
                </h2>
                <span className="text-[11px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-2 py-0.5 rounded-full shadow-2xs">
                  مجاني 100%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                فحص صور الجوازات والهويات الوطنية وتذاكر الطيران واستخراج البيانات بالعربية والإنجليزية بدقة فائقة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <span>احصل على مفتاح مجاني (Google AI Studio)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-700">
            مفتاح Google Gemini API Key:
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showGeminiKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setGeminiTestStatus(null);
                }}
                placeholder="AIzaSy..."
                className="w-full pr-9 pl-10 py-2.5 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50/50"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showGeminiKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestGeminiKey}
                disabled={testingGemini || !geminiKey.trim()}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="اختبار اتصال المفتاح مع سيرفرات جوجل"
              >
                <Zap className={`w-3.5 h-3.5 ${testingGemini ? "animate-spin" : "text-amber-500"}`} />
                <span>{testingGemini ? "جاري الفحص..." : "اختبار الاتصال"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveGeminiKey}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ المفتاح</span>
              </button>

              {geminiKey && (
                <button
                  type="button"
                  onClick={handleRemoveGeminiKey}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 rounded-xl text-xs font-medium transition-colors cursor-pointer border border-gray-200"
                  title="مسح المفتاح"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>يتم حفظ المفتاح مركزياً في قاعدة البيانات، ليقرأ ويعمل تلقائياً على كافة الأجهزة والمتصفحات المتصلة بالنظام بدون الحاجة لإدخاله في كل جهاز.</span>
          </div>

          {/* Test Status Banner */}
          {geminiTestStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                geminiTestStatus.valid
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {geminiTestStatus.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{geminiTestStatus.message}</span>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-gray-600">
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-start gap-2">
              <span className="text-emerald-600 font-black">✓</span>
              <span><strong>قراءة الجوازات بدقة 100%:</strong> فحص الاسم العربي، وترجمة الإنجليزي، والجنسية ورقم الجواز والميلاد.</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-start gap-2">
              <span className="text-emerald-600 font-black">✓</span>
              <span><strong>الهويات الوطنية والإقامات:</strong> استخراج اسم المستضيف رباعياً ورقم الهوية وتاريخ الميلاد.</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-start gap-2">
              <span className="text-emerald-600 font-black">✓</span>
              <span><strong>حصري ومجاني:</strong> يعطيك 1,500 عملية فحص مجانية يومياً من جوجل وبدون دفع أي رسوم.</span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Group & Bridge Settings */}
      <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-xs relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>إعدادات مجموعة الواتساب لموظف الصفا</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  إرسال الحزم الآلي
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                تحديد المجموعة ورابطها المباشر الذي يتم إرسال حزم المعاملات إليها بنقرة واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                waBridgeConnected === true
                  ? "bg-emerald-500 animate-pulse"
                  : waBridgeConnected === false
                  ? "bg-amber-500"
                  : "bg-gray-300"
              }`}
            />
            <span className="text-gray-700">
              {waBridgeConnected === true
                ? "خادم الواتساب (Bridge) متصل ✓"
                : waBridgeConnected === false
                ? "خادم الواتساب غير مشغل (افتح start.bat)"
                : "جاري فحص الاتصال..."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              اسم أو معرّف مجموعة الواتساب المستهدفة:
            </label>
            <input
              type="text"
              value={waGroup}
              onChange={(e) => setWaGroup(e.target.value)}
              placeholder="مثال: مجموعة التسكين والإعاشة أو معرف المجموعة"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              رابط الدعوة المباشر للمجموعة (لفتحها فوراً للتأكيد):
            </label>
            <input
              type="text"
              dir="ltr"
              value={waLink}
              onChange={(e) => setWaLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-left font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2">
          <p className="text-[11px] text-gray-400">
            يمكنك أيضاً تعديل هذه الإعدادات مباشرة من أي معاملة عبر الضغط على أيقونة الترس ⚙️ بجانب زر الواتساب.
          </p>
          <button
            type="button"
            onClick={handleSaveWaSettings}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>حفظ إعدادات المجموعة</span>
          </button>
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

      {/* Cloud Settings Modal */}
      <CloudSettingsModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        onConnectionChanged={(conn) => setIsCloud(conn)}
      />
    </div>
  );
}
