import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary } from "@/types";
import { RequestStatusBadge } from "@/components/ui/StatusBadge";
import {
  Search,
  Filter,
  FilePlus,
  Users,
  Calendar,
  Phone,
  ArrowRight,
  ExternalLink,
  Layers,
  Hash,
  Copy,
  Check,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function RequestsListPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedNusuk, setCopiedNusuk] = useState<string | null>(null);

  const copyToClipboard = (nusuk: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nusuk);
    setCopiedNusuk(nusuk);
    setTimeout(() => setCopiedNusuk(null), 2000);
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await api.requests.getAll(
        statusFilter === "ALL" ? undefined : statusFilter,
        undefined,
        search || undefined
      );
      setRequests(data);
    } catch (err) {
      console.error("Error loading requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequests();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل المعاملات والأفواج</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            إدارة وتتبع مسار كافة المعاملات والمستندات في النظام
          </p>
        </div>

        {(role === "Sender" || role === "Admin") && (
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors text-sm self-start sm:self-auto cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>إنشاء معاملة جديدة</span>
          </Link>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم المعاملة، اسم الفوج، هاتف، رقم نسك..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
          <Search className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 pl-3 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden bg-white cursor-pointer"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="Draft">مسودة</option>
              <option value="Submitted">تم التقديم</option>
              <option value="UnderReview">قيد مراجعة الصفا</option>
              <option value="CorrectionRequired">مطلوب تصحيح</option>
              <option value="SafaRegistrationCompleted">مسجلة في نسك</option>
              <option value="ReadyForSaudiAgent">محالة للوكيل السعودي</option>
              <option value="ReceivedBySaudiAgent">مستلمة من الوكيل</option>
              <option value="SaudiAgentProcessing">قيد معالجة الوكيل</option>
              <option value="Completed">مكتملة نهائياً</option>
              <option value="Cancelled">ملغاة</option>
            </select>
            <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          <button
            onClick={loadRequests}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm">جاري تحميل المعاملات...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500 shadow-xs">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">لا توجد معاملات</h3>
          <p className="text-xs text-gray-400 mt-1">
            لم يتم العثور على أي معاملات تطابق معايير البحث أو التصفية
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => navigate(`/requests/${req.id}`)}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:border-sky-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Details */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                    {req.requestNumber}
                  </span>
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {req.groupName}
                  </h2>
                  <RequestStatusBadge status={req.status} />

                  {req.hasHosting && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                      يوجد استضافة
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{req.travelersCount} معتمر</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span dir="ltr">{req.contactPhone}</span>
                  </div>

                  {req.travelDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{req.travelDate}</span>
                    </div>
                  )}

                  {req.nusukGroupNumber && (
                    <div
                      onClick={(e) => copyToClipboard(req.nusukGroupNumber!, e)}
                      className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded w-fit hover:bg-emerald-100 cursor-pointer"
                      title="انقر للنسخ"
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>{req.nusukGroupNumber}</span>
                      {copiedNusuk === req.nusukGroupNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                <div className="text-left hidden sm:block">
                  <div className="text-[11px] text-gray-400">تاريخ التقديم</div>
                  <div className="text-xs text-gray-600 font-medium">
                    {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 px-3.5 py-2.5 rounded-xl hover:bg-sky-100 transition-colors">
                  <span>فتح المعاملة</span>
                  <ExternalLink className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
