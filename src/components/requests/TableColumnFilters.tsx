"use client";

import React from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { GroupRequestSummary } from "@/types";
import { normalizeArabicText, isTravelerMatch } from "@/lib/searchUtils";

export interface TableColumnFiltersState {
  nusuk: string;
  status: string;
  sender: string;
  departureDate: string;
  returnDate: string;
  traveler: string;
  hosting: "ALL" | "WITH_HOST" | "WITHOUT_HOST";
}

export const initialColumnFilters: TableColumnFiltersState = {
  nusuk: "",
  status: "",
  sender: "",
  departureDate: "",
  returnDate: "",
  traveler: "",
  hosting: "ALL",
};

/**
 * Checks whether a request matches the active Admin column filters
 */
export function matchesColumnFilters(
  r: GroupRequestSummary,
  filters: TableColumnFiltersState
): boolean {
  // 1. Nusuk Number Filter
  if (filters.nusuk.trim()) {
    const term = filters.nusuk.trim().toLowerCase();
    if (!r.nusukGroupNumber || !r.nusukGroupNumber.toLowerCase().includes(term)) {
      return false;
    }
  }

  // 2. Status Filter
  if (filters.status && r.status !== filters.status) {
    return false;
  }

  // 3. Sender Filter
  if (filters.sender) {
    const sName = (r.senderName || "").trim().toLowerCase();
    if (sName !== filters.sender.trim().toLowerCase()) {
      return false;
    }
  }

  // 4. Departure Date Filter (matches YYYY-MM-DD prefix)
  if (filters.departureDate) {
    const dep = r.departureDate || r.travelDate;
    if (!dep || !dep.startsWith(filters.departureDate)) {
      return false;
    }
  }

  // 5. Return Date Filter (matches YYYY-MM-DD prefix)
  if (filters.returnDate) {
    if (!r.returnDate || !r.returnDate.startsWith(filters.returnDate)) {
      return false;
    }
  }

  // 6. Traveler Data Filter (searches inside travelersList, groupName, and requestNumber)
  if (filters.traveler.trim()) {
    const term = filters.traveler.trim().toLowerCase();
    const normTerm = normalizeArabicText(term);

    const matchGroup =
      r.groupName?.toLowerCase().includes(term) ||
      normalizeArabicText(r.groupName).includes(normTerm) ||
      r.requestNumber?.toLowerCase().includes(term);

    const matchTraveler = r.travelersList?.some((t) => isTravelerMatch(t, term));

    if (!matchGroup && !matchTraveler) {
      return false;
    }
  }

  // 7. Hosting Filter
  if (filters.hosting === "WITH_HOST" && !r.hasHosting) {
    return false;
  }
  if (filters.hosting === "WITHOUT_HOST" && r.hasHosting) {
    return false;
  }

  return true;
}

interface TableColumnFiltersRowProps {
  role?: string;
  filters: TableColumnFiltersState;
  onFilterChange: (key: keyof TableColumnFiltersState, value: string) => void;
  onReset: () => void;
  distinctSenders: string[];
  hasActiveFilters: boolean;
}

