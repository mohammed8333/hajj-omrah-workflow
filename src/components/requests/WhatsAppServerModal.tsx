"use client";

import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  X,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Send,
  Users,
  Settings,
  HelpCircle,
  Loader2,
  LogOut,
  Smartphone,
} from "lucide-react";
import { useDialog } from "@/lib/dialog-context";

interface WhatsAppServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupSelected?: (group: string) => void;
}

const BRIDGE_URL = "http://localhost:5055";
const STORAGE_KEY_GROUP = "safa_whatsapp_target_group";
const STORAGE_KEY_LINK = "safa_whatsapp_target_link";

export const WhatsAppServerModal: React.FC<WhatsAppServerModalProps> = ({
  isOpen,
  onClose,
  onGroupSelected,
}) => {
  const { alert, confirm } = useDialog();
  const [loading, setLoading] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    connected: boolean;
    hasQr: boolean;
    qrDataUrl?: string;
    groupsCount?: number;
    user?: { id: string; name: string; phone: string } | null;
  } | null>(null);

  const [targetGroup, setTargetGroup] = useState<string>("");
  const [groupLink, setGroupLink] = useState<string>("");
  const [availableGroups, setAvailableGroups] = useState<
    Array<{ id: string; subject: string; participantsCount?: number }>
  >([]);
  const [testTarget, setTestTarget] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>(
    "السلام عليكم ورحمة الله، فحص تجريبي لربط خادم مسار الواتساب المحلي 🚀✓"
  );
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Load saved settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedGroup = localStorage.getItem(STORAGE_KEY_GROUP) || "";
      const savedLink = localStorage.getItem(STORAGE_KEY_LINK) || "";
      setTargetGroup(savedGroup);
      setGroupLink(savedLink);
    }
  }, []);

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      checkStatus();
      const interval = setInterval(checkStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const checkStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${BRIDGE_URL}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setBridgeStatus({
          online: true,
          connected: Boolean(data.connected),
          hasQr: Boolean(data.hasQr),
          qrDataUrl: data.qrDataUrl,
          groupsCount: Number(data.groupsCount || 0),
          user: data.user,
        });

        if (data.connected && availableGroups.length === 0) {
          fetchGroups();
        }
        return;
      }
    } catch {
      // offline
    }
    setBridgeStatus({ online: false, connected: false, hasQr: false });
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/groups`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.groups)) {
          setAvailableGroups(data.groups);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSaveGroupSetting = (groupVal: string, linkVal: string) => {
    setTargetGroup(groupVal);
    setGroupLink(linkVal);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_GROUP, groupVal);
      localStorage.setItem(STORAGE_KEY_LINK, linkVal);
    }
    if (onGroupSelected) {
      onGroupSelected(groupVal);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: "تسجيل الخروج من الواتساب",
      message: "هل أنت متأكد من رغبتك في تسجيل الخروج وحذف الجلسة الحالية لربط رقم واتساب جديد؟",
      confirmText: "نعم، تسجيل الخروج",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setLoading(true);
      await fetch(`${BRIDGE_URL}/logout`, { method: "POST" });
      await alert({
        title: "تم تسجيل الخروج",
        message: "تم حذف الجلسة بنجاح، جاري إعداد كود QR جديد...",
        variant: "info",
      });
      await checkStatus();
    } catch (e: any) {
      await alert({
        title: "خطأ",
        message: e.message || "تعذر تسجيل الخروج من الخادم",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    try {
      setLoading(true);
      await fetch(`${BRIDGE_URL}/reconnect`, { method: "POST" });
      setTimeout(checkStatus, 1500);
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    const dest = testTarget.trim() || targetGroup.trim();
    if (!dest) {
      await alert({
        title: "تنبيه",
        message: "يرجى اختيار مجموعة أو إدخال رقم هاتف لإرسال الرسالة التجريبية.",
        variant: "warning",
      });
      return;
    }
    if (!testMessage.trim()) return;

    try {
      setTestSending(true);
      setTestResult(null);
      const res = await fetch(`${BRIDGE_URL}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: dest, message: testMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, msg: "تم إرسال الرسالة التجريبية بنجاح ✓" });
      } else {
        setTestResult({ success: false, msg: data.error || "فشل إرسال الرسالة التجريبية" });
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: e.message || "خطأ في الاتصال بالخادم" });
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-gray-900 flex items-center gap-2">
                <span>إدارة خادم الواتساب المحلي</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                  Port 5055
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                ربط حساب الواتساب وضبط المجموعة المستهدفة لإرسال حزم المعاملات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={BRIDGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-xl transition-colors hidden sm:flex items-center gap-1.5"
              title="فتح لوحة تحكم السيرفر الكاملة في نافذة جديدة"
            >
              <span>لوحة السيرفر الكاملة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="p-3.5 rounded-2xl border flex items-center justify-between text-xs bg-gray-50 border-gray-200">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                bridgeStatus?.connected
                  ? "bg-emerald-500 animate-pulse"
                  : bridgeStatus?.hasQr
                  ? "bg-amber-500 animate-ping"
                  : bridgeStatus?.online
                  ? "bg-sky-500"
                  : "bg-red-400"
              }`}
            ></span>
            <span className="font-bold text-gray-800">
              {bridgeStatus?.connected
                ? `متصل بحساب: ${bridgeStatus.user?.phone || "الواتساب"} ✓`
                : bridgeStatus?.hasQr
                ? "الخادم يعمل وبانتظار مسح كود QR من تطبيق الواتساب 📲"
                : bridgeStatus?.online
                ? "الخادم يعمل، جاري فحص جلسة الواتساب..."
                : "خادم الواتساب المحلي غير مشغّل حالياً ❌"}
            </span>
          </div>

          <button
            type="button"
            onClick={checkStatus}
            disabled={loading}
            className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>

        {/* BODY 1: If Bridge is Offline */}
        {!bridgeStatus?.online && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <span>كيفية تشغيل خادم الواتساب:</span>
            </div>
            <p className="leading-relaxed">
              لتفعيل الإرسال التلقائي لمجموعات الواتساب، افتح المجلد{" "}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">
                whatsapp-bridge
              </code>{" "}
              واضغط نقراً مزدوجاً على الملف:
            </p>
            <div className="bg-white border border-amber-200 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-800 text-sm">start.bat</span>
                <span className="text-gray-500 text-[11px]">(يقوم بتشغيل الخادم وفتح لوحة التحكم تلقائياً)</span>
              </div>
              <button
                type="button"
                onClick={checkStatus}
                className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 cursor-pointer"
              >
                تحقق الآن
              </button>
            </div>
          </div>
        )}

        {/* BODY 2: If Bridge is Online but Pending QR Scan */}
        {bridgeStatus?.online && !bridgeStatus?.connected && bridgeStatus?.hasQr && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-center">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                <QrCode className="w-4 h-4" />
                <span>امسح الرمز لربط الحساب</span>
              </span>
              <h4 className="text-sm font-bold text-gray-900">
                افتح واتساب على الهاتف &gt; الأجهزة المرتبطة &gt; ربط جهاز
              </h4>
            </div>

            {bridgeStatus.qrDataUrl ? (
              <div className="inline-block p-4 bg-white rounded-2xl border border-gray-200 shadow-md">
                <img
                  src={bridgeStatus.qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 mx-auto object-contain"
                />
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                <span>جاري تحميل كود QR...</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReconnect}
                className="text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>طلب كود QR جديد</span>
              </button>
            </div>
          </div>
        )}

        {/* BODY 3: If Connected */}
        {bridgeStatus?.connected && (
          <div className="space-y-4">
            {/* Account Info Card */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">
                    {bridgeStatus.user?.name || "حساب الواتساب"}
                  </div>
                  <div dir="ltr" className="text-emerald-800 font-mono font-bold text-right">
                    {bridgeStatus.user?.phone}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1"
                  title="تسجيل الخروج لربط رقم واتساب آخر"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ربط رقم آخر</span>
                </button>
              </div>
            </div>

            {/* Target Group Selector */}
            <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  المجموعة المستهدفة لإرسال حزم المعاملات:
                </label>
                {availableGroups.length > 0 ? (
                  <select
                    value={targetGroup}
                    onChange={(e) => handleSaveGroupSetting(e.target.value, groupLink)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-gray-800"
                  >
                    <option value="">-- اختر المجموعة من قائمة مجموعاتك ({availableGroups.length}) --</option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.subject} ({g.participantsCount} عضو)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={targetGroup}
                    onChange={(e) => handleSaveGroupSetting(e.target.value, groupLink)}
                    placeholder="مثال: مجموعة التسكين والإعاشة أو رابط الدعوة للمجموعة"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-bold"
                  />
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  يتم حفظ اسم المجموعة تلقائياً لاستخدامه دائماً في كل المعاملات.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  رابط المجموعة المباشر (اختياري لفتحها فوراً بعد الإرسال للتأكيد):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={groupLink}
                  onChange={(e) => handleSaveGroupSetting(targetGroup, e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-left font-mono"
                />
              </div>
            </div>

            {/* Test Send Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs space-y-2.5">
              <span className="font-bold text-gray-800 block">فحص الإرسال الفوري (رسالة تجريبية):</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testTarget}
                  onChange={(e) => setTestTarget(e.target.value)}
                  placeholder="رقم هاتف (مثال: 966500000000) أو اسم مجموعة"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-mono"
                />
                <button
                  type="button"
                  disabled={testSending}
                  onClick={handleSendTestMessage}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 -rotate-90" />}
                  <span>إرسال فحص</span>
                </button>
              </div>
              {testResult && (
                <div
                  className={`p-2 rounded-xl text-center font-bold ${
                    testResult.success
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <a
            href={BRIDGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
          >
            <span>فتح لوحة تحكم السيرفر المستقلة بالكامل</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
