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
    const isHostingActive = Boolean(hostIdFile || hostPhone.trim() || hasHosting);
    if (isHostingActive) {
      if (!hostPhone.trim()) {
        setError("عند إرفاق هوية المستضيف، يرجى إدخال رقم هاتف المستضيف داخل المملكة.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!hostIdFile) {
        setError("عند إدخال رقم هاتف المستضيف، يرجى إرفاق صورة أو مستند هوية المستضيف.");
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

      // Auto-generate group name & contact phone
      const groupName =
        travelers[0]?.fullName?.trim()
          ? `مجموعة ${travelers[0].fullName.trim()}`
          : `طلب جديد ${new Date().toLocaleDateString("ar-SA")}`;
      const contactPhone =
        hostPhone.trim() ||
        travelers.find((t) => t.phoneNumber?.trim())?.phoneNumber?.trim() ||
        "";

      // 1. Create Request
      const createdGroup = await api.requests.create({
        groupName,
        contactPhone,
        hasHosting: isHostingActive,
        hostName: isHostingActive && hostName.trim() ? hostName.trim() : undefined,
        hostBirthDate: isHostingActive && hostBirthDate.trim() ? hostBirthDate.trim() : undefined,
        hostNationality: isHostingActive && hostNationality.trim() ? hostNationality.trim() : undefined,
        hostNationalId: isHostingActive && hostNationalId.trim() ? hostNationalId.trim() : undefined,
        hostPhone: isHostingActive ? hostPhone.trim() : undefined,
        airline: airline.trim() || undefined,
        flightNumber: flightNumber.trim() || undefined,
        departureDate: departureDate || undefined,
        returnDate: returnDate || undefined,
        flightDepartureTime: flightDepartureTime || undefined,
        airportArrivalTime: airportArrivalTime || undefined,
      });

      // 2. Upload Host ID Document if selected
      if (isHostingActive && hostIdFile) {
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
        (isHostingActive && hostIdFile ? 1 : 0) +
        (flightTicketFile ? 1 : 0);
      travelers.forEach((t) => {
        if (t.passportFile) totalFilesToUpload++;
        if (t.photoFile) totalFilesToUpload++;
      });

      let uploadedFilesCount =
        (isHostingActive && hostIdFile ? 1 : 0) +
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

      {/* السطر العلوي: تذكرة الطيران المشتركة + هوية المستضيف + رقم هاتف المستضيف */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                بيانات الرحلة والاستضافة المشتركة
              </h2>
              <p className="text-xs text-gray-500">
                ارفع تذكرة الطيران وهوية المستضيف ورقم هاتفه (يستخرج الذكاء الاصطناعي كافة التفاصيل تلقائياً)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isScanningTicket && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                جاري استخراج بيانات التذكرة (AI)...
              </span>
            )}
            {isScanningHostId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                جاري فحص هوية المستضيف (OCR)...
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* 1. تذكرة الطيران المشتركة */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-sky-600" />
                <span>تذكرة الطيران</span>
              </span>
              {ticketScanSuccess && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> تم الاستخراج
                </span>
              )}
            </label>

            <FileDropArea
              onFileDrop={(file) => handleTicketFileChange(file)}
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMb={15}
              activeBorderColor="sky"
              overlayText="أفلت تذكرة الطيران هنا"
              overlaySubtext="استخراج تلقائي فوري بالذكاء الاصطناعي"
              onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
              className="rounded-xl"
            >
              {flightTicketFile ? (
                <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-xl relative flex items-center justify-between gap-2 min-h-[92px]">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-sky-200">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-gray-800 truncate" title={flightTicketFile.name}>
                        {flightTicketFile.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {formatFileSize(flightTicketFile.size)}
                      </p>
                      {ticketScanSuccess && airline && (
                        <p className="text-[10px] text-emerald-700 font-semibold truncate mt-0.5">
                          {airline} {flightNumber ? `(${flightNumber})` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isScanningTicket}
                      onClick={() => runTicketScan(flightTicketFile)}
                      className="p-1.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer"
                      title="إعادة الفحص بالذكاء الاصطناعي"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isScanningTicket ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTicketFileChange(null)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition-colors cursor-pointer"
                      title="إزالة واستبدال"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="topFlightTicketFile"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleTicketFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="topFlightTicketFile"
                    className="w-full flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-xl cursor-pointer bg-sky-50/20 hover:bg-sky-50/60 transition-all text-center min-h-[92px]"
                  >
                    <Upload className="w-5 h-5 text-sky-600 mb-1" />
                    <span className="text-xs font-bold text-sky-700">
                      رفع أو سحب التذكرة
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      PDF, JPG, PNG (AI تلقائي)
                    </span>
                  </label>
                </div>
              )}
            </FileDropArea>
          </div>

          {/* 2. هوية المستضيف */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Home className="w-4 h-4 text-amber-600" />
                <span>هوية المستضيف</span>
              </span>
              {hostScanSuccess && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> تم الاستخراج
                </span>
              )}
            </label>

            <FileDropArea
              onFileDrop={(file) => handleHostIdFileChange(file)}
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMb={10}
              activeBorderColor="amber"
              overlayText="أفلت هوية المستضيف هنا"
              overlaySubtext="فحص واستخراج تلقائي بالـ OCR"
              onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
              className="rounded-xl"
            >
              {hostIdFile ? (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl relative flex items-center justify-between gap-2 min-h-[92px]">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200">
                      ID
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-gray-800 truncate" title={hostIdFile.name}>
                        {hostIdFile.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {formatFileSize(hostIdFile.size)}
                      </p>
                      {hostScanSuccess && hostName && (
                        <p className="text-[10px] text-emerald-700 font-semibold truncate mt-0.5">
                          {hostName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {hostIdFile.type.startsWith("image/") && (
                      <button
                        type="button"
                        disabled={isScanningHostId}
                        onClick={() => runHostIdScan(hostIdFile)}
                        className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer"
                        title="إعادة فحص الهوية بالـ OCR"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isScanningHostId ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHostIdFile(null);
                        setHostScanSuccess(false);
                        setHostScanMessage("");
                      }}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition-colors cursor-pointer"
                      title="إزالة واستبدال"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="topHostIdFile"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleHostIdFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="topHostIdFile"
                    className="w-full flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl cursor-pointer bg-amber-50/20 hover:bg-amber-50/60 transition-all text-center min-h-[92px]"
                  >
                    <Upload className="w-5 h-5 text-amber-600 mb-1" />
                    <span className="text-xs font-bold text-amber-700">
                      رفع أو سحب الهوية
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      PDF, JPG, PNG (OCR تلقائي)
                    </span>
                  </label>
                </div>
              )}
            </FileDropArea>
          </div>

          {/* 3. رقم هاتف المستضيف */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>رقم هاتف المستضيف</span>
              </span>
              <span className="text-[10px] text-gray-400 font-normal">
                داخل المملكة
              </span>
            </label>
            <div className="min-h-[92px] p-3 bg-gray-50/60 rounded-xl border border-gray-200 flex flex-col justify-center">
              <input
                type="tel"
                value={hostPhone}
                onChange={(e) => setHostPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-right font-mono font-medium"
              />
              <span className="text-[10px] text-gray-500 mt-1.5 block">
                مطلوب في حال إرفاق مستند هوية المستضيف
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* سطر المسافرين: جواز السفر + الاسم ورقم الجواز + الصورة الشخصية + رقم الموبايل */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>بيانات ومستندات المسافرين ({travelers.length})</span>
          </h2>
        </div>

        <div className="space-y-4">
          {travelers.map((traveler, index) => (
            <div
              key={traveler.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4 relative"
            >
              {/* ترويسة بطاقة المسافر */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {traveler.fullName?.trim() ? (
                      <span className="text-blue-900 font-extrabold">{traveler.fullName}</span>
                    ) : (
                      <span>المسافر #{index + 1}</span>
                    )}
                  </h3>
                  {traveler.isScanning ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      <span>جاري قراءة الجواز (MRZ)...</span>
                    </span>
                  ) : traveler.scanSuccess ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>تم استخراج الاسم والجواز ✓</span>
                    </span>
                  ) : null}
                </div>

                {travelers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTraveler(traveler.id)}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-red-50 transition-colors font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المسافر</span>
                  </button>
                )}
              </div>

              {/* شبكة مدخلات ومستندات المسافر */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* 1. جواز السفر (رفع أو سحب) - 4 أعمدة */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>جواز السفر</span>
                    </span>
                    {traveler.passportFile && (
                      <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold">
                        مرفوع ✓
                      </span>
                    )}
                  </label>

                  <FileDropArea
                    onFileDrop={(file) => handleFileChange(traveler.id, "passport", file)}
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxSizeMb={10}
                    activeBorderColor="blue"
                    overlayText="أفلت جواز السفر هنا"
                    overlaySubtext="فحص واستخراج شريط MRZ تلقائياً"
                    onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                    className="rounded-xl"
                  >
                    {traveler.passportFile ? (
                      <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl flex items-center justify-between gap-2 min-h-[92px]">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {traveler.passportPreview ? (
                            <img
                              src={traveler.passportPreview}
                              alt="جواز السفر"
                              className="w-12 h-12 object-cover rounded-lg border border-blue-300 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                              PDF
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-gray-800 truncate" title={traveler.passportFile.name}>
                              {traveler.passportFile.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {formatFileSize(traveler.passportFile.size)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {traveler.passportFile.type.startsWith("image/") && (
                            <button
                              type="button"
                              disabled={traveler.isScanning}
                              onClick={() => runMrzScanForTraveler(traveler.id, traveler.passportFile!)}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer"
                              title="إعادة فحص الجواز"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${traveler.isScanning ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleFileChange(traveler.id, "passport", null)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition-colors cursor-pointer"
                            title="إزالة واستبدال"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`passport-${traveler.id}`}
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(traveler.id, "passport", e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label
                          htmlFor={`passport-${traveler.id}`}
                          className="w-full flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl cursor-pointer bg-blue-50/20 hover:bg-blue-50/60 transition-all text-center min-h-[92px]"
                        >
                          <Upload className="w-5 h-5 text-blue-600 mb-1" />
                          <span className="text-xs font-bold text-blue-700">
                            رفع أو سحب الجواز
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            PDF, JPG, PNG (MRZ تلقائي)
                          </span>
                        </label>
                      </div>
                    )}
                  </FileDropArea>
                </div>

                {/* 2. اسم المسافر ورقم الجواز (ظاهرين في الصفحة) - 4 أعمدة */}
                <div className="md:col-span-4 space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                      <span>اسم المسافر</span>
                      {traveler.scanSuccess && traveler.fullName && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> مستخرج تلقائياً
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={traveler.fullName || ""}
                        onChange={(e) => updateTravelerField(traveler.id, "fullName", e.target.value)}
                        placeholder="اسم المسافر (يُستخرج من الجواز)"
                        className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      {traveler.fullName && /[A-Za-z]/.test(traveler.fullName) && (
                        <button
                          type="button"
                          onClick={async () => {
                            const tr = await translateEnglishNameToArabic(traveler.fullName!);
                            if (tr) updateTravelerField(traveler.id, "fullName", tr);
                          }}
                          className="shrink-0 px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
                          title="ترجمة إلى العربية"
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
                        <span className="text-[10px] text-gray-500">
                          {traveler.nationality}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={traveler.passportNumber || ""}
                      onChange={(e) => updateTravelerField(traveler.id, "passportNumber", e.target.value.toUpperCase())}
                      placeholder="رقم الجواز (يُستخرج من الجواز)"
                      className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 3. الصورة الشخصية - عمودين */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-purple-600" />
                      <span>الصورة الشخصية</span>
                    </span>
                    {traveler.photoFile && (
                      <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold">
                        مرفوعة ✓
                      </span>
                    )}
                  </label>

                  <FileDropArea
                    onFileDrop={(file) => handleFileChange(traveler.id, "photo", file)}
                    accept=".jpg,.jpeg,.png"
                    maxSizeMb={10}
                    activeBorderColor="purple"
                    overlayText="أفلت الصورة هنا"
                    overlaySubtext="خلفية بيضاء (JPG, PNG)"
                    onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                    className="rounded-xl"
                  >
                    {traveler.photoFile ? (
                      <div className="p-2.5 bg-purple-50/40 border border-purple-200 rounded-xl flex items-center justify-between gap-2 min-h-[92px]">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {traveler.photoPreview && (
                            <img
                              src={traveler.photoPreview}
                              alt="الصورة"
                              className="w-10 h-10 object-cover rounded-full border border-purple-300 shrink-0"
                            />
                          )}
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-gray-800 truncate" title={traveler.photoFile.name}>
                              {traveler.photoFile.name}
                            </p>
                            <p className="text-[9px] text-gray-500">
                              {formatFileSize(traveler.photoFile.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileChange(traveler.id, "photo", null)}
                          className="p-1 text-red-600 hover:text-red-800 shrink-0 cursor-pointer"
                          title="إزالة واستبدال"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`photo-${traveler.id}`}
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(traveler.id, "photo", e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label
                          htmlFor={`photo-${traveler.id}`}
                          className="w-full flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-xl cursor-pointer bg-purple-50/20 hover:bg-purple-50/60 transition-all text-center min-h-[92px]"
                        >
                          <Upload className="w-4 h-4 text-purple-600 mb-1" />
                          <span className="text-xs font-bold text-purple-700">
                            رفع الصورة
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">
                            خلفية بيضاء
                          </span>
                        </label>
                      </div>
                    )}
                  </FileDropArea>
                </div>

                {/* 4. رقم موبايل المسافر - عمودين */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>رقم الموبايل</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      اختياري
                    </span>
                  </label>
                  <div className="min-h-[92px] p-2.5 bg-gray-50/60 rounded-xl border border-gray-200 flex flex-col justify-center">
                    <input
                      type="tel"
                      dir="ltr"
                      value={traveler.phoneNumber || ""}
                      onChange={(e) => updateTravelerField(traveler.id, "phoneNumber", e.target.value)}
                      placeholder="+966..."
                      className="w-full text-xs px-2.5 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-right"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      للتواصل والمتابعة
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* زر مسافر جديد */}
        <button
          type="button"
          onClick={addTraveler}
          className="w-full py-3.5 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl text-blue-600 hover:text-blue-700 bg-blue-50/40 hover:bg-blue-50 flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ مسافر جديد</span>
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
