"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AdminStats, GroupRequestSummary } from "@/types";
import { RequestStatusBadge } from "@/components/ui/StatusBadge";
import {
  FilePlus,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Layers,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Hash,
  Copy,
  Check,
  X,
  Archive,
  Trash2,
  Plane,
  Calendar,
  User,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequestLifecycleTimer } from "@/components/ui/RequestLifecycleTimer";
import { useDialog } from "@/lib/dialog-context";
import { getWhatsAppUrl } from "@/lib/phoneUtils";

// اقتطاع الاسم الثلاثي فقط (3 مقاطع كحد أقصى)
function getThreePartName(fullName?: string): string {
  if (!fullName) return "بدون اسم";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 3) return parts.join(" ");
  return parts.slice(0, 3).join(" ");
}

// تنسيق التاريخ يوم وشهر فقط بخط واضح
function formatDayMonth(dateStr?: string): string {
  if (!dateStr) return "لم يُحدد";
  try {
    const dateOnly = dateStr.split("T")[0];
    const [y, m, d] = dateOnly.split("-").map(Number);
    if (y && m && d) {
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("ar-EG-u-nu-latn", {
        day: "numeric",
        month: "long",
      });
    }
    const fallback = new Date(dateStr);
    return fallback.toLocaleDateString("ar-EG-u-nu-latn", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

// حساب المدة المتبقية على موعد السفر (السفر خلال قد ايه)
function getTravelCountdown(
  departureDate?: string,
  travelDate?: string,
  flightDepartureTime?: string
): { text: string; colorClass: string } | null {
  const effectiveDate = departureDate || travelDate;
  if (!effectiveDate) return null;

  try {
    const now = Date.now();
    let travelEpoch: number | null = null;
    const dateOnly = effectiveDate.split("T")[0];
    const [y, m, d] = dateOnly.split("-").map(Number);

    if (y && m && d) {
      if (
        flightDepartureTime &&
        /^\d{1,2}:\d{2}$/.test(flightDepartureTime.trim())
      ) {
        const [hh, mm] = flightDepartureTime.trim().split(":").map(Number);
        const dt = new Date(y, m - 1, d, hh, mm, 0);
        if (!isNaN(dt.getTime())) travelEpoch = dt.getTime();
      }
      if (travelEpoch === null) {
        const dt = new Date(y, m - 1, d, 23, 59, 59);
        if (!isNaN(dt.getTime())) travelEpoch = dt.getTime();
      }
    }

    if (travelEpoch === null) {
      const dt = new Date(effectiveDate);
      if (!isNaN(dt.getTime())) travelEpoch = dt.getTime();
    }

    if (!travelEpoch) return null;

    const diffMs = travelEpoch - now;
    if (diffMs <= 0) {
      return {
        text: "انتهى موعد السفر",
        colorClass: "bg-gray-100 text-gray-700 border-gray-200",
      };
    }

    const days = Math.floor(diffMs / (24 * 3600 * 1000));
    const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));

    if (days === 0) {
      if (hours === 0) {
        const minutes = Math.max(1, Math.floor((diffMs % (3600 * 1000)) / (60 * 1000)));
        return {
          text: `السفر خلال ${minutes} دقيقة`,
          colorClass: "bg-rose-50 text-rose-800 border-rose-200",
        };
      }
      return {
        text: `السفر خلال ${hours} ساعة`,
        colorClass: "bg-rose-50 text-rose-800 border-rose-200",
      };
    } else if (days === 1) {
      return {
        text: `السفر غداً (${hours} س)`,
        colorClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    } else if (days <= 3) {
      return {
        text: `السفر خلال ${days} أيام`,
        colorClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    } else {
      return {
        text: `السفر خلال ${days} يوم`,
        colorClass: "bg-sky-50 text-sky-800 border-sky-200",
      };
    }
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { confirm, prompt, alert } = useDialog();
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [nusukOnly, setNusukOnly] = useState(false);
  const [copiedNusuk, setCopiedNusuk] = useState<string | null>(null);

  const copyToClipboard = (nusuk: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nusuk);
    setCopiedNusuk(nusuk);
    setTimeout(() => setCopiedNusuk(null), 2000);
  };

  // فتح محادثة واتساب مع المستضيف برسالة الاستضافة المعتمدة
  const handleOpenHostWhatsApp = (
    r: GroupRequestSummary,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const phone = (r.hostPhone || (r.hasHosting ? r.contactPhone : "") || "").trim();
    if (!phone) return;

    const hostFirstName = r.hostName?.trim().split(/\s+/)[0] || "";
    const salutation = hostFirstName
      ? `السلام عليكم يا أستاذ ${hostFirstName}`
      : "السلام عليكم يا أستاذ";

    const currentUserName = user?.fullName?.trim() || user?.username || "ممثل شركة إيواء";

    const travelers =
      r.travelersList && r.travelersList.length > 0
        ? r.travelersList
        : [{ fullName: r.groupName || "المعتمر", passportNumber: "" }];

    const travelersLines = travelers
      .map(
        (t) =>
          `السيد ${t.fullName?.trim() || "المعتمر"}\nرقم جواز ${t.passportNumber?.trim() || ""}`.trim()
      )
      .join("\n");

    const message = `${salutation}
مع حضرتك ${currentUserName}
من شركة إيواء للعمرة 
ارجو قبول استضافة 
${travelersLines}
علما بان المعتمر المذكور تحت مسئولية حضرتك حتى خروجه من المملكة .
وشكرا`;

    const whatsappUrl = getWhatsAppUrl(phone, message);
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank");
    }
  };

  const handleAdminArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirm({
      title: "أرشفة المعاملة",
      message: "هل أنت متأكد من رغبتك في أرشفة هذه المعاملة؟",
      confirmText: "أرشفة المعاملة",
      cancelText: "إلغاء",
      variant: "warning",
    });
    if (!ok) return;
    try {
      await api.requests.archive(id, "أرشفة يدوية بواسطة مدير النظام");
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAdminUnarchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirm({
      title: "إلغاء أرشفة المعاملة",
      message: "هل ترغب في إلغاء أرشفة هذه المعاملة واستعادتها للحالة النشطة؟",
      confirmText: "استعادة المعاملة",
      cancelText: "إلغاء",
      variant: "info",
    });
    if (!ok) return;
    try {
      await api.requests.unarchive(id);
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAdminDelete = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const confirmation = await prompt({
      title: "تحذير أمني: مسح المعاملة نهائياً",
      message: `أنت على وشك مسح المعاملة (${reqNumber}) وكافة وثائقها وملفاتها نهائياً من النظام!\n\nللتأكيد النهائي، اكتب (حذف) أو (delete):`,
      placeholder: "اكتب (حذف) هنا...",
      confirmText: "حذف نهائي",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!confirmation || (confirmation.trim() !== "حذف" && confirmation.trim().toLowerCase() !== "delete")) {
      return;
    }
    try {
      await api.requests.delete(id);
      await alert({
        title: "تم الحذف بنجاح",
        message: "تم حذف المعاملة بالكامل وجميع مستنداتها بنجاح.",
        variant: "success",
      });
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAgentArchive = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirm({
      title: "إيداع في الأرشيف (تم)",
      message: `هل أنت متأكد من إتمام المعاملة (${reqNumber}) نهائياً ونقلها إلى سجل المؤرشفة؟`,
      confirmText: "تم - إيداع في الأرشيف",
      cancelText: "إلغاء",
      variant: "success",
    });
    if (!ok) return;
    try {
      await api.requests.archive(id, "تم إنجاز المعاملة وأرشفتها بواسطة الوكيل السعودي (تم)");
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      await alert({
        title: "تمت الأرشفة بنجاح",
        message: "تم نقل المعاملة إلى قسم المعاملات المؤرشفة بنجاح.",
        variant: "success",
      });
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  useEffect(() => {
    if (role === "SaudiAgent" && activeTab === "ALL") {
      setActiveTab("AGENT_INBOX");
    }
  }, [role, activeTab]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        if (role === "Admin") {
          const [statsRes, reqsRes] = await Promise.all([
            api.admin.getStats(),
            api.requests.getAll(),
          ]);
          setAdminStats(statsRes);
          setRequests(reqsRes);
        } else {
          const reqsRes = await api.requests.getAll();
          setRequests(reqsRes);
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, role, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-sm">جاري تحميل لوحة التحكم...</span>
      </div>
    );
  }

  // Filter requests based on tab and search term
  const filteredRequests = requests.filter((r) => {
    // Saudi Agent isolation: strictly only transactions referred to the agent or beyond
    if (role === "SaudiAgent") {
      const isAgentEligible = [
        "ReadyForSaudiAgent",
        "ReceivedBySaudiAgent",
        "SaudiAgentProcessing",
        "SaudiAgentCorrectionRequired",
        "ProgramLinked",
        "HostingAcceptanceRequested",
        "HostingAcceptedBySender",
        "HostingConfirmed",
        "Completed",
        "Archived",
      ].includes(r.status);
      if (!isAgentEligible) return false;
    }

    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      r.groupName.toLowerCase().includes(term) ||
      r.requestNumber.toLowerCase().includes(term) ||
      (r.nusukGroupNumber && r.nusukGroupNumber.toLowerCase().includes(term)) ||
      r.contactPhone.includes(term);

    if (!matchesSearch) return false;

    if (nusukOnly && !r.nusukGroupNumber) return false;

    if (activeTab === "ALL") return true;
    if (activeTab === "NEW") return r.status === "Submitted" || r.status === "Draft";
    if (activeTab === "REVIEW") return r.status === "UnderReview";
    if (activeTab === "ISSUES")
      return (
        r.status === "CorrectionRequired" ||
        r.status === "MissingDocuments" ||
        r.status === "SaudiAgentCorrectionRequired"
      );
    if (activeTab === "READY_AGENT") return r.status === "ReadyForSaudiAgent";
    if (activeTab === "HOSTING")
      return (
        r.status === "HostingAcceptanceRequested" ||
        r.status === "HostingAcceptedBySender" ||
        r.status === "HostingConfirmed"
      );
    if (activeTab === "AGENT_INBOX")
      return (
        r.status === "ReadyForSaudiAgent" ||
        r.status === "ReceivedBySaudiAgent" ||
        r.status === "SaudiAgentProcessing" ||
        r.status === "SaudiAgentCorrectionRequired" ||
        r.status === "ProgramLinked" ||
        r.status === "HostingAcceptanceRequested" ||
        r.status === "HostingAcceptedBySender" ||
        r.status === "HostingConfirmed"
      );
    if (activeTab === "COMPLETED") return r.status === "Completed";
    if (activeTab === "ARCHIVED") return r.status === "Archived";

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-teal-800 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            أهلاً بك، {user?.fullName}
          </h1>
          <p className="text-sky-100 text-xs sm:text-sm mt-1">
            {role === "Sender" && "يمكنك إنشاء ومتابعة طلبات ووثائق المجموعات والمعتمرين."}
            {role === "SafaEmployee" && "تدقيق ومراجعة الوثائق، تسجيل أرقام نسك، وإحالة المعاملات للوكيل السعودي."}
            {role === "SaudiAgent" && "استقبال وإصدار تأكيدات مجموعات العمرة ومتابعة الملاحظات."}
            {role === "Admin" && "الإشراف الكامل على النظام، توزيع المهام، ومتابعة سجلات التدقيق."}
          </p>
        </div>

        {(role === "Sender" || role === "Admin") && (
          <Link
            href="/requests/new"
            className="inline-flex items-center gap-2 bg-white text-sky-800 hover:bg-sky-50 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm shrink-0"
          >
            <FilePlus className="w-4 h-4" />
            <span>إنشاء مجموعة جديدة</span>
          </Link>
        )}
      </div>

      {/* Admin Statistics Section */}
      {role === "Admin" && adminStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">إجمالي المجموعات</div>
              <div className="text-xl font-bold text-gray-900">
                {adminStats.totalGroups}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">إجمالي المسافرين</div>
              <div className="text-xl font-bold text-gray-900">
                {adminStats.totalTravelers}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">تحتاج تصحيح / نواقص</div>
              <div className="text-xl font-bold text-gray-900">
                {adminStats.correctionRequired + adminStats.missingDocuments}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">المعاملات المكتملة</div>
              <div className="text-xl font-bold text-gray-900">
                {adminStats.completed}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Nusuk & Request Search Widget */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث السريع برقم مجموعة نسك، رقم المعاملة، أو اسم المجموعة..."
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50/50"
            />
            <Hash className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute left-3.5 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNusukOnly(!nusukOnly)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                nusukOnly
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>{nusukOnly ? "مسجلة بنسك فقط ✓" : "تصفية: مسجلة بنسك"}</span>
            </button>

            {searchTerm && (
              <Link
                href={`/requests?search=${encodeURIComponent(searchTerm)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors whitespace-nowrap"
              >
                <span>سجل المعاملات</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs / Filters Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {role !== "SaudiAgent" && (
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "ALL"
                  ? "bg-sky-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              الكل ({requests.length})
            </button>
          )}

          {role === "SafaEmployee" && (
            <>
              <button
                onClick={() => setActiveTab("NEW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-sky-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                جديد للمراجعة
              </button>
              <button
                onClick={() => setActiveTab("REVIEW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "REVIEW"
                    ? "bg-sky-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                قيد الفحص
              </button>
              <button
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                طلبات تصحيح ونواقص
              </button>
              <button
                onClick={() => setActiveTab("READY_AGENT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "READY_AGENT"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                جاهزة للوكيل
              </button>
            </>
          )}

          {role === "SaudiAgent" && (
            <>
              <button
                onClick={() => setActiveTab("AGENT_INBOX")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "AGENT_INBOX"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                الوارد والجديد للمعالجة (
                {
                  requests.filter((r) =>
                    [
                      "ReadyForSaudiAgent",
                      "ReceivedBySaudiAgent",
                      "SaudiAgentProcessing",
                      "SaudiAgentCorrectionRequired",
                      "ProgramLinked",
                      "HostingAcceptanceRequested",
                      "HostingAcceptedBySender",
                      "HostingConfirmed",
                    ].includes(r.status)
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white shadow-xs"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                مكتملة ({requests.filter((r) => r.status === "Completed").length})
              </button>
              <button
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                مؤرشفة ({requests.filter((r) => r.status === "Archived").length})
              </button>
            </>
          )}

          {role === "Sender" && (
            <>
              <button
                onClick={() => setActiveTab("NEW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-sky-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                المسودات والمقدمة
              </button>
              <button
                onClick={() => setActiveTab("HOSTING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "HOSTING"
                    ? "bg-amber-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                طلبات الاستضافة (
                {
                  requests.filter(
                    (r) =>
                      r.status === "HostingAcceptanceRequested" ||
                      r.status === "HostingAcceptedBySender" ||
                      r.status === "HostingConfirmed"
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                تحتاج تعديل
              </button>
              <button
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                المكتملة
              </button>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative shrink-0 sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم الطلب أو الاسم..."
            className="w-full pl-3 pr-9 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2" />
        </div>
      </div>

      {/* Requests List Cards / Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700">لا توجد طلبات</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            لم يتم العثور على أي معاملات تطابق الفلتر أو البحث الحالي.
          </p>
          {(role === "Sender" || role === "Admin") && (
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 mt-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              <FilePlus className="w-4 h-4" />
              <span>إنشاء أول طلب مجموعة</span>
            </Link>
          )}
        </div>
      ) : role === "Sender" ? (
        <>
          {/* Mobile Cards View (phones) - للمرسل على التليفون */}
          <div className="block md:hidden space-y-3">
            {filteredRequests.map((r) => {
              const travelers =
                r.travelersList && r.travelersList.length > 0
                  ? r.travelersList
                  : [{ id: `fb-${r.id}`, fullName: r.groupName || "بدون اسم", passportNumber: undefined, photoUrl: undefined }];

              const travelCountdown = getTravelCountdown(
                r.departureDate,
                r.travelDate,
                r.flightDepartureTime
              );

              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/requests/${r.id}`)}
                  className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs hover:border-sky-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] space-y-2.5"
                >
                  {/* الشريط العلوي: يمين = رقم مجموعة نسك مع النسخ، شمال = حالة المجموعة */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
                      <span className="text-[11px] text-gray-500 font-bold">نسك:</span>
                      {r.nusukGroupNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-800 text-xs">
                            {r.nusukGroupNumber}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(r.nusukGroupNumber!, e);
                            }}
                            className="text-gray-400 hover:text-emerald-700 p-0.5 cursor-pointer"
                            title="نسخ رقم نسك"
                          >
                            {copiedNusuk === r.nusukGroupNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">قيد التسجيل</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <RequestStatusBadge status={r.status} />
                    </div>
                  </div>

                  {/* الجزء السفلي: شبكة من عمودين مطابقة لقائمة المعاملات */}
                  <div className="grid grid-cols-2 gap-2.5 items-stretch">
                    {/* المربع الأيمن: بيانات الرحلة ومؤشر موعد السفر */}
                    <div className="flex flex-col gap-1.5">
                      <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-2.5 flex-1 flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Plane className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-mono font-bold text-gray-900 text-sm tracking-wide truncate">
                            {r.flightNumber || r.airline || "تذكرة مشتركة"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-800">
                          <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-bold text-sm">
                            {formatDayMonth(r.departureDate || r.travelDate)}
                          </span>
                        </div>
                      </div>

                      {travelCountdown ? (
                        <div
                          className={`border rounded-xl px-2 py-1 text-center flex items-center justify-center gap-1 text-[11px] font-bold shadow-2xs ${travelCountdown.colorClass}`}
                        >
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{travelCountdown.text}</span>
                        </div>
                      ) : (
                        <div className="border border-gray-200 bg-gray-50 rounded-xl px-2 py-1 text-center text-[10px] text-gray-400 font-medium">
                          موعد السفر غير محدد
                        </div>
                      )}
                    </div>

                    {/* المستطيل الأيسر: أسماء المسافرين (ثلاثية) مع الصور */}
                    <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-2.5 flex flex-col justify-center min-h-[105px]">
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
                        {travelers.map((t, idx) => (
                          <div key={t.id || idx} className="flex items-center gap-2 min-w-0">
                            {t.photoUrl ? (
                              <img
                                src={t.photoUrl}
                                alt={t.fullName}
                                className="w-8 h-8 rounded-full object-cover border border-purple-300 shrink-0 shadow-2xs"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {t.fullName && t.fullName.trim() ? (
                                  t.fullName.trim().charAt(0)
                                ) : (
                                  <User className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span
                                className="text-xs font-bold text-gray-900 block truncate leading-tight"
                                title={t.fullName}
                              >
                                {getThreePartName(t.fullName)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* زر واتساب المستضيف */}
                  {(r.hostPhone || (r.hasHosting && r.contactPhone)) && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenHostWhatsApp(r, e)}
                      className="w-full mt-2.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      title="مراسلة المستضيف عبر واتساب"
                    >
                      <MessageSquare className="w-4 h-4 fill-white" />
                      <span>واتساب المستضيف</span>
                      <span className="text-[11px] font-mono opacity-90 dir-ltr">
                        ({r.hostPhone || r.contactPhone})
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (صفحات الكمبيوتر) - صفوف بدمج خلايا المعتمرين كما في قائمة المعاملات */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-700 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">رقم مجموعة نسك</th>
                    <th className="py-3.5 px-4 text-center">الحالة</th>
                    <th className="py-3.5 px-4">بيانات الرحلة والتاريخ</th>
                    <th className="py-3.5 px-4">اسم المعتمر</th>
                    <th className="py-3.5 px-4 text-center">صورة المعتمر</th>
                    <th className="py-3.5 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                {filteredRequests.map((r, rIdx) => {
                  const isNusukMatch =
                    Boolean(searchTerm.trim()) &&
                    Boolean(r.nusukGroupNumber) &&
                    r.nusukGroupNumber!.toLowerCase().includes(searchTerm.trim().toLowerCase());

                  const travelers =
                    r.travelersList && r.travelersList.length > 0
                      ? r.travelersList
                      : [{ id: `fb-${r.id}`, fullName: r.groupName || "بدون اسم", passportNumber: undefined, photoUrl: undefined }];

                  const rowCount = travelers.length;
                  const travelCountdown = getTravelCountdown(
                    r.departureDate,
                    r.travelDate,
                    r.flightDepartureTime
                  );

                  return (
                    <tbody
                      key={r.id}
                      className={`divide-y divide-gray-100 border-b-2 border-gray-200/90 transition-colors ${
                        rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      } hover:bg-sky-50/30`}
                    >
                      {travelers.map((t, tIdx) => {
                        return (
                          <tr key={`${r.id}-${t.id || tIdx}`} className="transition-colors">
                            {/* Merged Columns */}
                            {tIdx === 0 && (
                              <>
                                {/* 1. رقم مجموعة نسك */}
                                <td
                                  rowSpan={rowCount}
                                  className="py-3.5 px-4 align-middle border-l border-gray-100 font-mono"
                                >
                                  {r.nusukGroupNumber ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono transition-all ${
                                          isNusukMatch
                                            ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                                            : "bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                                        }`}
                                      >
                                        {r.nusukGroupNumber}
                                      </span>
                                      <button
                                        onClick={(e) => copyToClipboard(r.nusukGroupNumber!, e)}
                                        className="text-gray-400 hover:text-emerald-700 p-1 cursor-pointer transition-colors"
                                        title="نسخ رقم نسك"
                                      >
                                        {copiedNusuk === r.nusukGroupNumber ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs italic">قيد التسجيل</span>
                                  )}
                                </td>

                                {/* 2. الحالة */}
                                <td
                                  rowSpan={rowCount}
                                  className="py-3.5 px-4 align-middle text-center border-l border-gray-100"
                                >
                                  <RequestStatusBadge status={r.status} />
                                </td>

                                {/* 3. بيانات الرحلة والتاريخ ومؤشر السفر */}
                                <td
                                  rowSpan={rowCount}
                                  className="py-3.5 px-4 align-middle border-l border-gray-100"
                                >
                                  <div className="space-y-1">
                                    <div className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                      <Plane className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                      <span className="font-mono uppercase">
                                        {r.flightNumber || r.airline || "تذكرة مشتركة"}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                      <span>
                                        {r.departureDate || r.travelDate
                                          ? new Date(r.departureDate || r.travelDate!).toLocaleDateString("ar-SA")
                                          : "لم يُحدد"}
                                      </span>
                                    </div>
                                    {travelCountdown && (
                                      <div className="pt-0.5">
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${travelCountdown.colorClass}`}
                                        >
                                          <Clock className="w-3.5 h-3.5 shrink-0" />
                                          <span>{travelCountdown.text}</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </>
                            )}

                            {/* 4. اسم المعتمر */}
                            <td className="py-3 px-4 align-middle border-l border-gray-100">
                              <div className="font-bold text-gray-900 text-xs">
                                {t.fullName}
                              </div>
                              {t.passportNumber && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  جواز: {t.passportNumber}
                                </div>
                              )}
                            </td>

                            {/* 5. صورة المعتمر */}
                            <td className="py-3 px-4 align-middle text-center border-l border-gray-100">
                              <div className="flex items-center justify-center">
                                {t.photoUrl ? (
                                  <img
                                    src={t.photoUrl}
                                    alt={t.fullName}
                                    className="w-9 h-9 rounded-full object-cover border border-purple-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                                    title={`صورة المعتمر: ${t.fullName}`}
                                  />
                                ) : (
                                  <div
                                    className="w-9 h-9 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xs shadow-2xs"
                                    title="لا توجد صورة شخصية"
                                  >
                                    {t.fullName && t.fullName.trim() ? (
                                      t.fullName.trim().charAt(0)
                                    ) : (
                                      <User className="w-4 h-4 text-purple-600" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 6. الإجراء */}
                            {tIdx === 0 && (
                              <td
                                rowSpan={rowCount}
                                className="py-3.5 px-4 align-middle text-center"
                              >
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <Link
                                    href={`/requests/${r.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                                    title="فتح المعاملة"
                                  >
                                    <span>فتح</span>
                                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                                  </Link>

                                  {(r.hostPhone || (r.hasHosting && r.contactPhone)) && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenHostWhatsApp(r, e)}
                                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                                      title="واتساب المستضيف"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                      <span>واتساب</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              onClick={() => router.push(`/requests/${req.id}`)}
              className="bg-white rounded-2xl border border-gray-200 hover:border-sky-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                      {req.requestNumber}
                    </span>
                    {role === "SaudiAgent" && req.status === "ReadyForSaudiAgent" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs">
                        جديد من صفا
                      </span>
                    )}
                  </div>
                  <RequestStatusBadge status={req.status} />
                </div>

                <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-sky-700 transition-colors">
                  {req.groupName}
                </h3>

                <div className="text-xs text-gray-600 space-y-1 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">هاتف التواصل:</span>
                    <span className="font-medium" dir="ltr">
                      {req.contactPhone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">عدد المسافرين:</span>
                    <span className="font-semibold text-gray-800">
                      {req.travelersCount} مسافر
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">الاستضافة:</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        req.hasHosting
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {req.hasHosting ? "نعم (مشتركة)" : "بدون"}
                    </span>
                  </div>

                  {req.nusukGroupNumber ? (
                    <div className="flex items-center justify-between pt-1.5 pb-1 px-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-emerald-800">
                      <span className="text-[11px] font-semibold flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-emerald-600" />
                        <span>رقم مجموعة نسك:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-xs bg-emerald-100/90 text-emerald-900 px-2 py-0.5 rounded-md">
                          {req.nusukGroupNumber}
                        </span>
                        <button
                          onClick={(e) => copyToClipboard(req.nusukGroupNumber!, e)}
                          className="text-gray-400 hover:text-emerald-700 p-0.5 cursor-pointer transition-colors"
                          title="نسخ رقم نسك"
                        >
                          {copiedNusuk === req.nusukGroupNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    role === "SafaEmployee" && req.status === "DocumentsCompleted" ? (
                      <div className="flex items-center justify-between text-[11px] bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200">
                        <span>رقم نسك:</span>
                        <span className="font-semibold">بانتظار الإدخال في صفا</span>
                      </div>
                    ) : null
                  )}

                  {req.pendingCorrectionsCount > 0 && (
                    <div className="bg-rose-50 text-rose-700 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 mt-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>يوجد {req.pendingCorrectionsCount} طلب تصحيح معلق</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifecycle Timer & Creation Date */}
              <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <RequestLifecycleTimer
                  createdAt={req.createdAt}
                  travelDate={req.travelDate}
                  departureDate={req.departureDate}
                  flightDepartureTime={req.flightDepartureTime}
                  status={req.status}
                  mode="compact"
                />
                <span className="text-[11px] text-gray-400 shrink-0">
                  {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                </span>
              </div>

              {/* Card Actions: Open Icon + Admin Archive & Delete Icon Buttons */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <span
                  className="p-1.5 text-sky-600 group-hover:text-sky-800 bg-sky-50 group-hover:bg-sky-100 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                  title="فتح تفاصيل المعاملة"
                >
                  <ArrowRight className="w-4 h-4 rotate-180 group-hover:translate-x-[-2px] transition-transform" />
                </span>

                {role === "Admin" && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {req.status === "Archived" ? (
                      <button
                        type="button"
                        onClick={(e) => handleAdminUnarchive(req.id, e)}
                        className="p-2 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        title="إلغاء أرشفة المعاملة واستعادتها"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleAdminArchive(req.id, e)}
                        className="p-2 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        title="أرشفة المعاملة"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleAdminDelete(req.id, req.requestNumber, e)}
                      className="p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                      title="مسح المعاملة نهائياً"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {role === "SaudiAgent" && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {req.status === "Completed" && (
                      <button
                        type="button"
                        onClick={(e) => handleAgentArchive(req.id, req.requestNumber, e)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        title="إيداع في الأرشيف (تم)"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم (أرشفة)</span>
                      </button>
                    )}
                    {req.status === "Archived" && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl">
                        <Archive className="w-3.5 h-3.5 text-purple-600" />
                        <span>مؤرشفة</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
