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
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
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
  }, [user, role, authLoading, navigate]);

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
    if (activeTab === "NEEDS_ACTION") {
      if (role === "Sender") return r.status === "Draft" || r.status === "CorrectionRequired";
      if (role === "SafaEmployee") return r.status === "Submitted" || r.status === "UnderReview";
      if (role === "SaudiAgent") return r.status === "ReadyForSaudiAgent" || r.status === "ReceivedBySaudiAgent";
      return r.status === "CorrectionRequired";
    }
    return r.status === activeTab;
  });

  const totalGroupsCount = requests.length;
  const totalTravelersCount = requests.reduce((acc, curr) => acc + curr.travelersCount, 0);
  const pendingCorrectionsCount = requests.reduce((acc, curr) => acc + curr.pendingCorrectionsCount, 0);
  const completedCount = requests.filter((r) => r.status === "Completed").length;
  const underReviewCount = requests.filter((r) => r.status === "UnderReview" || r.status === "Submitted").length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-l from-sky-700 via-sky-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 font-medium inline-block mb-2">
              نظام إدارة سير المستندات والمعاملات
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              أهلاً بك، {user?.fullName}
            </h1>
            <p className="text-sky-100 text-xs sm:text-sm mt-1">
              متابعة مباشرة وإلكترونية لجميع أفواج ومعاملات الحج والعمرة
            </p>
          </div>

          {(role === "Sender" || role === "Admin") && (
            <Link
              to="/requests/new"
              className="inline-flex items-center gap-2 bg-white text-sky-800 hover:bg-sky-50 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all text-sm self-start sm:self-auto cursor-pointer"
            >
              <FilePlus className="w-5 h-5 text-sky-600" />
              <span>إنشاء معاملة جديدة</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">إجمالي الأفواج</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {adminStats ? adminStats.totalGroups : totalGroupsCount}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">إجمالي المعتمرين</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {adminStats ? adminStats.totalTravelers : totalTravelersCount}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">قيد المراجعة</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {adminStats ? adminStats.underReview + adminStats.newRequests : underReviewCount}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">المعاملات المكتملة</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {adminStats ? adminStats.completed : completedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Quick Insights */}
      {role === "Admin" && adminStats && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">مؤشرات أداء الموظفين والوكلاء</h2>
            </div>
            <Link
              to="/admin/users"
              className="text-xs text-purple-700 hover:text-purple-800 font-semibold flex items-center gap-1"
            >
              <span>إدارة المستخدمين</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adminStats.requestsByEmployee.map((emp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-gray-800">{emp.employeeName}</div>
                  <div className="text-xs text-gray-500">{emp.role}</div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">
                    معاملات: <span className="font-bold text-gray-800">{emp.assignedCount}</span>
                  </div>
                  <div className="text-xs text-emerald-600 font-semibold">
                    مكتمل: {emp.completedCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requests Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-5 border-b border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">المعاملات الحديثة</h2>
              <p className="text-xs text-gray-500">
                قائمة المعاملات المحدثة ومتابعة حالتها في مسار العمل
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث برقم المعاملة، الاسم، نسك..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
              </div>

              {/* Nusuk checkbox toggle */}
              <button
                type="button"
                onClick={() => setNusukOnly(!nusukOnly)}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  nusukOnly
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
                title="تصفية المجموعات التي تحتوي على رقم نسك فقط"
              >
                <Hash className="w-4 h-4" />
                <span className="hidden md:inline">برقم نسك فقط</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: "ALL", label: "الكل" },
              { id: "NEEDS_ACTION", label: "تتطلب إجراءً مني" },
              { id: "Submitted", label: "تم التقديم" },
              { id: "UnderReview", label: "قيد المراجعة" },
              { id: "SafaRegistrationCompleted", label: "مسجلة في نسك" },
              { id: "ReadyForSaudiAgent", label: "محالة للوكيل" },
              { id: "Completed", label: "مكتملة" },
              { id: "CorrectionRequired", label: "مطلوب تصحيح" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Requests */}
        {filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-base font-bold text-gray-700">لا توجد معاملات مطابقة</div>
            <div className="text-xs text-gray-400 mt-1">
              جرب تغيير التبويب أو مسح معايير البحث
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => navigate(`/requests/${req.id}`)}
                className="p-4 sm:p-5 hover:bg-sky-50/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                      {req.requestNumber}
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                      {req.groupName}
                    </h3>
                    <RequestStatusBadge status={req.status} />

                    {req.pendingCorrectionsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>تصحيح مطلوب ({req.pendingCorrectionsCount})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{req.travelersCount} معتمر</span>
                    </span>

                    {req.travelDate && (
                      <span>تاريخ السفر: {req.travelDate}</span>
                    )}

                    <span>المرسل: {req.senderName}</span>

                    {req.nusukGroupNumber && (
                      <span
                        onClick={(e) => copyToClipboard(req.nusukGroupNumber!, e)}
                        className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold hover:bg-emerald-100 transition-colors"
                        title="انقر لنسخ رقم نسك"
                      >
                        <Hash className="w-3 h-3" />
                        <span>نسك: {req.nusukGroupNumber}</span>
                        {copiedNusuk === req.nusukGroupNumber ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-emerald-500" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-left hidden sm:block">
                    <div className="text-[11px] text-gray-400">آخر تحديث</div>
                    <div className="text-xs text-gray-600 font-medium">
                      {new Date(req.updatedAt).toLocaleDateString("ar-SA")}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-2 rounded-xl transition-colors">
                    <span>عرض التفاصيل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
