"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary } from "@/types";
import {
  Plane,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Users,
  Calendar,
  Phone,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Building2,
  AlertCircle,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import {
  exportTravelReportToExcel,
  TravelReportExportRow,
} from "@/lib/excelExport";
import { normalizeArabicText } from "@/lib/searchUtils";
import { extractEgyptianPhoneNumber, getWhatsAppUrl, normalizePhone } from "@/lib/phoneUtils";
import { getTravelArchiveCategory } from "@/lib/travelArchiveUtils";

export interface TravelPilgrimItem {
  id: string;
  fullName: string;
  passportNumber?: string;
  phoneNumber?: string;
  notes?: string;
  groupRequestId: string;
  groupRequestNumber: string;
  groupName: string;
  departureDate?: string;
  returnDate?: string;
  status: string;
  nusukGroupNumber: string;
  senderName?: string;
  airline?: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  airportArrivalTime?: string;
  travelersCount: number;
  ticketUrl?: string;
  egyptianPhone: string;
}

const ARABIC_MONTHS: Record<number, string> = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

export function formatArabicDateFriendly(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim() || dateStr === "-") return "-";
  const clean = dateStr.split("T")[0].trim();
  const parts = clean.split("-");
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && ARABIC_MONTHS[month]) {
      return `${day} ${ARABIC_MONTHS[month]}`;
    }
  }
  return dateStr;
}

// Helper: parse date to timestamp for chronological sorting
function parseDateForSort(dateStr?: string): number {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return Number.MAX_SAFE_INTEGER;
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d).getTime();
    }
  }
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

// Helper: parse departure time to minutes from midnight (0..1439)
function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || timeStr === "-" || timeStr.trim() === "") return Number.MAX_SAFE_INTEGER;
  const clean = timeStr.trim();
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (/pm|م/i.test(clean) && hours < 12) hours += 12;
    if (/am|ص/i.test(clean) && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return Number.MAX_SAFE_INTEGER;
}

