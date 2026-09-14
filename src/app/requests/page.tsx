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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/dialog-context";

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
  const [copiedNusuk, setCopiedNusuk] = useState<string | null>(null);

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

    // تنسيق رقم الهاتف الدولي
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("00")) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.startsWith("05") && cleanPhone.length === 10) {
      cleanPhone = "966" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("5") && cleanPhone.length === 9) {
      cleanPhone = "966" + cleanPhone;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const filtered = requests.filter((r) => {
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

    if (nusukFilter === "WITH_NUSUK") return Boolean(r.nusukGroupNumber);
    if (nusukFilter === "WITHOUT_NUSUK") return !r.nusukGroupNumber;

    return true;
  });

  const countWithNusuk = requests.filter((r) => Boolean(r.nusukGroupNumber)).length;
  const countWithoutNusuk = requests.length - countWithNusuk;

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
              <option value="">جميع الحالات</option>
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
            الكل ({requests.length})
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
          {/* Mobile Cards View (phones) - بناءً على الرسم التخطيطي المطلوب */}
          <div className="block md:hidden space-y-3">
            {filtered.map((r) => {
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

                    {/* المستطيل فوق على الشمال: حالة المجموعة + أزرار الأدمن إن وجدت */}
                    <div className="flex items-center gap-1.5">
                      <RequestStatusBadge status={r.status} />
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

          {/* Desktop Table View with Merged Rows for Travelers */}
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
                                  <RequestStatusBadge status={r.status} />
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
      )}
    </div>
  );
}
