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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequestLifecycleTimer } from "@/components/ui/RequestLifecycleTimer";

export default function DashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
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

  const handleAdminArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("هل أنت متأكد من رغبتك في أرشفة هذه المعاملة؟")) return;
    try {
      await api.requests.archive(id, "أرشفة يدوية بواسطة مدير النظام");
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleAdminUnarchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("هل ترغب في إلغاء أرشفة هذه المعاملة واستعادتها للحالة النشطة؟")) return;
    try {
      await api.requests.unarchive(id);
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleAdminDelete = async (id: string, reqNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const confirmation = prompt(
      `تحذير أمني: أنت على وشك مسح المعاملة (${reqNumber}) وكافة وثائقها نهائياً!\nللتأكيد النهائي، اكتب (حذف) أو (delete):`
    );
    if (!confirmation || (confirmation.trim() !== "حذف" && confirmation.trim().toLowerCase() !== "delete")) {
      return;
    }
    try {
      await api.requests.delete(id);
      alert("تم حذف المعاملة بالكامل بنجاح.");
      const reqsRes = await api.requests.getAll();
      setRequests(reqsRes);
      if (role === "Admin") {
        const statsRes = await api.admin.getStats();
        setAdminStats(statsRes);
      }
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

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
        r.status === "ProgramLinked" ||
        r.status === "HostingAcceptanceRequested" ||
        r.status === "HostingAcceptedBySender" ||
        r.status === "HostingConfirmed"
      );
    if (activeTab === "COMPLETED") return r.status === "Completed";

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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "AGENT_INBOX"
                    ? "bg-sky-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                الوارد والمعالجة
              </button>
              <button
                onClick={() => setActiveTab("ISSUES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "ISSUES"
                    ? "bg-rose-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                بها ملاحظات
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3 gap-2">
                  <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                    {req.requestNumber}
                  </span>
                  <RequestStatusBadge status={req.status} />
                </div>

                <h3 className="text-base font-bold text-gray-900 mb-1">
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

              {/* Card Actions: Open Details + Admin Archive & Delete Buttons */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <Link
                  href={`/requests/${req.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <span>عرض التفاصيل والإجراء</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </Link>

                {role === "Admin" && (
                  <div className="flex items-center gap-1.5">
                    {req.status === "Archived" ? (
                      <button
                        type="button"
                        onClick={(e) => handleAdminUnarchive(req.id, e)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        title="إلغاء أرشفة المعاملة واستعادتها"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>إلغاء الأرشفة</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleAdminArchive(req.id, e)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        title="أرشفة المعاملة"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>أرشفة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleAdminDelete(req.id, req.requestNumber, e)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                      title="مسح المعاملة نهائياً"
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
      )}
    </div>
  );
}
