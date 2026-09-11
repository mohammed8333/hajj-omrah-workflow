import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  FilePlus,
  Users,
  Home,
  AlertCircle,
  ArrowRight,
  Plus,
  Trash2,
  Calendar,
  Phone,
  Plane,
} from "lucide-react";

interface TravelerDraft {
  fullName: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
}

export default function NewRequestPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Basic Form
  const [groupName, setGroupName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [destination, setDestination] = useState("مكة المكرمة والمدينة المنورة");
  const [notes, setNotes] = useState("");

  // Hosting
  const [hasHosting, setHasHosting] = useState(false);
  const [hostName, setHostName] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [hostAddress, setHostAddress] = useState("");

  // Initial Travelers
  const [travelers, setTravelers] = useState<TravelerDraft[]>([
    { fullName: "", passportNumber: "", nationality: "سعودي", dateOfBirth: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTravelerField = () => {
    setTravelers([
      ...travelers,
      { fullName: "", passportNumber: "", nationality: "سعودي", dateOfBirth: "" },
    ]);
  };

  const handleRemoveTravelerField = (index: number) => {
    setTravelers(travelers.filter((_, i) => i !== index));
  };

  const handleTravelerChange = (
    index: number,
    field: keyof TravelerDraft,
    val: string
  ) => {
    const updated = [...travelers];
    updated[index][field] = val;
    setTravelers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !contactPhone.trim()) {
      setError("يرجى إدخال اسم الفوج ورقم هاتف التواصل.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Create Request
      const newReq = await api.requests.create({
        groupName: groupName.trim(),
        contactPhone: contactPhone.trim(),
        travelDate: travelDate || undefined,
        destination: destination || undefined,
        notes: notes || undefined,
        hasHosting,
        hostName: hasHosting ? hostName : undefined,
        hostPhone: hasHosting ? hostPhone : undefined,
        hostAddress: hasHosting ? hostAddress : undefined,
      });

      // 2. Add travelers if filled
      for (const trv of travelers) {
        if (trv.fullName.trim()) {
          await api.travelers.add(newReq.id, {
            fullName: trv.fullName.trim(),
            passportNumber: trv.passportNumber?.trim() || undefined,
            nationality: trv.nationality?.trim() || undefined,
            dateOfBirth: trv.dateOfBirth || undefined,
          });
        }
      }

      // Navigate to detail page
      navigate(`/requests/${newReq.id}`);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء حفظ المعاملة");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-2 font-semibold cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">إنشاء معاملة حج أو عمرة جديدة</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            أدخل بيانات الفوج والمعتمرين لحفظ المسودة ورفع الجوازات والوثائق
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Group Basic Information */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Plane className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-gray-900">بيانات الفوج الأساسية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                اسم المجموعة / الفوج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="مثال: فوج الهدى والنور - عمرة شعبان"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                رقم هاتف مسؤول التواصل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="مثال: 0551234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                تاريخ السفر المتوقع
              </label>
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                الوجهة
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="مثال: مكة المكرمة والمدينة المنورة"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              ملاحظات أو تعليمات إضافية
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي ملاحظات خاصة بالفوج..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Section 2: Hosting Information */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-gray-900">معلومات الاستضافة والسكن</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={hasHosting}
                onChange={(e) => setHasHosting(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <span>توجد جهة مستضيفة أو فندق محدد</span>
            </label>
          </div>

          {hasHosting && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  اسم المستضيف / الفندق
                </label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="مثال: فندق أبراج مكة"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  هاتف المستضيف
                </label>
                <input
                  type="text"
                  value={hostPhone}
                  onChange={(e) => setHostPhone(e.target.value)}
                  placeholder="مثال: 0125559999"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  العنوان / الموقع
                </label>
                <input
                  type="text"
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  placeholder="مثال: مكة المكرمة - أجياد"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Initial Travelers */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">إضافة المعتمرين</h2>
            </div>
            <button
              type="button"
              onClick={handleAddTravelerField}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة معتمر آخر</span>
            </button>
          </div>

          <div className="space-y-3">
            {travelers.map((trv, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end relative"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    اسم المعتمر الكامل
                  </label>
                  <input
                    type="text"
                    value={trv.fullName}
                    onChange={(e) =>
                      handleTravelerChange(idx, "fullName", e.target.value)
                    }
                    placeholder="الاسم الرباعي كما في الجواز"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    رقم جواز السفر
                  </label>
                  <input
                    type="text"
                    value={trv.passportNumber || ""}
                    onChange={(e) =>
                      handleTravelerChange(idx, "passportNumber", e.target.value)
                    }
                    placeholder="مثال: A12345678"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    الجنسية
                  </label>
                  <input
                    type="text"
                    value={trv.nationality || ""}
                    onChange={(e) =>
                      handleTravelerChange(idx, "nationality", e.target.value)
                    }
                    placeholder="مثال: مصري، أردني..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      تاريخ الميلاد
                    </label>
                    <input
                      type="date"
                      value={trv.dateOfBirth || ""}
                      onChange={(e) =>
                        handleTravelerChange(idx, "dateOfBirth", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                    />
                  </div>

                  {travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTravelerField(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            * يمكنك إرفاق صور الجوازات وتذاكر الطيران بعد حفظ المعاملة من صفحة تفاصيل الفوج.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="submit"
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FilePlus className="w-5 h-5" />
                <span>حفظ ومتابعة رفع المستندات</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
