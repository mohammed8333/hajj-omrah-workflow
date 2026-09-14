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
  IdCard,
  User,
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
            setHostName((current) => current || result.fullNameArabic);
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

    // Check that every traveler has a phone number (إجباري)
    const missingPhoneTraveler = travelers.find(
      (t) => !t.phoneNumber || !t.phoneNumber.trim()
    );
    if (missingPhoneTraveler) {
      setError("رقم تليفون المسافر إجباري، يرجى إدخال رقم الهاتف لكل مسافر للمتابعة.");
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
    <div className="space-y-2 sm:space-y-4 pb-4 sm:pb-8 max-w-2xl mx-auto">
      {/* Error Banner */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold">تنبيه بالخطأ</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* استمارة المعاملة والمسافرين - مدمجة بدون سكرول للشاشة الواحدة */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-gray-200 p-2.5 sm:p-4 space-y-2 sm:space-y-3">
        {/* الصف 1: مربع التذكرة على اليمين (طيارة) | مربع هوية المستضيف على الشمال */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 items-stretch">
          {/* 1. تذكرة الطيران (طيارة) */}
          <FileDropArea
            onFileDrop={(file) => handleTicketFileChange(file)}
            accept=".pdf,.jpg,.jpeg,.png"
            maxSizeMb={15}
            activeBorderColor="sky"
            overlayText="أفلت التذكرة هنا"
            onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
            className="rounded-xl h-full"
          >
            {flightTicketFile ? (
              <div className="relative h-16 sm:h-20 p-1.5 bg-sky-50/70 border border-sky-400 rounded-xl flex flex-col items-center justify-center text-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTicketFileChange(null);
                  }}
                  className="absolute top-1 left-1 p-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                  title="إزالة واستبدال التذكرة"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-6 h-6 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center mb-0.5">
                  {isScanningTicket ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plane className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-gray-900 truncate max-w-[85%]" title={flightTicketFile.name}>
                  {flightTicketFile.name}
                </span>
                <span className="text-[9px] text-emerald-700 font-bold">
                  {isScanningTicket ? "جاري الاستخراج..." : "تم الرفع ✓"}
                </span>
              </div>
            ) : (
              <label
                htmlFor="topFlightTicketFile"
                className="h-16 sm:h-20 flex flex-col items-center justify-center border border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50/70 rounded-xl cursor-pointer transition-all p-1 text-center group"
              >
                <input
                  type="file"
                  id="topFlightTicketFile"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleTicketFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-0.5 shadow-2xs">
                  <Plane className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-sky-950">تذكرة الطيران</span>
              </label>
            )}
          </FileDropArea>

          {/* 2. هوية المستضيف */}
          <FileDropArea
            onFileDrop={(file) => handleHostIdFileChange(file)}
            accept=".pdf,.jpg,.jpeg,.png"
            maxSizeMb={10}
            activeBorderColor="amber"
            overlayText="أفلت الهوية هنا"
            onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
            className="rounded-xl h-full"
          >
            {hostIdFile ? (
              <div className="relative h-16 sm:h-20 p-1.5 bg-amber-50/70 border border-amber-400 rounded-xl flex flex-col items-center justify-center text-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHostIdFile(null);
                    setHostScanSuccess(false);
                    setHostScanMessage("");
                  }}
                  className="absolute top-1 left-1 p-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                  title="إزالة واستبدال الهوية"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center mb-0.5 font-bold text-xs">
                  {isScanningHostId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Home className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-gray-900 truncate max-w-[85%]" title={hostIdFile.name}>
                  {hostIdFile.name}
                </span>
                <span className="text-[9px] text-emerald-700 font-bold">
                  {isScanningHostId ? "جاري الفحص..." : "تم الرفع ✓"}
                </span>
              </div>
            ) : (
              <label
                htmlFor="topHostIdFile"
                className="h-16 sm:h-20 flex flex-col items-center justify-center border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 rounded-xl cursor-pointer transition-all p-1 text-center group"
              >
                <input
                  type="file"
                  id="topHostIdFile"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleHostIdFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-0.5 shadow-2xs">
                  <Home className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-amber-950">هوية المستضيف</span>
              </label>
            )}
          </FileDropArea>
        </div>

        {/* الصف 2: مستطيل عريض لرقم المستضيف */}
        <div className="space-y-0.5">
          <label className="block text-[11px] sm:text-xs font-bold text-gray-700">
            رقم المستضيف
          </label>
          <div className="relative">
            <input
              type="tel"
              value={hostPhone}
              onChange={(e) => setHostPhone(e.target.value)}
              placeholder="اكتب رقم المستضيف (مثال: 05xxxxxxxx)"
              dir="ltr"
              className="w-full text-xs sm:text-sm py-1.5 sm:py-2 px-3 bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-300 focus:border-amber-500 rounded-lg sm:rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-right font-mono font-bold transition-all"
            />
            <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* خط فاصل أنيق بين الاستضافة والمسافرين */}
        <div className="border-t border-gray-200/80 my-1"></div>

        {/* قائمة المسافرين */}
        <div className="space-y-2 sm:space-y-3">
          {travelers.map((traveler, index) => (
            <div
              key={traveler.id}
              className="bg-gray-50/50 border border-gray-200/90 rounded-xl sm:rounded-2xl p-2 sm:p-3 space-y-2 relative"
            >
              {/* شريط رأس المسافر (يظهر عند وجود أكثر من مسافر، أو لإظهار الاسم المستخرج) */}
              {travelers.length > 1 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      {traveler.fullName?.trim() ? traveler.fullName : `المسافر #${index + 1}`}
                    </span>
                    {traveler.passportNumber && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        ({traveler.passportNumber})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeTraveler(traveler.id)}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 p-0.5 rounded hover:bg-red-50 transition-colors font-medium cursor-pointer"
                    title="حذف المسافر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              ) : traveler.fullName?.trim() ? (
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center justify-between">
                  <span>تم استخراج: {traveler.fullName}</span>
                  {traveler.passportNumber && <span className="font-mono text-[10px]">({traveler.passportNumber})</span>}
                </div>
              ) : null}

              {/* الصف 4: على اليمين جواز السفر (ID)، وعلى الشمال الصورة الشخصية (User) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 items-stretch">
                {/* 1. جواز السفر (أيكون الـ ID) */}
                <FileDropArea
                  onFileDrop={(file) => handleFileChange(traveler.id, "passport", file)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="blue"
                  overlayText="أفلت جواز السفر هنا"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-xl h-full"
                >
                  {traveler.passportFile ? (
                    <div className="relative h-16 sm:h-20 p-1.5 bg-blue-50/70 border border-blue-400 rounded-xl flex flex-col items-center justify-center text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(traveler.id, "passport", null);
                        }}
                        className="absolute top-1 left-1 p-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                        title="إزالة واستبدال الجواز"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center mb-0.5 overflow-hidden">
                        {traveler.isScanning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : traveler.passportPreview ? (
                          <img src={traveler.passportPreview} alt="جواز السفر" className="w-full h-full object-cover" />
                        ) : (
                          <IdCard className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-gray-900 truncate max-w-[85%]" title={traveler.passportFile.name}>
                        {traveler.passportFile.name}
                      </span>
                      <span className="text-[9px] text-emerald-700 font-bold">
                        {traveler.isScanning ? "جاري الفحص..." : "تم الرفع ✓"}
                      </span>
                    </div>
                  ) : (
                    <label
                      htmlFor={`passport-${traveler.id}`}
                      className="h-16 sm:h-20 flex flex-col items-center justify-center border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 rounded-xl cursor-pointer transition-all p-1 text-center group"
                    >
                      <input
                        type="file"
                        id={`passport-${traveler.id}`}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(traveler.id, "passport", e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-0.5 shadow-2xs">
                        <IdCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-blue-950">جواز السفر</span>
                    </label>
                  )}
                </FileDropArea>

                {/* 2. الصورة الشخصية (أيكون شخص User) */}
                <FileDropArea
                  onFileDrop={(file) => handleFileChange(traveler.id, "photo", file)}
                  accept=".jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="purple"
                  overlayText="أفلت الصورة هنا"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-xl h-full"
                >
                  {traveler.photoFile ? (
                    <div className="relative h-16 sm:h-20 p-1.5 bg-purple-50/70 border border-purple-400 rounded-xl flex flex-col items-center justify-center text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(traveler.id, "photo", null);
                        }}
                        className="absolute top-1 left-1 p-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                        title="إزالة واستبدال الصورة"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-0.5 overflow-hidden border border-purple-300">
                        {traveler.photoPreview ? (
                          <img src={traveler.photoPreview} alt="الصورة الشخصية" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-gray-900 truncate max-w-[85%]" title={traveler.photoFile.name}>
                        {traveler.photoFile.name}
                      </span>
                      <span className="text-[9px] text-emerald-700 font-bold">
                        تم الرفع ✓
                      </span>
                    </div>
                  ) : (
                    <label
                      htmlFor={`photo-${traveler.id}`}
                      className="h-16 sm:h-20 flex flex-col items-center justify-center border border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/70 rounded-xl cursor-pointer transition-all p-1 text-center group"
                    >
                      <input
                        type="file"
                        id={`photo-${traveler.id}`}
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(traveler.id, "photo", e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-0.5 shadow-2xs">
                        <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-purple-950">الصورة الشخصية</span>
                    </label>
                  )}
                </FileDropArea>
              </div>

              {/* الصف 5: رقم التليفون للمسافر - إجباري */}
              <div className="space-y-0.5">
                <label className="block text-[11px] sm:text-xs font-bold text-gray-700">
                  رقم تليفون المسافر <span className="text-red-500 font-bold">* (إجباري)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    value={traveler.phoneNumber || ""}
                    onChange={(e) => updateTravelerField(traveler.id, "phoneNumber", e.target.value)}
                    placeholder="+966..."
                    className="w-full text-xs sm:text-sm py-1.5 sm:py-2 px-3 bg-white border border-gray-300 focus:border-blue-500 rounded-lg sm:rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-right transition-all"
                  />
                  <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* الصف 6: زر إضافة مسافر جديد */}
        <button
          type="button"
          onClick={addTraveler}
          className="w-full py-2 sm:py-2.5 border border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-blue-600 hover:text-blue-700 bg-blue-50/30 hover:bg-blue-50/60 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ إضافة مسافر جديد</span>
        </button>

        {/* شريط الإجراءات في الأسفل */}
        <div className="pt-2 sm:pt-3 border-t border-gray-100 flex flex-col items-center gap-1.5 sm:gap-2">
          <div className="flex items-center justify-between w-full gap-2.5">
            {/* حفظ كمسودة (أيقونة + كلمة مسودة بخط صغير) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title="حفظ كمسودة"
            >
              <Save className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-gray-600">مسودة</span>
            </button>

            {/* حفظ وإرسال للمراجعة (أيقونة + كلمة إرسال) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="حفظ وإرسال للمراجعة مباشرة"
            >
              <Send className="w-3.5 h-3.5 -rotate-90 shrink-0" />
              <span>إرسال</span>
            </button>
          </div>

          {/* إجمالي المسافرين وعدد الجوازات (بخط أصغر وفي الأسفل) */}
          <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-gray-500">
            <span>إجمالي المسافرين: <strong className="text-blue-600 font-bold">{travelers.length}</strong></span>
            <span className="text-gray-300">•</span>
            <span>الجوازات: <strong className="text-emerald-600 font-bold">{travelers.filter((t) => t.passportFile).length}</strong></span>
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
