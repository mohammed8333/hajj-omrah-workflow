"use client";

import React, { useState } from "react";
import {
  FileText,
  Plane,
  Home,
  Users,
  Eye,
  Download,
  Phone,
  Ticket,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Edit2,
  MessageSquare,
} from "lucide-react";
import { DocumentItem, DocumentReviewStatus, GroupRequestDetail } from "@/types";
import { DocumentStatusBadge } from "@/components/ui/StatusBadge";
import { getWhatsAppUrl, getTelUrl, normalizePhone } from "@/lib/phoneUtils";
import { checkPassportValidity } from "@/lib/passportValidation";

interface SafaEmployeeViewProps {
  request: GroupRequestDetail;
  ticketDoc?: DocumentItem;
  hostDoc?: DocumentItem;
  totalDocsCount: number;
  isDownloadingAll: boolean;
  onDownloadAllDocs: () => Promise<void>;
  onPreviewDoc: (doc: DocumentItem) => void;
  onDownloadDoc: (doc: DocumentItem) => void;
  onQuickReview: (
    docId: string,
    status: DocumentReviewStatus,
    note?: string
  ) => Promise<void>;
  onUpdateTraveler: (
    travelerId: string,
    fullName: string,
    passportNumber?: string,
    phoneNumber?: string,
    nationality?: string,
    dateOfBirth?: string,
    expiryDate?: string
  ) => Promise<void>;
  onRequestCorrection: (target: {
    travelerId?: string;
    documentId?: string;
    targetField?: string;
  }) => void;
  actionLoading: boolean;
}

