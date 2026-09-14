"use client";

import React, { useState } from "react";
import {
  Building,
  Plane,
  Home,
  Users,
  Eye,
  Download,
  Phone,
  Ticket,
  Calendar,
  Clock,
  Edit2,
  Check,
  MessageSquare,
} from "lucide-react";
import { DocumentItem, GroupRequestDetail } from "@/types";
import { getWhatsAppUrl, getTelUrl, normalizePhone } from "@/lib/phoneUtils";

interface SaudiAgentViewProps {
  request: GroupRequestDetail;
  ticketDoc?: DocumentItem;
  hostDoc?: DocumentItem;
  onPreviewDoc: (doc: DocumentItem) => void;
  onDownloadDoc: (doc: DocumentItem) => void;
  onUpdateTraveler: (
    travelerId: string,
    fullName: string,
    passportNumber?: string,
    phoneNumber?: string,
    nationality?: string,
    dateOfBirth?: string
  ) => Promise<void>;
  onSaveNusukNumber: (num: string) => Promise<void>;
  actionLoading: boolean;
}

export const SaudiAgentView: React.FC<SaudiAgentViewProps> = ({
  request,
  ticketDoc,
  hostDoc,
  onPreviewDoc,
  onDownloadDoc,
  onUpdateTraveler,
  onSaveNusukNumber,
  actionLoading,
}) => {
  const [editingNusuk, setEditingNusuk] = useState(false);
  const [nusukInput, setNusukInput] = useState(request.nusukGroupNumber || "");

  const [editingTravelerId, setEditingTravelerId] = useState<string | null>(null);
  const [editTravelerName, setEditTravelerName] = useState("");
  const [editTravelerPassport, setEditTravelerPassport] = useState("");
  const [editTravelerPhone, setEditTravelerPhone] = useState("");
  const [editTravelerNationality, setEditTravelerNationality] = useState("");
  const [editTravelerBirthDate, setEditTravelerBirthDate] = useState("");

  const handleStartEditTraveler = (t: any) => {
    setEditingTravelerId(t.id);
    setEditTravelerName(t.fullName);
    setEditTravelerPassport(t.passportNumber || "");
    setEditTravelerPhone(t.phoneNumber || "");
    setEditTravelerNationality(t.nationality || "");
    setEditTravelerBirthDate(t.dateOfBirth || "");
  };

  const handleSaveTraveler = async () => {
    if (!editingTravelerId) return;
    await onUpdateTraveler(
      editingTravelerId,
      editTravelerName,
      editTravelerPassport,
      editTravelerPhone,
      editTravelerNationality,
      editTravelerBirthDate
    );
    setEditingTravelerId(null);
  };

  const handleSaveNusuk = async () => {
    await onSaveNusukNumber(nusukInput);
    setEditingNusuk(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Nusuk Group Number Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-gray-900">رقم مجموعة نسك</h2>
          </div>
          {!editingNusuk && (
            <button
              type="button"
              onClick={() => {
                setNusukInput(request.nusukGroupNumber || "");
                setEditingNusuk(true);
              }}
              className="text-xs text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{request.nusukGroupNumber ? "تعديل رقم نسك" : "إدخال رقم نسك"}</span>
            </button>
          )}
        </div>

        {editingNusuk ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-teal-50/50 p-4 rounded-xl border border-teal-200">
            <input
              type="text"
              value={nusukInput}
              onChange={(e) => setNusukInput(e.target.value)}
              placeholder="مثال: NUSUK-109283"
              className="flex-1 px-3 py-2 bg-white border border-teal-300 rounded-lg text-sm font-mono font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveNusuk}
                disabled={actionLoading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingNusuk(false)}
                className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-semibold">الرقم المعتمد:</span>
            {request.nusukGroupNumber ? (
              <span className="text-base font-mono font-black text-teal-800 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
                {request.nusukGroupNumber}
              </span>
            ) : (
              <span className="text-xs text-gray-400 font-medium">
                لم يتم توثيق رقم مجموعة نسك بعد
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Flight Details Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-sky-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                بيانات وتذكرة الطيران للمجموعة
              </h2>
              <p className="text-xs text-gray-500">
                تذكرة ومواعيد سفر موحدة لكافة مسافري المعاملة
              </p>
            </div>
          </div>
          {ticketDoc && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreviewDoc(ticketDoc)}
                className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة التذكرة</span>
              </button>
              <button
                type="button"
                onClick={() => onDownloadDoc(ticketDoc)}
                className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل التذكرة</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Plane className="w-3.5 h-3.5 text-sky-600" />
              <span>شركة / نوع الطيران:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.airline || "غير محدد"}
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Ticket className="w-3.5 h-3.5 text-sky-600" />
              <span>رقم الرحلة:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm font-mono uppercase">
              {request.flightNumber || "غير محدد"}
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>تاريخ ذهاب:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.departureDate || request.travelDate
                ? new Date(request.departureDate || request.travelDate!).toLocaleDateString(
                    "ar-SA"
                  )
                : "غير محدد"}
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>تاريخ عودة:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.returnDate
                ? new Date(request.returnDate).toLocaleDateString("ar-SA")
                : "غير محدد"}
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>وقت إقلاع طائرة الذهاب:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm font-mono" dir="ltr">
              {request.flightDepartureTime || "غير محدد"}
            </span>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <div className="flex items-center justify-between text-amber-900 mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>وقت تواجد المسافر في المطار:</span>
              </span>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1 rounded font-bold">
                قبل الإقلاع بـ 3 ساعات
              </span>
            </div>
            <span className="font-bold text-gray-900 text-sm font-mono" dir="ltr">
              {request.airportArrivalTime || "غير محدد"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Hosting Information Card */}
      {request.hasHosting && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-gray-900">
                بيانات الاستضافة المشتركة
              </h2>
            </div>
            {hostDoc && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPreviewDoc(hostDoc)}
                  className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة هوية المستضيف</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadDoc(hostDoc)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل هوية المستضيف</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">اسم المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostName || "غير محدد"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">رقم هاتف المستضيف:</span>
              {request.hostingInfo?.hostPhone || request.contactPhone ? (
                <a
                  href={`tel:${request.hostingInfo?.hostPhone || request.contactPhone}`}
                  className="font-bold text-emerald-700 hover:text-emerald-900 text-sm font-mono inline-flex items-center gap-1"
                  dir="ltr"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{request.hostingInfo?.hostPhone || request.contactPhone}</span>
                </a>
              ) : (
                <span className="text-gray-400">غير محدد</span>
              )}
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">جنسية المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostNationality || "غير محدد"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">رقم الهوية / الإقامة:</span>
              <span className="font-bold text-gray-800 text-sm font-mono">
                {request.hostingInfo?.hostNationalId || "غير محدد"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">تاريخ ميلاد المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostBirthDate || "غير محدد"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">عنوان المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostAddress || "غير محدد"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Travelers List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">
              أسماء وبيانات المسافرين ({request.travelers.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="p-3 font-bold">#</th>
                <th className="p-3 font-bold">اسم المسافر</th>
                <th className="p-3 font-bold">رقم الجواز</th>
                <th className="p-3 font-bold">رقم الهاتف</th>
                <th className="p-3 font-bold">الجنسية</th>
                <th className="p-3 font-bold">تاريخ الميلاد</th>
                <th className="p-3 font-bold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {request.travelers.map((traveler, idx) => (
                <tr key={traveler.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-bold text-gray-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-gray-900">{traveler.fullName}</td>
                  <td className="p-3 font-mono font-semibold text-gray-700">
                    {traveler.passportNumber || "—"}
                  </td>
                  <td className="p-3">
                    {traveler.phoneNumber ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        <a
                          href={getWhatsAppUrl(traveler.phoneNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-mono font-bold hover:underline"
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
                    ) : (
                      <span className="text-gray-400">غير مسجل</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">{traveler.nationality || "—"}</td>
                  <td className="p-3 font-mono text-gray-700">{traveler.dateOfBirth || "—"}</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleStartEditTraveler(traveler)}
                      className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 font-bold transition-colors cursor-pointer"
                      title="تعديل بيانات المسافر أو إضافة الهاتف"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تعديل الهاتف / البيانات</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline Editor for Saudi Agent */}
        {editingTravelerId && (
          <div className="mt-4 p-4 bg-sky-50/60 rounded-xl border border-sky-200 space-y-3">
            <div className="font-bold text-xs text-sky-900">
              تعديل بيانات المسافر ورقم الهاتف:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
              <div>
                <label className="block text-gray-600 mb-0.5">اسم المسافر:</label>
                <input
                  type="text"
                  value={editTravelerName}
                  onChange={(e) => setEditTravelerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-0.5">رقم الجواز:</label>
                <input
                  type="text"
                  value={editTravelerPassport}
                  onChange={(e) => setEditTravelerPassport(e.target.value.toUpperCase())}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-0.5">رقم الهاتف:</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={editTravelerPhone}
                  onChange={(e) => setEditTravelerPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-mono font-bold text-left"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-0.5">الجنسية:</label>
                <input
                  type="text"
                  value={editTravelerNationality}
                  onChange={(e) => setEditTravelerNationality(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-0.5">تاريخ الميلاد:</label>
                <input
                  type="text"
                  value={editTravelerBirthDate}
                  onChange={(e) => setEditTravelerBirthDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-sky-200">
              <button
                type="button"
                onClick={handleSaveTraveler}
                disabled={actionLoading || !editTravelerName.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ التعديلات</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingTravelerId(null)}
                className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
