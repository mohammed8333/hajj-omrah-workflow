"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary } from "@/types";
import {
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Users,
  Calendar,
  Phone,
  Edit2,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Building2,
  Check,
  X,
  FileText,
  AlertCircle,
  Hash,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { exportSenderTravelersReportToExcel, SenderReportExportRow } from "@/lib/excelExport";
import { normalizeArabicText } from "@/lib/searchUtils";
import { getWhatsAppUrl, normalizePhone } from "@/lib/phoneUtils";

export interface PilgrimReportItem {
  id: string;
  fullName: string;
  passportNumber?: string;
  phoneNumber?: string;
  affiliation?: string;
  notes?: string;
  groupRequestId: string;
  groupRequestNumber: string;
  groupName: string;
  departureDate?: string;
  returnDate?: string;
  status: string;
  nusukGroupNumber?: string;
  senderName?: string;
  airline?: string;
  flightNumber?: string;
}

export default function SenderReportPage() {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAffiliation, setSelectedAffiliation] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Quick edit affiliation modal
  const [editingItem, setEditingItem] = useState<PilgrimReportItem | null>(null);
  const [editAffiliationVal, setEditAffiliationVal] = useState<string>("");
  const [applyToEntireGroup, setApplyToEntireGroup] = useState<boolean>(false);
  const [isSavingAffiliation, setIsSavingAffiliation] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Sender sees own requests, Admin/Safa sees all
      const data = await api.requests.getAll(undefined, undefined, undefined, role === "Sender" ? user?.id : undefined);
      setRequests(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحميل بيانات التقرير.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, role]);

  // Flatten all travelers across requests
  const allPilgrims = useMemo(() => {
    const list: PilgrimReportItem[] = [];

    requests.forEach((req) => {
      const depDate = req.departureDate || req.travelDate;
      const retDate = req.returnDate;

      if (req.travelersList && req.travelersList.length > 0) {
        req.travelersList.forEach((t) => {
          list.push({
            id: t.id,
            fullName: t.fullName || "معتمر بدون اسم",
            passportNumber: t.passportNumber,
            phoneNumber: undefined, // traveler summary might have phone in detailed view
            affiliation: t.affiliation?.trim() || undefined,
            notes: t.notes?.trim() || undefined,
            groupRequestId: req.id,
            groupRequestNumber: req.requestNumber,
            groupName: req.groupName,
            departureDate: depDate,
            returnDate: retDate,
            status: req.status,
            nusukGroupNumber: req.nusukGroupNumber,
            senderName: req.senderName,
            airline: req.airline,
            flightNumber: req.flightNumber,
          });
        });
      } else {
        // Fallback row if request has count > 0 but empty travelers list
        const count = req.travelersCount || 1;
        for (let i = 1; i <= count; i++) {
          list.push({
            id: `pseudo-${req.id}-${i}`,
            fullName: `${req.groupName} (معتمر #${i})`,
            passportNumber: undefined,
            phoneNumber: req.contactPhone,
            affiliation: undefined,
            notes: undefined,
            groupRequestId: req.id,
            groupRequestNumber: req.requestNumber,
            groupName: req.groupName,
            departureDate: depDate,
            returnDate: retDate,
            status: req.status,
            nusukGroupNumber: req.nusukGroupNumber,
            senderName: req.senderName,
            airline: req.airline,
            flightNumber: req.flightNumber,
          });
        }
      }
    });

    return list;
  }, [requests]);

  // Extract all distinct affiliations with their counts
  const affiliationStats = useMemo(() => {
    const map = new Map<string, number>();
    let unassignedCount = 0;

    allPilgrims.forEach((p) => {
      if (p.affiliation && p.affiliation.trim()) {
        const key = p.affiliation.trim();
        map.set(key, (map.get(key) || 0) + 1);
      } else {
        unassignedCount++;
      }
    });

    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return {
      distinctList: entries.map(([name]) => name),
      countsMap: map,
      unassignedCount,
      totalAssigned: allPilgrims.length - unassignedCount,
    };
  }, [allPilgrims]);

  // Distinct groups
  const distinctGroups = useMemo(() => {
    const set = new Set<string>();
    allPilgrims.forEach((p) => {
      if (p.groupName) set.add(p.groupName);
    });
    return Array.from(set).sort();
  }, [allPilgrims]);

  // Filtered pilgrims
  const filteredPilgrims = useMemo(() => {
    return allPilgrims.filter((p) => {
      // 1. Affiliation Filter
      if (selectedAffiliation !== "ALL") {
        if (selectedAffiliation === "UNASSIGNED") {
          if (p.affiliation && p.affiliation.trim()) return false;
        } else {
          if (!p.affiliation || p.affiliation.trim() !== selectedAffiliation) return false;
        }
      }

      // 2. Group Filter
      if (selectedGroup !== "ALL" && p.groupName !== selectedGroup) {
        return false;
      }

      // 3. Date Filters
      if (startDate && p.departureDate && p.departureDate < startDate) {
        return false;
      }
      if (endDate && p.departureDate && p.departureDate > endDate) {
        return false;
      }

      // 4. Text Search
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const normTerm = normalizeArabicText(term);

        const matchName =
          p.fullName.toLowerCase().includes(term) ||
          normalizeArabicText(p.fullName).includes(normTerm);
        const matchPassport = p.passportNumber?.toLowerCase().includes(term);
        const matchAffiliation =
          p.affiliation?.toLowerCase().includes(term) ||
          (p.affiliation && normalizeArabicText(p.affiliation).includes(normTerm));
        const matchGroup =
          p.groupName.toLowerCase().includes(term) ||
          normalizeArabicText(p.groupName).includes(normTerm);
        const matchReqNo = p.groupRequestNumber.toLowerCase().includes(term);
        const matchNusuk = p.nusukGroupNumber?.toLowerCase().includes(term);
        const matchNotes =
          p.notes?.toLowerCase().includes(term) ||
          (p.notes && normalizeArabicText(p.notes).includes(normTerm));

        if (
          !matchName &&
          !matchPassport &&
          !matchAffiliation &&
          !matchGroup &&
          !matchReqNo &&
          !matchNusuk &&
          !matchNotes
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allPilgrims, selectedAffiliation, selectedGroup, startDate, endDate, search]);

  // Handle Export to Excel
  const handleExportExcel = () => {
    const exportRows: SenderReportExportRow[] = filteredPilgrims.map((p) => ({
      fullName: p.fullName,
      affiliation: p.affiliation || "غير محدد",
      departureDate: p.departureDate || "-",
      returnDate: p.returnDate || "-",
      passportNumber: p.passportNumber,
      phoneNumber: p.phoneNumber,
      groupName: p.groupName,
      requestNumber: p.groupRequestNumber,
      nusukGroupNumber: p.nusukGroupNumber,
      notes: p.notes,
    }));

    const filterName =
      selectedAffiliation === "ALL"
        ? undefined
        : selectedAffiliation === "UNASSIGNED"
        ? "بدون تبعية"
        : selectedAffiliation;

    exportSenderTravelersReportToExcel(exportRows, filterName);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // Quick Save Affiliation
  const handleSaveAffiliation = async () => {
    if (!editingItem) return;
    try {
      setIsSavingAffiliation(true);
      const cleanVal = editAffiliationVal.trim();

      if (applyToEntireGroup) {
        // Find all travelers in the same group and update them
        const sameGroupPilgrims = allPilgrims.filter(
          (p) => p.groupRequestId === editingItem.groupRequestId && !p.id.startsWith("pseudo-")
        );
        for (const p of sameGroupPilgrims) {
          await api.travelers.update(p.id, { affiliation: cleanVal || undefined });
        }
      } else {
        if (!editingItem.id.startsWith("pseudo-")) {
          await api.travelers.update(editingItem.id, { affiliation: cleanVal || undefined });
        }
      }

      setSuccessMessage("تم تحديث التبعية بنجاح.");
      setTimeout(() => setSuccessMessage(null), 3000);
      setEditingItem(null);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل حفظ التبعية.");
    } finally {
      setIsSavingAffiliation(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-16 font-sans">
      {/* Top Header - Hidden on Print */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/requests"
              className="text-gray-400 hover:text-sky-600 transition-colors p-1 rounded-lg"
              title="العودة لقائمة المعاملات"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <span>تقرير المعتمرين والمناديب</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 mr-9">
            متابعة شاملة لتبعية كل معتمر، تواريخ السفر والعودة، مع إمكانية التصفية لكل مندوب،
            والتصدير الفوري لإكسيل والطباعة الرسمية.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Export to Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || filteredPilgrims.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
            title="تصدير شيت إكسيل منسق RTL بالبيانات المفلترة"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إكسيل ({filteredPilgrims.length})</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || filteredPilgrims.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
            title="طباعة التقرير بنسق رسمي"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Official Print Header (Visible ONLY on print) */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black">منظومة الحج والعمرة - صفا</h2>
            <h3 className="text-lg font-bold text-slate-700 mt-1">
              تقرير بيانات المعتمرين والتبعية للمرسل
            </h3>
            {selectedAffiliation !== "ALL" && (
              <p className="text-sm font-bold text-purple-900 mt-1">
                المندوب المحدد:{" "}
                {selectedAffiliation === "UNASSIGNED" ? "معتمرين بدون تبعية محددة" : selectedAffiliation}
              </p>
            )}
          </div>
          <div className="text-left text-xs space-y-1 font-mono">
            <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</p>
            <p>عدد المعتمرين في الكشف: {filteredPilgrims.length} معتمر</p>
            {user?.fullName && <p>طُبع بواسطة: {user.fullName}</p>}
          </div>
        </div>
      </div>

      {/* Stats Cards - Hidden on Print */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">إجمالي المعتمرين</span>
            <span className="text-xl sm:text-2xl font-black text-gray-900">
              {allPilgrims.length}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">عدد المناديب والجهات</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {affiliationStats.distinctList.length}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">معتمرين محدد لهم مندوب</span>
            <span className="text-xl sm:text-2xl font-black text-blue-700">
              {affiliationStats.totalAssigned}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">بدون تبعية محددة</span>
            <span className="text-xl sm:text-2xl font-black text-amber-700">
              {affiliationStats.unassignedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar - Hidden on Print */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        {/* Affiliation Chips / Quick Pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-purple-600" />
              <span>تصفية سريعة حسب المندوب / التبعية:</span>
            </span>
            {selectedAffiliation !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedAffiliation("ALL")}
                className="text-[11px] text-purple-700 hover:underline font-bold cursor-pointer"
              >
                إظهار الكل ({allPilgrims.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedAffiliation("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                selectedAffiliation === "ALL"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              الكل ({allPilgrims.length})
            </button>

            {affiliationStats.distinctList.map((aff) => {
              const count = affiliationStats.countsMap.get(aff) || 0;
              const isSelected = selectedAffiliation === aff;
              return (
                <button
                  key={aff}
                  type="button"
                  onClick={() => setSelectedAffiliation(aff)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-purple-700 text-white shadow-xs ring-2 ring-purple-300"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200"
                  }`}
                >
                  <span>{aff}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {affiliationStats.unassignedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAffiliation("UNASSIGNED")}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedAffiliation === "UNASSIGNED"
                    ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-300"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                }`}
              >
                <span>بدون تبعية محددة</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full">
                  {affiliationStats.unassignedCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          {/* Search Box */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              بحث بالاسم / الجواز / الملاحظات:
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم المعتمر أو رقم الجواز..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Group Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              تصفية حسب المجموعة:
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
            >
              <option value="ALL">جميع المجموعات ({distinctGroups.length})</option>
              {distinctGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              تاريخ السفر من:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white font-mono"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              تاريخ السفر إلى:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white font-mono"
            />
          </div>
        </div>

        {/* Reset Filters */}
        {(selectedAffiliation !== "ALL" || selectedGroup !== "ALL" || search || startDate || endDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>
              عرض <strong>{filteredPilgrims.length}</strong> من أصل <strong>{allPilgrims.length}</strong> معتمر
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedAffiliation("ALL");
                setSelectedGroup("ALL");
                setSearch("");
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
            >
              إلغاء جميع الفلاتر ↺
            </button>
          </div>
        )}
      </div>

      {/* Main Report Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-bold">جاري تحميل بيانات المعتمرين...</span>
          </div>
        ) : filteredPilgrims.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-800">لا يوجد معتمرين مطابقين للفلاتر</h3>
            <p className="text-xs text-gray-500">
              يرجى التحقق من معايير البحث أو اختيار مندوب آخر.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800 print:bg-slate-800">
                  <th className="py-3 px-3 w-12 text-center">م</th>
                  <th className="py-3 px-4 min-w-[180px]">اسم المعتمر / المسافر</th>
                  <th className="py-3 px-4 min-w-[160px]">التبعية (المندوب)</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">ت الذهاب</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">ت العودة</th>
                  <th className="py-3 px-3 min-w-[120px] font-mono text-center">رقم الجواز</th>
                  <th className="py-3 px-4 min-w-[160px]">المجموعة / المعاملة</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">رقم نسك</th>
                  <th className="py-3 px-4 min-w-[200px]">ملاحظات</th>
                  <th className="py-3 px-3 w-20 text-center print:hidden">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPilgrims.map((item, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-purple-50/40 transition-colors ${
                        isEven ? "bg-white" : "bg-slate-50/60"
                      }`}
                    >
                      {/* Serial Number */}
                      <td className="py-3 px-3 text-center font-bold text-gray-500">
                        {idx + 1}
                      </td>

                      {/* Traveler Name */}
                      <td className="py-3 px-4 font-black text-gray-900 text-sm">
                        <span>{item.fullName}</span>
                      </td>

                      {/* Affiliation / Delegate */}
                      <td className="py-3 px-4">
                        {item.affiliation ? (
                          <div className="inline-flex items-center gap-1.5 bg-purple-100/80 text-purple-950 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-black shadow-2xs">
                            <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>{item.affiliation}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            غير محدد
                          </span>
                        )}
                      </td>

                      {/* Travel Date */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-900">
                        {item.departureDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-600 print:hidden" />
                            <span>{item.departureDate}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Return Date */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-900">
                        {item.returnDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-600 print:hidden" />
                            <span>{item.returnDate}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Passport Number */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                        {item.passportNumber || "-"}
                      </td>

                      {/* Group Name & Request */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/requests/${item.groupRequestId}`}
                          className="font-bold text-sky-800 hover:text-sky-950 hover:underline block"
                          title="عرض تفاصيل المعاملة"
                        >
                          {item.groupName}
                        </Link>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {item.groupRequestNumber}
                        </span>
                      </td>

                      {/* Nusuk Number */}
                      <td className="py-3 px-3 text-center">
                        {item.nusukGroupNumber ? (
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            {item.nusukGroupNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-gray-600 text-[11px] leading-relaxed">
                        {item.notes || "-"}
                      </td>

                      {/* Actions (Print: hidden) */}
                      <td className="py-3 px-3 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditAffiliationVal(item.affiliation || "");
                            setApplyToEntireGroup(false);
                          }}
                          className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                          title="تعديل تبعية هذا المعتمر مباشرة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Official Print Signatures Footer (Visible ONLY on print) */}
      <div className="hidden print:flex justify-between items-center pt-10 text-xs font-bold text-slate-800">
        <div className="text-center w-56">
          <p className="border-b border-slate-400 pb-12 mb-2">إعداد وتوقيع المندوب / المشرف</p>
          <p>الاسم: ........................................</p>
        </div>
        <div className="text-center w-56">
          <p className="border-b border-slate-400 pb-12 mb-2">اعتماد شركة صفا للسياحة</p>
          <p>التوقيع والختم الرسمي</p>
        </div>
      </div>

      {/* Quick Edit Affiliation Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span>تعديل تبعية المعتمر</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                <span className="block text-[11px] font-bold text-purple-900">المعتمر:</span>
                <span className="text-sm font-black text-purple-950">{editingItem.fullName}</span>
                <span className="block text-[10px] text-purple-700 mt-0.5">
                  المجموعة: {editingItem.groupName} ({editingItem.groupRequestNumber})
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  التبعية / اسم المندوب:
                </label>
                <input
                  type="text"
                  value={editAffiliationVal}
                  onChange={(e) => setEditAffiliationVal(e.target.value)}
                  placeholder="مثال: أ/ أحمد، شركة النور، مندوب جدة..."
                  className="w-full px-3 py-2 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-purple-950 bg-white"
                  autoFocus
                />
              </div>

              {/* Suggestions */}
              {affiliationStats.distinctList.length > 0 && (
                <div>
                  <span className="text-[10px] text-gray-500 font-bold block mb-1">
                    اختيار سريع من المناديب الحاليين:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {affiliationStats.distinctList.slice(0, 6).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setEditAffiliationVal(name)}
                        className="text-[10px] bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-900 px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply to entire group checkbox */}
              <label className="flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors border border-gray-200">
                <input
                  type="checkbox"
                  checked={applyToEntireGroup}
                  onChange={(e) => setApplyToEntireGroup(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-gray-700 leading-tight">
                  تطبيق هذه التبعية على جميع معتمري هذه المجموعة أيضاً
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAffiliation}
                disabled={isSavingAffiliation}
                className="px-5 py-2 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingAffiliation ? "جاري الحفظ..." : "حفظ التبعية"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