export const SafaEmployeeView: React.FC<SafaEmployeeViewProps> = ({
  request,
  ticketDoc,
  hostDoc,
  totalDocsCount,
  isDownloadingAll,
  onDownloadAllDocs,
  onPreviewDoc,
  onDownloadDoc,
  onQuickReview,
  onUpdateTraveler,
  onRequestCorrection,
  actionLoading,
}) => {
  const [editingTravelerId, setEditingTravelerId] = useState<string | null>(null);
  const [editTravelerName, setEditTravelerName] = useState("");
  const [editTravelerPassport, setEditTravelerPassport] = useState("");
  const [editTravelerPhone, setEditTravelerPhone] = useState("");
  const [editTravelerNationality, setEditTravelerNationality] = useState("");
  const [editTravelerBirthDate, setEditTravelerBirthDate] = useState("");
  const [editTravelerExpiryDate, setEditTravelerExpiryDate] = useState("");

  const handleStartEditTraveler = (t: any) => {
    setEditingTravelerId(t.id);
    setEditTravelerName(t.fullName);
    setEditTravelerPassport(t.passportNumber || "");
    setEditTravelerPhone(t.phoneNumber || "");
    setEditTravelerNationality(t.nationality || "");
    setEditTravelerBirthDate(t.dateOfBirth || "");
    setEditTravelerExpiryDate(t.expiryDate || "");
  };

  const handleSaveTraveler = async () => {
    if (!editingTravelerId) return;
    await onUpdateTraveler(
      editingTravelerId,
      editTravelerName,
      editTravelerPassport,
      editTravelerPhone,
      editTravelerNationality,
      editTravelerBirthDate,
      editTravelerExpiryDate
    );
    setEditingTravelerId(null);
  };

  const renderDocBox = (
    title: string,
    icon: React.ReactNode,
    doc?: DocumentItem,
    isRequired: boolean = true
  ) => {
    return (
      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/70 flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between gap-1 border-b border-gray-200/60 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon}
            <span className="text-xs font-bold text-gray-800 truncate">
              {title}
              {isRequired && <span className="text-red-500 mr-0.5">*</span>}
            </span>
          </div>
          {doc ? (
            <DocumentStatusBadge status={doc.reviewStatus} />
          ) : (
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium shrink-0">
              غير مرفوع
            </span>
          )}
        </div>

        {doc ? (
          <div className="space-y-2">
            <div
              className="text-[11px] text-gray-600 truncate font-mono"
              title={doc.originalFileName}
            >
              {doc.originalFileName}
            </div>
            {doc.fileSize ? (
              <div className="text-[10px] text-gray-400">
                {(doc.fileSize / 1024).toFixed(1)} KB
              </div>
            ) : null}

            {doc.reviewNote && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                ملاحظة: {doc.reviewNote}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-gray-200/60">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onPreviewDoc(doc);
                  }}
                  className="p-1.5 text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer border border-sky-200"
                  title="معاينة المستند"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onDownloadDoc(doc);
                  }}
                  className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer border border-emerald-200"
                  title="تنزيل المستند"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Review Buttons for Safa Employee */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onQuickReview(doc.id, "Accepted");
                  }}
                  disabled={actionLoading}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs ${
                    doc.reviewStatus === "Accepted"
                      ? "bg-emerald-700 text-white ring-2 ring-emerald-400"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                  title="قبول المستند (صح)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onQuickReview(doc.id, "NeedsCorrection");
                  }}
                  disabled={actionLoading}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs ${
                    doc.reviewStatus === "NeedsCorrection"
                      ? "bg-amber-600 text-white ring-2 ring-amber-400"
                      : "bg-amber-500 hover:bg-amber-600 text-white"
                  }`}
                  title="طلب تصحيح للمستند (مثلث)"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onQuickReview(doc.id, "Rejected");
                  }}
                  disabled={actionLoading}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs ${
                    doc.reviewStatus === "Rejected"
                      ? "bg-rose-700 text-white ring-2 ring-rose-400"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                  title="رفض المستند (إكس)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-gray-400 text-xs">
            لم يتم رفع المستند بعد
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Safa Header Bar with Top Download All Button */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>لوحة تدقيق ومطابقة المستندات لموظف الصفا</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            مطابقة مستندات الهوية والجواز والصورة الشخصية وتذكرة الطيران تمهيداً لإصدار رقم نسك
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadAllDocs}
          disabled={isDownloadingAll || totalDocsCount === 0}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
        >
          {isDownloadingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>تحميل كافة المستندات (ملف مضغوط ZIP)</span>
          <span className="bg-emerald-800 text-emerald-100 text-[11px] px-2 py-0.5 rounded-full font-bold">
            {totalDocsCount} مستند
          </span>
        </button>
      </div>

      {/* Compact Flight Schedule Reference Bar for Safa */}
      <div className="bg-sky-50/50 rounded-2xl border border-sky-200 p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-sky-900 border-b border-sky-200/60 pb-2">
          <div className="flex items-center gap-1.5">
            <Plane className="w-4 h-4 text-sky-600" />
            <span>مواعيد وبيانات الرحلة المشتركة (مرجع التسجيل):</span>
          </div>
          {ticketDoc && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreviewDoc(ticketDoc)}
                className="text-[11px] text-sky-700 hover:text-sky-900 bg-white hover:bg-sky-100 border border-sky-300 font-bold px-2 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>معاينة التذكرة</span>
              </button>
              <button
                type="button"
                onClick={() => onDownloadDoc(ticketDoc)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 font-bold px-2 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>تحميل التذكرة</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="bg-white p-2 rounded-lg border border-sky-100">
            <span className="text-gray-400 block text-[10px]">الطيران:</span>
            <span className="font-bold text-gray-800 truncate block">
              {request.airline || "غير محدد"}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-sky-100">
            <span className="text-gray-400 block text-[10px]">رقم الرحلة:</span>
            <span className="font-bold text-gray-800 font-mono uppercase block">
              {request.flightNumber || "غير محدد"}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-sky-100">
            <span className="text-gray-400 block text-[10px]">تاريخ الذهاب:</span>
            <span className="font-bold text-gray-800 block">
              {request.departureDate || request.travelDate
                ? new Date(request.departureDate || request.travelDate!).toLocaleDateString("ar-SA")
                : "غير محدد"}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-sky-100">
            <span className="text-gray-400 block text-[10px]">تاريخ العودة:</span>
            <span className="font-bold text-gray-800 block">
              {request.returnDate ? new Date(request.returnDate).toLocaleDateString("ar-SA") : "غير محدد"}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-sky-100">
            <span className="text-gray-400 block text-[10px]">إقلاع الطائرة:</span>
            <span className="font-bold text-gray-800 font-mono block" dir="ltr">
              {request.flightDepartureTime || "غير محدد"}
            </span>
          </div>
          <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
            <span className="text-amber-800 block text-[10px] font-semibold">تواجد المطار:</span>
            <span className="font-bold text-amber-900 font-mono block" dir="ltr">
              {request.airportArrivalTime || "غير محدد"}
            </span>
          </div>
        </div>
      </div>

      {/* Travelers 4-Documents Side-by-Side Cards */}
      <div className="space-y-4">
        {request.travelers.map((traveler, tIndex) => {
          const passportDoc = traveler.documents?.find((d) => d.documentType === "Passport");
          const photoDoc = traveler.documents?.find((d) => d.documentType === "PersonalPhoto");

          return (
            <div
              key={traveler.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3"
            >
              {/* Traveler Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                    {tIndex + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {traveler.fullName}
                  </h3>
                  {traveler.passportNumber && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      جواز: {traveler.passportNumber}
                    </span>
                  )}
                  {traveler.phoneNumber && (
                    <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      <a
                        href={getWhatsAppUrl(traveler.phoneNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-mono font-bold text-xs hover:underline"
                        title="مراسلة المسافر عبر واتساب"
                        dir="ltr"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600 shrink-0" />
                        <span>{normalizePhone(traveler.phoneNumber).displayFormatted || traveler.phoneNumber}</span>
                      </a>
                      <span className="text-emerald-300">|</span>
                      <a
                        href={getTelUrl(traveler.phoneNumber)}
                        className="p-0.5 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-100 transition-colors"
                        title="اتصال هاتفي بالمسافر"
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {traveler.nationality && (
                    <span className="text-xs text-gray-500">
                      ({traveler.nationality})
                    </span>
                  )}
                  {traveler.expiryDate && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      انتهاء: {traveler.expiryDate}
                    </span>
                  )}
                  {(() => {
                    const validity = checkPassportValidity(traveler.expiryDate, request.travelDate);
                    if (validity.warning) {
                      return (
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{validity.warning}</span>
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEditTraveler(traveler)}
                    className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 px-2 py-1 rounded-md font-semibold cursor-pointer border border-sky-200"
                    title="تعديل الهاتف أو البيانات"
                  >
                    <Edit2 className="w-3 h-3 inline ml-1" />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onRequestCorrection({
                        travelerId: traveler.id,
                        targetField: "مستندات المسافر",
                      });
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md font-semibold cursor-pointer"
                  >
                    طلب تصحيح
                  </button>
                </div>
              </div>

              {/* Inline Editor if Safa employee edits traveler */}
              {editingTravelerId === traveler.id && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-gray-600 mb-0.5">اسم المسافر:</label>
                      <input
                        type="text"
                        value={editTravelerName}
                        onChange={(e) => setEditTravelerName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-0.5">رقم الجواز:</label>
                      <input
                        type="text"
                        value={editTravelerPassport}
                        onChange={(e) => setEditTravelerPassport(e.target.value.toUpperCase())}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-0.5">انتهاء الجواز:</label>
                      <input
                        type="text"
                        value={editTravelerExpiryDate}
                        onChange={(e) => setEditTravelerExpiryDate(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-0.5">رقم الهاتف:</label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={editTravelerPhone}
                        onChange={(e) => setEditTravelerPhone(e.target.value)}
                        placeholder="010xxxxxxxx"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono text-left"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveTraveler}
                      disabled={actionLoading || !editTravelerName.trim()}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTravelerId(null)}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg font-medium"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Documents Side-by-Side Grid */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 ${
                  request.hasHosting ? "lg:grid-cols-4" : "lg:grid-cols-3"
                } gap-3 pt-1`}
              >
                {/* 1. صورة هوية المستضيف */}
                {request.hasHosting &&
                  renderDocBox(
                    "هوية المستضيف",
                    <Home className="w-4 h-4 text-amber-600" />,
                    hostDoc,
                    true
                  )}

                {/* 2. صورة جواز السفر */}
                {renderDocBox(
                  "جواز السفر",
                  <FileText className="w-4 h-4 text-sky-600" />,
                  passportDoc,
                  true
                )}

                {/* 3. الصورة الشخصية */}
                {renderDocBox(
                  "الصورة الشخصية",
                  <Users className="w-4 h-4 text-emerald-600" />,
                  photoDoc,
                  true
                )}

                {/* 4. تذكرة الطيران المشتركة */}
                {renderDocBox(
                  "تذكرة الطيران",
                  <Ticket className="w-4 h-4 text-purple-600" />,
                  ticketDoc,
                  true
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Download All Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onDownloadAllDocs}
          disabled={isDownloadingAll || totalDocsCount === 0}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
        >
          {isDownloadingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>تحميل كافة المستندات (ملف مضغوط ZIP)</span>
          <span className="bg-emerald-800 text-emerald-100 text-[11px] px-2 py-0.5 rounded-full font-bold">
            {totalDocsCount} مستند
          </span>
        </button>
      </div>
    </div>
  );
};