export function TableColumnFiltersRow({
  role,
  filters,
  onFilterChange,
  onReset,
  distinctSenders,
  hasActiveFilters,
}: TableColumnFiltersRowProps) {
  if (role !== "Admin") return null;

  return (
    <tr className="bg-sky-50/70 border-t border-b border-sky-200/80 font-normal">
      {/* 1. Nusuk Filter */}
      <th className="p-1.5">
        <div className="relative">
          <input
            type="text"
            value={filters.nusuk}
            onChange={(e) => onFilterChange("nusuk", e.target.value)}
            placeholder="بحث برقم نسك..."
            className={`w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 font-mono transition-colors ${
              filters.nusuk ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
            }`}
          />
          {filters.nusuk && (
            <button
              type="button"
              onClick={() => onFilterChange("nusuk", "")}
              className="absolute left-1.5 top-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="مسح"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </th>

      {/* 2. Status Filter */}
      <th className="p-1.5 text-center">
        <select
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className={`w-full px-2 py-1 text-[11px] rounded-lg border bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors ${
            filters.status ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
          }`}
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
          <option value="SaudiAgentCorrectionRequired">مطلوب تصحيح من الوكيل</option>
          <option value="Completed">(تم) - مكتمل</option>
          <option value="Cancelled">ملغي</option>
          <option value="Archived">معاملات مؤرشفة</option>
        </select>
      </th>

      {/* 3. Sender Filter (Admin only) */}
      <th className="p-1.5 text-center">
        <select
          value={filters.sender}
          onChange={(e) => onFilterChange("sender", e.target.value)}
          className={`w-full px-2 py-1 text-[11px] rounded-lg border bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors ${
            filters.sender ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
          }`}
        >
          <option value="">جميع المرسلين ({distinctSenders.length})</option>
          {distinctSenders.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </th>

      {/* 4. Departure Date Filter */}
      <th className="p-1.5">
        <div className="relative flex items-center">
          <input
            type="date"
            value={filters.departureDate}
            onChange={(e) => onFilterChange("departureDate", e.target.value)}
            className={`w-full px-1.5 py-1 text-[10px] rounded-lg border bg-white font-mono focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors ${
              filters.departureDate ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
            }`}
            title="تصفية حسب تاريخ الذهاب"
          />
          {filters.departureDate && (
            <button
              type="button"
              onClick={() => onFilterChange("departureDate", "")}
              className="absolute left-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="مسح"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </th>

      {/* 5. Return Date Filter */}
      <th className="p-1.5">
        <div className="relative flex items-center">
          <input
            type="date"
            value={filters.returnDate}
            onChange={(e) => onFilterChange("returnDate", e.target.value)}
            className={`w-full px-1.5 py-1 text-[10px] rounded-lg border bg-white font-mono focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors ${
              filters.returnDate ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
            }`}
            title="تصفية حسب تاريخ العودة"
          />
          {filters.returnDate && (
            <button
              type="button"
              onClick={() => onFilterChange("returnDate", "")}
              className="absolute left-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="مسح"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </th>

      {/* 6. Travelers Data Filter */}
      <th className="p-1.5">
        <div className="relative">
          <input
            type="text"
            value={filters.traveler}
            onChange={(e) => onFilterChange("traveler", e.target.value)}
            placeholder="المعتمر / الجواز..."
            className={`w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 transition-colors ${
              filters.traveler ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
            }`}
          />
          {filters.traveler && (
            <button
              type="button"
              onClick={() => onFilterChange("traveler", "")}
              className="absolute left-1.5 top-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="مسح"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </th>

      {/* 7. Host Data Filter */}
      <th className="p-1.5">
        <select
          value={filters.hosting}
          onChange={(e) => onFilterChange("hosting", e.target.value as TableColumnFiltersState["hosting"])}
          className={`w-full px-2 py-1 text-[11px] rounded-lg border bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer transition-colors ${
            filters.hosting !== "ALL" ? "border-sky-500 ring-1 ring-sky-300 font-bold bg-sky-50/50" : "border-gray-200"
          }`}
        >
          <option value="ALL">الكل (استضافة / بدون)</option>
          <option value="WITH_HOST">مع استضافة</option>
          <option value="WITHOUT_HOST">بدون استضافة</option>
        </select>
      </th>

      {/* 8. Reset Action */}
      <th className="p-1.5 text-center">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="إلغاء وتصفير فلاتر الأعمدة"
          >
            <RotateCcw className="w-3 h-3" />
            <span>مسح ↺</span>
          </button>
        ) : (
          <span className="text-[10px] text-sky-700 font-medium bg-sky-100/60 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>فلترة</span>
          </span>
        )}
      </th>
    </tr>
  );
}

interface TableColumnFiltersToggleProps {
  role?: string;
  isOpen: boolean;
  onToggle: () => void;
  activeCount: number;
}

export function TableColumnFiltersToggle({
  role,
  isOpen,
  onToggle,
  activeCount,
}: TableColumnFiltersToggleProps) {
  if (role !== "Admin") return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
        isOpen || activeCount > 0
          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
      title="إظهار / إخفاء فلاتر الأعمدة المباشرة في رأس الجدول (للأدمن فقط)"
    >
      <Filter className="w-3.5 h-3.5" />
      <span>فلاتر الأعمدة</span>
      {activeCount > 0 && (
        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
          {activeCount}
        </span>
      )}
    </button>
  );
}
