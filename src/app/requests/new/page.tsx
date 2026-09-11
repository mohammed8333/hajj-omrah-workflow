"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Users,
  Home,
  Plus,
  Trash2,
  AlertCircle,
  ArrowRight,
  Save,
  Send,
  Upload,
  FileText,
  Image as ImageIcon,
  Ticket,
  CheckCircle2,
  X,
  Loader2,
  ShieldCheck,
  Plane,
  Calendar,
  Clock,
} from "lucide-react";

interface TravelerDraft {
  id: string;
  passportFile: File | null;
  passportPreview?: string;
  photoFile: File | null;
  photoPreview?: string;
  ticketFile: File | null;
}

export default function UnifiedNewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Hosting
  const [hasHosting, setHasHosting] = useState(false);
  const [hostPhone, setHostPhone] = useState("");
  const [hostIdFile, setHostIdFile] = useState<File | null>(null);

  // Flight & Travel Details
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flightDepartureTime, setFlightDepartureTime] = useState("");
  const [airportArrivalTime, setAirportArrivalTime] = useState("");

  // Travelers with Direct Documents
  const [travelers, setTravelers] = useState<TravelerDraft[]>([
    {
      id: "tr-1",
      passportFile: null,
      photoFile: null,
      ticketFile: null,
    },
  ]);

  // Loading & Progress State
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Add new traveler
  const addTraveler = () => {
    setTravelers((prev) => [
      ...prev,
      {
        id: `tr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        passportFile: null,
        photoFile: null,
        ticketFile: null,
      },
    ]);
  };

  // Remove traveler
  const removeTraveler = (id: string) => {
    if (travelers.length <= 1) {
      alert("يجب أن تحتوي المعاملة على مسافر واحد على الأقل.");
      return;
    }
    setTravelers((prev) => prev.filter((t) => t.id !== id));
  };

  // Handle document file changes
  const handleFileChange = (
    travelerId: string,
    docType: "passport" | "photo" | "ticket",
    file: File | null
  ) => {
    if (file && file.size > 10 * 1024 * 1024) {
      alert("حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).");
      return;
    }

    setTravelers((prev) =>
      prev.map((t) => {
        if (t.id !== travelerId) return t;
        const updated = { ...t };
        if (docType === "passport") {
          updated.passportFile = file;
          if (file && file.type.startsWith("image/")) {
            updated.passportPreview = URL.createObjectURL(file);
          } else {
            updated.passportPreview = undefined;
          }
        } else if (docType === "photo") {
          updated.photoFile = file;
          if (file && file.type.startsWith("image/")) {
            updated.photoPreview = URL.createObjectURL(file);
          } else {
            updated.photoPreview = undefined;
          }
        } else if (docType === "ticket") {
          updated.ticketFile = file;
        }
        return updated;
      })
    );
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 بايت";
    const k = 1024;
    const sizes = ["بايت", "كيلوبايت", "ميجابايت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Main Submit Handler (Draft or Direct Submit to Safa)
  const handleSubmit = async (submitDirectlyToSafa: boolean) => {
    setError(null);

    // Validation
    if (hasHosting) {
      if (!hostPhone.trim()) {
        setError("عند تفعيل الاستضافة، يرجى إدخال رقم هاتف المستضيف داخل المملكة.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!hostIdFile) {
        setError("عند تفعيل الاستضافة، يرجى إرفاق صورة أو مستند هوية المستضيف.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (travelers.length === 0) {
      setError("يرجى إضافة مسافر واحد على الأقل في المعاملة.");
      return;
    }

    // Check if at least one document is attached
    const totalAttached = travelers.filter(
      (t) => t.passportFile || t.photoFile || t.ticketFile
    ).length;

    if (totalAttached === 0) {
      setError("يرجى إرفاق مستند واحد على الأقل (جواز السفر، الصورة، أو التذكرة) لمتابعة الحفظ.");
      return;
    }

    if (submitDirectlyToSafa) {
      const missingPassports = travelers.filter((t) => !t.passportFile);
      if (missingPassports.length > 0) {
        const confirmSend = confirm(
          `تنبيه: لم يتم إرفاق صورة جواز السفر لعدد (${missingPassports.length}) مسافر. هل ترغب في إرسال المعاملة على أي حال؟`
        );
        if (!confirmSend) return;
      }
    }

    try {
      setLoading(true);
      setProgressPercent(10);
      setProgressStep("جاري إنشاء المعاملة الأساسية...");

      // 1. Create Request
      const createdGroup = await api.requests.create({
        groupName: "",
        contactPhone: "",
        hasHosting,
        hostPhone: hasHosting ? hostPhone.trim() : undefined,
        departureDate: departureDate || undefined,
        returnDate: returnDate || undefined,
        flightDepartureTime: flightDepartureTime || undefined,
        airportArrivalTime: airportArrivalTime || undefined,
      });

      // 2. Upload Host ID Document if selected
      if (hasHosting && hostIdFile) {
        setProgressStep("جاري رفع مستند هوية المستضيف...");
        await api.documents.upload(createdGroup.id, hostIdFile, "HostId");
      }

      // Calculate total uploads
      let totalFilesToUpload = (hasHosting && hostIdFile ? 1 : 0);
      travelers.forEach((t) => {
        if (t.passportFile) totalFilesToUpload++;
        if (t.photoFile) totalFilesToUpload++;
        if (t.ticketFile) totalFilesToUpload++;
      });

      let uploadedFilesCount = (hasHosting && hostIdFile ? 1 : 0);

      // 3. Create Travelers & Upload Documents
      for (let i = 0; i < travelers.length; i++) {
        const t = travelers[i];
        setProgressStep(`جاري تسجيل المسافر (${i + 1} من ${travelers.length})...`);
        setProgressPercent(20 + Math.floor((i / travelers.length) * 40));

        const createdTraveler = await api.travelers.add(createdGroup.id, {
          fullName: `مسافر #${i + 1}`,
        });

        // Upload Passport
        if (t.passportFile) {
          uploadedFilesCount++;
          setProgressStep(`جاري رفع جواز سفر المسافر (${i + 1})...`);
          await api.documents.upload(
            createdGroup.id,
            t.passportFile,
            "Passport",
            createdTraveler.id
          );
        }

        // Upload Photo
        if (t.photoFile) {
          uploadedFilesCount++;
          setProgressStep(`جاري رفع الصورة الشخصية للمسافر (${i + 1})...`);
          await api.documents.upload(
            createdGroup.id,
            t.photoFile,
            "PersonalPhoto",
            createdTraveler.id
          );
        }

        // Upload Ticket
        if (t.ticketFile) {
          uploadedFilesCount++;
          setProgressStep(`جاري رفع تذكرة الطيران للمسافر (${i + 1})...`);
          await api.documents.upload(
            createdGroup.id,
            t.ticketFile,
            "FlightTicket",
            createdTraveler.id
          );
        }
      }

      // 4. Submit to Safa directly if requested
      if (submitDirectlyToSafa) {
        setProgressPercent(90);
        setProgressStep("جاري إحالة المعاملة لموظف صفا للمراجعة والتدقيق...");
        await api.requests.submit(createdGroup.id);
      }

      setProgressPercent(100);
      setProgressStep("اكتمل رفع المعاملة والمستندات بنجاح! جاري الانتقال...");

      setTimeout(() => {
        router.push(`/requests/${createdGroup.id}`);
      }, 500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("حدث خطأ أثناء حفظ المعاملة والمستندات.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-44 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link
              href="/requests"
              className="hover:text-blue-600 flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              العودة إلى المعاملات
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">معاملة جديدة</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>إنشاء معاملة ورفع المستندات</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
              رفع مباشر
            </span>
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            ارفع جوازات وصور وتذاكر المسافرين مباشرة دون الحاجة لأي كتابة نصية مسبقة.
          </p>
        </div>

        {/* Quick Help Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>الملفات تُحفظ في خزينة مشفرة ومحمية وتخضع للفحص التلقائي.</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">تنبيه بالخطأ</h4>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Hosting (Corrected style with toggle knob & file upload only) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                بيانات الاستضافة والسكن داخل المملكة
              </h2>
              <p className="text-xs text-gray-500">
                قم بتفعيل الخيار في حال وجود مستضيف داخل المملكة لرفع مستند الهوية
              </p>
            </div>
          </div>

          {/* Corrected iOS Style Switch in LTR container */}
          <div dir="ltr" className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 select-none">
              {hasHosting ? "مُفعّل" : "معطّل"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hasHosting}
              onClick={() => setHasHosting(!hasHosting)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                hasHosting ? "bg-amber-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  hasHosting ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* When Hosting is active: Host phone + Host ID upload */}
        {hasHosting && (
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                رقم هاتف المستضيف داخل المملكة <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={hostPhone}
                onChange={(e) => setHostPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="w-full sm:max-w-md px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">
                مرفق هوية المستضيف (PDF / صورة) <span className="text-red-500">*</span>
              </label>
            <div className="relative">
              <input
                type="file"
                id="host-id-file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setHostIdFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="host-id-file"
                className={`w-full flex items-center justify-between p-4 text-sm rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  hostIdFile
                    ? "bg-green-50/60 border-green-400 text-green-900"
                    : "bg-gray-50/50 border-gray-300 hover:border-amber-400 hover:bg-amber-50/30 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                    ID
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {hostIdFile ? hostIdFile.name : "اضغط لاختيار أو سحب ملف هوية المستضيف"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hostIdFile
                        ? `${formatFileSize(hostIdFile.size)} - جاهز للرفع`
                        : "الصيغ المسموحة: PDF, JPG, PNG (حد أقصى 10MB)"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hostIdFile ? (
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> تم التحديد
                    </span>
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </label>

              {hostIdFile && (
                <button
                  type="button"
                  onClick={() => setHostIdFile(null)}
                  className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
                  title="إزالة واستبدال"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Section 2: Travelers & Documents in Place (NO scalar inputs, only upload boxes) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-blue-50/60 p-4 rounded-xl border border-blue-200">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              قائمة المسافرين والمستندات ({travelers.length})
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              ارفع مستندات كل مسافر مباشرة (جواز السفر، الصورة، وتذكرة الطيران).
            </p>
          </div>
          <button
            type="button"
            onClick={addTraveler}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            + إضافة مسافر آخر
          </button>
        </div>

        {/* Travelers List */}
        <div className="space-y-4">
          {travelers.map((traveler, index) => (
            <div
              key={traveler.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 relative"
            >
              {/* Traveler Card Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    المسافر #{index + 1}
                  </h3>
                </div>

                {travelers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTraveler(traveler.id)}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف هذا المسافر
                  </button>
                )}
              </div>

              {/* Direct Document Upload Cards (3 items) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Passport Upload */}
                <div
                  className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
                    traveler.passportFile
                      ? "border-green-400 bg-green-50/50"
                      : "border-gray-300 hover:border-blue-400 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>صورة جواز السفر</span>
                    </div>
                    {traveler.passportFile && (
                      <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> تم التحديد
                      </span>
                    )}
                  </div>

                  {traveler.passportFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {traveler.passportPreview ? (
                          <img
                            src={traveler.passportPreview}
                            alt="معاينة الجواز"
                            className="w-12 h-12 object-cover rounded-lg border border-green-300 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                            PDF
                          </div>
                        )}
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {traveler.passportFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatFileSize(traveler.passportFile.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange(traveler.id, "passport", null)}
                        className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> إزالة واستبدال
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`passport-${traveler.id}`}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileChange(
                            traveler.id,
                            "passport",
                            e.target.files?.[0] || null
                          )
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`passport-${traveler.id}`}
                        className="w-full flex flex-col items-center justify-center py-4 px-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-blue-300 transition-colors"
                      >
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs font-bold text-blue-600">
                          اضغط لاختيار الجواز
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          PDF, JPG, PNG (أقصى 10MB)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. Photo Upload */}
                <div
                  className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
                    traveler.photoFile
                      ? "border-green-400 bg-green-50/50"
                      : "border-gray-300 hover:border-purple-400 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <ImageIcon className="w-4 h-4 text-purple-600" />
                      <span>الصورة الشخصية</span>
                    </div>
                    {traveler.photoFile && (
                      <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> تم التحديد
                      </span>
                    )}
                  </div>

                  {traveler.photoFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {traveler.photoPreview && (
                          <img
                            src={traveler.photoPreview}
                            alt="معاينة الصورة"
                            className="w-12 h-12 object-cover rounded-full border border-purple-300 shrink-0"
                          />
                        )}
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {traveler.photoFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatFileSize(traveler.photoFile.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange(traveler.id, "photo", null)}
                        className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> إزالة واستبدال
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`photo-${traveler.id}`}
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileChange(
                            traveler.id,
                            "photo",
                            e.target.files?.[0] || null
                          )
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`photo-${traveler.id}`}
                        className="w-full flex flex-col items-center justify-center py-4 px-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-purple-300 transition-colors"
                      >
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs font-bold text-purple-600">
                          اضغط لاختيار الصورة
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          خلفية بيضاء (JPG, PNG)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 3. Ticket Upload (NO "(اختياري)" - fourth requirement fulfilled) */}
                <div
                  className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
                    traveler.ticketFile
                      ? "border-green-400 bg-green-50/50"
                      : "border-gray-300 hover:border-amber-400 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <Ticket className="w-4 h-4 text-amber-600" />
                      <span>تذكرة الطيران</span>
                    </div>
                    {traveler.ticketFile && (
                      <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> تم التحديد
                      </span>
                    )}
                  </div>

                  {traveler.ticketFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                          DOC
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {traveler.ticketFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatFileSize(traveler.ticketFile.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange(traveler.id, "ticket", null)}
                        className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> إزالة واستبدال
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`ticket-${traveler.id}`}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileChange(
                            traveler.id,
                            "ticket",
                            e.target.files?.[0] || null
                          )
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`ticket-${traveler.id}`}
                        className="w-full flex flex-col items-center justify-center py-4 px-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-amber-300 transition-colors"
                      >
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs font-bold text-amber-600">
                          اضغط لاختيار التذكرة
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          PDF, JPG, PNG
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add traveler button */}
        <button
          type="button"
          onClick={addTraveler}
          className="w-full py-3.5 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-blue-600 hover:text-blue-700 bg-blue-50/40 hover:bg-blue-50 flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          + إضافة مسافر آخر إلى هذه المعاملة
        </button>
      </div>

      {/* Section 3: Flight & Travel Dates (مواعيد وتفاصيل الرحلة والطيران) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 shadow-xs">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                بيانات ومواعيد الرحلة والطيران
              </h2>
              <p className="text-xs text-gray-500">
                حدد تواريخ الذهاب والعودة ومواعيد إقلاع الطائرة وتواجد المسافرين في المطار
              </p>
            </div>
          </div>
          <span className="text-xs bg-sky-50 text-sky-800 font-semibold px-2.5 py-1 rounded-md border border-sky-200">
            مواعيد السفر
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* 1. تاريخ ذهاب */}
          <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-200/80 hover:border-sky-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>تاريخ ذهاب</span>
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white transition-all text-gray-800 font-medium"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">تاريخ انطلاق الرحلة</span>
          </div>

          {/* 2. تاريخ عودة */}
          <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-200/80 hover:border-teal-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>تاريخ عودة</span>
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white transition-all text-gray-800 font-medium"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">تاريخ رحلة العودة</span>
          </div>

          {/* 3. وقت إقلاع الطائرة */}
          <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-200/80 hover:border-indigo-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>وقت إقلاع الطائرة</span>
            </label>
            <input
              type="time"
              value={flightDepartureTime}
              onChange={(e) => setFlightDepartureTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-gray-800 font-medium text-center"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">موعد إقلاع الطيران المحدد</span>
          </div>

          {/* 4. وقت تواجد المسافر في المطار */}
          <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-200/80 hover:border-amber-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>وقت تواجد المسافر في المطار</span>
            </label>
            <input
              type="time"
              value={airportArrivalTime}
              onChange={(e) => setAirportArrivalTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white transition-all text-gray-800 font-medium text-center"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">الحضور بصالة السفر قبل الإقلاع</span>
          </div>
        </div>
      </div>

      {/* Floating Action Bar - Docked at Bottom (Never overlaps sidebar) */}
      <div className="fixed bottom-4 z-40 left-4 right-4 md:left-6 md:right-72 pointer-events-none transition-all">
        <div className="max-w-5xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/90 p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-auto">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-xs text-gray-700 font-medium">
            <span className="flex items-center gap-1.5">
              <span>إجمالي المسافرين:</span>
              <strong className="text-blue-600 font-bold text-sm bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{travelers.length}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5">
              <span>الجوازات:</span>
              <strong className="text-green-600 font-bold text-sm bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                {travelers.filter((t) => t.passportFile).length}
              </strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5">
              <span>التذاكر:</span>
              <strong className="text-amber-600 font-bold text-sm bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                {travelers.filter((t) => t.ticketFile).length}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Save Draft */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-gray-500" />
              <span>حفظ كمسودة</span>
            </button>

            {/* Direct Submit to Safa */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>حفظ وإرسال للمراجعة مباشرة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">جاري المعالجة والرفع الآمن</h3>
              <p className="text-xs text-gray-500 mt-1">{progressStep}</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <p className="text-[11px] text-gray-400">
              يرجى عدم إغلاق الصفحة حتى اكتمال رفع المستندات بنجاح.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