export default function TravelReportPage() {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [selectedAirline, setSelectedAirline] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.requests.getAll();
      setRequests(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحميل بيانات تقرير السفر.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to extract traveler phone (prioritizes clean Egyptian, accepts direct traveler phone, rejects Saudi host fallback)
  const resolveTravelerEgyptianPhone = (phoneNumber?: string, travelerNotes?: string, parentReq?: GroupRequestSummary): string => {
    const eg1 = extractEgyptianPhoneNumber(phoneNumber);
    if (eg1) return eg1;
    if (phoneNumber && phoneNumber.trim() && phoneNumber.trim() !== "-") {
      const norm = normalizePhone(phoneNumber);
      return norm.displayFormatted || phoneNumber.trim();
    }
    const eg2 = extractEgyptianPhoneNumber(travelerNotes);
    if (eg2) return eg2;
    const eg3 = extractEgyptianPhoneNumber(parentReq?.contactPhone);
    if (eg3) return eg3;
    const eg4 = extractEgyptianPhoneNumber(parentReq?.notes);
    if (eg4) return eg4;
    return "-";
  };

  // Helper to resolve ticket URL
  const resolveTicketUrl = (req?: GroupRequestSummary): string | undefined => {
    if (!req) return undefined;
    if (req.flightTicketDocumentUrl && (req.flightTicketDocumentUrl.startsWith("http://") || req.flightTicketDocumentUrl.startsWith("https://"))) {
      return req.flightTicketDocumentUrl;
    }
    if (typeof window !== "undefined" && req.flightTicketDocumentId) {
      const origin = window.location.origin;
      return `${origin}/requests/${encodeURIComponent(req.id)}?docId=${encodeURIComponent(req.flightTicketDocumentId)}`;
    }
    return undefined;
  };

  // Flatten all travelers for active transactions with a valid Nusuk group number
  const allTravelPilgrims = useMemo(() => {
    const list: TravelPilgrimItem[] = [];

    // Filter requests: Active and with a valid Nusuk group number
    const eligibleRequests = requests.filter((req) => {
      if (getTravelArchiveCategory(req) !== "ACTIVE") return false;

      const rawNusuk = req.nusukGroupNumber;
      if (!rawNusuk) return false;
      const clean = rawNusuk.trim();
      return (
        clean !== "" &&
        clean !== "-" &&
        clean !== "لم يُسجل بعد" &&
        clean !== "لم يسجل بعد" &&
        clean.toLowerCase() !== "null" &&
        clean.toLowerCase() !== "undefined"
      );
    });

    eligibleRequests.forEach((req) => {
      const depDate = req.departureDate || req.travelDate;
      const retDate = req.returnDate;
      const totalCount = req.travelersCount || (req.travelersList && req.travelersList.length > 0 ? req.travelersList.length : 1);
      const ticketLink = resolveTicketUrl(req);
      const cleanNusuk = req.nusukGroupNumber!.trim();

      if (req.travelersList && req.travelersList.length > 0) {
        req.travelersList.forEach((t) => {
          const egPhone = resolveTravelerEgyptianPhone(t.phoneNumber, t.notes, req);
          list.push({
            id: t.id,
            fullName: t.fullName || "معتمر بدون اسم",
            passportNumber: t.passportNumber,
            phoneNumber: t.phoneNumber || req.contactPhone,
            notes: t.notes?.trim() || undefined,
            groupRequestId: req.id,
            groupRequestNumber: req.requestNumber,
            groupName: req.groupName,
            departureDate: depDate,
            returnDate: retDate,
            status: req.status,
            nusukGroupNumber: cleanNusuk,
            senderName: req.senderName,
            airline: req.airline,
            flightNumber: req.flightNumber,
            flightDepartureTime: req.flightDepartureTime,
            airportArrivalTime: req.airportArrivalTime,
            travelersCount: totalCount,
            ticketUrl: ticketLink,
            egyptianPhone: egPhone,
          });
        });
      } else {
        const count = req.travelersCount || 1;
        for (let i = 1; i <= count; i++) {
          const egPhone = resolveTravelerEgyptianPhone(req.contactPhone, req.notes, req);
          list.push({
            id: `pseudo-${req.id}-${i}`,
            fullName: `${req.groupName} (معتمر #${i})`,
            passportNumber: undefined,
            phoneNumber: req.contactPhone,
            notes: undefined,
            groupRequestId: req.id,
            groupRequestNumber: req.requestNumber,
            groupName: req.groupName,
            departureDate: depDate,
            returnDate: retDate,
            status: req.status,
            nusukGroupNumber: cleanNusuk,
            senderName: req.senderName,
            airline: req.airline,
            flightNumber: req.flightNumber,
            flightDepartureTime: req.flightDepartureTime,
            airportArrivalTime: req.airportArrivalTime,
            travelersCount: totalCount,
            ticketUrl: ticketLink,
            egyptianPhone: egPhone,
          });
        }
      }
    });

    return list;
  }, [requests]);

  // Distinct airlines for dropdown
  const distinctAirlines = useMemo(() => {
    const set = new Set<string>();
    allTravelPilgrims.forEach((p) => {
      if (p.airline && p.airline.trim()) set.add(p.airline.trim());
    });
    return Array.from(set).sort();
  }, [allTravelPilgrims]);

  // Apply filters
  const filteredPilgrims = useMemo(() => {
    let result = allTravelPilgrims;

    // 1. Text search
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      const normTerm = normalizeArabicText(term);

      result = result.filter((p) => {
        const nameMatch =
          p.fullName.toLowerCase().includes(term) ||
          normalizeArabicText(p.fullName).includes(normTerm);
        const passMatch = p.passportNumber?.toLowerCase().includes(term);
        const nusukMatch = p.nusukGroupNumber.toLowerCase().includes(term);
        const groupMatch =
          p.groupName.toLowerCase().includes(term) ||
          normalizeArabicText(p.groupName).includes(normTerm);
        const flightMatch = p.flightNumber?.toLowerCase().includes(term);
        const phoneMatch = p.egyptianPhone.replace(/\D/g, "").includes(term.replace(/\D/g, ""));
        return nameMatch || passMatch || nusukMatch || groupMatch || flightMatch || phoneMatch;
      });
    }

    // 2. Airline Filter
    if (selectedAirline !== "ALL") {
      result = result.filter((p) => (p.airline || "").trim() === selectedAirline);
    }

    // 3. Date range filters
    if (startDate) {
      result = result.filter((p) => {
        if (!p.departureDate) return false;
        return p.departureDate.split("T")[0] >= startDate;
      });
    }
    if (endDate) {
      result = result.filter((p) => {
        if (!p.departureDate) return false;
        return p.departureDate.split("T")[0] <= endDate;
      });
    }

    return result;
  }, [allTravelPilgrims, search, selectedAirline, startDate, endDate]);

  // Group contiguous travelers and sort groups chronologically:
  // Primary: departureDate (asc), Secondary: flightDepartureTime (asc)
  const sortedPilgrimsWithGroupMeta = useMemo(() => {
    interface GroupBucket {
      groupKey: string;
      groupId: string;
      departureDate?: string;
      flightDepartureTime?: string;
      travelers: TravelPilgrimItem[];
    }

    const groupMap = new Map<string, GroupBucket>();
    const groupOrder: string[] = [];

    filteredPilgrims.forEach((item) => {
      const key = item.groupRequestId;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          groupKey: key,
          groupId: item.groupRequestId,
          departureDate: item.departureDate,
          flightDepartureTime: item.flightDepartureTime,
          travelers: [],
        });
        groupOrder.push(key);
      }
      groupMap.get(key)!.travelers.push(item);
    });

    const buckets = groupOrder.map((k) => groupMap.get(k)!);

    // Chronological Sort: departureDate asc, flightDepartureTime asc
    buckets.sort((a, b) => {
      const dateA = parseDateForSort(a.departureDate);
      const dateB = parseDateForSort(b.departureDate);
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      const timeA = parseTimeToMinutes(a.flightDepartureTime);
      const timeB = parseTimeToMinutes(b.flightDepartureTime);
      return timeA - timeB;
    });

    // Flatten into final list with groupIndex to alternate colors
    const flatList: Array<TravelPilgrimItem & { groupIndex: number; isFirstInGroup: boolean; groupSize: number }> = [];

    buckets.forEach((bucket, bIdx) => {
      bucket.travelers.forEach((t, tIdx) => {
        flatList.push({
          ...t,
          groupIndex: bIdx,
          isFirstInGroup: tIdx === 0,
          groupSize: bucket.travelers.length,
        });
      });
    });

    return flatList;
  }, [filteredPilgrims]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalTravelers = filteredPilgrims.length;
    const uniqueGroups = new Set(filteredPilgrims.map((p) => p.groupRequestId)).size;
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const urgentCount = filteredPilgrims.filter((p) => {
      if (!p.departureDate) return false;
      const d = new Date(p.departureDate);
      return d >= now && d <= in48h;
    }).length;

    const completedFlights = filteredPilgrims.filter(
      (p) => Boolean(p.flightNumber && p.flightDepartureTime)
    ).length;

    return { totalTravelers, uniqueGroups, urgentCount, completedFlights };
  }, [filteredPilgrims]);

  const copyText = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Export to Excel handler
  const handleExportTravelExcel = () => {
    if (filteredPilgrims.length === 0) {
      setError("لا توجد بيانات مطابقة لتصديرها.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const exportRows: TravelReportExportRow[] = filteredPilgrims.map((p) => ({
      groupId: p.groupRequestId,
      nusukGroupNumber: p.nusukGroupNumber,
      groupName: p.groupName,
      travelersCount: p.travelersCount,
      ticketUrl: p.ticketUrl,
      flightNumber: p.flightNumber || "-",
      departureDate: p.departureDate || "-",
      flightDepartureTime: p.flightDepartureTime || "-",
      airportArrivalTime: p.airportArrivalTime || "-",
      travelerName: p.fullName,
      travelerPhone: p.egyptianPhone,
    }));

    exportTravelReportToExcel(exportRows);
    setSuccessMessage(`تم تصدير تقرير السفر بنجاح لعدد (${exportRows.length}) مسافر.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Guard for Admin role
  if (role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl mb-4">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">غير مصرح بالدخول</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          عذراً، هذا التقرير مخصص لإدارة النظام فقط (Admin). يرجى الرجوع لقائمة المعاملات.
        </p>
        <Link
          href="/requests"
          className="mt-5 inline-flex items-center gap-2 bg-sky-600 text-white font-bold px-4 py-2 rounded-xl text-sm"
        >
          <span>العودة للمعاملات</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

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
              <span className="p-2 rounded-xl bg-sky-100 text-sky-700">
                <Plane className="w-6 h-6" />
              </span>
              <span>تقرير السفر والرحلات</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 mr-9">
            متابعة توقيتات إقلاع الطيران، التواجد بالمطار، أرقام الرحلات للمعتمرين، وتصدير شيت السفر المعتمد برقم نسك.
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

          {/* Export Travel Excel Button */}
          <button
            type="button"
            onClick={handleExportTravelExcel}
            disabled={loading || filteredPilgrims.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
            title="تصدير شيت إكسيل تقرير السفر المعتمد (مرتب حسب تاريخ السفر ووقت الإقلاع)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إكسيل ({filteredPilgrims.length})</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || filteredPilgrims.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
            title="طباعة التقرير بنسق رسمي صفحة واحدة"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-center gap-2 print:hidden">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Summary Stats Cards - Hidden on Print */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-gray-500 font-semibold block">إجمالي المسافرين</span>
            <span className="text-2xl font-black text-gray-900 mt-1 block">
              {stats.totalTravelers}
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-gray-500 font-semibold block">مجموعات نسك</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {stats.uniqueGroups}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-gray-500 font-semibold block">رحلات خلال 48 ساعة</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {stats.urgentCount}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-gray-500 font-semibold block">بيانات رحلات مكتملة</span>
            <span className="text-2xl font-black text-sky-600 mt-1 block">
              {stats.completedFlights}
            </span>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Plane className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar - Hidden on Print */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* General Search */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، رقم نسك، الجواز، رقم الرحلة، اسم المجموعة..."
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Airline Filter */}
          <div>
            <select
              value={selectedAirline}
              onChange={(e) => setSelectedAirline(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
            >
              <option value="ALL">جميع شركات الطيران ({distinctAirlines.length})</option>
              {distinctAirlines.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From & To */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="تاريخ السفر من"
              className="w-1/2 px-2 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white font-mono"
            />
            <span className="text-gray-400 text-xs">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="تاريخ السفر إلى"
              className="w-1/2 px-2 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white font-mono"
            />
          </div>
        </div>

        {/* Reset Filter Button if active */}
        {(search || selectedAirline !== "ALL" || startDate || endDate) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedAirline("ALL");
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
            >
              مسح جميع الفلاتر
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-sm font-semibold">جاري تحميل بيانات تقرير السفر...</span>
          </div>
        ) : sortedPilgrimsWithGroupMeta.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-700">لا توجد بيانات سفر مطابقة</h3>
            <p className="text-xs text-gray-500 mt-1">
              تأكد من وجود معاملات نشطة ومسجلة برقم نسك معتمد أو قم بإعادة ضبط معايير البحث.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800 text-[11px] font-bold">
                  <th className="py-3 px-2 text-center w-10">م</th>
                  <th className="py-3 px-2 text-center">رقم مجموعة نسك</th>
                  <th className="py-3 px-3">اسم المجموعة</th>
                  <th className="py-3 px-2 text-center">عدد المسافرين</th>
                  <th className="py-3 px-2 text-center">رابط التذكرة</th>
                  <th className="py-3 px-2 text-center">رقم الرحلة</th>
                  <th className="py-3 px-2.5 text-center">تاريخ الذهاب</th>
                  <th className="py-3 px-2 text-center">وقت إقلاع الطائرة</th>
                  <th className="py-3 px-2 text-center">التواجد بالمطار</th>
                  <th className="py-3 px-3">اسم المسافر</th>
                  <th className="py-3 px-3 text-center">رقم هاتف المسافر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedPilgrimsWithGroupMeta.map((p, idx) => {
                  // Distinct alternating row color per group:
                  // Even groups get soft sky/slate tint, odd groups get white
                  const isEvenGroup = p.groupIndex % 2 === 0;
                  const rowBg = isEvenGroup ? "bg-sky-50/40 hover:bg-sky-50" : "bg-white hover:bg-gray-50";

                  return (
                    <tr
                      key={p.id}
                      className={`${rowBg} transition-colors ${
                        p.isFirstInGroup && p.groupIndex !== 0 ? "border-t-2 border-sky-200" : ""
                      }`}
                    >
                      {/* 1. م */}
                      <td className="py-2.5 px-2 text-center font-mono text-gray-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* 2. رقم مجموعة نسك */}
                      <td className="py-2.5 px-2 text-center font-mono">
                        <button
                          type="button"
                          onClick={(e) => copyText(p.nusukGroupNumber, `nusuk-${p.id}`, e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer text-xs"
                          title="انقر لنسخ رقم نسك"
                        >
                          <span>{p.nusukGroupNumber}</span>
                          {copiedKey === `nusuk-${p.id}` ? (
                            <Check className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <Copy className="w-3 h-3 text-emerald-600 opacity-60" />
                          )}
                        </button>
                      </td>

                      {/* 3. اسم المجموعة */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900">{p.groupName}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {p.groupRequestNumber}
                        </div>
                      </td>

                      {/* 4. عدد المسافرين */}
                      <td className="py-2.5 px-2 text-center font-black text-gray-700">
                        {p.travelersCount}
                      </td>

                      {/* 5. رابط التذكرة */}
                      <td className="py-2.5 px-2 text-center">
                        {p.ticketUrl ? (
                          <a
                            href={p.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            title="فتح تذكرة الطيران"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>التذكرة</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* 6. رقم الرحلة */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-800">
                        {p.flightNumber || "-"}
                      </td>

                      {/* 7. تاريخ الذهاب */}
                      <td className="py-2.5 px-2.5 text-center font-bold text-gray-800 whitespace-nowrap">
                        {formatArabicDateFriendly(p.departureDate)}
                      </td>

                      {/* 8. وقت إقلاع طائرة الذهاب */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-purple-700">
                        {p.flightDepartureTime || "-"}
                      </td>

                      {/* 9. وقت التواجد في المطار */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">
                        {p.airportArrivalTime || "-"}
                      </td>

                      {/* 10. اسم المسافر */}
                      <td className="py-2.5 px-3">
                        <div className="font-black text-gray-900">{p.fullName}</div>
                        {p.passportNumber && (
                          <div className="text-[10px] text-gray-500 font-mono">
                            جواز: {p.passportNumber}
                          </div>
                        )}
                      </td>

                      {/* 11. رقم هاتف المسافر */}
                      <td className="py-2.5 px-3 text-center">
                        {p.egyptianPhone && p.egyptianPhone !== "-" ? (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span className="font-mono text-gray-800 font-bold text-xs" dir="ltr">
                              {p.egyptianPhone}
                            </span>
                            <a
                              href={getWhatsAppUrl(p.egyptianPhone, `السلام عليكم يا ${p.fullName}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="محادثة واتساب مباشرة"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${p.egyptianPhone}`}
                              className="p-1 rounded-md text-sky-600 hover:bg-sky-50 transition-colors"
                              title="اتصال هاتفي"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 landscape;
                margin: 5mm 6mm 5mm 6mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              header, aside, footer, nav, .print\\:hidden {
                display: none !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: 8pt !important;
              }
              th, td {
                padding: 3px 4px !important;
                border: 1px solid #cbd5e1 !important;
              }
              th {
                background: #0f172a !important;
                color: #ffffff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `,
        }}
      />
    </div>
  );
}
