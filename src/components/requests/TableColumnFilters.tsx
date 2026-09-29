"use client";

import React, { useState, useRef, useEffect } from "react";
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

export const SAUDI_AGENT_STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "ReadyForSaudiAgent", label: "جديد محال من صفا" },
  { value: "ReceivedBySaudiAgent", label: "مستلم من الوكيل" },
  { value: "SaudiAgentProcessing", label: "قيد المعالجة" },
  { value: "ProgramLinked", label: "تم ربط البرنامج" },
  { value: "HostingAcceptanceRequested", label: "بانتظار قبول الاستضافة" },
  { value: "HostingAcceptedBySender", label: "تم قبول الاستضافة" },
  { value: "HostingConfirmed", label: "تم تأكيد الاستضافة" },
  { value: "SaudiAgentCorrectionRequired", label: "مطلوب تصحيح" },
  { value: "Completed", label: "(تم) - مكتمل" },
  { value: "Archived", label: "معاملات مؤرشفة" },
];

export const DEFAULT_STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "Draft", label: "مسودة" },
  { value: "Submitted", label: "تم التقديم" },
  { value: "UnderReview", label: "قيد المراجعة" },
  { value: "MissingDocuments", label: "مستندات ناقصة" },
  { value: "CorrectionRequired", label: "مطلوب تصحيح" },
  { value: "DocumentsCompleted", label: "المستندات مكتملة" },
  { value: "SafaRegistrationCompleted", label: "اكتمل تسجيل صفا" },
  { value: "ReadyForSaudiAgent", label: "جاهز للوكيل السعودي" },
  { value: "ReceivedBySaudiAgent", label: "مستلم من الوكيل" },
  { value: "ProgramLinked", label: "تم ربط البرنامج" },
  { value: "HostingAcceptanceRequested", label: "بانتظار قبول الاستضافة" },
  { value: "HostingAcceptedBySender", label: "تم قبول الاستضافة" },
  { value: "HostingConfirmed", label: "تم تأكيد الاستضافة" },
  { value: "SaudiAgentProcessing", label: "قيد المعالجة" },
  { value: "Completed", label: "(تم) - مكتمل" },
  { value: "Cancelled", label: "ملغي" },
  { value: "Archived", label: "معاملات مؤرشفة" },
];

export const STATUS_DISPLAY_NAMES: Record<string, string> = {
  Draft: "مسودة",
  Submitted: "تم التقديم",
  UnderReview: "قيد المراجعة",
  MissingDocuments: "مستندات ناقصة",
  CorrectionRequired: "مطلوب تصحيح",
  DocumentsCompleted: "المستندات مكتملة",
  SafaRegistrationCompleted: "اكتمل تسجيل صفا",
  ReadyForSaudiAgent: "جاهز للوكيل السعودي",
  ReceivedBySaudiAgent: "مستلم من الوكيل",
  SaudiAgentProcessing: "قيد المعالجة",
  SaudiAgentCorrectionRequired: "مطلوب تصحيح من الوكيل",
  ProgramLinked: "تم ربط البرنامج",
  HostingAcceptanceRequested: "بانتظار قبول الاستضافة",
  HostingAcceptedBySender: "تم قبول الاستضافة",
  HostingConfirmed: "تم تأكيد الاستضافة",
  Completed: "(تم) - مكتمل",
  Cancelled: "ملغي",
  Archived: "معاملات مؤرشفة",
};

export const SAUDI_AGENT_STATUS_DISPLAY_NAMES: Record<string, string> = {
  ...STATUS_DISPLAY_NAMES,
  ReadyForSaudiAgent: "جديد محال من صفا",
  SaudiAgentCorrectionRequired: "مطلوب تصحيح",
};

export const STATUS_WORKFLOW_ORDER: string[] = [
  "Draft",
  "Submitted",
  "UnderReview",
  "MissingDocuments",
  "CorrectionRequired",
  "DocumentsCompleted",
  "SafaRegistrationCompleted",
  "ReadyForSaudiAgent",
  "ReceivedBySaudiAgent",
  "SaudiAgentProcessing",
  "SaudiAgentCorrectionRequired",
  "ProgramLinked",
  "HostingAcceptanceRequested",
  "HostingAcceptedBySender",
  "HostingConfirmed",
  "Completed",
  "Cancelled",
  "Archived",
];

