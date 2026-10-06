"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary, TravelerSummaryItem } from "@/types";
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
  FileSpreadsheet,
  RotateCcw,
  Building,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/dialog-context";
import { getWhatsAppUrl } from "@/lib/phoneUtils";
import { WhatsAppModal } from "@/components/ui/WhatsAppModal";
import { NusukApprovalModal } from "@/components/requests/NusukApprovalModal";
import { notificationsService } from "@/lib/notificationsService";
import { downloadFile } from "@/lib/fileDownload";
import { matchesRequestSearch, getMatchingTravelers, isTravelerMatch } from "@/lib/searchUtils";
import {
  HeaderColumnFilter,
  TableColumnFiltersState,
  initialColumnFilters,
  matchesColumnFilters,
  getDistinctStatusOptions,
  getDistinctDateOptions,
  HOSTING_OPTIONS,
} from "@/components/requests/TableColumnFilters";
import { getTravelArchiveCategory } from "@/lib/travelArchiveUtils";

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
  const [mobileCardTab, setMobileCardTab] = useState<Record<string, "host" | "travelers">>({});
  const [nusukModalRequest, setNusukModalRequest] = useState<GroupRequestSummary | null>(null);
  const [whatsAppModalRequest, setWhatsAppModalRequest] = useState<GroupRequestSummary | null>(null);
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

  // Interactive Column Filters
  const [colFilters, setColFilters] = useState<TableColumnFiltersState>(initialColumnFilters);

  const handleColFilterChange = (key: keyof TableColumnFiltersState, val: string) => {
    setColFilters((prev) => ({ ...prev, [key]: val }));
    if (key === "status") {
      setStatusFilter(val);
    }
  };

  const resetColFilters = () => {
    setColFilters(initialColumnFilters);
    setStatusFilter("");
  };

  const distinctSenders = React.useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.senderName && r.senderName.trim()) set.add(r.senderName.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const activeColFiltersCount = React.useMemo(() => {
    let count = 0;
    if (colFilters.nusuk.trim()) count++;
    if (colFilters.status) count++;
    if (colFilters.sender) count++;
    if (colFilters.departureDate) count++;
    if (colFilters.returnDate) count++;
    if (colFilters.traveler.trim()) count++;
    if (colFilters.hosting && colFilters.hosting !== "ALL") count++;
    return count;
  }, [colFilters]);

  // Read initial search from URL params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("search") || params.get("nusuk") || "";
      if (q) setSearch(q);
      const status = params.get("status");
      if (status) {
        setStatusFilter(status);
        setColFilters((prev) => ({ ...prev, status }));
      }
      const nusukOnly = params.get("nusukOnly");
      if (nusukOnly === "true") setNusukFilter("WITH_NUSUK");
    }
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await api.requests.getAll();
      setRequests(data);
      notificationsService.checkAndGenerateUrgentFlightAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

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
    const isImg =
      docUrl?.startsWith("data:image/") ||
      /\.(jpg|jpeg|png|webp|gif)/i.test(docUrl || "") ||
      title?.includes("صورة") ||
      title?.includes("هوية") ||
      title?.includes("جواز");
    const ext = isImg ? ".jpg" : ".pdf";
    setDocPreviewModal({
      isOpen: true,
      title: title || "معاينة المستند",
      url: docUrl || null,
      loading: !docUrl,
      docId,
      downloadName: (title || "document").replace(/\s+/g, "_") + ext,
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

  // فتح صورة جواز المسافر عند الضغط على رقم الجواز
  const handleViewTravelerPassport = async (
    requestId: string,
    traveler: TravelerSummaryItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (traveler.passportDocumentUrl || traveler.passportDocumentId) {
      handleViewDoc(
        traveler.passportDocumentId,
        traveler.passportDocumentUrl,
        `جواز سفر - ${traveler.fullName}${traveler.passportNumber ? ` (${traveler.passportNumber})` : ""}`,
        e
      );
      return;
    }

    try {
      const fullReq = await api.requests.getById(requestId);
      const passportDoc =
        fullReq.groupDocuments?.find(
          (d) => d.travelerId === traveler.id && d.documentType === "Passport"
        ) ||
        fullReq.travelers
          ?.find((tr) => tr.id === traveler.id)
          ?.documents?.find((d) => d.documentType === "Passport");

      if (passportDoc) {
        handleViewDoc(
          passportDoc.id,
          passportDoc.storageUrl,
          `جواز سفر - ${traveler.fullName}${traveler.passportNumber ? ` (${traveler.passportNumber})` : ""}`,
          e
        );
      } else {
        await alert({
          title: "تنبيه",
          message: `لا توجد صورة جواز سفر مرفوعة للمسافر (${traveler.fullName}) في هذه المعاملة حتى الآن.`,
          variant: "warning",
        });
      }
    } catch (err) {
      console.error("Failed to load traveler passport doc:", err);
      await alert({
        title: "خطأ",
        message: "تعذر فتح صورة الجواز، يرجى المحاولة لاحقاً.",
        variant: "danger",
      });
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
      await downloadFile(url, fileName || "document.pdf");
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

  const hasHostingReq = (r: GroupRequestSummary) =>
    Boolean(r.hasHosting || r.hostName || r.hostNationalId || r.hostIdDocumentId || r.hostIdDocumentUrl);

  const isWaitingHosting = (r: GroupRequestSummary) =>
    r.status === "HostingAcceptanceRequested" || (hasHostingReq(r) && r.status === "ProgramLinked");

  const isReadyForPayment = (r: GroupRequestSummary) =>
    r.status === "HostingAcceptedBySender" ||
    r.status === "HostingConfirmed" ||
    (!hasHostingReq(r) && r.status === "ProgramLinked");

  const renderWorkflowStatusBadge = (r: GroupRequestSummary) => {
    if (r.status === "Completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>مكتملة</span>
        </span>
      );
    }
    if (r.status === "Archived") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
          <Archive className="w-3.5 h-3.5 text-slate-600" />
          <span>مؤرشف</span>
        </span>
      );
    }
    if (isWaitingHosting(r)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>بانتظار قبول الاستضافة</span>
        </span>
      );
    }
    if (isReadyForPayment(r)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>بانتظار دفع الفاتورة</span>
        </span>
      );
    }
    if (role === "SaudiAgent") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>بانتظار ربط البرنامج</span>
        </span>
      );
    }
    return <RequestStatusBadge status={r.status} />;
  };

  const handleLinkProgram = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "SaudiAgent" && role !== "Admin") return;

    try {
      if (hasHostingReq(r)) {
        await api.requests.requestHostingAcceptance(
          r.id,
          "تم ربط البرنامج وتحويل المعاملة للمرسل لقبول الاستضافة"
        );
      } else {
        await api.requests.linkProgram(r.id, "تم ربط البرنامج بنجاح");
      }

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    }
  };

  const handleAcceptHosting = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "Admin" && role !== "Sender") return;

    try {
      await api.requests.acceptHosting(
        r.id,
        role === "Admin"
          ? "تم قبول وتمرير الاستضافة بواسطة إدارة النظام"
          : "تم قبول طلب الاستضافة من قِبل المُرسل"
      );

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    }
  };

  const handlePayInvoice = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "SaudiAgent" && role !== "Admin") return;

    try {
      await api.requests.agentComplete(
        r.id,
        "تم دفع الفاتورة وإصدار كافة التأشيرات والخدمات بنجاح"
      );

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    }
  };

  const handleRevertInvoicePayment = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "Admin") return;

    try {
      const prevStatus = hasHostingReq(r) ? "HostingAcceptedBySender" : "ProgramLinked";
      await api.requests.transition(
        r.id,
        prevStatus,
        "تم التراجع عن دفع الفاتورة بواسطة إدارة النظام"
      );

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    }
  };

  const handleRevertHostingAcceptance = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "Admin") return;

    try {
      await api.requests.transition(
        r.id,
        "HostingAcceptanceRequested",
        "تم التراجع عن قبول الاستضافة بواسطة إدارة النظام"
      );

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    }
  };

  const handleRevertProgramLink = async (r: GroupRequestSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== "Admin") return;

    try {
      await api.requests.transition(
        r.id,
        "ReadyForSaudiAgent",
        "تم التراجع عن ربط البرنامج بواسطة إدارة النظام"
      );

      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
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

  const isRequestOwnedBySender = (r: GroupRequestSummary) => {
    if (!user) return false;
    if (r.senderId && r.senderId === user.id) return true;
    if (r.senderName) {
      const sName = r.senderName.trim().toLowerCase();
      if (user.fullName && sName === user.fullName.trim().toLowerCase()) return true;
      if (user.username && sName === user.username.trim().toLowerCase()) return true;
    }
    return false;
  };

  const roleRequests =
    role === "SaudiAgent"
      ? requests.filter((r) => agentEligibleStatuses.includes(r.status))
      : role === "Sender"
      ? requests.filter(isRequestOwnedBySender)
      : requests;

  // Predicate helpers for clean, role-tailored workflow filter tabs
  const isRequestNew = (r: GroupRequestSummary) =>
    !r.nusukGroupNumber &&
    (r.status === "Draft" ||
      r.status === "Submitted" ||
      r.status === "UnderReview" ||
      r.status === "DocumentsCompleted" ||
      r.status === "CorrectionRequired" ||
      r.status === "MissingDocuments");

  const isRequestTransferredToAgent = (r: GroupRequestSummary) =>
    r.status === "ReadyForSaudiAgent" ||
    r.status === "ReceivedBySaudiAgent" ||
    r.status === "SaudiAgentProcessing" ||
    r.status === "SaudiAgentCorrectionRequired";

  const isRequestProgramLinked = (r: GroupRequestSummary) => isWaitingHosting(r);

  const isRequestHostingAccepted = (r: GroupRequestSummary) => isReadyForPayment(r);

  const isRequestInvoicePaid = (r: GroupRequestSummary) =>
    r.status === "Completed" ||
    ((role === "SafaEmployee" || role === "Admin") &&
      r.status === "SafaRegistrationCompleted");

  // Categorize role requests into Active, Recent Archive (<=30 days past), and Old Archive (>30 days past)
  const activeRoleRequests = roleRequests.filter((r) => getTravelArchiveCategory(r) === "ACTIVE");
  const recentArchivedRequests = roleRequests.filter((r) => getTravelArchiveCategory(r) === "ARCHIVED_RECENT");
  const oldArchivedRequests = roleRequests.filter((r) => getTravelArchiveCategory(r) === "ARCHIVED_OLD");

  // Determine the baseline requests for the current tab (for dynamic status filters)
  const currentTabBaseRequests = React.useMemo(() => {
    if (activeTab === "ARCHIVED") return recentArchivedRequests;
    if (activeTab === "ARCHIVED_OLD") return oldArchivedRequests;
    if (activeTab === "ALL") return roleRequests;
    return activeRoleRequests.filter((r) => {
      if (activeTab === "NEW") return isRequestNew(r);
      if (
        activeTab === "TRANSFERRED_TO_AGENT" ||
        activeTab === "READY_AGENT" ||
        activeTab === "AGENT_INBOX"
      )
        return isRequestTransferredToAgent(r);
      if (activeTab === "PROGRAM_LINKED") return isRequestProgramLinked(r);
      if (activeTab === "HOSTING_ACCEPTED") return isRequestHostingAccepted(r);
      if (activeTab === "INVOICE_PAID" || activeTab === "COMPLETED")
        return isRequestInvoicePaid(r);
      return true;
    });
  }, [activeTab, recentArchivedRequests, oldArchivedRequests, roleRequests, activeRoleRequests]);

  const distinctStatusOptions = React.useMemo(() => {
    return getDistinctStatusOptions(currentTabBaseRequests, role, colFilters.status);
  }, [currentTabBaseRequests, role, colFilters.status]);

  const distinctDepartureDates = React.useMemo(() => {
    return getDistinctDateOptions(currentTabBaseRequests, "departure", colFilters.departureDate);
  }, [currentTabBaseRequests, colFilters.departureDate]);

  const distinctReturnDates = React.useMemo(() => {
    return getDistinctDateOptions(currentTabBaseRequests, "return", colFilters.returnDate);
  }, [currentTabBaseRequests, colFilters.returnDate]);

  // For Safa and Admin who inspect across all requests:
  const activeAllRequests = requests.filter((r) => getTravelArchiveCategory(r) === "ACTIVE");

  const countWithNusuk = activeRoleRequests.filter((r) => Boolean(r.nusukGroupNumber)).length;
  const countWithoutNusuk = activeRoleRequests.length - countWithNusuk;

  // Precomputed tab counts:
  const agentAllCount = roleRequests.length;
  const agentTransferredCount = activeRoleRequests.filter(isRequestTransferredToAgent).length;
  const agentProgramLinkedCount = activeRoleRequests.filter(isRequestProgramLinked).length;
  const agentHostingAcceptedCount = activeRoleRequests.filter(isRequestHostingAccepted).length;
  const agentInvoicePaidCount = activeRoleRequests.filter(isRequestInvoicePaid).length;

  const senderAllCount = roleRequests.length;
  const senderNewCount = activeRoleRequests.filter(isRequestNew).length;
  const senderTransferredCount = activeRoleRequests.filter(isRequestTransferredToAgent).length;
  const senderProgramLinkedCount = activeRoleRequests.filter(isRequestProgramLinked).length;
  const senderHostingAcceptedCount = activeRoleRequests.filter(isRequestHostingAccepted).length;
  const senderInvoicePaidCount = activeRoleRequests.filter(isRequestInvoicePaid).length;

  const adminAllCount = requests.length;
  const adminNewCount = activeAllRequests.filter(isRequestNew).length;
  const adminTransferredCount = activeAllRequests.filter(isRequestTransferredToAgent).length;
  const adminProgramLinkedCount = activeAllRequests.filter(isRequestProgramLinked).length;
  const adminHostingAcceptedCount = activeAllRequests.filter(isRequestHostingAccepted).length;
  const adminInvoicePaidCount = activeAllRequests.filter(isRequestInvoicePaid).length;

  const urgentUpcomingRequests = activeRoleRequests.filter((r) => {
    if (r.status === "Completed" || r.status === "Archived" || r.status === "Cancelled") return false;
    const depDateStr = r.departureDate || r.travelDate;
    if (!depDateStr) return false;
    const depDate = new Date(depDateStr);
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return depDate >= now && depDate <= in48Hours;
  });

  const filtered = roleRequests.filter((r) => {
    if (!matchesRequestSearch(r, search)) return false;

    // Interactive Column Filters
    if (!matchesColumnFilters(r, colFilters)) return false;

    if (nusukFilter === "WITH_NUSUK" && !r.nusukGroupNumber) return false;
    if (nusukFilter === "WITHOUT_NUSUK" && r.nusukGroupNumber) return false;

    // Optional granular status dropdown filter
    if (statusFilter && r.status !== statusFilter) return false;

    // ALL tab includes all transactions (new, transferred, linked, accepted, completed, archived)
    if (activeTab === "ALL") return true;

    const category = getTravelArchiveCategory(r);

    // Two-tier archive system
    if (activeTab === "ARCHIVED") {
      return category === "ARCHIVED_RECENT";
    }
    if (activeTab === "ARCHIVED_OLD") {
      return category === "ARCHIVED_OLD";
    }

    // All active tabs: only ACTIVE transactions appear
    if (category !== "ACTIVE") {
      return false;
    }

    if (activeTab === "NEW") return isRequestNew(r);
    if (
      activeTab === "TRANSFERRED_TO_AGENT" ||
      activeTab === "READY_AGENT" ||
      activeTab === "AGENT_INBOX"
    )
      return isRequestTransferredToAgent(r);
    if (activeTab === "PROGRAM_LINKED") return isRequestProgramLinked(r);
    if (activeTab === "HOSTING_ACCEPTED") return isRequestHostingAccepted(r);
    if (activeTab === "INVOICE_PAID" || activeTab === "COMPLETED")
      return isRequestInvoicePaid(r);

    return true;
  });

  return (
    <div className="space-y-6 w-full">
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

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/reports/sender"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm transition-all cursor-pointer"
            title="تقرير المعتمرين والمناديب وتصدير إكسيل"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تقرير المعتمرين والمناديب</span>
          </Link>

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
      </div>

      {/* Urgent Upcoming Flights Alert Banner (within 48 hours) */}
      {urgentUpcomingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-orange-500/10 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-950 flex items-center gap-2">
                <span>تنبيه رحلات طيران عاجلة خلال 48 ساعة</span>
                <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {urgentUpcomingRequests.length} معاملات
                </span>
              </h4>
              <p className="text-xs text-rose-800 mt-0.5">
                هناك رحلات سفر قريبة جداً! يرجى سرعة تدقيق المستندات، إصدار رقم نسك، وتأكيد الاستضافة قبل موعد الإقلاع.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {urgentUpcomingRequests.slice(0, 4).map((ur) => (
              <button
                key={ur.id}
                type="button"
                onClick={() => setSearch(ur.requestNumber)}
                className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="تصفية هذه المعاملة العاجلة"
              >
                <span>{ur.requestNumber}</span>
                <span className="text-[10px] text-gray-500 font-normal">({ur.travelersCount} مسافر)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        {/* Role Specific Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-100 scrollbar-none">
          {role === "SaudiAgent" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("TRANSFERRED_TO_AGENT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "TRANSFERRED_TO_AGENT"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار ربط البرنامج ({agentTransferredCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROGRAM_LINKED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "PROGRAM_LINKED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار قبول الاستضافة ({agentProgramLinkedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("HOSTING_ACCEPTED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "HOSTING_ACCEPTED"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار دفع الفاتورة ({agentHostingAcceptedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("INVOICE_PAID")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "INVOICE_PAID"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مكتملة ({agentInvoicePaidCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف ({recentArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED_OLD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED_OLD"
                    ? "bg-stone-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف القديم ({oldArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0 sm:ms-auto ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({agentAllCount})
              </button>
            </>
          )}

          {role === "Sender" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                جديد ({senderNewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TRANSFERRED_TO_AGENT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "TRANSFERRED_TO_AGENT"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار ربط البرنامج ({senderTransferredCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROGRAM_LINKED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "PROGRAM_LINKED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار قبول الاستضافة ({senderProgramLinkedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("HOSTING_ACCEPTED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "HOSTING_ACCEPTED"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار دفع الفاتورة ({senderHostingAcceptedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("INVOICE_PAID")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "INVOICE_PAID"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مكتملة ({senderInvoicePaidCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف ({recentArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED_OLD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED_OLD"
                    ? "bg-stone-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف القديم ({oldArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0 sm:ms-auto ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({senderAllCount})
              </button>
            </>
          )}

          {(role === "SafaEmployee" || role === "Admin") && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("NEW")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "NEW"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                جديد ({adminNewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TRANSFERRED_TO_AGENT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "TRANSFERRED_TO_AGENT"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار ربط البرنامج ({adminTransferredCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROGRAM_LINKED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "PROGRAM_LINKED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار قبول الاستضافة ({adminProgramLinkedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("HOSTING_ACCEPTED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "HOSTING_ACCEPTED"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                بانتظار دفع الفاتورة ({adminHostingAcceptedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("INVOICE_PAID")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "INVOICE_PAID"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                مكتملة ({adminInvoicePaidCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف ({recentArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED_OLD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED_OLD"
                    ? "bg-stone-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف القديم ({oldArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0 sm:ms-auto ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({adminAllCount})
              </button>
            </>
          )}

          {(!role || !["SaudiAgent", "SafaEmployee", "Sender", "Admin"].includes(role)) && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف ({recentArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVED_OLD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ARCHIVED_OLD"
                    ? "bg-stone-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الأرشيف القديم ({oldArchivedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0 sm:ms-auto ${
                  activeTab === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                الكل ({roleRequests.length})
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Main Search Input with Nusuk support */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم أي مسافر، رقم الجواز، رقم نسك، اسم المجموعة، أو الهاتف..."
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

        </div>

        {/* Active Column Filters Banner */}
        {activeColFiltersCount > 0 && (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
            <div className="flex items-center gap-2 font-bold">
              <Filter className="w-4 h-4 text-sky-600" />
              <span>فلاتر أعمدة الجدول مفعلة ({activeColFiltersCount} عمود مُفلتر)</span>
            </div>
            <button
              type="button"
              onClick={resetColFilters}
              className="text-rose-700 hover:text-rose-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer text-[11px] shadow-2xs"
            >
              إلغاء فلاتر الأعمدة ↺
            </button>
          </div>
        )}

        {search && (
          <div className="pt-1 text-xs">
            <span className="text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md font-medium">
              نتائج البحث عن: &quot;{search}&quot; ({filtered.length})
            </span>
          </div>
        )}
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
          {(search || statusFilter || nusukFilter !== "ALL" || activeColFiltersCount > 0) && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setNusukFilter("ALL");
                resetColFilters();
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
              const isCompleted = r.status === "Completed" || r.status === "Archived";
              const matchingTravelers = getMatchingTravelers(r, search);
              const isTravelerMatched = Boolean(search.trim()) && matchingTravelers.length > 0;
              const currentMobileTab = mobileCardTab[r.id] ?? (isTravelerMatched ? "travelers" : "host");
              const reqTravelers =
                r.travelersList && r.travelersList.length > 0
                  ? r.travelersList
                  : [{ id: `fb-${r.id}`, fullName: r.groupName || "المعتمر", photoUrl: undefined }];
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
                      {renderWorkflowStatusBadge(r)}
                    </div>
                  </div>

                  {/* إشعار مسافر مطابق للبحث */}
                  {isTravelerMatched && (
                    <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-900 px-2.5 py-1 rounded-xl text-xs font-bold">
                      <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="text-[11px] text-purple-700 shrink-0">مسافر مطابق:</span>
                      <span className="truncate text-purple-950 font-extrabold">
                        {matchingTravelers.map((t) => t.fullName).join("، ")}
                      </span>
                    </div>
                  )}

                  {/* شريط المرسل والإسناد لموظف صفا والأدمن فقط */}
                  {(role === "SafaEmployee" || role === "Admin") && (
                    <div className="flex items-center justify-between gap-2 bg-blue-50/50 border border-blue-200/70 px-2.5 py-1 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] text-blue-600 font-bold shrink-0">المرسل:</span>
                        <span className="font-bold text-gray-900 text-xs truncate" title={r.senderName || "غير محدد"}>
                          {r.senderName || "غير محدد"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {r.senderName && r.senderName.trim() ? (
                            r.senderName.trim().charAt(0)
                          ) : (
                            <User className="w-3 h-3 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                            <span>{r.saudiArrivalTime || "--:--"}</span>
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
                            <span>{r.returnFlightDepartureTime || "--:--"}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-gray-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate">{r.returnDate ? formatDayMonth(r.returnDate) : "لم يُحدد"}</span>
                        </div>
                      </div>
                    </div>

                    {/* الجزء الأيسر: بيانات المسافرين لمرسل المعاملات، أو بيانات المستضيف للوكيل السعودي، أو كلاهما عبر تبديل سريع للأدمن وموظف صفا */}
                    {role === "Sender" ? (
                      <div className="bg-purple-50/40 border border-purple-200/80 rounded-xl p-2.5 flex flex-col justify-center text-xs overflow-hidden">
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
                          {reqTravelers.map((t, idx) => {
                            const isThisMatched = isTravelerMatch(t, search);
                            return (
                              <div
                                key={t.id || idx}
                                className={`flex items-center gap-2 min-w-0 p-1 rounded-lg transition-colors ${
                                  isThisMatched ? "bg-purple-100 ring-2 ring-purple-400" : ""
                                }`}
                              >
                                {t.photoUrl ? (
                                  <img
                                    src={t.photoUrl}
                                    alt={t.fullName}
                                    onClick={(e) => handleViewDoc(undefined, t.photoUrl, `صورة المسافر - ${t.fullName}`, e)}
                                    className="w-8 h-8 rounded-full object-cover border border-purple-300 shrink-0 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
                                    title="معاينة الصورة"
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
                                    className={`text-xs block truncate leading-tight ${
                                      isThisMatched ? "font-black text-purple-950" : "font-bold text-gray-900"
                                    }`}
                                    title={t.fullName}
                                  >
                                    {t.fullName}
                                  </span>
                                  {t.passportNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleViewTravelerPassport(r.id, t, e)}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer transition-colors mt-0.5"
                                      title="اضغط لمعاينة صورة الجواز المرفوعة"
                                    >
                                      <FileText className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                      <span dir="ltr">{t.passportNumber}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : role === "SaudiAgent" ? (
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
                    ) : (
                      /* موظف صفا والأدمن: تبديل بين المستضيف والمسافرين للحفاظ تماماً على نفس أبعاد الصندوق على الموبايل */
                      <div className="bg-amber-50/20 border border-amber-200/80 rounded-xl p-2 flex flex-col justify-between text-xs overflow-hidden">
                        {/* التبديل العلوي */}
                        <div className="flex items-center bg-gray-100/90 p-0.5 rounded-lg mb-1.5 shrink-0 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMobileCardTab((prev) => ({ ...prev, [r.id]: "host" }));
                            }}
                            className={`flex-1 py-0.5 text-center rounded-md transition-all cursor-pointer ${
                              currentMobileTab === "host"
                                ? "bg-white text-amber-900 shadow-2xs font-extrabold"
                                : "text-gray-500 hover:text-gray-800"
                            }`}
                          >
                            المستضيف
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMobileCardTab((prev) => ({ ...prev, [r.id]: "travelers" }));
                            }}
                            className={`flex-1 py-0.5 text-center rounded-md transition-all cursor-pointer ${
                              currentMobileTab === "travelers"
                                ? "bg-purple-600 text-white shadow-2xs font-extrabold"
                                : "text-gray-500 hover:text-gray-800"
                            }`}
                          >
                            المسافرين ({reqTravelers.length})
                          </button>
                        </div>

                        {currentMobileTab === "travelers" ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5 flex-1">
                            {reqTravelers.map((t, idx) => {
                              const isThisMatched = isTravelerMatch(t, search);
                              return (
                                <div
                                  key={t.id || idx}
                                  className={`flex items-center gap-1.5 min-w-0 p-1 rounded-lg transition-colors ${
                                    isThisMatched ? "bg-purple-100 ring-2 ring-purple-400" : ""
                                  }`}
                                >
                                  {t.photoUrl ? (
                                    <img
                                      src={t.photoUrl}
                                      alt={t.fullName}
                                      onClick={(e) => handleViewDoc(undefined, t.photoUrl, `صورة المسافر - ${t.fullName}`, e)}
                                      className="w-7 h-7 rounded-full object-cover border border-purple-300 shrink-0 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
                                      title="معاينة الصورة"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs">
                                      {t.fullName && t.fullName.trim() ? (
                                        t.fullName.trim().charAt(0)
                                      ) : (
                                        <User className="w-3.5 h-3.5 text-purple-600" />
                                      )}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`text-[11px] block truncate leading-tight ${
                                        isThisMatched ? "font-black text-purple-950" : "font-bold text-gray-900"
                                      }`}
                                      title={t.fullName}
                                    >
                                      {t.fullName}
                                    </span>
                                    {t.passportNumber && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleViewTravelerPassport(r.id, t, e)}
                                        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer transition-colors mt-0.5"
                                        title="اضغط لمعاينة صورة الجواز المرفوعة"
                                      >
                                        <FileText className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                        <span dir="ltr">{t.passportNumber}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1 flex-1 flex flex-col justify-between">
                            {/* 1. رقم الهوية + نسخ */}
                            <div className="flex items-center justify-between gap-1 border-b border-amber-100/70 pb-0.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] text-gray-500 block leading-tight">الهوية:</span>
                                <span className="font-mono font-bold text-gray-900 text-[10.5px] truncate block" dir="ltr">
                                  {r.hostNationalId || "-"}
                                </span>
                              </div>
                              {r.hostNationalId && (
                                <button
                                  type="button"
                                  onClick={(e) => copyText(r.hostNationalId!, `m-hostId-${r.id}`, e)}
                                  className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer shrink-0"
                                  title="نسخ رقم الهوية"
                                >
                                  {copiedKey === `m-hostId-${r.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* 2. تاريخ ميلاد المستضيف + نسخ */}
                            <div className="flex items-center justify-between gap-1 border-b border-amber-100/70 pb-0.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] text-gray-500 block leading-tight">الميلاد:</span>
                                <span className="font-mono font-bold text-gray-900 text-[10.5px] truncate block" dir="ltr">
                                  {r.hostBirthDate || "-"}
                                </span>
                              </div>
                              {r.hostBirthDate && (
                                <button
                                  type="button"
                                  onClick={(e) => copyText(r.hostBirthDate!, `m-hostBirth-${r.id}`, e)}
                                  className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer shrink-0"
                                  title="نسخ تاريخ الميلاد"
                                >
                                  {copiedKey === `m-hostBirth-${r.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* 3. تليفون المستضيف + نسخ */}
                            <div className="flex items-center justify-between gap-1 border-b border-amber-100/70 pb-0.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] text-gray-500 block leading-tight">الهاتف:</span>
                                <span className="font-mono font-bold text-gray-900 text-[10.5px] truncate block" dir="ltr">
                                  {r.hostPhone || (r.hasHosting ? r.contactPhone : "-")}
                                </span>
                              </div>
                              {(r.hostPhone || (r.hasHosting && r.contactPhone)) && (
                                <button
                                  type="button"
                                  onClick={(e) => copyText(r.hostPhone || r.contactPhone, `m-hostPhone-${r.id}`, e)}
                                  className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer shrink-0"
                                  title="نسخ رقم الهاتف"
                                >
                                  {copiedKey === `m-hostPhone-${r.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* 4. اسم المستضيف + نسخ */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] text-gray-500 block leading-tight">الاسم:</span>
                                <span className="font-bold text-gray-900 text-[10.5px] truncate block">
                                  {r.hostName || "-"}
                                </span>
                              </div>
                              {r.hostName && (
                                <button
                                  type="button"
                                  onClick={(e) => copyText(r.hostName!, `m-hostName-${r.id}`, e)}
                                  className="text-gray-400 hover:text-amber-700 p-0.5 cursor-pointer shrink-0"
                                  title="نسخ اسم المستضيف"
                                >
                                  {copiedKey === `m-hostName-${r.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* الشريط السفلي: تذكرة جنبها الهوية جنبها تم والأزرار */}
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

                    {/* أزرار الإجراءات */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {role === "Sender" && isWaitingHosting(r) && (
                        <button
                          type="button"
                          onClick={(e) => handleAcceptHosting(r, e)}
                          className="px-3.5 py-1.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                          title="تأكيد قبول الاستضافة"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>تم قبول الاستضافة</span>
                        </button>
                      )}

                      {role === "SaudiAgent" && (
                        r.status === "Archived" ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap">
                            <Archive className="w-3 h-3 text-purple-600" />
                            <span>مؤرشفة</span>
                          </span>
                        ) : r.status === "Completed" ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap">
                              <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                              <span>مكتملة (تم)</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                              className="px-2 py-1 text-[11px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              title="نقل المعاملة إلى الأرشيف"
                            >
                              <Archive className="w-3 h-3 text-stone-600" />
                              <span>أرشفة</span>
                            </button>
                          </div>
                        ) : isWaitingHosting(r) ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>بانتظار قبول الاستضافة ⏳</span>
                          </span>
                        ) : isReadyForPayment(r) ? (
                          <button
                            type="button"
                            onClick={(e) => handlePayInvoice(r, e)}
                            className="px-3.5 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                            title="تأكيد دفع الفاتورة واكتمال المعاملة"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>تم دفع الفاتورة</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleLinkProgram(r, e)}
                            className="px-3.5 py-1.5 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                            title="تأكيد ربط البرنامج"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>تم ربط برنامج</span>
                          </button>
                        )
                      )}

                      {role === "Admin" && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.status === "Archived" ? (
                            <button
                              type="button"
                              onClick={(e) => handleAdminUnarchive(r.id, e)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              title="إلغاء الأرشفة"
                            >
                              <Archive className="w-3.5 h-3.5 text-amber-600" />
                              <span>استعادة</span>
                            </button>
                          ) : r.status === "Completed" ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                <span>مكتملة</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleRevertInvoicePayment(r, e)}
                                className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                title="تراجع عن دفع الفاتورة وإعادة المعاملة لانتظار الدفع"
                              >
                                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                                <span>تراجع عن الدفع</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                                className="px-2 py-1 text-[11px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                                title="نقل المعاملة إلى الأرشيف"
                              >
                                <Archive className="w-3 h-3 text-stone-600" />
                                <span>أرشفة</span>
                              </button>
                            </div>
                          ) : isWaitingHosting(r) ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleAcceptHosting(r, e)}
                                className="px-2.5 py-1 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                title="تمرير وقبول الاستضافة"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>تم قبول الاستضافة</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRevertProgramLink(r, e)}
                                className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار الربط"
                              >
                                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                                <span>تراجع عن الربط</span>
                              </button>
                            </div>
                          ) : isReadyForPayment(r) ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handlePayInvoice(r, e)}
                                className="px-2.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                title="تأكيد دفع الفاتورة واكتمال المعاملة"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>دفع الفاتورة</span>
                              </button>
                              {hasHostingReq(r) ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleRevertHostingAcceptance(r, e)}
                                  className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                  title="تراجع عن قبول الاستضافة وإعادة المعاملة لانتظار قبول الاستضافة"
                                >
                                  <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                                  <span>تراجع عن الاستضافة</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleRevertProgramLink(r, e)}
                                  className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                  title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار الربط"
                                >
                                  <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                                  <span>تراجع عن الربط</span>
                                </button>
                              )}
                            </div>
                          ) : isRequestNew(r) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNusukModalRequest(r);
                              }}
                              className="px-2.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                              title="اعتماد رقم نسك وتحويل المعاملة للوكيل السعودي وإرسالها للواتس"
                            >
                              <Building className="w-3.5 h-3.5" />
                              <span>اعتماد رقم نسك</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleLinkProgram(r, e)}
                              className="px-2.5 py-1 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                              title="تأكيد ربط البرنامج"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>تم ربط برنامج</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleAdminDelete(r.id, r.requestNumber, e)}
                            className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer transition-colors shrink-0"
                            title="مسح المعاملة نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/requests/${r.id}`);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                        title="عرض تفاصيل المعاملة"
                      >
                        <span>عرض</span>
                        <ArrowRight className="w-3 h-3 rotate-180" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (صفحات الكمبيوتر) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-700 font-bold">
                  <tr>
                    {/* 1. رقم مجموعة نسك */}
                    <th className="py-3 px-3">
                      <div className="flex items-center justify-between gap-1.5">
                        <span>رقم مجموعة نسك</span>
                        <HeaderColumnFilter
                          title="رقم نسك"
                          type="text"
                          value={colFilters.nusuk}
                          onChange={(v) => handleColFilterChange("nusuk", v)}
                          onClear={() => handleColFilterChange("nusuk", "")}
                          placeholder="بحث برقم نسك..."
                          align="right"
                        />
                      </div>
                    </th>

                    {/* 2. الحالة */}
                    <th className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>الحالة</span>
                        <HeaderColumnFilter
                          title="الحالة"
                          type="select"
                          value={colFilters.status}
                          onChange={(v) => handleColFilterChange("status", v)}
                          onClear={() => handleColFilterChange("status", "")}
                          options={distinctStatusOptions}
                          align="right"
                        />
                      </div>
                    </th>

                    {/* 3. المرسل */}
                    {(role === "SafaEmployee" || role === "Admin") && (
                      <th className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>المرسل</span>
                          <HeaderColumnFilter
                            title="المرسل"
                            type="select"
                            value={colFilters.sender}
                            onChange={(v) => handleColFilterChange("sender", v)}
                            onClear={() => handleColFilterChange("sender", "")}
                            options={[
                              { value: "", label: `جميع المرسلين (${distinctSenders.length})` },
                              ...distinctSenders.map((s) => ({ value: s, label: s })),
                            ]}
                            align="right"
                          />
                        </div>
                      </th>
                    )}

                    {/* 4. رحلة الذهاب */}
                    <th className="py-3 px-3">
                      <div className="flex items-center justify-between gap-1.5">
                        <span>رحلة الذهاب</span>
                        <HeaderColumnFilter
                          title="تاريخ الذهاب"
                          type="date"
                          value={colFilters.departureDate}
                          onChange={(v) => handleColFilterChange("departureDate", v)}
                          onClear={() => handleColFilterChange("departureDate", "")}
                          options={distinctDepartureDates}
                          align="right"
                        />
                      </div>
                    </th>

                    {/* 5. رحلة العودة */}
                    <th className="py-3 px-3">
                      <div className="flex items-center justify-between gap-1.5">
                        <span>رحلة العودة</span>
                        <HeaderColumnFilter
                          title="تاريخ العودة"
                          type="date"
                          value={colFilters.returnDate}
                          onChange={(v) => handleColFilterChange("returnDate", v)}
                          onClear={() => handleColFilterChange("returnDate", "")}
                          options={distinctReturnDates}
                          align="right"
                        />
                      </div>
                    </th>

                    {/* 6. بيانات المسافرين */}
                    {(role === "Sender" || role === "SafaEmployee" || role === "Admin") && (
                      <th className="py-3 px-3">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>بيانات المسافرين</span>
                          <HeaderColumnFilter
                            title="المسافرين"
                            type="text"
                            value={colFilters.traveler}
                            onChange={(v) => handleColFilterChange("traveler", v)}
                            onClear={() => handleColFilterChange("traveler", "")}
                            placeholder="اسم المعتمر / الجواز..."
                            align="right"
                          />
                        </div>
                      </th>
                    )}

                    {/* 7. بيانات المستضيف */}
                    {(role === "SaudiAgent" || role === "SafaEmployee" || role === "Admin") && (
                      <th className="py-3 px-3">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>بيانات المستضيف</span>
                          <HeaderColumnFilter
                            title="المستضيف"
                            type="select"
                            value={colFilters.hosting}
                            onChange={(v) => handleColFilterChange("hosting", v)}
                            onClear={() => handleColFilterChange("hosting", "ALL")}
                            options={HOSTING_OPTIONS}
                            align="left"
                          />
                        </div>
                      </th>
                    )}

                    {/* 8. المستندات والإجراء */}
                    <th className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>المستندات والإجراء</span>
                        {activeColFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={resetColFilters}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg cursor-pointer transition-colors shadow-2xs"
                            title="مسح جميع فلاتر الأعمدة"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>مسح ({activeColFiltersCount})</span>
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r, rIdx) => {
                    const isCompleted = r.status === "Completed" || r.status === "Archived";
                    const isNusukMatch =
                      Boolean(search.trim()) &&
                      Boolean(r.nusukGroupNumber) &&
                      r.nusukGroupNumber!.toLowerCase().includes(search.trim().toLowerCase());
                    const matchingTravelers = getMatchingTravelers(r, search);
                    const isTravelerMatched = Boolean(search.trim()) && matchingTravelers.length > 0;
                    const reqTravelers =
                      r.travelersList && r.travelersList.length > 0
                        ? r.travelersList
                        : [{ id: `fb-${r.id}`, fullName: r.groupName || "المعتمر", photoUrl: undefined }];

                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        } hover:bg-sky-50/30`}
                      >
                        {/* 1. رقم مجموعة نسك */}
                        <td className="py-2.5 px-3 align-middle border-l border-gray-100 font-mono">
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
                          {isTravelerMatched && (
                            <div
                              className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 max-w-[170px] truncate"
                              title={`مسافر مطابق: ${matchingTravelers.map((t) => t.fullName).join("، ")}`}
                            >
                              <Users className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                              <span className="truncate">{matchingTravelers[0].fullName}</span>
                              {matchingTravelers.length > 1 && (
                                <span className="text-[9px] font-extrabold text-purple-700 shrink-0">
                                  +{matchingTravelers.length - 1}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 2. الحالة: تم الاستلام أو (تم) أو شارة الحالة */}
                        <td className="py-2.5 px-2 align-middle text-center border-l border-gray-100">
                          {renderWorkflowStatusBadge(r)}
                        </td>

                        {/* 2.5 المرسل (لموظف صفا والأدمن فقط) */}
                        {(role === "SafaEmployee" || role === "Admin") && (
                          <td className="py-2.5 px-2 align-middle text-center border-l border-gray-100">
                            <div className="flex flex-col items-center gap-1 max-w-[140px] mx-auto">
                              <div className="inline-flex items-center gap-1.5 bg-blue-50/60 border border-blue-200/80 px-2 py-1 rounded-xl shadow-2xs w-full">
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {r.senderName && r.senderName.trim() ? (
                                    r.senderName.trim().charAt(0)
                                  ) : (
                                    <User className="w-3 h-3 text-blue-600" />
                                  )}
                                </div>
                                <span
                                  className="font-bold text-blue-950 text-xs truncate block"
                                  title={r.senderName || "غير محدد"}
                                >
                                  {r.senderName || "غير محدد"}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 3. رحلة الذهاب */}
                        <td className="py-2.5 px-3 align-middle border-l border-gray-100">
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
                                {r.saudiArrivalTime || "--:--"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 4. رحلة العودة */}
                        <td className="py-2.5 px-3 align-middle border-l border-gray-100">
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
                                {r.returnFlightDepartureTime || "--:--"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 5. عمود بيانات المسافرين (للمرسل ولموظف صفا وللأدمن) */}
                        {(role === "Sender" || role === "SafaEmployee" || role === "Admin") && (
                          <td className="py-2.5 px-3 align-middle border-l border-gray-100">
                            <div className="bg-purple-50/40 border border-purple-200/80 rounded-xl p-2 min-w-[170px] max-w-xs space-y-1.5 max-h-44 overflow-y-auto">
                              {reqTravelers.map((t, idx) => {
                                const isThisMatched = isTravelerMatch(t, search);
                                return (
                                  <div
                                    key={t.id || idx}
                                    className={`flex items-center gap-2.5 min-w-0 p-1 rounded-lg transition-colors ${
                                      isThisMatched ? "bg-purple-100 ring-2 ring-purple-400" : ""
                                    }`}
                                  >
                                    {t.photoUrl ? (
                                      <img
                                        src={t.photoUrl}
                                        alt={t.fullName}
                                        onClick={(e) => handleViewDoc(undefined, t.photoUrl, `صورة المسافر - ${t.fullName}`, e)}
                                        className="w-9 h-9 rounded-full object-cover border border-purple-300 shrink-0 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
                                        title="معاينة الصورة"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                        {t.fullName && t.fullName.trim() ? (
                                          t.fullName.trim().charAt(0)
                                        ) : (
                                          <User className="w-4 h-4 text-purple-600" />
                                        )}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={`text-xs block truncate leading-tight ${
                                          isThisMatched ? "font-black text-purple-950" : "font-bold text-gray-900"
                                        }`}
                                        title={t.fullName}
                                      >
                                        {t.fullName}
                                      </span>
                                      {t.passportNumber && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleViewTravelerPassport(r.id, t, e)}
                                          className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer transition-colors mt-0.5 group/pass"
                                          title="اضغط لمعاينة صورة الجواز المرفوعة"
                                        >
                                          <FileText className="w-3 h-3 text-sky-600 group-hover/pass:text-sky-800 shrink-0" />
                                          <span dir="ltr">{t.passportNumber}</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        )}

                        {/* 6. عمود بيانات المستضيف (للوكيل السعودي ولموظف صفا وللأدمن) */}
                        {(role === "SaudiAgent" || role === "SafaEmployee" || role === "Admin") && (
                          <td className="py-2.5 px-3 align-middle border-l border-gray-100">
                            <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-2 text-[11px] space-y-1 min-w-[170px] max-w-xs">
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
                        )}

                        {/* 6. المستندات والإجراء: تذكرة جنبها الهوية جنبها الأزرار */}
                        <td className="py-2.5 px-3 align-middle text-center">
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

                            {/* أزرار الإجراء بحسب الدور */}
                            {role === "Sender" && isWaitingHosting(r) && (
                              <button
                                type="button"
                                onClick={(e) => handleAcceptHosting(r, e)}
                                className="px-3.5 py-1.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 border border-amber-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                title="تأكيد قبول الاستضافة"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>تم قبول الاستضافة</span>
                              </button>
                            )}

                            {role === "SaudiAgent" && (
                              r.status === "Archived" ? (
                                <span className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                  <Archive className="w-3.5 h-3.5 text-purple-600" />
                                  <span>مؤرشفة</span>
                                </span>
                              ) : r.status === "Completed" ? (
                                <div className="flex items-center gap-1">
                                  <span className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    <span>مكتملة (تم)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                                    className="px-2 py-1 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                                    title="نقل المعاملة إلى الأرشيف"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-stone-600" />
                                    <span>أرشفة</span>
                                  </button>
                                </div>
                              ) : isWaitingHosting(r) ? (
                                <span className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>بانتظار قبول الاستضافة ⏳</span>
                                </span>
                              ) : isReadyForPayment(r) ? (
                                <button
                                  type="button"
                                  onClick={(e) => handlePayInvoice(r, e)}
                                  className="px-3.5 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                  title="تأكيد دفع الفاتورة واكتمال المعاملة"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>تم دفع الفاتورة</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleLinkProgram(r, e)}
                                  className="px-3.5 py-1.5 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 border border-purple-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                  title="تأكيد ربط البرنامج"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>تم ربط برنامج</span>
                                </button>
                              )
                            )}

                            {role === "Admin" && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {r.status === "Archived" ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAdminUnarchive(r.id, e)}
                                    className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                                    title="إلغاء الأرشفة"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                                    <span>استعادة</span>
                                  </button>
                                ) : r.status === "Completed" ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="px-2 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                      <span>مكتملة</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleRevertInvoicePayment(r, e)}
                                      className="px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                      title="تراجع عن دفع الفاتورة وإعادة المعاملة لانتظار الدفع"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>تراجع عن الدفع</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleAgentArchive(r.id, r.requestNumber, e)}
                                      className="px-2 py-1 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                                      title="نقل المعاملة إلى الأرشيف"
                                    >
                                      <Archive className="w-3.5 h-3.5 text-stone-600" />
                                      <span>أرشفة</span>
                                    </button>
                                  </div>
                                ) : isWaitingHosting(r) ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={(e) => handleAcceptHosting(r, e)}
                                      className="px-2.5 py-1 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 border border-amber-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                      title="تمرير وقبول الاستضافة"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>تم قبول الاستضافة</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleRevertProgramLink(r, e)}
                                      className="px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                      title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار الربط"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>تراجع عن الربط</span>
                                    </button>
                                  </div>
                                ) : isReadyForPayment(r) ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={(e) => handlePayInvoice(r, e)}
                                      className="px-2.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                      title="تأكيد دفع الفاتورة واكتمال المعاملة"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>دفع الفاتورة</span>
                                    </button>
                                    {hasHostingReq(r) ? (
                                      <button
                                        type="button"
                                        onClick={(e) => handleRevertHostingAcceptance(r, e)}
                                        className="px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                        title="تراجع عن قبول الاستضافة وإعادة المعاملة لانتظار قبول الاستضافة"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>تراجع عن الاستضافة</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => handleRevertProgramLink(r, e)}
                                        className="px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                        title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار الربط"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>تراجع عن الربط</span>
                                      </button>
                                    )}
                                  </div>
                                ) : isRequestNew(r) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNusukModalRequest(r);
                                    }}
                                    className="px-2.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                    title="اعتماد رقم نسك وتحويل المعاملة للوكيل السعودي وإرسالها للواتس"
                                  >
                                    <Building className="w-3.5 h-3.5" />
                                    <span>اعتماد رقم نسك</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleLinkProgram(r, e)}
                                    className="px-2.5 py-1 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 border border-purple-600 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs hover:shadow-sm active:scale-95 whitespace-nowrap"
                                    title="تأكيد ربط البرنامج"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>تم ربط برنامج</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => handleAdminDelete(r.id, r.requestNumber, e)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer transition-colors shrink-0"
                                  title="مسح المعاملة نهائياً"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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

      {/* Smart WhatsApp Integration Modal */}
      {whatsAppModalRequest && (
        <WhatsAppModal
          isOpen={!!whatsAppModalRequest}
          onClose={() => setWhatsAppModalRequest(null)}
          request={whatsAppModalRequest}
        />
      )}

      {/* Nusuk Approval & WhatsApp Auto-Send Modal */}
      <NusukApprovalModal
        isOpen={Boolean(nusukModalRequest)}
        onClose={() => setNusukModalRequest(null)}
        request={nusukModalRequest}
        currentUser={user}
        onSuccess={async (msg) => {
          await alert({
            title: "نجاح",
            message: msg || "تم اعتماد رقم نسك بنجاح",
            variant: "success",
          });
          loadRequests();
        }}
      />
    </div>
  );
}
