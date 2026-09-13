"use client";

import React, { useState, useEffect } from "react";
import {
  Cloud,
  CloudOff,
  Database,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Key,
  UploadCloud,
  Eye,
  EyeOff,
  Copy,
  Info,
  Download,
  FileCheck,
} from "lucide-react";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  setSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
} from "@/lib/supabaseClient";
import { api } from "@/lib/api";
import { localDB } from "@/lib/localDatabase";

interface CloudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChanged?: (isCloud: boolean) => void;
}

export function CloudSettingsModal({
  isOpen,
  onClose,
  onConnectionChanged,
}: CloudSettingsModalProps) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [localRequestsCount, setLocalRequestsCount] = useState(0);
  const [localTravelersCount, setLocalTravelersCount] = useState(0);
  const [backupSaved, setBackupSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setIsConfigured(isSupabaseConfigured());
      setTestResult(null);
      setMigrationResult(null);
      setMigrationStatus(null);
      setBackupSaved(false);

      try {
        const reqs = localDB.getAllRequestsFull();
        setLocalRequestsCount(reqs.length);
        const travCount = reqs.reduce((sum, r) => sum + (r.travelers?.length || 0), 0);
        setLocalTravelersCount(travCount);
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  const handleExportLocalBackup = () => {
    try {
      const jsonStr = api.system.exportBackup();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `hajj_local_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(u);
      setBackupSaved(true);
      setTimeout(() => setBackupSaved(false), 4000);
    } catch (e: any) {
      alert("فشل تحميل النسخة الاحتياطية: " + e.message);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        tested: true,
        success: false,
        message: "يرجى كتابة أو لصق رابط المشروع والمفتاح أولاً قبل إجراء الاختبار.",
      });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await testSupabaseConnection(url.trim(), anonKey.trim());
      setTestResult({
        tested: true,
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        message: err.message || "حدث خطأ غير متوقع أثناء محاولة الاتصال.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndActivate = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        tested: true,
        success: false,
        message: "يرجى إدخال كل من Project URL و Anon Key.",
      });
      return;
    }

    setSupabaseCredentials(url.trim(), anonKey.trim());
    setIsConfigured(true);
    setTestResult({
      tested: true,
      success: true,
      message: "تم حفظ إعدادات السحابة وتفعيل وضع العمل الجماعي أونلاين بنجاح! 🎉",
    });

    if (onConnectionChanged) {
      onConnectionChanged(true);
    }

    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleSwitchToLocal = () => {
    clearSupabaseCredentials();
    setUrl("");
    setAnonKey("");
    setIsConfigured(false);
    setTestResult({
      tested: true,
      success: true,
      message: "تم إلغاء الربط السحابي والعودة للوضع المحلي (Offline Storage) بنجاح.",
    });

    if (onConnectionChanged) {
      onConnectionChanged(false);
    }

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleMigrateData = async () => {
    if (!isSupabaseConfigured() && (!url.trim() || !anonKey.trim())) {
      setMigrationResult({
        success: false,
        message: "يرجى تفعيل الاتصال بالسحابة أولاً قبل ترحيل البيانات.",
      });
      return;
    }

    // If credentials typed but not saved yet, save first
    if (!isSupabaseConfigured()) {
      setSupabaseCredentials(url.trim(), anonKey.trim());
    }

    try {
      setMigrating(true);
      setMigrationResult(null);
      setMigrationStatus("جاري التجهيز لترحيل البيانات...");

      const res = await api.migration.migrateToCloud((msg) => {
        setMigrationStatus(msg);
      });

      setMigrationResult({
        success: true,
        message: `اكتمل ترحيل (${res.importedRequests}) معاملة و (${res.importedUsers}) مستخدم إلى سحابة Supabase بنجاح! أصبحت جميع المعاملات الآن متزامنة عبر كافة الأجهزة.`,
      });
    } catch (err: any) {
      setMigrationResult({
        success: false,
        message: `فشل ترحيل البيانات: ${err.message}`,
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 relative max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            {isConfigured ? (
              <Cloud className="w-6 h-6" />
            ) : (
              <CloudOff className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">
                الربط السحابي (Supabase Cloud Database)
              </h3>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isConfigured
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {isConfigured ? "🟢 متصل أونلاين" : "⚪ وضع محلي"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              ربط النظام بقاعدة بيانات سحابية مجانية للعمل الجماعي من أجهزة متعددة في نفس الوقت
            </p>
          </div>
        </div>

        {/* Status Info Box */}
        <div
          className={`p-4 rounded-xl border mb-5 text-xs ${
            isConfigured
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-amber-50/70 border-amber-200 text-amber-900"
          }`}
        >
          {isConfigured ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">النظام متصل بالسحابة بنجاح!</p>
                <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                  جميع المعاملات والملفات والمستخدمين يتم حفظهم وتحديثهم في قاعدة بيانات Supabase السحابية في الوقت الفعلي (Real-time). أي تغيير يظهر فوراً لكافة الأجهزة.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">أنت تعمل حالياً في الوضع المحلي (Offline Mode)</p>
                <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                  البيانات تُخزن فقط على هذا المتصفح. لتفعيل العمل الجماعي المشترك ومشاركة المعاملات مع بقية الموظفين والوكلاء أونلاين مجاناً، اتبع الخطوات بالأسفل لربط Supabase.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Credentials Form */}
        <div className="space-y-4 mb-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">
                رابط المشروع (Project URL):
              </label>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 hover:text-sky-800 flex items-center gap-1"
              >
                <span>لوحة تحكم Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-gray-50/50"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              مفتاح الوصول العام (Anon Public Key):
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={anonKey}
                onChange={(e) => {
                  setAnonKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pr-9 pl-10 py-2.5 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-gray-50/50"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs mb-5 flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">{testResult.message}</div>
          </div>
        )}

        {/* Action Buttons for Connection */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !url.trim() || !anonKey.trim()}
            className="flex-1 min-w-[130px] px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-sky-600" : ""}`} />
            <span>{testing ? "جاري الاختبار..." : "اختبار الاتصال"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndActivate}
            disabled={!url.trim() || !anonKey.trim()}
            className="flex-1 min-w-[130px] px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>حفظ وتفعيل السحابة</span>
          </button>

          {isConfigured && (
            <button
              type="button"
              onClick={handleSwitchToLocal}
              className="px-3.5 py-2.5 bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-700 border border-gray-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              title="إلغاء الاتصال والعودة للوضع المحلي"
            >
              العودة للوضع المحلي
            </button>
          )}
        </div>

        {/* One-click Migration Section */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border border-indigo-100 mb-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-indigo-950">
                  نقل وترحيل بيانات المتصفح إلى السحابة
                </h4>
                <p className="text-[11px] text-indigo-800/80">
                  رفع كافة المعاملات والمستندات المخزنة محلياً على هذا الجهاز إلى Supabase
                </p>
              </div>
            </div>

            {/* Detected count badge */}
            <div className="text-left shrink-0 bg-white/80 border border-indigo-200 px-3 py-1.5 rounded-xl text-[11px] text-indigo-900 font-medium shadow-2xs">
              <div>المعاملات: <strong className="text-indigo-700">{localRequestsCount}</strong></div>
              <div>المعتمرون: <strong className="text-indigo-700">{localTravelersCount}</strong></div>
            </div>
          </div>

          {/* Backup Download Button for Safety */}
          <div className="bg-white/90 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>أمان إضافي:</strong> يمكنك حفظ نسخة احتياطية (JSON) على جهازك أولاً قبل الترحيل
              </span>
            </div>
            <button
              type="button"
              onClick={handleExportLocalBackup}
              className="w-full sm:w-auto px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {backupSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم التنزيل بنجاح!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل نسخة احتياطية</span>
                </>
              )}
            </button>
          </div>

          {migrationStatus && (
            <div className="text-[11px] text-indigo-700 font-medium bg-indigo-100/60 px-3 py-2 rounded-lg flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
              <span>{migrationStatus}</span>
            </div>
          )}

          {migrationResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                migrationResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {migrationResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{migrationResult.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleMigrateData}
            disabled={migrating || (!isConfigured && (!url.trim() || !anonKey.trim()))}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {migrating
                ? "جاري ترحيل البيانات ورفع المستندات..."
                : `بدء ترحيل (${localRequestsCount}) معاملة محلية إلى سحابة Supabase الآن`}
            </span>
          </button>
        </div>

        {/* Quick Setup Instructions Accordion / Guide */}
        <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/70 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-gray-800 text-[11px]">
            <span>💡 خطوات إعداد Supabase المجاني (خلال دقيقتين):</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
              مجاني 100%
            </span>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-600 leading-relaxed pr-1">
            <li>
              افتح{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 font-bold underline"
              >
                supabase.com
              </a>{" "}
              وسجل دخولك مجاناً عبر حساب GitHub أو Google.
            </li>
            <li>
              أنشئ مشروعاً جديداً بالضغط على <strong>New Project</strong> واختر اسماً وكلمة مرور.
            </li>
            <li>
              ادخل على <strong>SQL Editor</strong> في القائمة الجانبية في Supabase، وانسخ محتوى ملف{" "}
              <code className="font-mono bg-gray-200 px-1 py-0.5 rounded text-gray-800">
                supabase_schema.sql
              </code>{" "}
              الموجود في المشروع والصقه هناك واضغط <strong>Run</strong>.
            </li>
            <li>
              ادخل على <strong>Project Settings → API</strong> وانسخ <strong>Project URL</strong> و{" "}
              <strong>anon / public key</strong> والصقهما في هذا المربع واضغط حفظ!
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