/**
 * Returns dynamic status filter options containing ONLY the statuses present
 * in the current requests dataset, plus the "جميع الحالات" (All) option.
 */
export function getDistinctStatusOptions(
  requests: GroupRequestSummary[],
  role?: string,
  selectedStatus?: string
): Array<{ value: string; label: string }> {
  const labelMap = role === "SaudiAgent" ? SAUDI_AGENT_STATUS_DISPLAY_NAMES : STATUS_DISPLAY_NAMES;
  const presentStatuses = new Set<string>();

  (requests || []).forEach((r) => {
    if (r.status && typeof r.status === "string" && r.status.trim()) {
      presentStatuses.add(r.status.trim());
    }
  });

  // Preserve the currently selected status if any, so user doesn't get an orphan state
  if (selectedStatus && selectedStatus.trim()) {
    presentStatuses.add(selectedStatus.trim());
  }

  const options: Array<{ value: string; label: string }> = [
    { value: "", label: "جميع الحالات" },
  ];

  // Add present statuses in natural workflow order
  STATUS_WORKFLOW_ORDER.forEach((st) => {
    if (presentStatuses.has(st)) {
      options.push({
        value: st,
        label: labelMap[st] || st,
      });
      presentStatuses.delete(st);
    }
  });

  // If there are any non-standard or custom statuses present, append them
  presentStatuses.forEach((st) => {
    options.push({
      value: st,
      label: labelMap[st] || st,
    });
  });

  return options;
}

export const HOSTING_OPTIONS = [
  { value: "ALL", label: "الكل (استضافة / بدون)" },
  { value: "WITH_HOST", label: "مع استضافة" },
  { value: "WITHOUT_HOST", label: "بدون استضافة" },
];

/**
 * Checks whether a request matches the active column filters
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

export interface HeaderColumnFilterProps {
  title: string;
  type: "text" | "select" | "date";
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  align?: "right" | "left" | "center";
}

/**
 * In-Header Column Filter Trigger & Popover
 * Rendered directly inside <th> cells (replacing the extra sub-header filter row)
 */
export function HeaderColumnFilter({
  title,
  type,
  value,
  onChange,
  onClear,
  options,
  placeholder,
  align = "right",
}: HeaderColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFiltered = Boolean(
    value && (type !== "select" || (value !== "" && value !== "ALL"))
  );

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus input when opening
    if (inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const alignmentClass =
    align === "left"
      ? "left-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "right-0";

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`relative p-1 rounded-md transition-all cursor-pointer inline-flex items-center justify-center ${
          isFiltered
            ? "bg-sky-600 text-white shadow-2xs ring-2 ring-sky-300 font-bold"
            : "text-gray-400 hover:text-sky-700 hover:bg-sky-100/80"
        }`}
        title={`تصفية حسب ${title}`}
      >
        <Filter className={`w-3 h-3 ${isFiltered ? "fill-current" : ""}`} />
        {isFiltered && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full ring-1 ring-white" />
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[220px] max-w-xs text-right font-normal text-xs text-gray-800 ${alignmentClass}`}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-100 font-bold text-gray-700">
            <div className="flex items-center gap-1.5 text-sky-800">
              <Filter className="w-3.5 h-3.5 text-sky-600" />
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-2">
            {type === "text" && (
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder || `بحث...`}
                  className="w-full pl-6 pr-2.5 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
                />
                {value && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="absolute left-2 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title="مسح"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {type === "date" && (
              <div className="relative">
                <input
                  ref={inputRef}
                  type="date"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white font-mono"
                />
              </div>
            )}

            {type === "select" && (
              <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                {options?.map((opt) => {
                  const isSelected =
                    value === opt.value ||
                    (!value && opt.value === "") ||
                    (!value && opt.value === "ALL");
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-sky-50 text-sky-800 font-bold"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <span className="text-sky-600 font-bold text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-gray-100 text-[11px]">
            {isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
              >
                مسح التصفية
              </button>
            ) : (
              <span className="text-gray-400">لا توجد تصفية</span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-md transition-colors cursor-pointer"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Deprecated components kept for compatibility if needed
export function TableColumnFiltersRow() {
  return null;
}

export function TableColumnFiltersToggle() {
  return null;
}
