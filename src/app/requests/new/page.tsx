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
  RotateCcw,
  Sparkles,
  Languages,
  Phone,
} from "lucide-react";
import { scanPassportMRZ, translateEnglishNameToArabic } from "@/lib/mrzScanner";
import { scanHostId } from "@/lib/hostIdScanner";
import { scanFlightTicket, calculateAirportArrivalTime } from "@/lib/flightTicketScanner";
import { useDialog } from "@/lib/dialog-context";
import { FileDropArea } from "@/components/ui/FileDropArea";

interface TravelerDraft {
  id: string;
  fullName?: string;
  fullNameEnglish?: string;
  passportNumber?: string;
  phoneNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportFile: File | null;
  passportPreview?: string;
  photoFile: File | null;
  photoPreview?: string;
  isScanning?: boolean;
  scanSuccess?: boolean;
  scanMessage?: string;
}

export default function UnifiedNewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, alert } = useDialog();

  // Hosting
  const [hasHosting, setHasHosting] = useState(false);
  const [hostName, setHostName] = useState("");
  const [hostBirthDate, setHostBirthDate] = useState("");
  const [hostNationality, setHostNationality] = useState("");
  const [hostNationalId, setHostNationalId] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [hostIdFile, setHostIdFile] = useState<File | null>(null);
  const [isScanningHostId, setIsScanningHostId] = useState(false);
  const [hostScanSuccess, setHostScanSuccess] = useState(false);
  const [hostScanMessage, setHostScanMessage] = useState("");

  // Run OCR scan on host ID file
  const runHostIdScan = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setIsScanningHostId(true);
    setHostScanSuccess(false);
    setHostScanMessage("جاري فحص وقراءة هوية المستضيف (OCR)...");
    try {
      const result = await scanHostId(file, (msg) => {
        setHostScanMessage(msg);
      });
      if (
        result &&
        (result.hostName ||
          result.hostBirthDate ||
          result.hostNationality ||
          result.idNumber)
      ) {
        if (result.hostName) setHostName(result.hostName);
        if (result.hostBirthDate) setHostBirthDate(result.hostBirthDate);
        if (result.hostNationality) setHostNationality(result.hostNationality);
        if (result.idNumber) setHostNationalId(result.idNumber);
        setHostScanSuccess(true);
        setHostScanMessage(
          `تم استخراج البيانات بنجاح: ${result.hostName || ""} ${
            result.hostNationality ? `[${result.hostNationality}]` : ""
          } ${result.hostBirthDate ? `(الميلاد: ${result.hostBirthDate})` : ""}`
        );
      } else {
        setHostScanSuccess(false);
        setHostScanMessage("لم يتم استخراج البيانات بوضوح، يمكنك إدخالها يدوياً.");
      }
    } catch {
      setHostScanSuccess(false);
      setHostScanMessage("تعذر فحص الهوية، يرجى كتابة البيانات يدوياً.");
    } finally {
      setIsScanningHostId(false);
    }
  };

  const handleHostIdFileChange = async (file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      await alert({
        title: "تنبيه حجم الملف",
        message: "حجم ملف هوية المستضيف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).",
        variant: "warning",
      });
      return;
    }
    setHostIdFile(file);
    if (file && file.type.startsWith("image/")) {
      setTimeout(() => {
        runHostIdScan(file);
      }, 50);
    } else {
      setIsScanningHostId(false);
      setHostScanSuccess(false);
      setHostScanMessage("");
    }
  };

  // Shared Flight & Travel Details
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flightDepartureTime, setFlightDepartureTime] = useState("");
  const [airportArrivalTime, setAirportArrivalTime] = useState("");
  const [flightTicketFile, setFlightTicketFile] = useState<File | null>(null);
  const [isScanningTicket, setIsScanningTicket] = useState(false);
  const [ticketScanSuccess, setTicketScanSuccess] = useState(false);
  const [ticketScanMessage, setTicketScanMessage] = useState("");

  // Run AI scan on flight ticket file (Gemini Vision)
  const runTicketScan = async (file: File) => {
    setIsScanningTicket(true);
    setTicketScanSuccess(false);
    setTicketScanMessage("جاري فحص تذكرة الطيران بالذكاء الاصطناعي (Google Gemini)...");
    try {
      const result = await scanFlightTicket(file, (msg) => {
        setTicketScanMessage(msg);
      });
      if (
        result &&
        (result.departureDate ||
          result.returnDate ||
          result.flightDepartureTime ||
          result.airline ||
          result.flightNumber)
      ) {
        if (result.airline) setAirline(result.airline);
        if (result.flightNumber) setFlightNumber(result.flightNumber);
        if (result.departureDate) setDepartureDate(result.departureDate);
        if (result.returnDate) setReturnDate(result.returnDate);
        if (result.flightDepartureTime) {
          setFlightDepartureTime(result.flightDepartureTime);
          const calcTime = calculateAirportArrivalTime(result.flightDepartureTime);
          setAirportArrivalTime(calcTime || result.airportArrivalTime || "");
        } else if (result.airportArrivalTime) {
          setAirportArrivalTime(result.airportArrivalTime);
        }
        setTicketScanSuccess(true);
        setTicketScanMessage(
          `تم استخراج بيانات الرحلة بنجاح: ${result.airline || ""} ${
            result.flightNumber ? `(رحلة ${result.flightNumber})` : ""
          } ${result.departureDate ? `| الذهاب: ${result.departureDate}` : ""} ${
            result.flightDepartureTime ? `| الإقلاع: ${result.flightDepartureTime}` : ""
          }`
        );
      } else {
        setTicketScanSuccess(false);
        setTicketScanMessage("لم يتم استخراج بيانات التذكرة بوضوح، يمكنك إدخال المواعيد يدوياً.");
      }
    } catch {
      setTicketScanSuccess(false);
      setTicketScanMessage("تعذر فحص التذكرة بالذكاء الاصطناعي، يرجى كتابة البيانات يدوياً.");
    } finally {
      setIsScanningTicket(false);
    }
  };

  const handleTicketFileChange = async (file: File | null) => {
    if (file && file.size > 15 * 1024 * 1024) {
      await alert({
        title: "تنبيه حجم الملف",
        message: "حجم ملف تذكرة الطيران يتجاوز الحد الأقصى المسموح به (15 ميجابايت).",
        variant: "warning",
      });
      return;
    }
    setFlightTicketFile(file);
    if (file) {
      setTimeout(() => {
        runTicketScan(file);
      }, 50);
    } else {
      setIsScanningTicket(false);
      setTicketScanSuccess(false);
      setTicketScanMessage("");
    }
  };

  const handleDepartureTimeChange = (val: string) => {
    setFlightDepartureTime(val);
    if (val) {
      const calcArrival = calculateAirportArrivalTime(val);
      if (calcArrival) setAirportArrivalTime(calcArrival);
    }
  };

  // Travelers with Direct Documents (Passport & Photo only)
  const [travelers, setTravelers] = useState<TravelerDraft[]>([
    {
      id: "tr-1",
      fullName: "",
      passportFile: null,
      photoFile: null,
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
        fullName: "",
        passportFile: null,
        photoFile: null,
      },
    ]);
  };

  // Remove traveler
  const removeTraveler = async (id: string) => {
    if (travelers.length <= 1) {
      await alert({
        title: "تنبيه",
        message: "يجب أن تحتوي المعاملة على مسافر واحد على الأقل.",
        variant: "warning",
      });
      return;
    }
    setTravelers((prev) => prev.filter((t) => t.id !== id));
  };

  // Update specific traveler field (name, passport number, phone, etc.)
  const updateTravelerField = (
    travelerId: string,
    field: "fullName" | "passportNumber" | "nationality" | "dateOfBirth" | "phoneNumber",
    value: string
  ) => {
    setTravelers((prev) =>
      prev.map((t) => (t.id === travelerId ? { ...t, [field]: value } : t))
    );
  };

  // Run MRZ scan on passport file
  const runMrzScanForTraveler = async (travelerId: string, file: File) => {
    if (!file.type.startsWith("image/")) return;

    setTravelers((prev) =>
      prev.map((t) =>
        t.id === travelerId
          ? {
              ...t,
              isScanning: true,
              scanSuccess: false,
              scanMessage: "جاري فحص وقراءة شريط الجواز (MRZ)...",
            }
          : t
      )
    );

    try {
      const result = await scanPassportMRZ(file, (msg) => {
        setTravelers((prev) =>
          prev.map((t) => (t.id === travelerId ? { ...t, scanMessage: msg } : t))
        );
      });

      setTravelers((prev) =>
        prev.map((t) => {
          if (t.id !== travelerId) return t;
          if (result && result.fullNameArabic) {
            return {
              ...t,
              fullName: result.fullNameArabic,
              fullNameEnglish: result.fullNameEnglish,
              passportNumber: result.passportNumber || t.passportNumber,
              nationality: result.nationality || t.nationality,
              dateOfBirth: result.dateOfBirth || t.dateOfBirth,
              isScanning: false,
              scanSuccess: true,
              scanMessage: `تم التعرف بنجاح على: ${result.fullNameArabic}`,
            };
          } else {
            return {
              ...t,
              isScanning: false,
              scanSuccess: false,
              scanMessage: "لم يتم التقاط شريط MRZ بوضوح، يمكنك إدخال الاسم يدوياً.",
            };
          }
        })
      );
    } catch {
      setTravelers((prev) =>
        prev.map((t) =>
          t.id === travelerId
            ? {
                ...t,
                isScanning: false,
                scanSuccess: false,
                scanMessage: "تعذر فحص الجواز، يرجى كتابة الاسم يدوياً.",
              }
            : t
        )
      );
    }
  };

  // Handle document file changes
  const handleFileChange = async (
    travelerId: string,
    docType: "passport" | "photo",
    file: File | null
  ) => {
    if (file && file.size > 10 * 1024 * 1024) {
      await alert({
        title: "تنبيه حجم الملف",
        message: "حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).",
        variant: "warning",
      });
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
            setTimeout(() => {
              runMrzScanForTraveler(travelerId, file);
            }, 50);
          } else {
            updated.passportPreview = undefined;
            updated.isScanning = false;
            updated.scanSuccess = false;
          }
        } else if (docType === "photo") {
          updated.photoFile = file;
          if (file && file.type.startsWith("image/")) {
            updated.photoPreview = URL.createObjectURL(file);
          } else {
            updated.photoPreview = undefined;
          }
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
    const totalAttached =
      travelers.filter((t) => t.passportFile || t.photoFile).length +
      (flightTicketFile ? 1 : 0);

    if (totalAttached === 0) {
      setError("يرجى إرفاق مستند واحد على الأقل (جواز السفر، الصورة، أو تذكرة الطيران) لمتابعة الحفظ.");
      return;
    }

    if (submitDirectlyToSafa) {
      const missingPassports = travelers.filter((t) => !t.passportFile);
      if (missingPassports.length > 0) {
        const confirmSend = await confirm({
          title: "تنبيه نقص صور الجوازات",
          message: `تنبيه: لم يتم إرفاق صورة جواز السفر لعدد (${missingPassports.length}) مسافر. هل ترغب في إرسال المعاملة على أي حال للمراجعة؟`,
          confirmText: "إرسال على أي حال",
          cancelText: "الرجوع للاستكمال",
          variant: "warning",
        });
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
        hostName: hasHosting && hostName.trim() ? hostName.trim() : undefined,
        hostBirthDate: hasHosting && hostBirthDate.trim() ? hostBirthDate.trim() : undefined,
        hostNationality: hasHosting && hostNationality.trim() ? hostNationality.trim() : undefined,
        hostNationalId: hasHosting && hostNationalId.trim() ? hostNationalId.trim() : undefined,
        hostPhone: hasHosting ? hostPhone.trim() : undefined,
        airline: airline.trim() || undefined,
        flightNumber: flightNumber.trim() || undefined,
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

      // Upload Shared Flight Ticket Document if selected
      if (flightTicketFile) {
        setProgressStep("جاري رفع تذكرة الطيران المشتركة...");
        await api.documents.upload(createdGroup.id, flightTicketFile, "FlightTicket");
      }

      // Calculate total uploads
      let totalFilesToUpload =
        (hasHosting && hostIdFile ? 1 : 0) +
        (flightTicketFile ? 1 : 0);
      travelers.forEach((t) => {
        if (t.passportFile) totalFilesToUpload++;
        if (t.photoFile) totalFilesToUpload++;
      });

      let uploadedFilesCount =
        (hasHosting && hostIdFile ? 1 : 0) +
        (flightTicketFile ? 1 : 0);

      // 3. Create Travelers & Upload Documents (Passport & Photo)
      for (let i = 0; i < travelers.length; i++) {
        const t = travelers[i];
        setProgressStep(`جاري تسجيل المسافر (${i + 1} من ${travelers.length})...`);
        setProgressPercent(20 + Math.floor((i / travelers.length) * 40));

        const createdTraveler = await api.travelers.add(createdGroup.id, {
          fullName: t.fullName?.trim() || `مسافر #${i + 1}`,
          passportNumber: t.passportNumber?.trim() || undefined,
          phoneNumber: t.phoneNumber?.trim() || undefined,
          nationality: t.nationality?.trim() || undefined,
          dateOfBirth: t.dateOfBirth?.trim() || undefined,
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

        {/* When Hosting is active: Host fields + OCR scanning + Host ID upload */}
        {hasHosting && (
          <div className="pt-4 border-t border-gray-100 space-y-4">
            {/* Status Indicator */}
            {isScanningHostId ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>{hostScanMessage || "جاري فحص هوية المستضيف وقراءة الاسم وتاريخ الميلاد (OCR)..."}</span>
              </div>
            ) : hostScanSuccess ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{hostScanMessage}</span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  تم الاستخراج تلقائياً ✓
                </span>
              </div>
            ) : hostScanMessage && hostIdFile ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>{hostScanMessage}</span>
              </div>
            ) : null}

            {/* Fields ABOVE the image upload box as requested */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>اسم المستضيف</span>
                  {hostScanSuccess && hostName && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> تم التعرف
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="اسم المستضيف (يُملأ تلقائياً من الهوية)"
                  className="w-full text-xs px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>جنسية المستضيف</span>
                  {hostScanSuccess && hostNationality && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> تم التعرف
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={hostNationality}
                  onChange={(e) => setHostNationality(e.target.value)}
                  placeholder="مثال: سعودي، مصري..."
                  className="w-full text-xs px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>تاريخ ميلاد المستضيف</span>
                  {hostScanSuccess && hostBirthDate && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> تم التعرف
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={hostBirthDate}
                  onChange={(e) => setHostBirthDate(e.target.value)}
                  placeholder="مثال: 1405/06/12 أو 1985/02/10"
                  className="w-full text-xs px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  رقم هاتف المستضيف داخل المملكة <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={hostPhone}
                  onChange={(e) => setHostPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  className="w-full text-xs px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-right font-mono"
                />
              </div>

              {hostNationalId && (
                <div className="sm:col-span-2 lg:col-span-4 pt-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    رقم هوية / إقامة المستضيف (مستخرج)
                  </label>
                  <input
                    type="text"
                    value={hostNationalId}
                    onChange={(e) => setHostNationalId(e.target.value)}
                    placeholder="رقم الهوية أو الإقامة"
                    className="w-full sm:max-w-xs text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono"
                  />
                </div>
              )}
            </div>

            {/* Host ID Document Upload Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-700">
                  مرفق هوية المستضيف (PDF / صورة) <span className="text-red-500">*</span>
                </label>
                {hostIdFile && hostIdFile.type.startsWith("image/") && (
                  <button
                    type="button"
                    disabled={isScanningHostId}
                    onClick={() => runHostIdScan(hostIdFile)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="إعادة فحص هوية المستضيف وقراءة البيانات"
                  >
                    <RotateCcw className={`w-3 h-3 ${isScanningHostId ? "animate-spin" : ""}`} />
                    <span>إعادة فحص الهوية (OCR)</span>
                  </button>
                )}
              </div>

              <FileDropArea
                onFileDrop={(file) => handleHostIdFileChange(file)}
                accept=".pdf,.jpg,.jpeg,.png"
                maxSizeMb={10}
                activeBorderColor="amber"
                overlayText="أفلت ملف هوية المستضيف هنا"
                overlaySubtext="سيتم فحص الهوية واستخراج البيانات تلقائياً (OCR)"
                onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                className="rounded-xl"
              >
                <div className="relative">
                  <input
                    type="file"
                    id="host-id-file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleHostIdFileChange(e.target.files?.[0] || null)}
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
                          {hostIdFile ? hostIdFile.name : "اضغط لاختيار أو اسحب ملف هوية المستضيف هنا"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {hostIdFile
                            ? `${formatFileSize(hostIdFile.size)} - جاهز للرفع (يتم الفحص التلقائي)`
                            : "الصيغ المسموحة: PDF, JPG, PNG (حد أقصى 10MB) - يتم استخراج الاسم والميلاد تلقائياً"}
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
                      onClick={() => {
                        setHostIdFile(null);
                        setHostScanSuccess(false);
                        setHostScanMessage("");
                      }}
                      className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm cursor-pointer z-10"
                      title="إزالة واستبدال"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </FileDropArea>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Shared Flight Ticket & Schedule (بيانات وتذكرة الطيران المشتركة لجميع المسافرين) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 shadow-xs">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                بيانات وتذكرة الطيران المشتركة لجميع المسافرين
              </h2>
              <p className="text-xs text-gray-500">
                تذكرة واحدة مشتركة لكافة مسافري المجموعة مع الفحص التلقائي واستخراج البيانات بالذكاء الاصطناعي
              </p>
            </div>
          </div>
          <span className="text-xs bg-sky-50 text-sky-800 font-semibold px-2.5 py-1 rounded-md border border-sky-200 w-fit">
            تذكرة واحدة لجميع المسافرين
          </span>
        </div>

        {/* AI Status Indicator */}
        {isScanningTicket ? (
          <div className="flex items-center gap-2 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span>{ticketScanMessage || "جاري فحص تذكرة الطيران واستخراج المواعيد بالذكاء الاصطناعي (Google Gemini)..."}</span>
          </div>
        ) : ticketScanSuccess ? (
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{ticketScanMessage}</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold shrink-0">
              تم الاستخراج تلقائياً بالذكاء الاصطناعي ✓
            </span>
          </div>
        ) : ticketScanMessage && flightTicketFile ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{ticketScanMessage}</span>
          </div>
        ) : null}

        {/* Flight Ticket Upload Dropzone */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-sky-600" />
              <span>مستند / ملف تذكرة الطيران المشتركة (صورة أو PDF)</span>
            </span>
            {flightTicketFile && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> تم اختيار التذكرة
              </span>
            )}
          </label>

          <FileDropArea
            onFileDrop={(file) => handleTicketFileChange(file)}
            accept=".pdf,.jpg,.jpeg,.png"
            maxSizeMb={15}
            activeBorderColor="sky"
            overlayText="أفلت تذكرة الطيران هنا"
            overlaySubtext="يقوم الذكاء الاصطناعي باستخراج تفاصيل ومواعيد الرحلة تلقائياً"
            onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
            className="rounded-xl"
          >
            {flightTicketFile ? (
              <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                  <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-sky-200">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-bold text-gray-800 truncate">{flightTicketFile.name}</p>
                    <p className="text-xs text-gray-500">{(flightTicketFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isScanningTicket}
                    onClick={() => runTicketScan(flightTicketFile)}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="إعادة فحص التذكرة بالذكاء الاصطناعي"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isScanningTicket ? "animate-spin" : ""}`} />
                    <span>إعادة الفحص بالذكاء الاصطناعي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTicketFileChange(null)}
                    className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>إزالة الملف</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  id="sharedFlightTicketFile"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleTicketFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="sharedFlightTicketFile"
                  className="w-full flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-xl cursor-pointer bg-sky-50/30 hover:bg-sky-50/70 transition-all text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-sky-700">
                    اضغط هنا أو اسحب تذكرة الطيران المشتركة (صورة أو PDF)
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    يقوم الذكاء الاصطناعي بقراءة وتعبئة جميع الحقول أدناه تلقائياً بدقة تامة
                  </span>
                </label>
              </div>
            )}
          </FileDropArea>
        </div>

        {/* 6 Form Fields Extracted by AI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* 1. نوع / شركة الطيران */}
          <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:border-sky-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-sky-600" />
                <span>نوع / شركة الطيران</span>
              </span>
              {ticketScanSuccess && airline && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> تم التعرف
                </span>
              )}
            </label>
            <input
              type="text"
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder="مثال: الخطوط السعودية، مصر للطيران..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white transition-all text-gray-800 font-medium"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">شركة النقل الجوي للرحلة</span>
          </div>

          {/* 2. رقم الرحلة */}
          <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:border-sky-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-sky-600" />
                <span>رقم الرحلة</span>
              </span>
              {ticketScanSuccess && flightNumber && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> تم التعرف
                </span>
              )}
            </label>
            <input
              type="text"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="مثال: SV123 أو MS665"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white transition-all text-gray-800 font-bold uppercase"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">رقم رحلة الطيران المجدولة</span>
          </div>

          {/* 3. تاريخ الذهاب */}
          <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:border-sky-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>تاريخ الذهاب</span>
              </span>
              {ticketScanSuccess && departureDate && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> تم التعرف
                </span>
              )}
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white transition-all text-gray-800 font-medium"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">تاريخ انطلاق رحلة الذهاب</span>
          </div>

          {/* 4. تاريخ العودة */}
          <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:border-teal-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>تاريخ العودة</span>
              </span>
              {ticketScanSuccess && returnDate && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> تم التعرف
                </span>
              )}
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white transition-all text-gray-800 font-medium"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">تاريخ رحلة العودة (اختياري)</span>
          </div>

          {/* 5. وقت إقلاع طائرة الذهاب */}
          <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors">
            <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>وقت إقلاع طائرة الذهاب</span>
              </span>
              {ticketScanSuccess && flightDepartureTime && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> تم التعرف
                </span>
              )}
            </label>
            <input
              type="time"
              value={flightDepartureTime}
              onChange={(e) => handleDepartureTimeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-gray-800 font-medium text-center"
            />
            <span className="text-[11px] text-gray-500 mt-1.5 block">موعد إقلاع الطيران المحدد</span>
          </div>

          {/* 6. وقت تواجد المسافر في المطار (قبل الإقلاع بـ 3 ساعات) */}
          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 transition-colors">
            <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>وقت تواجد المسافر في المطار</span>
              </span>
              <span className="text-[10px] bg-amber-200/70 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                قبل الإقلاع بـ 3 ساعات تلقائياً
              </span>
            </label>
            <input
              type="time"
              value={airportArrivalTime}
              onChange={(e) => setAirportArrivalTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white transition-all text-gray-900 font-bold text-center"
            />
            <span className="text-[11px] text-amber-700 mt-1.5 block font-medium">
              محسوب تلقائياً قبل إقلاع الطائرة بـ 3 ساعات
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Travelers & Documents (Passport & Photo only) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-blue-50/60 p-4 rounded-xl border border-blue-200">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              قائمة المسافرين والمستندات ({travelers.length})
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              ارفع جواز السفر والصورة الشخصية لكل مسافر (التذكرة موحدة لجميع المسافرين بالأعلى).
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {traveler.fullName?.trim() ? (
                        <>
                          <span className="text-blue-900 font-extrabold">{traveler.fullName}</span>
                          {traveler.fullNameEnglish && (
                            <span className="text-xs text-gray-500 font-normal font-mono">
                              ({traveler.fullNameEnglish})
                            </span>
                          )}
                        </>
                      ) : (
                        <span>المسافر #{index + 1}</span>
                      )}
                    </h3>
                  </div>

                  {/* Status Indicator */}
                  {traveler.isScanning ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{traveler.scanMessage || "جاري فحص الجواز وقراءة الاسم..."}</span>
                    </span>
                  ) : traveler.scanSuccess ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>تم استخراج الاسم وترجمته تلقائياً</span>
                    </span>
                  ) : traveler.scanMessage && traveler.passportFile ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      <span>{traveler.scanMessage}</span>
                    </span>
                  ) : null}
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

              {/* Traveler Basic Data Inputs (Auto-filled from MRZ or manually editable) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>اسم المسافر (بالعربية)</span>
                    {traveler.scanSuccess && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> تم التعرف تلقائياً
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={traveler.fullName || ""}
                      onChange={(e) =>
                        updateTravelerField(traveler.id, "fullName", e.target.value)
                      }
                      placeholder="مثال: محمد أحمد علي (يُملأ تلقائياً عند رفع صورة الجواز)"
                      className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                    {traveler.fullName && /[A-Za-z]/.test(traveler.fullName) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const tr = await translateEnglishNameToArabic(traveler.fullName!);
                          if (tr) {
                            updateTravelerField(traveler.id, "fullName", tr);
                          }
                        }}
                        className="shrink-0 px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="ترجمة الاسم بالذكاء الاصطناعي عبر Google Translate"
                      >
                        <Languages className="w-3.5 h-3.5" />
                        <span>ترجمة</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>رقم جواز السفر</span>
                    {traveler.nationality && (
                      <span className="text-[10px] text-gray-500 font-normal">
                        الجنسية: {traveler.nationality}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={traveler.passportNumber || ""}
                    onChange={(e) =>
                      updateTravelerField(
                        traveler.id,
                        "passportNumber",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="رقم الجواز (يُملأ تلقائياً)"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رقم هاتف المسافر (اختياري)</span>
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={traveler.phoneNumber || ""}
                    onChange={(e) =>
                      updateTravelerField(
                        traveler.id,
                        "phoneNumber",
                        e.target.value
                      )
                    }
                    placeholder="مثال: +966501234567"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-right"
                  />
                </div>
              </div>

              {/* Direct Document Upload Cards (Passport & Photo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Passport Upload */}
                <FileDropArea
                  onFileDrop={(file) => handleFileChange(traveler.id, "passport", file)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="blue"
                  overlayText="أفلت جواز السفر هنا"
                  overlaySubtext="سيتم فحص وقراءة شريط MRZ تلقائياً"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-xl"
                >
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
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleFileChange(traveler.id, "passport", null)}
                            className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> إزالة واستبدال
                          </button>
                          {traveler.passportFile.type.startsWith("image/") && (
                            <button
                              type="button"
                              disabled={traveler.isScanning}
                              onClick={() =>
                                runMrzScanForTraveler(traveler.id, traveler.passportFile!)
                              }
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:opacity-50"
                              title="إعادة فحص وقراءة شريط MRZ"
                            >
                              <RotateCcw
                                className={`w-3 h-3 ${
                                  traveler.isScanning ? "animate-spin" : ""
                                }`}
                              />
                              إعادة فحص الجواز
                            </button>
                          )}
                        </div>
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
                            اضغط لاختيار أو اسحب الجواز هنا
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            PDF, JPG, PNG (أقصى 10MB)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </FileDropArea>

                {/* 2. Photo Upload */}
                <FileDropArea
                  onFileDrop={(file) => handleFileChange(traveler.id, "photo", file)}
                  accept=".jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="purple"
                  overlayText="أفلت الصورة الشخصية هنا"
                  overlaySubtext="خلفية بيضاء وواضحة (JPG, PNG)"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-xl"
                >
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
                            اضغط لاختيار أو اسحب الصورة هنا
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            خلفية بيضاء (JPG, PNG)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </FileDropArea>
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
              <span>التذكرة المشتركة:</span>
              <strong
                className={`text-sm px-2 py-0.5 rounded-lg border font-bold ${
                  flightTicketFile
                    ? "text-sky-700 bg-sky-50 border-sky-200"
                    : "text-gray-500 bg-gray-50 border-gray-200"
                }`}
              >
                {flightTicketFile ? "مرفوعة ✓" : "غير مرفوعة"}
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
