"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary } from "@/types";
import { RequestStatusBadge } from "@/components/ui/StatusBadge";
import { RequestLifecycleTimer } from "@/components/ui/RequestLifecycleTimer";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RequestsListPage() {
  const { user, role } = useAuth();
  const router = useRouter();
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
    if (!confirm("هل أنت متأكد من رغبتك في أرشفة هذه المعاملة؟")) return;
    try {
      await api.requests.archive(id, "أرشفة يدوية بواسطة مدير النظام");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleAdminUnarchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل ترغب في إلغاء أرشفة هذه المعاملة واستعادتها للحالة النشطة؟")) return;
    try {
      await api.requests.unarchive(id);
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleAdminDelete = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmation = prompt(
      `تحذير أمني: أنت على وشك مسح المعاملة (${reqNumber}) وكافة وثائقها نهائياً!\nللتأكيد النهائي، اكتب (حذف) أو (delete):`
    );
    if (!confirmation || (confirmation.trim() !== "حذف" && confirmation.trim().toLowerCase() !== "delete")) {
      return;
    }
    try {
      await api.requests.delete(id);
      alert("تم حذف المعاملة بالكامل بنجاح.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const filtered = requests.filter((r) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      r.groupName.toLowerCase().includes(term) ||
      r.requestNumber.toLowerCase().includes(term) ||
      (r.nusukGroupNumber && r.nusukGroupNumber.toLowerCase().includes(term)) ||
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
          {/* Mobile Cards View (phones) */}
          <div className="block md:hidden space-y-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                      {r.requestNumber}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 mt-1.5">{r.groupName}</h3>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </div>

                {/* Prominent Nusuk Bar on Phone */}
                <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
                  <span className="text-gray-500 font-medium flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رقم مجموعة نسك:</span>
                  </span>
                  {r.nusukGroupNumber ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md text-xs">
                        {r.nusukGroupNumber}
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(r.nusukGroupNumber!, e)}
                        className="text-gray-400 hover:text-emerald-700 p-1"
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
                    <span className="text-gray-400 text-[11px]">غير مسجل بعد</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 pt-1">
                  <div>
                    <span>المسافرين: </span>
                    <span className="font-bold text-gray-800">{r.travelersCount}</span>
                  </div>
                  <div dir="ltr" className="text-right">
                    <span>{r.contactPhone}</span>
                  </div>
                  <div>
                    <span>الاستضافة: </span>
                    <span className={r.hasHosting ? "text-amber-700 font-bold" : "text-gray-400"}>
                      {r.hasHosting ? "مشتركة" : "بدون"}
                    </span>
                  </div>
                  <div className="text-left text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                  </div>
                </div>

                {/* Lifecycle Timer on Mobile */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  <RequestLifecycleTimer
                    createdAt={r.createdAt}
                    travelDate={r.travelDate}
                    departureDate={r.departureDate}
                    flightDepartureTime={r.flightDepartureTime}
                    status={r.status}
                    mode="compact"
                  />
                  <span className="text-[11px] text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                  </span>
                </div>

                {/* Action Buttons on Card */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  <Link
                    href={`/requests/${r.id}`}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>عرض التفاصيل</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </Link>

                  {role === "Admin" && (
                    <div className="flex items-center gap-1.5">
                      {r.status === "Archived" ? (
                        <button
                          type="button"
                          onClick={(e) => handleAdminUnarchive(r.id, e)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                          title="إلغاء الأرشفة"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>إلغاء الأرشفة</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleAdminArchive(r.id, e)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                          title="أرشفة المعاملة"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>أرشفة</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleAdminDelete(r.id, r.requestNumber, e)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        title="مسح المعاملة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>مسح</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">رقم المعاملة</th>
                    <th className="py-3.5 px-4">اسم المجموعة / العميل</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4">رقم مجموعة نسك</th>
                    <th className="py-3.5 px-4">المسافرين</th>
                    <th className="py-3.5 px-4">الاستضافة</th>
                    <th className="py-3.5 px-4">دورة المعاملة</th>
                    <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                    <th className="py-3.5 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => {
                    const isNusukMatch =
                      search.trim() &&
                      r.nusukGroupNumber &&
                      r.nusukGroupNumber.toLowerCase().includes(search.trim().toLowerCase());

                    return (
                      <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                          {r.requestNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div>{r.groupName}</div>
                          <div className="text-[11px] text-gray-400 font-normal font-mono" dir="ltr">
                            {r.contactPhone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <RequestStatusBadge status={r.status} />
                        </td>
                        {/* Nusuk Group Number Column */}
                        <td className="py-3.5 px-4 font-mono">
                          {r.nusukGroupNumber ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono transition-all ${
                                  isNusukMatch
                                    ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
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
                            <span className="text-gray-300 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          <span className="font-bold">{r.travelersCount}</span> مسافر
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              r.hasHosting
                                ? "bg-amber-50 text-amber-800 font-medium"
                                : "text-gray-400"
                            }`}
                          >
                            {r.hasHosting ? "مشتركة" : "بدون"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <RequestLifecycleTimer
                            createdAt={r.createdAt}
                            travelDate={r.travelDate}
                            departureDate={r.departureDate}
                            flightDepartureTime={r.flightDepartureTime}
                            status={r.status}
                            mode="compact"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <Link
                              href={`/requests/${r.id}`}
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-bold bg-sky-50 px-2.5 py-1.5 rounded-lg transition-colors"
                              title="فتح المعاملة"
                            >
                              <span>فتح</span>
                              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            </Link>

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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
