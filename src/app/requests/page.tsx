"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary } from "@/types";
import { RequestStatusBadge } from "@/components/ui/StatusBadge";
import {
  FilePlus,
  Search,
  Layers,
  ArrowRight,
  Phone,
  Users,
  Filter,
  Hash,
  Copy,
  Check,
  X,
  Archive,
  Trash2,
  Plane,
  Calendar,
  User,
  Clock,
  MessageSquare,
  IdCard,
  Download,
  Eye,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function RequestsListPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const { confirm, prompt, alert } = useDialog();
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [nusukFilter, setNusukFilter] = useState<"ALL" | "WITH_NUSUK" | "WITHOUT_NUSUK">("ALL");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [copiedNusuk, setCopiedNusuk] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [docPreviewModal, setDocPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string | null;
    loading: boolean;
    docId?: string;
    downloadName?: string;
  }>({
    isOpen: false,
    title: "",
    url: null,
    loading: false,
  });

  // Read initial search from URL params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("search") || params.get("nusuk") || "";
      if (q) setSearch(q);
      const status = params.get("status");
      if (status) setStatusFilter(status);
      const nusukOnly = params.get("nusukOnly");
      if (nusukOnly === "true") setNusukFilter("WITH_NUSUK");
    }
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await api.requests.getAll(statusFilter || undefined);
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const copyToClipboard = (nusuk: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nusuk);
    setCopiedNusuk(nusuk);
    setTimeout(() => setCopiedNusuk(null), 2000);
  };

  const copyText = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleViewDoc = async (
    docId?: string,
    docUrl?: string,
    title?: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!docId && !docUrl) {
      await alert({
        title: "تنبيه",
        message: "هذا المستند غير مرفوع في المعاملة حتى الآن.",
        variant: "warning",
      });
      return;
    }
    setDocPreviewModal({
      isOpen: true,
      title: title || "معاينة المستند",
      url: docUrl || null,
      loading: !docUrl,
      docId,
      downloadName: (title || "document").replace(/\s+/g, "_") + ".pdf",
    });
    if (!docUrl && docId) {
      try {
        const url = await api.documents.getStreamUrl(docId);
        setDocPreviewModal((prev) => ({ ...prev, url, loading: false }));
      } catch (err) {
        console.error("Failed to get doc stream URL:", err);
        setDocPreviewModal((prev) => ({ ...prev, loading: false }));
        await alert({
          title: "خطأ",
          message: "تعذر تحميل معاينة المستند، يرجى المحاولة مرة أخرى.",
          variant: "danger",
        });
      }
    }
  };

  const handleDownloadDoc = async (
    docId?: string,
    docUrl?: string,
    fileName?: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!docId && !docUrl) {
      await alert({
        title: "تنبيه",
        message: "هذا المستند غير مرفوع في المعاملة حتى الآن.",
        variant: "warning",
      });
      return;
    }
    try {
      const url = docUrl || (await api.documents.getStreamUrl(docId!));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "document.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download document:", err);
      await alert({
        title: "خطأ",
        message: "تعذر تنزيل المستند، يرجى المحاولة لاحقاً.",
        variant: "danger",
      });
    }
  };

  const handleAdminArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAgentArchive = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "تأكيد إنجاز المعاملة (تم)",
      message: `هل أنت متأكد من إنجاز معاملة (${reqNumber}) نهائياً ونقلها إلى سجل المؤرشفة؟`,
      confirmText: "نعم، تم الإنجاز ✓",
      cancelText: "إلغاء",
      variant: "success",
    });
    if (!ok) return;
    try {
      const targetReq = requests.find((x) => x.id === id);
      if (targetReq && targetReq.status !== "Completed" && targetReq.status !== "Archived") {
        await api.requests.agentComplete(id, "تم إنجاز كافة التأشيرات والخدمات بنجاح");
      }
      await api.requests.archive(id, "تم إنجاز المعاملة وأرشفتها بواسطة الوكيل السعودي (تم)");
      await loadRequests();
      await alert({
        title: "تمت المعاملة بنجاح",
        message: `تم اعتماد معاملة (${reqNumber}) وإيداعها في سجل المؤرشفة (تم) بنجاح.`,
        variant: "success",
      });
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAdminUnarchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  const handleAdminDelete = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
        message: "تم حذف المعاملة بالكامل بنجاح.",
        variant: "success",
      });
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) await alert({ title: "خطأ", message: err.message, variant: "danger" });
    }
  };

  // فتح محادثة واتساب مع المستضيف برسالة الاستضافة المعتمدة
  const handleOpenHostWhatsApp = (
    r: GroupRequestSummary,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const phone = (r.hostPhone || (r.hasHosting ? r.contactPhone : "") || "").trim();
    if (!phone) return;

    // اسم المستضيف الأول فقط
    const hostFirstName = r.hostName?.trim().split(/\s+/)[0] || "";
    const salutation = hostFirstName
      ? `السلام عليكم يا أستاذ ${hostFirstName}`
      : "السلام عليكم يا أستاذ";

    // اسم الشخص اللي عامل login وضغط علي الزر
    const currentUserName = user?.fullName?.trim() || user?.username || "ممثل شركة إيواء";

    // تكرار السيد ورقم الجواز إذا كان فيه أكثر من مسافر
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

  // Saudi Agent isolation: strictly only transactions referred to the agent or beyond
  const agentEligibleStatuses = [
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
  ];

  const roleRequests =
    role === "SaudiAgent"
      ? requests.filter((r) => agentEligibleStatuses.includes(r.status))
      : requests;

  const countWithNusuk = roleRequests.filter((r) => Boolean(r.nusukGroupNumber)).length;
  const countWithoutNusuk = roleRequests.length - countWithNusuk;

  // Precomputed tab counts for all roles
  const agentInboxCount = roleRequests.filter((r) =>
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
  ).length;
  const agentCompletedCount = roleRequests.filter((r) => r.status === "Completed").length;
  const agentArchivedCount = roleRequests.filter((r) => r.status === "Archived").length;

  const safaNewCount = requests.filter((r) => r.status === "Submitted" || r.status === "Draft").length;
  const safaReviewCount = requests.filter((r) => r.status === "UnderReview").length;
  const safaIssuesCount = requests.filter(
    (r) =>
      r.status === "CorrectionRequired" ||
      r.status === "MissingDocuments" ||
      r.status === "SaudiAgentCorrectionRequired"
  ).length;
  const safaReadyAgentCount = requests.filter((r) => r.status === "ReadyForSaudiAgent").length;
  const safaCompletedCount = requests.filter(
    (r) =>
      r.status === "Completed" ||
      r.status === "SafaRegistrationCompleted" ||
      r.status === "DocumentsCompleted"
  ).length;

  const senderNewCount = requests.filter((r) => r.status === "Submitted" || r.status === "Draft").length;
  const senderHostingCount = requests.filter(
    (r) =>
      r.status === "HostingAcceptanceRequested" ||
      r.status === "HostingAcceptedBySender" ||
      r.status === "HostingConfirmed"
  ).length;
  const senderIssuesCount = requests.filter(
    (r) =>
      r.status === "CorrectionRequired" ||
      r.status === "MissingDocuments" ||
      r.status === "SaudiAgentCorrectionRequired"
  ).length;
  const senderCompletedCount = requests.filter((r) => r.status === "Completed").length;

  const adminNewCount = requests.filter((r) => r.status === "Submitted" || r.status === "Draft").length;
  const adminProcessingCount = requests.filter((r) =>
    [
      "UnderReview",
      "ReadyForSaudiAgent",
      "ReceivedBySaudiAgent",
      "SaudiAgentProcessing",
      "ProgramLinked",
      "HostingAcceptanceRequested",
      "HostingAcceptedBySender",
      "HostingConfirmed",
    ].includes(r.status)
  ).length;
  const adminIssuesCount = requests.filter(
    (r) =>
      r.status === "CorrectionRequired" ||
      r.status === "MissingDocuments" ||
      r.status === "SaudiAgentCorrectionRequired"
  ).length;
  const adminCompletedCount = requests.filter((r) => r.status === "Completed").length;
  const adminArchivedCount = requests.filter((r) => r.status === "Archived").length;

  const filtered = roleRequests.filter((r) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      r.groupName.toLowerCase().includes(term) ||
      r.requestNumber.toLowerCase().includes(term) ||
      (r.nusukGroupNumber && r.nusukGroupNumber.toLowerCase().includes(term)) ||
      (r.hostName && r.hostName.toLowerCase().includes(term)) ||
      (r.hostPhone && r.hostPhone.includes(term)) ||
      r.contactPhone.includes(term);

    if (!matchesTerm) return false;

    if (nusukFilter === "WITH_NUSUK" && !r.nusukGroupNumber) return false;
    if (nusukFilter === "WITHOUT_NUSUK" && r.nusukGroupNumber) return false;

    // Optional granular status dropdown filter
    if (statusFilter && r.status !== statusFilter) return false;

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
    if (activeTab === "PROCESSING")
      return (
        r.status === "UnderReview" ||
        r.status === "ReadyForSaudiAgent" ||
        r.status === "ReceivedBySaudiAgent" ||
        r.status === "SaudiAgentProcessing" ||
        r.status === "ProgramLinked" ||
        r.status === "HostingAcceptanceRequested" ||
        r.status === "HostingAcceptedBySender" ||
        r.status === "HostingConfirmed"
      );
    if (activeTab === "COMPLETED")
      return (
        r.status === "Completed" ||
        (role === "SafaEmployee" &&
          (r.status === "SafaRegistrationCompleted" ||
            r.status === "DocumentsCompleted"))
      );
    if (activeTab === "ARCHIVED") return r.status === "Archived";

    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            سجل ومعاملات المجموعات
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            عرض وبحث في كافة طلبات الحج والعمرة والرحلات المسجلة في النظام.
          </p>
        </div>

        {(role === "Sender" || role === "Admin") && (
          <Link
            href="/requests/new"
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm"
          >
            <FilePlus className="w-4 h-4" />
            <span>طلب جديد</span>
          </Link>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        {/* Role Specific Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-100 scrollbar-none">
          {role === "SaudiAgent" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({roleRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("AGENT_INBOX")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "AGENT_INBOX"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الوارد والجديد للمعالجة ({agentInboxCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مكتملة ({agentCompletedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مؤرشفة ({agentArchivedCount})
              </button>
            </>
          )}

          {role === "SafaEmployee" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                جديد للمراجعة ({safaNewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("REVIEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "REVIEW"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                قيد الفحص ({safaReviewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                طلبات تصحيح ونواقص ({safaIssuesCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("READY_AGENT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "READY_AGENT"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                جاهزة للوكيل ({safaReadyAgentCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مكتملة ({safaCompletedCount})
              </button>
            </>
          )}

          {role === "Sender" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                المسودات والمقدمة ({senderNewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("HOSTING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "HOSTING"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                طلبات الاستضافة ({senderHostingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                تحتاج تعديل ({senderIssuesCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                المكتملة ({senderCompletedCount})
              </button>
            </>
          )}

          {role === "Admin" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                جديد ومقدم ({adminNewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROCESSING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "PROCESSING"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                قيد المعالجة والمراجعة ({adminProcessingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                تحتاج تصحيح ({adminIssuesCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "COMPLETED"
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                المكتملة ({adminCompletedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                المؤرشفة ({adminArchivedCount})
              </button>
            </>
          )}

          {(!role || !["SaudiAgent", "SafaEmployee", "Sender", "Admin"].includes(role)) && (
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "ALL"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              الكل ({roleRequests.length})
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Main Search Input with Nusuk support */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم مجموعة نسك، رقم المعاملة، اسم المجموعة، أو الهاتف..."
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-gray-50/50"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white cursor-pointer"
            >
              {role === "SaudiAgent" ? (
                <>
                  <option value="">الكل (جميع الحالات)</option>
                  <option value="ReadyForSaudiAgent">جديد محال من صفا</option>
                  <option value="ReceivedBySaudiAgent">مستلم من الوكيل</option>
                  <option value="SaudiAgentProcessing">قيد المعالجة</option>
                  <option value="ProgramLinked">تم ربط البرنامج</option>
                  <option value="HostingAcceptanceRequested">بانتظار قبول الاستضافة</option>
                  <option value="HostingAcceptedBySender">تم قبول الاستضافة</option>
                  <option value="HostingConfirmed">تم تأكيد الاستضافة</option>
                  <option value="SaudiAgentCorrectionRequired">مطلوب تصحيح</option>
                  <option value="Completed">مكتمل نهائياً</option>
                  <option value="Archived">معاملات مؤرشفة</option>
                </>
              ) : (
                <>
                  <option value="">الكل (جميع الحالات)</option>
                  <option value="Draft">مسودة</option>
                  <option value="Submitted">تم التقديم</option>
                  <option value="UnderReview">قيد المراجعة</option>
                  <option value="MissingDocuments">مستندات ناقصة</option>
                  <option value="CorrectionRequired">مطلوب تصحيح</option>
                  <option value="DocumentsCompleted">المستندات مكتملة</option>
                  <option value="SafaRegistrationCompleted">اكتمل تسجيل صفا</option>
                  <option value="ReadyForSaudiAgent">جاهز للوكيل السعودي</option>
                  <option value="ReceivedBySaudiAgent">مستلم من الوكيل</option>
                  <option value="ProgramLinked">تم ربط البرنامج</option>
                  <option value="HostingAcceptanceRequested">بانتظار قبول الاستضافة</option>
                  <option value="HostingAcceptedBySender">تم قبول الاستضافة</option>
                  <option value="HostingConfirmed">تم تأكيد الاستضافة</option>
                  <option value="SaudiAgentProcessing">قيد المعالجة</option>
                  <option value="Completed">مكتمل نهائياً</option>
                  <option value="Cancelled">ملغي</option>
                  <option value="Archived">معاملات مؤرشفة</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Nusuk Quick Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 overflow-x-auto text-xs">
          <span className="text-gray-400 text-[11px] shrink-0 font-medium">تصفية نسك:</span>
          <button
            onClick={() => setNusukFilter("ALL")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              nusukFilter === "ALL"
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            الكل ({roleRequests.length})
          </button>
          <button
            onClick={() => setNusukFilter("WITH_NUSUK")}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              nusukFilter === "WITH_NUSUK"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            <Hash className="w-3 h-3" />
            <span>مسجلة بنسك ({countWithNusuk})</span>
          </button>
          <button
            onClick={() => setNusukFilter("WITHOUT_NUSUK")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              nusukFilter === "WITHOUT_NUSUK"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            بدون رقم نسك ({countWithoutNusuk})
          </button>

          {search && (
            <span className="mr-auto text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md font-medium">
              نتائج البحث عن: &quot;{search}&quot; ({filtered.length})
            </span>
          )}
        </div>
      </div>

      {/* Requests Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-xs">جاري تحميل قائمة المعاملات...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700">لا توجد طلبات مطابقة</h3>
          <p className="text-xs text-gray-500 mt-1">
            لم نجد معاملات مطابقة لمعايير البحث أو رقم نسك الحالي.
          </p>
          {(search || statusFilter || nusukFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setNusukFilter("ALL");
              }}
              className="mt-4 text-xs font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg cursor-pointer inline-block"
            >
              إعادة ضبط معايير البحث
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Cards View (phones) */}
          <div className="block md:hidden space-y-3">
            {filtered.map((r) => {
              if (role === "SaudiAgent") {
                const isCompleted = r.status === "Completed" || r.status === "Archived";
                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/requests/${r.id}`)}
                    className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs hover:border-sky-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] space-y-3"
                  >
                    {/* الشريط العلوي: يمين = رقم مجموعة نسك مع النسخ، شمال = حالة المعاملة */}
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
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>(تم)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-sky-600" />
                            <span>تم الاستلام</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* عمودين: الجزء الأيمن مربعين تحت بعض للرحلة، الجزء الأيسر بيانات المستضيف الـ 4 مع النسخ */}
                    <div className="grid grid-cols-2 gap-2.5 items-stretch">
                      {/* الجزء الأيمن: مربعين تحت بعض لبيانات الرحلة */}
                      <div className="flex flex-col gap-2 justify-between">
                        {/* المربع الأول: رحلة الذهاب */}
                        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-2 flex flex-col justify-between flex-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[10px] text-sky-700 font-bold flex items-center gap-1">
                              <Plane className="w-3 h-3 text-sky-600 shrink-0" />
                              <span>الذهاب</span>
                            </div>
                            <span className="text-[10px] text-sky-800 font-bold truncate max-w-[80px]" title={r.arrivalAirport || "مطار جدة"}>
                              {r.arrivalAirport || "مطار جدة"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <div className="font-mono font-bold text-gray-900 text-xs truncate">
                              {r.flightNumber || r.airline || "تذكرة مشتركة"}
                            </div>
                            <div className="font-mono font-bold text-gray-700 text-[10px] flex items-center gap-0.5" dir="ltr">
                              <Clock className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                              <span>{r.saudiArrivalTime || "16:05"}</span>
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-gray-800 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-600 shrink-0" />
                            <span className="truncate">{formatDayMonth(r.departureDate || r.travelDate)}</span>
                          </div>
                        </div>

                        {/* المربع الثاني: رحلة العودة */}
                        <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-2 flex flex-col justify-between flex-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                              <Plane className="w-3 h-3 text-indigo-600 -scale-x-100 shrink-0" />
                              <span>العودة</span>
                            </div>
                            <span className="text-[10px] text-indigo-800 font-bold truncate max-w-[80px]" title={r.returnDepartureAirport || (r.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")}>
                              {r.returnDepartureAirport || (r.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <div className="font-mono font-bold text-gray-900 text-xs truncate">
                              {r.returnFlightNumber || r.flightNumber || "رحلة العودة"}
                            </div>
                            <div className="font-mono font-bold text-gray-700 text-[10px] flex items-center gap-0.5" dir="ltr">
                              <Clock className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                              <span>{r.returnFlightDepartureTime || "12:20"}</span>
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-gray-800 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="truncate">{r.returnDate ? formatDayMonth(r.returnDate) : "لم يُحدد"}</span>
                          </div>
                        </div>
                      </div>

                      {/* الجزء الأيسر: بيانات المستضيف الأربعة تحت بعض مع علامة نسخ لكل سطر */}
                      <div className="bg-amber-50/30 border border-amber-200/80 rounded-xl p-2.5 flex flex-col justify-between text-xs space-y-1.5">
                        {/* 1. رقم الهوية + نسخ */}
                        <div className="flex items-center justify-between gap-1 border-b border-amber-100 pb-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-gray-500 block leading-tight">رقم الهوية:</span>
                            <span className="font-mono font-bold text-gray-900 text-[11px] truncate block" dir="ltr">
                              {r.hostNationalId || "-"}
                            </span>
                          </div>
                          {r.hostNationalId && (
                            <button
                              type="button"
                              onClick={(e) => copyText(r.hostNationalId!, `m-hostId-${r.id}`, e)}
                              className="text-gray-400 hover:text-amber-700 p-1 cursor-pointer shrink-0"
                              title="نسخ رقم الهوية"
                            >
                              {copiedKey === `m-hostId-${r.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* 2. تاريخ ميلاد المستضيف + نسخ */}
                        <div className="flex items-center justify-between gap-1 border-b border-amber-100 pb-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-gray-500 block leading-tight">تاريخ الميلاد:</span>
                            <span className="font-mono font-bold text-gray-900 text-[11px] truncate block" dir="ltr">
                              {r.hostBirthDate || "-"}
                            </span>
                          </div>
                          {r.hostBirthDate && (
                            <button
                              type="button"
                              onClick={(e) => copyText(r.hostBirthDate!, `m-hostBirth-${r.id}`, e)}
                              className="text-gray-400 hover:text-amber-700 p-1 cursor-pointer shrink-0"
                              title="نسخ تاريخ الميلاد"
                            >
                              {copiedKey === `m-hostBirth-${r.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* 3. تليفون المستضيف + نسخ */}
                        <div className="flex items-center justify-between gap-1 border-b border-amber-100 pb-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-gray-500 block leading-tight">هاتف المستضيف:</span>
                            <span className="font-mono font-bold text-gray-900 text-[11px] truncate block" dir="ltr">
                              {r.hostPhone || (r.hasHosting ? r.contactPhone : "-")}
                            </span>
                          </div>
                          {(r.hostPhone || (r.hasHosting && r.contactPhone)) && (
                            <button
                              type="button"
                              onClick={(e) => copyText(r.hostPhone || r.contactPhone, `m-hostPhone-${r.id}`, e)}
                              className="text-gray-400 hover:text-amber-700 p-1 cursor-pointer shrink-0"
                              title="نسخ رقم الهاتف"
                            >
                              {copiedKey === `m-hostPhone-${r.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* 4. اسم المستضيف + نسخ */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-gray-500 block leading-tight">اسم المستضيف:</span>
                            <span className="font-bold text-gray-900 text-[11px] truncate block">
                              {r.hostName || "-"}
                            </span>
                          </div>
                          {r.hostName && (
                            <button
                              type="button"
                              onClick={(e) => copyText(r.hostName!, `m-hostName-${r.id}`, e)}
                              className="text-gray-400 hover:text-amber-700 p-1 cursor-pointer shrink-0"
                              title="نسخ اسم المستضيف"
                            >
                              {copiedKey === `m-hostName-${r.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* الشريط السفلي: تذكرة جنبها الهوية جنبها تم */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5 flex-wrap">
                      {/* تذكرة */}
                      <div className="flex items-center gap-1 bg-sky-50/80 border border-sky-200 px-2 py-1 rounded-xl shadow-2xs">
                        <button
                          type="button"
                          onClick={(e) => handleViewDoc(r.flightTicketDocumentId, r.flightTicketDocumentUrl, `تذكرة طيران - ${r.groupName}`, e)}
                          className={`p-1 rounded-lg text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer flex items-center gap-1 ${
                            !r.flightTicketDocumentId && !r.flightTicketDocumentUrl ? "opacity-40" : ""
                          }`}
                          title="معاينة تذكرة الطيران"
                        >
                          <Plane className="w-3.5 h-3.5 text-sky-600" />
                          <span className="text-[11px] font-bold">التذكرة</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadDoc(r.flightTicketDocumentId, r.flightTicketDocumentUrl, `ticket-${r.requestNumber}.pdf`, e)}
                          className={`p-1 rounded-lg text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer ${
                            !r.flightTicketDocumentId && !r.flightTicketDocumentUrl ? "opacity-40" : ""
                          }`}
                          title="تحميل تذكرة الطيران"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* الهوية */}
                      <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-200 px-2 py-1 rounded-xl shadow-2xs">
                        <button
                          type="button"
                          onClick={(e) => handleViewDoc(r.hostIdDocumentId, r.hostIdDocumentUrl, `هوية المستضيف - ${r.hostName || r.groupName}`, e)}
                          className={`p-1 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1 ${
                            !r.hostIdDocumentId && !r.hostIdDocumentUrl ? "opacity-40" : ""
                          }`}
                          title="معاينة هوية المستضيف"
                        >
                          <IdCard className="w-3.5 h-3.5 text-amber-700" />
                          <span className="text-[11px] font-bold">الهوية</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadDoc(r.hostIdDocumentId, r.hostIdDocumentUrl, `host-id-${r.requestNumber}.jpg`, e)}
                          className={`p-1 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer ${
                            !r.hostIdDocumentId && !r.hostIdDocumentUrl ? "opacity-40" : ""
                          }`}
                          title="تحميل هوية المستضيف"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* زر تم */}
                      {r.status === "Archived" ? (
                        <span className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-1 shadow-2xs">
                          <Archive className="w-3 h-3 text-purple-600" />
                          <span>مؤرشفة</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                          className="px-3.5 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95"
                          title="إنجاز المعاملة ونقلها إلى الأرشيف (تم)"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>تم</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

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
                    {/* المستطيل فوق على اليمين: مجموعة نسك وجنبيها علامة النسخ */}
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

                    {/* المستطيل فوق على الشمال: حالة المجموعة + أزرار الأدمن والوكيل إن وجدت */}
                    <div className="flex items-center gap-1.5">
                      <RequestStatusBadge status={r.status} />
                      {role === "SaudiAgent" && (
                        <div className="flex items-center gap-1">
                          {r.status === "Completed" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAgentArchive(r.id, r.requestNumber, e);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                              title="إيداع في الأرشيف (تم)"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>تم (أرشفة)</span>
                            </button>
                          )}
                          {r.status === "Archived" && (
                            <span className="px-2 py-0.5 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-1">
                              <Archive className="w-3 h-3 text-purple-600" />
                              <span>مؤرشفة</span>
                            </span>
                          )}
                        </div>
                      )}
                      {role === "Admin" && (
                        <div className="flex items-center gap-1">
                          {r.status === "Archived" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdminUnarchive(r.id, e);
                              }}
                              className="p-1 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer transition-colors"
                              title="إلغاء الأرشفة"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdminArchive(r.id, e);
                              }}
                              className="p-1 text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer transition-colors"
                              title="أرشفة"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdminDelete(r.id, r.requestNumber, e);
                            }}
                            className="p-1 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-colors"
                            title="مسح المعاملة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* الجزء السفلي: شبكة من عمودين مطابقة للرسم التخطيطي */}
                  <div className="grid grid-cols-2 gap-2.5 items-stretch">
                    {/* 1. المربع الأيمن (تحت مجموعة نسك): بيانات الرحلة ومؤشر موعد السفر */}
                    <div className="flex flex-col gap-1.5">
                      {/* مربع بيانات الرحلة: رقم الرحلة والتاريخ يوم وشهر وخط أكبر */}
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

                      {/* المستطيل الصغير تحته: السفر خلال قد ايه */}
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

                    {/* 2. المستطيل الكبير على الشمال: أسماء المسافرين (ثلاثية) مع الصور */}
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

                  {/* زر واتساب المستضيف في نهاية الكارت إذا كان هناك رقم للمستضيف */}
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

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              {role === "SaudiAgent" ? (
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-700 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">رقم مجموعة نسك</th>
                      <th className="py-3.5 px-4 text-center">الحالة</th>
                      <th className="py-3.5 px-4">رحلة الذهاب</th>
                      <th className="py-3.5 px-4">رحلة العودة</th>
                      <th className="py-3.5 px-4">بيانات المستضيف</th>
                      <th className="py-3.5 px-4 text-center">المستندات والإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((r, rIdx) => {
                      const isCompleted = r.status === "Completed" || r.status === "Archived";
                      const isNusukMatch =
                        Boolean(search.trim()) &&
                        Boolean(r.nusukGroupNumber) &&
                        r.nusukGroupNumber!.toLowerCase().includes(search.trim().toLowerCase());

                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors ${
                            rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          } hover:bg-sky-50/30`}
                        >
                          {/* 1. رقم مجموعة نسك */}
                          <td className="py-3.5 px-4 align-middle border-l border-gray-100 font-mono">
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
                                  type="button"
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

                          {/* 2. الحالة: تم الاستلام أو (تم) */}
                          <td className="py-3.5 px-4 align-middle text-center border-l border-gray-100">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>(تم)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs">
                                <Check className="w-3.5 h-3.5 text-sky-600" />
                                <span>تم الاستلام</span>
                              </span>
                            )}
                          </td>

                          {/* 3. رحلة الذهاب */}
                          <td className="py-3.5 px-4 align-middle border-l border-gray-100">
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                <Plane className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{r.flightNumber || r.airline || "تذكرة مشتركة"}</span>
                              </div>
                              <div className="text-[11px] text-gray-700 font-bold flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{formatDayMonth(r.departureDate || r.travelDate)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-sky-900 font-medium pt-0.5">
                                <span className="bg-sky-100/70 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                                  {r.arrivalAirport || "مطار جدة"}
                                </span>
                                <span className="flex items-center gap-1 font-mono text-gray-600 font-bold" dir="ltr">
                                  <Clock className="w-3 h-3 text-sky-600 shrink-0" />
                                  {r.saudiArrivalTime || "16:05"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 4. رحلة العودة */}
                          <td className="py-3.5 px-4 align-middle border-l border-gray-100">
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                <Plane className="w-3.5 h-3.5 text-indigo-600 -scale-x-100 shrink-0" />
                                <span>{r.returnFlightNumber || r.flightNumber || "رحلة العودة"}</span>
                              </div>
                              <div className="text-[11px] text-gray-700 font-bold flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>{r.returnDate ? formatDayMonth(r.returnDate) : "لم يُحدد"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-indigo-900 font-medium pt-0.5">
                                <span className="bg-indigo-100/70 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                                  {r.returnDepartureAirport || (r.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")}
                                </span>
                                <span className="flex items-center gap-1 font-mono text-gray-600 font-bold" dir="ltr">
                                  <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                                  {r.returnFlightDepartureTime || "12:20"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 5. بيانات المستضيف (الهوية والميلاد والهاتف والاسم مع النسخ) */}
                          <td className="py-3 px-4 align-middle border-l border-gray-100">
                            <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-2 text-[11px] space-y-1 min-w-[200px] max-w-xs">
                              {/* الهوية */}
                              <div className="flex items-center justify-between gap-1 border-b border-amber-100/80 pb-0.5">
                                <span className="text-gray-500 font-medium">الهوية:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-gray-900" dir="ltr">
                                    {r.hostNationalId || "-"}
                                  </span>
                                  {r.hostNationalId && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(r.hostNationalId!, `d-hostId-${r.id}`, e)}
                                      className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer"
                                      title="نسخ رقم الهوية"
                                    >
                                      {copiedKey === `d-hostId-${r.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* تاريخ الميلاد */}
                              <div className="flex items-center justify-between gap-1 border-b border-amber-100/80 pb-0.5">
                                <span className="text-gray-500 font-medium">الميلاد:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-gray-900" dir="ltr">
                                    {r.hostBirthDate || "-"}
                                  </span>
                                  {r.hostBirthDate && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(r.hostBirthDate!, `d-hostBirth-${r.id}`, e)}
                                      className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer"
                                      title="نسخ تاريخ الميلاد"
                                    >
                                      {copiedKey === `d-hostBirth-${r.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* هاتف المستضيف */}
                              <div className="flex items-center justify-between gap-1 border-b border-amber-100/80 pb-0.5">
                                <span className="text-gray-500 font-medium">الهاتف:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-gray-900" dir="ltr">
                                    {r.hostPhone || (r.hasHosting ? r.contactPhone : "-")}
                                  </span>
                                  {(r.hostPhone || (r.hasHosting && r.contactPhone)) && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(r.hostPhone || r.contactPhone, `d-hostPhone-${r.id}`, e)}
                                      className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer"
                                      title="نسخ رقم الهاتف"
                                    >
                                      {copiedKey === `d-hostPhone-${r.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* اسم المستضيف */}
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-gray-500 font-medium">الاسم:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-gray-900 truncate max-w-[130px]" title={r.hostName}>
                                    {r.hostName || "-"}
                                  </span>
                                  {r.hostName && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(r.hostName!, `d-hostName-${r.id}`, e)}
                                      className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer"
                                      title="نسخ اسم المستضيف"
                                    >
                                      {copiedKey === `d-hostName-${r.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 6. المستندات والإجراء: تذكرة جنبها الهوية جنبها تم */}
                          <td className="py-3 px-4 align-middle text-center">
                            <div className="inline-flex items-center justify-center gap-2 flex-wrap">
                              {/* تذكرة الطيران */}
                              <div className="flex items-center gap-1 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg shadow-2xs">
                                <button
                                  type="button"
                                  onClick={(e) => handleViewDoc(r.flightTicketDocumentId, r.flightTicketDocumentUrl, `تذكرة طيران - ${r.groupName}`, e)}
                                  className={`p-1 text-sky-700 hover:bg-sky-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                                    !r.flightTicketDocumentId && !r.flightTicketDocumentUrl ? "opacity-40" : ""
                                  }`}
                                  title="معاينة تذكرة الطيران"
                                >
                                  <Plane className="w-3.5 h-3.5 text-sky-600" />
                                  <span className="text-[11px] font-bold">التذكرة</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadDoc(r.flightTicketDocumentId, r.flightTicketDocumentUrl, `ticket-${r.requestNumber}.pdf`, e)}
                                  className={`p-1 text-sky-700 hover:bg-sky-100 rounded-md transition-colors cursor-pointer ${
                                    !r.flightTicketDocumentId && !r.flightTicketDocumentUrl ? "opacity-40" : ""
                                  }`}
                                  title="تحميل تذكرة الطيران"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* هوية المستضيف */}
                              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shadow-2xs">
                                <button
                                  type="button"
                                  onClick={(e) => handleViewDoc(r.hostIdDocumentId, r.hostIdDocumentUrl, `هوية المستضيف - ${r.hostName || r.groupName}`, e)}
                                  className={`p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                                    !r.hostIdDocumentId && !r.hostIdDocumentUrl ? "opacity-40" : ""
                                  }`}
                                  title="معاينة هوية المستضيف"
                                >
                                  <IdCard className="w-3.5 h-3.5 text-amber-700" />
                                  <span className="text-[11px] font-bold">الهوية</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadDoc(r.hostIdDocumentId, r.hostIdDocumentUrl, `host-id-${r.requestNumber}.jpg`, e)}
                                  className={`p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors cursor-pointer ${
                                    !r.hostIdDocumentId && !r.hostIdDocumentUrl ? "opacity-40" : ""
                                  }`}
                                  title="تحميل هوية المستضيف"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* زر تم */}
                              {r.status === "Archived" ? (
                                <span className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-1 shadow-2xs">
                                  <Archive className="w-3.5 h-3.5 text-purple-600" />
                                  <span>مؤرشفة</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                                  className="px-3.5 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95"
                                  title="إنجاز المعاملة ونقلها إلى الأرشيف (تم)"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>تم</span>
                                </button>
                              )}

                              {/* زر فتح/عرض المعاملة */}
                              <Link
                                href={`/requests/${r.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                                title="عرض تفاصيل المعاملة"
                              >
                                <span>عرض</span>
                                <ArrowRight className="w-3 h-3 rotate-180" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
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
                {filtered.map((r, rIdx) => {
                  const isNusukMatch =
                    Boolean(search.trim()) &&
                    Boolean(r.nusukGroupNumber) &&
                    r.nusukGroupNumber!.toLowerCase().includes(search.trim().toLowerCase());

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
                            {/* Merged Columns (Rendered on first row only with rowSpan) */}
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
                                  <div className="flex flex-col items-center gap-1">
                                    <RequestStatusBadge status={r.status} />
                                  </div>
                                </td>

                                {/* 3. بيانات الرحلة: رقم الرحلة فوق وتحتيها التاريخ والسفر خلال قد ايه */}
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
                                          <Clock className="w-3 h-3 shrink-0" />
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

                            {/* 5. صورة المعتمر مصغرة زي بروفايل */}
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

                            {/* 6. الإجراء (Merged for the whole group) */}
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

                                  {role === "Admin" && (
                                    <div className="flex items-center gap-1 border-r border-gray-200 pr-1.5 mr-0.5">
                                      {r.status === "Archived" ? (
                                        <button
                                          type="button"
                                          onClick={(e) => handleAdminUnarchive(r.id, e)}
                                          className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors"
                                          title="إلغاء الأرشفة"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => handleAdminArchive(r.id, e)}
                                          className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors"
                                          title="أرشفة المعاملة"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => handleAdminDelete(r.id, r.requestNumber, e)}
                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg cursor-pointer transition-colors"
                                        title="مسح المعاملة نهائياً"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}

                                  {role === "SaudiAgent" && (
                                    <div className="flex items-center gap-1 border-r border-gray-200 pr-1.5 mr-0.5">
                                      {r.status === "Completed" && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl transition-colors cursor-pointer shadow-2xs"
                                          title="إيداع في الأرشيف (تم)"
                                        >
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>تم (أرشفة)</span>
                                        </button>
                                      )}
                                      {r.status === "Archived" && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
                                          <Archive className="w-3.5 h-3.5 text-purple-600" />
                                          <span>مؤرشفة</span>
                                        </span>
                                      )}
                                    </div>
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
            )}
            </div>
          </div>
        </>
      )}

      {/* Document Preview Modal */}
      {docPreviewModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setDocPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50/80">
              <h3 className="font-bold text-gray-800 text-sm truncate">
                {docPreviewModal.title}
              </h3>
              <div className="flex items-center gap-2">
                {docPreviewModal.url && (
                  <>
                    <a
                      href={docPreviewModal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="فتح في نافذة مستقلة"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadDoc(
                          docPreviewModal.docId,
                          docPreviewModal.url!,
                          docPreviewModal.downloadName
                        )
                      }
                      className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="تحميل الملف"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setDocPreviewModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-gray-100 min-h-[300px]">
              {docPreviewModal.loading ? (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">جاري تحميل المستند...</span>
                </div>
              ) : docPreviewModal.url ? (
                docPreviewModal.url.includes("application/pdf") ||
                docPreviewModal.downloadName?.endsWith(".pdf") ? (
                  <iframe
                    src={docPreviewModal.url}
                    className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
                    title={docPreviewModal.title}
                  />
                ) : (
                  <img
                    src={docPreviewModal.url}
                    alt={docPreviewModal.title}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-xs"
                  />
                )
              ) : (
                <div className="text-center text-gray-400 text-xs py-8">
                  تعذر عرض معاينة للمستند
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
