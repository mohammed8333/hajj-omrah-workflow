"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  CorrectionRequest,
  DocumentItem,
  DocumentReviewStatus,
  DocumentType,
  GroupRequestDetail,
  Traveler,
} from "@/types";
import { DocumentStatusBadge, RequestStatusBadge } from "@/components/ui/StatusBadge";
import { DOCUMENT_TYPE_LABELS, REVIEW_STATUS_MAP } from "@/lib/constants";
import { RequestLifecycleTimer } from "@/components/ui/RequestLifecycleTimer";
import { SaudiAgentView } from "@/components/requests/SaudiAgentView";
import { SafaEmployeeView } from "@/components/requests/SafaEmployeeView";
import JSZip from "jszip";
import {
  Plane,
  Home,
  Users,
  FileText,
  UploadCloud,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Send,
  Check,
  AlertTriangle,
  FileUp,
  X,
  Building,
  Key,
  Calendar,
  Phone,
  Link2,
  RotateCcw,
  Archive,
  Hourglass,
  Edit2,
  Sparkles,
  Loader2,
  Download,
  Languages,
  ExternalLink,
  ScanText,
  Undo2,
  Upload,
  Ticket,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import { scanPassportMRZ, translateEnglishNameToArabic } from "@/lib/mrzScanner";
import { scanHostId } from "@/lib/hostIdScanner";
import { scanFlightTicket, calculateAirportArrivalTime } from "@/lib/flightTicketScanner";
import { getGeminiApiKey, setGeminiApiKey } from "@/lib/geminiVision";
import { useDialog } from "@/lib/dialog-context";
import { FileDropArea } from "@/components/ui/FileDropArea";
import { getWhatsAppUrl, getTelUrl, normalizePhone, validateHostPhone, validateTravelerPhone } from "@/lib/phoneUtils";
import { WhatsAppModal } from "@/components/ui/WhatsAppModal";
import { checkPassportValidity } from "@/lib/passportValidation";
import { formatOfficialGroupName, resolveSenderCode } from "@/lib/groupNaming";
import { WhatsAppGroupSendButton } from "@/components/requests/WhatsAppGroupSendButton";

export default function RequestDetailPage({
  requestId: propRequestId,
  params,
}: {
  requestId?: string;
  params?: Promise<{ id: string }> | { id: string };
}) {
  const routeParams = useParams<{ id: string }>();
  const rawId = propRequestId || routeParams?.id || "";
  const requestId = (rawId || "").split("?")[0];
  const router = useRouter();
  const { user, role } = useAuth();
  const { confirm, prompt, alert } = useDialog();

  const [request, setRequest] = useState<GroupRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocLoading, setPreviewDocLoading] = useState(false);
  const [reviewModalDoc, setReviewModalDoc] = useState<DocumentItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>("Accepted");
  const [reviewNote, setReviewNote] = useState("");

  // Safa Complete Modal & Nusuk Number
  const [showNusukModal, setShowNusukModal] = useState(false);
  const [nusukInput, setNusukInput] = useState("");
  const [nusukGroupName, setNusukGroupName] = useState("");
  const [nusukNote, setNusukNote] = useState("");
  const [editingNusuk, setEditingNusuk] = useState(false);

  // Correction Request Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<{
    travelerId?: string;
    documentId?: string;
    targetField?: string;
  }>({});
  const [correctionReason, setCorrectionReason] = useState("");

  // Uploading state
  const [uploadingFor, setUploadingFor] = useState<{
    travelerId?: string;
    docType: DocumentType;
  } | null>(null);

  // Flight Details Edit Modal
  const [showFlightEditModal, setShowFlightEditModal] = useState(false);
  const [editAirline, setEditAirline] = useState("");
  const [editFlightNumber, setEditFlightNumber] = useState("");
  const [editReturnFlightNumber, setEditReturnFlightNumber] = useState("");
  const [editArrivalAirport, setEditArrivalAirport] = useState("");
  const [editSaudiArrivalTime, setEditSaudiArrivalTime] = useState("");
  const [editReturnDepartureAirport, setEditReturnDepartureAirport] = useState("");
  const [editReturnFlightDepartureTime, setEditReturnFlightDepartureTime] = useState("");
  const [editDepartureDate, setEditDepartureDate] = useState("");
  const [editReturnDate, setEditReturnDate] = useState("");
  const [editFlightDepartureTime, setEditFlightDepartureTime] = useState("");
  const [editAirportArrivalTime, setEditAirportArrivalTime] = useState("");
  const [isScanningFlightTicketDoc, setIsScanningFlightTicketDoc] = useState(false);

  // Batch download state
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Traveler Inline Edit / MRZ Scanning
  const [editingTravelerId, setEditingTravelerId] = useState<string | null>(null);
  const [editTravelerName, setEditTravelerName] = useState("");
  const [editTravelerPassport, setEditTravelerPassport] = useState("");
  const [editTravelerPhone, setEditTravelerPhone] = useState("");
  const [editTravelerNationality, setEditTravelerNationality] = useState("");
  const [editTravelerBirthDate, setEditTravelerBirthDate] = useState("");
  const [editTravelerExpiryDate, setEditTravelerExpiryDate] = useState("");
  const [isMrzScanningTravelerId, setIsMrzScanningTravelerId] = useState<string | null>(null);
  const [isScanningHostIdDoc, setIsScanningHostIdDoc] = useState(false);

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Host Info Edit State
  const [editingHostInfo, setEditingHostInfo] = useState(false);
  const [editHostName, setEditHostName] = useState("");
  const [editHostBirthDate, setEditHostBirthDate] = useState("");
  const [editHostNationality, setEditHostNationality] = useState("");
  const [editHostPhone, setEditHostPhone] = useState("");
  const [editHostNationalId, setEditHostNationalId] = useState("");

  // General Transaction Info Edit Modal
  const [showEditGeneralModal, setShowEditGeneralModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Admin View Switching State
  const [adminViewMode, setAdminViewMode] = useState<"agent" | "safa" | "full">("agent");

  useEffect(() => {
    let isMounted = true;
    if (previewDoc) {
      setPreviewDocLoading(true);
      api.documents
        .getStreamUrl(previewDoc.id)
        .then((url) => {
          if (isMounted) {
            setPreviewDocUrl(url);
            setPreviewDocLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setPreviewDocUrl(null);
            setPreviewDocLoading(false);
          }
        });
    } else {
      setPreviewDocUrl(null);
      setPreviewDocLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [previewDoc]);

  const loadRequest = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }
      const data = await api.requests.getById(requestId);
      setRequest(data);
      if (data.nusukGroupNumber) {
        setNusukInput(data.nusukGroupNumber);
      }
      if (data.groupName) {
        setNusukGroupName(data.groupName);
      }
      const isAgentEligibleStatus = [
        "ReadyForSaudiAgent",
        "ReceivedBySaudiAgent",
        "SaudiAgentProcessing",
        "SaudiAgentCorrectionRequired",
        "ProgramLinked",
        "HostingAcceptanceRequested",
        "HostingAcceptedBySender",
        "HostingConfirmed",
        "Completed",
        "Archived",
      ].includes(data.status);
      setAdminViewMode(isAgentEligibleStatus ? "agent" : "safa");

      // If URL contains docId (e.g. clicked from Excel export), auto-open preview modal
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        let targetDocId = urlParams.get("docId") || urlParams.get("doc");
        if (!targetDocId && window.location.hash.includes("?")) {
          const hashQuery = window.location.hash.split("?")[1];
          const hashParams = new URLSearchParams(hashQuery);
          targetDocId = hashParams.get("docId") || hashParams.get("doc");
        }
        if (targetDocId) {
          let foundDoc = data.groupDocuments?.find((d) => d.id === targetDocId);
          if (!foundDoc && data.hostingInfo?.hostIdDocument?.id === targetDocId) {
            foundDoc = data.hostingInfo.hostIdDocument;
          }
          if (!foundDoc && data.travelers) {
            for (const t of data.travelers) {
              const d = t.documents?.find((doc) => doc.id === targetDocId);
              if (d) {
                foundDoc = d;
                break;
              }
            }
          }
          // Fallback by documentType
          if (!foundDoc) {
            if (targetDocId === "HostId" || targetDocId === "host") {
              foundDoc =
                data.hostingInfo?.hostIdDocument ||
                data.groupDocuments?.find((d) => d.documentType === "HostId");
            } else if (targetDocId === "Passport" || targetDocId === "pass") {
              foundDoc =
                data.travelers?.[0]?.documents?.find((d) => d.documentType === "Passport") ||
                data.groupDocuments?.find((d) => d.documentType === "Passport");
            } else if (targetDocId === "PersonalPhoto" || targetDocId === "photo") {
              foundDoc =
                data.travelers?.[0]?.documents?.find((d) => d.documentType === "PersonalPhoto") ||
                data.groupDocuments?.find((d) => d.documentType === "PersonalPhoto");
            } else if (targetDocId === "FlightTicket" || targetDocId === "ticket") {
              foundDoc =
                data.travelers?.[0]?.documents?.find((d) => d.documentType === "FlightTicket") ||
                data.groupDocuments?.find((d) => d.documentType === "FlightTicket");
            }
          }
          if (foundDoc) {
            setPreviewDoc(foundDoc);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("تعذر تحميل بيانات المعاملة.");
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadRequest(true);
  }, [requestId]);

  const handleFileUpload = async (
    file: File,
    docType: DocumentType,
    travelerId?: string
  ) => {
    try {
      setActionLoading(true);
      setError(null);
      await api.documents.upload(requestId, file, docType, travelerId);

      // If uploading a Host ID image, scan OCR and update hostingInfo
      if (docType === "HostId" && file.type.startsWith("image/")) {
        try {
          const scanResult = await scanHostId(file);
          if (
            scanResult &&
            (scanResult.hostName ||
              scanResult.hostBirthDate ||
              scanResult.hostNationality ||
              scanResult.idNumber)
          ) {
            await api.requests.update(requestId, {
              hasHosting: true,
              hostName: scanResult.hostName || request?.hostingInfo?.hostName,
              hostBirthDate: scanResult.hostBirthDate || request?.hostingInfo?.hostBirthDate,
              hostNationality: scanResult.hostNationality || request?.hostingInfo?.hostNationality,
              hostNationalId: scanResult.idNumber || request?.hostingInfo?.hostNationalId,
              hostPhone: request?.hostingInfo?.hostPhone,
            });
            setSuccess(
              `تم رفع هوية المستضيف واستخراج البيانات بنجاح: ${scanResult.hostName || ""} ${
                scanResult.hostNationality ? `[${scanResult.hostNationality}]` : ""
              } ${scanResult.hostBirthDate ? `(تاريخ الميلاد: ${scanResult.hostBirthDate})` : ""}`
            );
          } else {
            setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (hostScanErr) {
          console.warn("Host ID auto-scan error:", hostScanErr);
          setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
        }
      } else if (docType === "Passport" && travelerId && file.type.startsWith("image/")) {
        try {
          const scanResult = await scanPassportMRZ(file);
          if (scanResult && scanResult.fullNameArabic) {
            const currentTraveler = request?.travelers?.find((t) => t.id === travelerId);
            const isGenericName =
              !currentTraveler?.fullName ||
              /^مسافر\s*#?\d*$/i.test(currentTraveler.fullName.trim()) ||
              /^المسافر\s*#?\d*$/i.test(currentTraveler.fullName.trim());
            if (isGenericName) {
              await api.travelers.update(travelerId, {
                fullName: scanResult.fullNameArabic,
                passportNumber: scanResult.passportNumber || currentTraveler?.passportNumber,
                nationality: scanResult.nationality || currentTraveler?.nationality,
                dateOfBirth: scanResult.dateOfBirth || currentTraveler?.dateOfBirth,
              });
              setSuccess(`تم رفع الجواز واستخراج اسم المسافر تلقائياً: (${scanResult.fullNameArabic})`);
            } else {
              setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
            }
          } else {
            setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (mrzErr) {
          console.warn("MRZ auto-scan error:", mrzErr);
          setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
        }
      } else if (docType === "FlightTicket") {
        try {
          const scanResult = await scanFlightTicket(file);
          if (
            scanResult &&
            (scanResult.departureDate ||
              scanResult.returnDate ||
              scanResult.flightDepartureTime ||
              scanResult.airline ||
              scanResult.flightNumber)
          ) {
            let arrivalTime = scanResult.airportArrivalTime;
            if (scanResult.flightDepartureTime) {
              arrivalTime = calculateAirportArrivalTime(scanResult.flightDepartureTime);
            }
            await api.requests.update(requestId, {
              airline: scanResult.airline || request?.airline,
              flightNumber: scanResult.flightNumber || request?.flightNumber,
              returnFlightNumber: scanResult.returnFlightNumber || request?.returnFlightNumber,
              arrivalAirport: scanResult.arrivalAirport || request?.arrivalAirport,
              saudiArrivalTime: scanResult.saudiArrivalTime || request?.saudiArrivalTime,
              returnDepartureAirport: scanResult.returnDepartureAirport || request?.returnDepartureAirport,
              returnFlightDepartureTime: scanResult.returnFlightDepartureTime || request?.returnFlightDepartureTime,
              departureDate: scanResult.departureDate || request?.departureDate,
              returnDate: scanResult.returnDate || request?.returnDate,
              flightDepartureTime: scanResult.flightDepartureTime || request?.flightDepartureTime,
              airportArrivalTime: arrivalTime || request?.airportArrivalTime,
            });
            setSuccess(
              `تم رفع تذكرة الطيران واستخراج البيانات بنجاح: ${scanResult.airline || ""} ${
                scanResult.flightNumber ? `(رحلة ${scanResult.flightNumber})` : ""
              } ${scanResult.departureDate ? `| الذهاب: ${scanResult.departureDate}` : ""} ${
                scanResult.flightDepartureTime ? `| الإقلاع: ${scanResult.flightDepartureTime}` : ""
              }`
            );
          } else {
            setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (ticketScanErr) {
          console.warn("Flight ticket auto-scan error:", ticketScanErr);
          setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
        }
      } else {
        setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
      }

      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("فشل رفع المستند.");
      }
    } finally {
      setActionLoading(false);
      setUploadingFor(null);
    }
  };

  const handleUpdateTraveler = async (
    travelerId: string,
    fullName: string,
    passportNumber?: string,
    phoneNumber?: string,
    nationality?: string,
    dateOfBirth?: string,
    expiryDate?: string
  ) => {
    if (!fullName.trim()) {
      setError("يرجى كتابة اسم المسافر.");
      return;
    }

    let formattedPhone: string | undefined = undefined;
    if (phoneNumber !== undefined && phoneNumber.trim()) {
      const pVal = validateTravelerPhone(phoneNumber);
      if (!pVal.isValid) {
        setError(pVal.error || "رقم المسافر غير صحيح");
        return;
      }
      formattedPhone = pVal.formatted;
    } else if (phoneNumber !== undefined) {
      formattedPhone = undefined;
    }

    try {
      setActionLoading(true);
      setError(null);
      const current = request?.travelers.find((t) => t.id === travelerId);
      await api.travelers.update(travelerId, {
        fullName: fullName.trim(),
        passportNumber: passportNumber?.trim() || current?.passportNumber,
        phoneNumber: phoneNumber !== undefined ? formattedPhone : current?.phoneNumber,
        nationality: nationality?.trim() || current?.nationality,
        dateOfBirth: dateOfBirth?.trim() || current?.dateOfBirth,
        expiryDate: expiryDate !== undefined ? expiryDate?.trim() : current?.expiryDate,
        notes: current?.notes,
      });
      setSuccess("تم تحديث بيانات المسافر بنجاح.");
      setEditingTravelerId(null);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحديث بيانات المسافر.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveHostInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!request) return;

    let formattedHostPhone: string | undefined = undefined;
    if (editHostPhone.trim()) {
      const hVal = validateHostPhone(editHostPhone);
      if (!hVal.isValid) {
        setError(hVal.error || "رقم المستضيف غير صحيح");
        return;
      }
      formattedHostPhone = hVal.formatted;
    }

    try {
      setActionLoading(true);
      setError(null);
      await api.requests.update(requestId, {
        hasHosting: true,
        hostName: editHostName.trim(),
        hostBirthDate: editHostBirthDate.trim() || undefined,
        hostNationality: editHostNationality.trim() || undefined,
        hostPhone: formattedHostPhone,
        hostNationalId: editHostNationalId.trim() || undefined,
      });
      setSuccess("تم تحديث بيانات المستضيف بنجاح.");
      setEditingHostInfo(false);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحديث بيانات المستضيف.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveGeneralInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.update(requestId, {
        groupName: editGroupName.trim() || request.groupName,
        contactPhone: editContactPhone.trim() || request.contactPhone,
        destination: editDestination.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setSuccess("تم تحديث بيانات المعاملة الأساسية بنجاح.");
      setShowEditGeneralModal(false);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحديث بيانات المعاملة.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanExistingPassport = async (traveler: Traveler) => {
    const passDoc = traveler.documents?.find((d) => d.documentType === "Passport");
    if (!passDoc) {
      setError("لا يوجد جواز سفر مرفوع لهذا المسافر لفحصه.");
      return;
    }

    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      const enteredKey = await prompt({
        title: "تفعيل فحص الجواز بالذكاء الاصطناعي (Google Gemini AI)",
        message:
          "للحصول على قراءة دقيقة 100% للجواز وترجمة الاسم واستخراج الجنسية والميلاد، الصق مفتاح Google Gemini المجاني هنا (أو اتركه فارغاً للمتابعة بالفحص العادي):",
        placeholder: "AIzaSy...",
        confirmText: "فحص بالذكاء الاصطناعي ✨",
        cancelText: "فحص عادي",
        variant: "primary",
      });
      if (enteredKey && enteredKey.trim()) {
        setGeminiApiKey(enteredKey.trim());
      }
    }

    try {
      setIsMrzScanningTravelerId(traveler.id);
      setError(null);
      const streamUrl = await api.documents.getStreamUrl(passDoc.id);
      const scanResult = await scanPassportMRZ(streamUrl);
      if (scanResult && scanResult.fullNameArabic) {
        await api.travelers.update(traveler.id, {
          fullName: scanResult.fullNameArabic,
          passportNumber: scanResult.passportNumber || traveler.passportNumber,
          nationality: scanResult.nationality || traveler.nationality,
          dateOfBirth: scanResult.dateOfBirth || traveler.dateOfBirth,
          expiryDate: scanResult.expiryDate || traveler.expiryDate,
        });
        const hasGemini = !!getGeminiApiKey();
        setSuccess(
          `تم بنجاح فحص الجواز ${hasGemini ? "بالذكاء الاصطناعي (Gemini Vision AI ✨)" : ""} وتحديث الاسم إلى: (${scanResult.fullNameArabic})`
        );
        await loadRequest();
      } else {
        setError("تعذر قراءة بيانات الجواز بوضوح، يرجى التأكد من وضوح الصورة أو تعديل الاسم يدوياً.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء فحص صورة الجواز.");
    } finally {
      setIsMrzScanningTravelerId(null);
    }
  };

  const handleDownloadDoc = async (doc: DocumentItem) => {
    try {
      setActionLoading(true);
      const url = await api.documents.getStreamUrl(doc.id);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        doc.originalFileName ||
        `document-${doc.documentType}.${doc.mimeType?.includes("pdf") ? "pdf" : "jpg"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Download failed", e);
      setError("فشل تنزيل الملف، يرجى المحاولة مرة أخرى.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadAllDocs = async () => {
    if (!request) return;
    try {
      setIsDownloadingAll(true);
      setError(null);

      const docEntries: { doc: DocumentItem; customName: string }[] = [];

      // 1. Host ID Document
      const hostDoc =
        request.hostingInfo?.hostIdDocument ||
        request.groupDocuments?.find((d) => d.documentType === "HostId");
      if (hostDoc) {
        const ext =
          hostDoc.originalFileName?.split(".").pop() ||
          (hostDoc.mimeType?.includes("pdf") ? "pdf" : "jpg");
        docEntries.push({
          doc: hostDoc,
          customName: `1_هوية_المستضيف.${ext}`,
        });
      }

      // 2. Shared Flight Ticket Document
      const ticketDoc =
        request.flightTicketDocument ||
        request.groupDocuments?.find((d) => d.documentType === "FlightTicket");
      if (ticketDoc) {
        const ext =
          ticketDoc.originalFileName?.split(".").pop() ||
          (ticketDoc.mimeType?.includes("pdf") ? "pdf" : "jpg");
        docEntries.push({
          doc: ticketDoc,
          customName: `2_تذكرة_الطيران_المشتركة.${ext}`,
        });
      }

      // 3. Traveler Documents (Passport & Photo)
      request.travelers?.forEach((traveler, tIdx) => {
        const safeName = (traveler.fullName || `مسافر_${tIdx + 1}`).replace(
          /[\/\\:*?"<>|]/g,
          "_"
        );
        const passDoc = traveler.documents?.find((d) => d.documentType === "Passport");
        if (passDoc) {
          const ext =
            passDoc.originalFileName?.split(".").pop() ||
            (passDoc.mimeType?.includes("pdf") ? "pdf" : "jpg");
          docEntries.push({
            doc: passDoc,
            customName: `مسافر_${tIdx + 1}_${safeName}_جواز_السفر.${ext}`,
          });
        }
        const photoDoc = traveler.documents?.find(
          (d) => d.documentType === "PersonalPhoto"
        );
        if (photoDoc) {
          const ext =
            photoDoc.originalFileName?.split(".").pop() ||
            (photoDoc.mimeType?.includes("pdf") ? "pdf" : "jpg");
          docEntries.push({
            doc: photoDoc,
            customName: `مسافر_${tIdx + 1}_${safeName}_الصورة_الشخصية.${ext}`,
          });
        }
      });

      if (docEntries.length === 0) {
        await alert({
          title: "لا توجد مستندات",
          message: "لا توجد أي مستندات مرفوعة في هذه المعاملة حالياً لتحميلها.",
          variant: "warning",
        });
        return;
      }

      const zip = new JSZip();

      for (const entry of docEntries) {
        try {
          const streamUrl = await api.documents.getStreamUrl(entry.doc.id);
          const response = await fetch(streamUrl);
          const blob = await response.blob();
          zip.file(entry.customName, blob);
        } catch (fileErr) {
          console.error(`Failed to package doc ${entry.customName}`, fileErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `معاملة_${request.requestNumber || request.id}_كافة_المستندات.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(
        `تم بنجاح تحميل كافة المستندات (${docEntries.length} ملفات) في ملف مضغوط ZIP.`
      );
    } catch (err: unknown) {
      console.error("Batch download error:", err);
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء تجميع وتحميل كافة المستندات.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleScanExistingHostId = async (doc: DocumentItem) => {
    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      if (doc.mimeType && !doc.mimeType.startsWith("image/")) {
        await alert({
          title: "تنبيه الفحص التلقائي",
          message: "الفحص التلقائي العادي متاح فقط لملفات الصور (JPG, PNG). لتفعيل فحص ملفات PDF يرجى إدخال مفتاح الذكاء الاصطناعي (Gemini) في الإعدادات.",
          variant: "info",
        });
        return;
      }

      const enteredKey = await prompt({
        title: "تفعيل فحص الهوية بالذكاء الاصطناعي (Google Gemini AI)",
        message:
          "للحصول على قراءة دقيقة 100% لبيانات هوية المستضيف وتاريخ الميلاد ورقم الهوية، الصق مفتاح Google Gemini المجاني هنا (أو اتركه فارغاً للمتابعة بالفحص العادي):",
        placeholder: "AIzaSy...",
        confirmText: "فحص بالذكاء الاصطناعي ✨",
        cancelText: "فحص عادي",
        variant: "primary",
      });
      if (enteredKey && enteredKey.trim()) {
        setGeminiApiKey(enteredKey.trim());
      }
    }

    try {
      setIsScanningHostIdDoc(true);
      setError(null);
      const streamUrl = await api.documents.getStreamUrl(doc.id);
      const scanResult = await scanHostId(streamUrl);
      if (
        scanResult &&
        (scanResult.hostName ||
          scanResult.hostBirthDate ||
          scanResult.hostNationality ||
          scanResult.idNumber)
      ) {
        await api.requests.update(requestId, {
          hasHosting: true,
          hostName: scanResult.hostName || request?.hostingInfo?.hostName,
          hostBirthDate: scanResult.hostBirthDate || request?.hostingInfo?.hostBirthDate,
          hostNationality: scanResult.hostNationality || request?.hostingInfo?.hostNationality,
          hostNationalId: scanResult.idNumber || request?.hostingInfo?.hostNationalId,
          hostPhone: request?.hostingInfo?.hostPhone,
        });
        const hasGemini = !!getGeminiApiKey();
        setSuccess(
          `تم بنجاح فحص هوية المستضيف ${hasGemini ? "بالذكاء الاصطناعي (Gemini Vision AI ✨)" : ""}: ${scanResult.hostName || ""} ${
            scanResult.hostNationality ? `[${scanResult.hostNationality}]` : ""
          } ${scanResult.hostBirthDate ? `(تاريخ الميلاد: ${scanResult.hostBirthDate})` : ""} ${
            scanResult.idNumber ? `(رقم الهوية: ${scanResult.idNumber})` : ""
          }`
        );
        await loadRequest();
      } else {
        setError("تعذر قراءة بيانات هوية المستضيف بوضوح، يرجى التأكد من وضوح الصورة.");
      }
    } catch (err: unknown) {
      console.error("Host ID scan failed:", err);
      setError("حدث خطأ أثناء فحص صورة هوية المستضيف بالذكاء الاصطناعي.");
    } finally {
      setIsScanningHostIdDoc(false);
    }
  };

  const handleTranslateEditName = async () => {
    if (!editTravelerName.trim()) return;
    try {
      setActionLoading(true);
      const translated = await translateEnglishNameToArabic(editTravelerName.trim());
      if (translated) {
        setEditTravelerName(translated);
        setSuccess(`تمت ترجمة الاسم عبر Google Translate إلى: (${translated})`);
      }
    } catch (e) {
      console.warn("Translation failed:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const ok = await confirm({
      title: "حذف المستند",
      message: "هل أنت متأكد من رغبتك في حذف هذا المستند نهائياً؟",
      confirmText: "حذف المستند",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      await api.documents.delete(docId);
      setSuccess("تم حذف المستند بنجاح.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanExistingFlightTicket = async (ticketDoc: DocumentItem) => {
    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      const enteredKey = await prompt({
        title: "تفعيل فحص تذكرة الطيران بالذكاء الاصطناعي (Google Gemini AI)",
        message:
          "لاستخراج مواعيد الرحلات وأرقام الطيران والمطارات آلياً من التذكرة (PDF أو صورة)، الصق مفتاح Google Gemini المجاني هنا:",
        placeholder: "AIzaSy...",
        confirmText: "فحص بالذكاء الاصطناعي ✨",
        cancelText: "إلغاء",
        variant: "primary",
      });
      if (enteredKey && enteredKey.trim()) {
        setGeminiApiKey(enteredKey.trim());
      } else {
        return;
      }
    }

    try {
      setIsScanningFlightTicketDoc(true);
      setError(null);
      const url = await api.documents.getStreamUrl(ticketDoc.id);
      if (!url) throw new Error("تعذر جلب ملف تذكرة الطيران للفحص");

      const result = await scanFlightTicket(url);
      if (
        result &&
        (result.departureDate ||
          result.returnDate ||
          result.flightDepartureTime ||
          result.airline ||
          result.flightNumber)
      ) {
        let arrivalTime = result.airportArrivalTime;
        if (result.flightDepartureTime) {
          arrivalTime = calculateAirportArrivalTime(result.flightDepartureTime);
        }
        await api.requests.update(requestId, {
          airline: result.airline || request?.airline,
          flightNumber: result.flightNumber || request?.flightNumber,
          returnFlightNumber: result.returnFlightNumber || request?.returnFlightNumber,
          arrivalAirport: result.arrivalAirport || request?.arrivalAirport,
          saudiArrivalTime: result.saudiArrivalTime || request?.saudiArrivalTime,
          returnDepartureAirport: result.returnDepartureAirport || request?.returnDepartureAirport,
          returnFlightDepartureTime: result.returnFlightDepartureTime || request?.returnFlightDepartureTime,
          departureDate: result.departureDate || request?.departureDate,
          returnDate: result.returnDate || request?.returnDate,
          flightDepartureTime: result.flightDepartureTime || request?.flightDepartureTime,
          airportArrivalTime: arrivalTime || request?.airportArrivalTime,
        });
        setSuccess(
          `تم فحص تذكرة الطيران بالذكاء الاصطناعي وتحديث البيانات بنجاح: ${result.airline || ""} ${
            result.flightNumber ? `(رحلة ${result.flightNumber})` : ""
          } ${result.departureDate ? `| الذهاب: ${result.departureDate}` : ""} ${
            result.flightDepartureTime ? `| الإقلاع: ${result.flightDepartureTime}` : ""
          }`
        );
        await loadRequest();
      } else {
        setSuccess("تم فحص التذكرة ولكن لم يتم استخراج بيانات واضحة، يمكنك تعديلها يدوياً.");
      }
    } catch (e: any) {
      console.warn("Scan existing flight ticket error:", e);
      setError(e.message || "فشل فحص تذكرة الطيران بالذكاء الاصطناعي");
    } finally {
      setIsScanningFlightTicketDoc(false);
    }
  };

  const handleSaveFlightDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.update(request.id, {
        groupName: request.groupName,
        contactPhone: request.contactPhone,
        hasHosting: request.hasHosting,
        destination: request.destination,
        notes: request.notes,
        hostName: request.hostingInfo?.hostName,
        hostPhone: request.hostingInfo?.hostPhone,
        hostAddress: request.hostingInfo?.hostAddress,
        airline: editAirline || undefined,
        flightNumber: editFlightNumber || undefined,
        returnFlightNumber: editReturnFlightNumber || undefined,
        arrivalAirport: editArrivalAirport || undefined,
        saudiArrivalTime: editSaudiArrivalTime || undefined,
        returnDepartureAirport: editReturnDepartureAirport || undefined,
        returnFlightDepartureTime: editReturnFlightDepartureTime || undefined,
        departureDate: editDepartureDate || undefined,
        returnDate: editReturnDate || undefined,
        flightDepartureTime: editFlightDepartureTime || undefined,
        airportArrivalTime: editAirportArrivalTime || undefined,
      });
      setSuccess("تم تحديث مواعيد وبيانات الرحلة والطيران بنجاح.");
      setShowFlightEditModal(false);
      await loadRequest();
    } catch (err: any) {
      setError(err.message || "فشل تحديث مواعيد الرحلة");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    const ok = await confirm({
      title: "تقديم الطلب للمراجعة",
      message: "هل أنت متأكد من تقديم الطلب لموظف الصفا للمراجعة والتدقيق؟",
      confirmText: "تأكيد التقديم",
      cancelText: "إلغاء",
      variant: "primary",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.submit(requestId);
      setSuccess("تم تقديم الطلب بنجاح وهو الآن قيد مراجعة الصفا.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSafaStartReview = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.transition(requestId, "UnderReview", "بدء مراجعة وتدقيق المعاملة");
      setSuccess("تم بدء مراجعة المعاملة.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewDocument = async () => {
    if (!reviewModalDoc) return;
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.documents.review(reviewModalDoc.id, reviewStatus, reviewNote);
      setSuccess("تم تحديث نتيجة تدقيق المستند.");
      setReviewModalDoc(null);
      setReviewNote("");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReview = async (
    docId: string,
    newStatus: DocumentReviewStatus,
    note?: string
  ) => {
    let finalNote = note;
    if (newStatus === "NeedsCorrection" && !finalNote) {
      const input = await prompt({
        title: "طلب تصحيح للمستند",
        message: "اكتب ملاحظة أو سبب طلب التصحيح للمرسل (اختياري):",
        placeholder: "اكتب سبب طلب التصحيح هنا...",
        confirmText: "طلب التصحيح",
        cancelText: "إلغاء",
        variant: "warning",
      });
      if (input === null) return;
      finalNote = input.trim() || undefined;
    } else if (newStatus === "Rejected" && !finalNote) {
      const input = await prompt({
        title: "رفض المستند",
        message: "اكتب سبب رفض المستند للمرسل (اختياري):",
        placeholder: "اكتب سبب الرفض هنا...",
        confirmText: "تأكيد الرفض",
        cancelText: "إلغاء",
        variant: "danger",
      });
      if (input === null) return;
      finalNote = input.trim() || undefined;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      // Optimistic in-place update for instant UI feedback without reload
      setRequest((prev) => {
        if (!prev) return prev;
        const updateDoc = (d: DocumentItem): DocumentItem =>
          d.id === docId
            ? {
                ...d,
                reviewStatus: newStatus,
                reviewNote: finalNote !== undefined ? finalNote : d.reviewNote,
              }
            : d;

        return {
          ...prev,
          hostingInfo: prev.hostingInfo
            ? {
                ...prev.hostingInfo,
                hostIdDocument: prev.hostingInfo.hostIdDocument
                  ? updateDoc(prev.hostingInfo.hostIdDocument)
                  : undefined,
              }
            : prev.hostingInfo,
          groupDocuments: prev.groupDocuments ? prev.groupDocuments.map(updateDoc) : undefined,
          travelers: prev.travelers.map((t) => ({
            ...t,
            documents: t.documents.map(updateDoc),
          })),
        };
      });

      await api.documents.review(docId, newStatus, finalNote);
      const label =
        newStatus === "Accepted"
          ? "مقبول ✓"
          : newStatus === "NeedsCorrection"
          ? "يحتاج تصحيح ⚠️"
          : newStatus === "Rejected"
          ? "مرفوض ✗"
          : "قيد الانتظار";
      setSuccess(`تم تحديث حالة المستند إلى: ${label}`);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      await loadRequest(false);
    } finally {
      setActionLoading(false);
    }
  };

  const checkAllDocumentsAccepted = (): { isAllAccepted: boolean; reason?: string } => {
    if (!request) return { isAllAccepted: false, reason: "بيانات المعاملة غير متوفرة" };

    // 1. Check hosting document if hasHosting is true
    if (request.hasHosting) {
      const hostDoc =
        request.hostingInfo?.hostIdDocument ||
        request.groupDocuments?.find((d) => d.documentType === "HostId");
      if (!hostDoc) {
        return { isAllAccepted: false, reason: "مستند هوية المستضيف غير مرفوع في المعاملة." };
      }
      if (hostDoc.reviewStatus !== "Accepted") {
        const st = REVIEW_STATUS_MAP[hostDoc.reviewStatus]?.label || hostDoc.reviewStatus;
        return {
          isAllAccepted: false,
          reason: `مستند هوية المستضيف (${st})، يجب مراجعته وقبوله أولاً.`,
        };
      }
    }

    // 2. Check travelers
    if (!request.travelers || request.travelers.length === 0) {
      return { isAllAccepted: false, reason: "لا يوجد مسافرين مسجلين في المعاملة." };
    }

    for (let i = 0; i < request.travelers.length; i++) {
      const traveler = request.travelers[i];
      const travelerLabel = traveler.fullName || `المسافر #${i + 1}`;
      const docs = traveler.documents || [];

      // Check passport
      const passportDoc = docs.find((d) => d.documentType === "Passport");
      if (!passportDoc) {
        return { isAllAccepted: false, reason: `جواز السفر غير مرفوع للمسافر (${travelerLabel}).` };
      }
      if (passportDoc.reviewStatus !== "Accepted") {
        const st = REVIEW_STATUS_MAP[passportDoc.reviewStatus]?.label || passportDoc.reviewStatus;
        return {
          isAllAccepted: false,
          reason: `جواز السفر للمسافر (${travelerLabel}) (${st})، يجب قبوله أولاً.`,
        };
      }

      // Check personal photo
      const photoDoc = docs.find((d) => d.documentType === "PersonalPhoto");
      if (!photoDoc) {
        return { isAllAccepted: false, reason: `الصورة الشخصية غير مرفوعة للمسافر (${travelerLabel}).` };
      }
      if (photoDoc.reviewStatus !== "Accepted") {
        const st = REVIEW_STATUS_MAP[photoDoc.reviewStatus]?.label || photoDoc.reviewStatus;
        return {
          isAllAccepted: false,
          reason: `الصورة الشخصية للمسافر (${travelerLabel}) (${st})، يجب قبولها أولاً.`,
        };
      }

      // Check all other uploaded documents for this traveler
      for (const doc of docs) {
        if (doc.reviewStatus !== "Accepted") {
          const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
          const st = REVIEW_STATUS_MAP[doc.reviewStatus]?.label || doc.reviewStatus;
          return {
            isAllAccepted: false,
            reason: `المستند (${typeLabel}) للمسافر (${travelerLabel}) (${st})، يجب قبوله أولاً.`,
          };
        }
      }
    }

    // 3. Check group documents
    if (request.groupDocuments && request.groupDocuments.length > 0) {
      for (const doc of request.groupDocuments) {
        if (doc.reviewStatus !== "Accepted") {
          const docName = doc.originalFileName || DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
          const st = REVIEW_STATUS_MAP[doc.reviewStatus]?.label || doc.reviewStatus;
          return {
            isAllAccepted: false,
            reason: `المستند (${docName}) للمجموعة (${st})، لم يتم قبوله بعد.`,
          };
        }
      }
    }

    return { isAllAccepted: true };
  };

  const handleCompleteSafa = async () => {
    const docCheckResult = checkAllDocumentsAccepted();
    if (!docCheckResult.isAllAccepted) {
      await alert({
        title: "تنبيه تدقيق المستندات",
        message: docCheckResult.reason || "لا يمكن إدخال رقم نسك إلا بعد قبول جميع المستندات.",
        variant: "warning",
      });
      return;
    }
    if (!nusukInput.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال رقم مجموعة نسك لمتابعة الإجراء.",
        variant: "warning",
      });
      return;
    }
    if (!nusukGroupName.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال اسم المجموعة لمتابعة الإجراء.",
        variant: "warning",
      });
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.safaComplete(
        requestId,
        nusukInput.trim(),
        nusukNote.trim() || undefined,
        nusukGroupName.trim()
      );
      if (request) {
        request.groupName = nusukGroupName.trim();
        request.nusukGroupNumber = nusukInput.trim();
      }
      setSuccess("تم اكتمال تسجيل صفا وتوثيق رقم نسك وتحديث اسم المجموعة بنجاح.");
      setShowNusukModal(false);
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNusukNumber = async (val?: string) => {
    const num = val !== undefined ? val : nusukInput;
    if (!request) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.update(requestId, {
        nusukGroupNumber: num.trim() || undefined,
      });
      setSuccess("تم حفظ وتحديث رقم مجموعة نسك بنجاح.");
      setEditingNusuk(false);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل حفظ رقم مجموعة نسك.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToSaudiAgent = async () => {
    const ok = await confirm({
      title: "إحالة للوكيل السعودي",
      message: "هل أنت متأكد من إحالة المعاملة المكتملة إلى الوكيل السعودي؟",
      confirmText: "تأكيد الإحالة",
      cancelText: "إلغاء",
      variant: "primary",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.sendToAgent(requestId, undefined, "إحالة المجموعة للوكيل السعودي للمصادقة");
      setSuccess("تمت إحالة المجموعة بنجاح للوكيل السعودي.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgentReceive = async () => {
    try {
      setActionLoading(true);
      await api.requests.agentReceive(requestId, "تم تأكيد استلام المعاملة من قبل الوكيل السعودي");
      setSuccess("تم تأكيد الاستلام وبدء المعالجة.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgentComplete = async () => {
    const ok = await confirm({
      title: "اعتماد المعاملة نهائياً",
      message: "هل أنت متأكد من اكتمال كافة الإجراءات واعتماد المعاملة نهائياً؟",
      confirmText: "اعتماد المعاملة ✓",
      cancelText: "إلغاء",
      variant: "success",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      await api.requests.agentComplete(requestId, "تم إنجاز كافة التأشيرات والخدمات بنجاح");
      setSuccess("تم إتمام المعاملة بنجاح ✓.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgentArchive = async () => {
    const ok = await confirm({
      title: "تأكيد إنجاز المعاملة (تم)",
      message: `هل أنت متأكد من إنجاز معاملة (${request.requestNumber}) نهائياً ونقلها إلى سجل المؤرشفة؟`,
      confirmText: "نعم، تم الإنجاز ✓",
      cancelText: "إلغاء",
      variant: "success",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      if (request.status !== "Completed" && request.status !== "Archived") {
        await api.requests.agentComplete(requestId, "تم إنجاز كافة التأشيرات والخدمات بنجاح");
      }
      await api.requests.archive(requestId, "تم إنجاز المعاملة وأرشفتها بواسطة الوكيل السعودي (تم)");
      setSuccess("تم إنجاز المعاملة بنجاح ونقلها إلى سجل المؤرشفة (تم) ✓.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkProgram = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.linkProgram(requestId, "تم ربط البرنامج بنجاح من قبل الوكيل السعودي");
      setSuccess("تم ربط البرنامج بنجاح. يمكنك الآن طلب قبول الاستضافة.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestHostingAcceptance = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.requestHostingAcceptance(requestId, "تم إرسال طلب قبول الاستضافة إلى المرسل للموافقة والتأكيد");
      setSuccess("تم إرسال طلب قبول الاستضافة بنجاح وإحالة المعاملة للمرسل.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptHosting = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.acceptHosting(requestId, "تم قبول طلب الاستضافة من قبل المرسل");
      setSuccess("تم قبول طلب الاستضافة. يمكنك الآن تأكيد الاستضافة للوكيل.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmHosting = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.confirmHosting(requestId, "تم تأكيد الاستضافة وإحالتها للوكيل السعودي للاعتماد النهائي");
      setSuccess("تم تأكيد الاستضافة للوكيل السعودي بنجاح.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!correctionReason.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى كتابة سبب طلب التصحيح لتوضيح المطلوب للمرسل.",
        variant: "warning",
      });
      return;
    }
    try {
      setActionLoading(true);
      await api.requests.requestCorrection(requestId, {
        travelerId: correctionTarget.travelerId,
        documentId: correctionTarget.documentId,
        targetField: correctionTarget.targetField,
        reason: correctionReason.trim(),
      });
      setSuccess("تم إرسال طلب التصحيح وتنبيه المرسل.");
      setShowCorrectionModal(false);
      setCorrectionReason("");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveCorrection = async (correctionId: string) => {
    try {
      setActionLoading(true);
      await api.requests.resolveCorrection(correctionId, "تم التعديل وحل الملاحظة");
      setSuccess("تم تأكيد معالجة طلب التصحيح.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminArchive = async () => {
    const ok = await confirm({
      title: "أرشفة المعاملة",
      message: "هل أنت متأكد من رغبتك في أرشفة هذه المعاملة؟",
      confirmText: "أرشفة المعاملة",
      cancelText: "إلغاء",
      variant: "warning",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.archive(requestId, "أرشفة يدوية بواسطة مدير النظام");
      setSuccess("تمت أرشفة المعاملة بنجاح وحفظها في الأرشيف.");
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminUnarchive = async () => {
    const ok = await confirm({
      title: "إلغاء أرشفة المعاملة",
      message: "هل ترغب في إلغاء أرشفة هذه المعاملة واستعادتها للحالة النشطة؟",
      confirmText: "استعادة المعاملة",
      cancelText: "إلغاء",
      variant: "info",
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.unarchive(requestId);
      setSuccess("تم إلغاء أرشفة المعاملة واستعادتها للحالة النشطة بنجاح.");
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminDelete = async () => {
    const confirmation = await prompt({
      title: "تحذير أمني: مسح المعاملة نهائياً",
      message: `أنت على وشك مسح هذه المعاملة وكافة وثائقها وملفاتها نهائياً من النظام!\n\nللتأكيد النهائي، اكتب (حذف) أو (delete) في المربع أدناه:`,
      placeholder: "اكتب (حذف) هنا...",
      confirmText: "حذف نهائي",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!confirmation || (confirmation.trim() !== "حذف" && confirmation.trim().toLowerCase() !== "delete")) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.delete(requestId);
      await alert({
        title: "تم الحذف بنجاح",
        message: "تم حذف المعاملة بالكامل وجميع مستنداتها بنجاح.",
        variant: "success",
      });
      router.push("/requests");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-sm">جاري تحميل المعاملة والوثائق...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-md mx-auto my-12 shadow-xs">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-800 mb-1">المعاملة غير متوفرة</h2>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          تعذر العثور على المعاملة المطلوبة في هذا المتصفح. قد تكون مسجلة تحت حساب أو جهاز آخر، أو تم حذفها.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.push("/requests")}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            عرض كافة المعاملات
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            الرئيسية
          </button>
        </div>
      </div>
    );
  }

  const hasItemsNeedingCorrection =
    request.status === "CorrectionRequired" ||
    request.travelers.some(
      (t) =>
        t.status === "NeedsCorrection" ||
        t.documents.some((d) => d.reviewStatus === "NeedsCorrection")
    ) ||
    request.hostingInfo?.hostIdDocument?.reviewStatus === "NeedsCorrection" ||
    request.groupDocuments?.some((d) => d.reviewStatus === "NeedsCorrection");

  const canEditDocs =
    (role === "Sender" || role === "Admin") &&
    (request.status === "Draft" ||
      request.status === "CorrectionRequired" ||
      request.status === "MissingDocuments" ||
      hasItemsNeedingCorrection);

  const canEditAnyData =
    role === "Admin" ||
    canEditDocs ||
    hasItemsNeedingCorrection;

  const isAdmin = role === "Admin";
  const isSafaEmployee = role === "SafaEmployee";
  const isSaudiAgent = role === "SaudiAgent";
  const isSender = role === "Sender";

  const isSafaReviewer = role === "SafaEmployee" || role === "Admin";
  const isAgent = role === "SaudiAgent" || role === "Admin";
  const canEditTraveler =
    role === "Admin" ||
    role === "Sender" ||
    role === "SafaEmployee" ||
    role === "SaudiAgent" ||
    canEditAnyData;

  const hostDoc =
    request.hostingInfo?.hostIdDocument ||
    request.groupDocuments?.find((d) => d.documentType === "HostId");
  const ticketDoc =
    request.flightTicketDocument ||
    request.groupDocuments?.find((d) => d.documentType === "FlightTicket");

  let totalDocsCount = (hostDoc ? 1 : 0) + (ticketDoc ? 1 : 0);
  request.travelers?.forEach((t) => {
    if (t.documents?.some((d) => d.documentType === "Passport")) totalDocsCount++;
    if (t.documents?.some((d) => d.documentType === "PersonalPhoto")) totalDocsCount++;
  });

  const docCheck = checkAllDocumentsAccepted();
  const canCompleteSafa = docCheck.isAllAccepted;

  const isAgentEligible = [
    "ReadyForSaudiAgent",
    "ReceivedBySaudiAgent",
    "SaudiAgentProcessing",
    "SaudiAgentCorrectionRequired",
    "ProgramLinked",
    "HostingAcceptanceRequested",
    "HostingAcceptedBySender",
    "HostingConfirmed",
    "Completed",
    "Archived",
  ].includes(request.status);

  if (isSaudiAgent && !isAgentEligible) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 bg-white rounded-2xl border border-amber-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">المعاملة غير متاحة للوكيل السعودي بعد</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
          هذه المعاملة ما زالت في مرحلة المراجعة وتدقيق المستندات لدى موظف صفا، ولم يتم إحالتها بعد إلى الوكيل السعودي.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>العودة إلى لوحة التحكم</span>
        </button>
      </div>
    );
  }

  const isOwnerSender =
    !isSender ||
    (Boolean(request.senderId) && request.senderId === user?.id) ||
    (Boolean(request.senderName) && Boolean(user?.fullName) && request.senderName!.trim().toLowerCase() === user!.fullName.trim().toLowerCase()) ||
    (Boolean(request.senderName) && Boolean(user?.username) && request.senderName!.trim().toLowerCase() === user!.username.trim().toLowerCase());

  if (isSender && !isOwnerSender) {
    return (
      <div className="w-full my-16 p-8 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">غير مصرح لك بعرض هذه المعاملة</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
          هذه المعاملة تم إرسالها من حساب مرسل آخر، وتظهر فقط للمرسل صاحب المعاملة وموظفي صفا وإدارة النظام.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>العودة إلى لوحة التحكم</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Breadcrumb & Status Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
              {request.requestNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">
              {request.groupName}
            </h1>
            {canEditAnyData && (
              <button
                type="button"
                onClick={() => {
                  setEditGroupName(request.groupName);
                  setEditContactPhone(request.contactPhone);
                  setEditDestination(request.destination || "");
                  setEditNotes(request.notes || "");
                  setShowEditGeneralModal(true);
                }}
                className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="تعديل بيانات المعاملة (الاسم، الهاتف، الملاحظات)"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل المعاملة</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              <span dir="ltr">{request.contactPhone}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{request.travelers.length} مسافرين</span>
            </span>
            {request.travelDate && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {new Date(request.travelDate).toLocaleDateString("ar-SA")}
                  </span>
                </span>
              </>
            )}
            {request.nusukGroupNumber && (
              <>
                <span>•</span>
                <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                  رقم نسك: {request.nusukGroupNumber}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          {request.status === "Completed" || request.status === "Archived" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>(تم)</span>
            </span>
          ) : isSaudiAgent ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>تم الاستلام</span>
            </span>
          ) : (
            <RequestStatusBadge status={request.status} />
          )}

          {/* Action buttons by Role */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Sender Actions */}
            {role === "Sender" && request.status === "Draft" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmitRequest();
                }}
                disabled={actionLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تقديم الطلب للاعتماد</span>
              </button>
            )}

            {/* Safa Employee Actions */}
            {isSafaReviewer && request.status === "Submitted" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSafaStartReview();
                }}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>بدء التدقيق والمراجعة</span>
              </button>
            )}

            {isSafaReviewer &&
              (request.status === "UnderReview" ||
                request.status === "DocumentsCompleted" ||
                request.status === "SafaRegistrationCompleted") && (
                <>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!canCompleteSafa) {
                        await alert({
                          title: "تنبيه تدقيق المستندات",
                          message: docCheck.reason || "لا يمكن إدخال رقم نسك إلا بعد قبول جميع المستندات.",
                          variant: "warning",
                        });
                        return;
                      }
                      const dep = request.departureDate || request.travelDate;
                      const ret = request.returnDate;
                      const senderCode = request.senderCode || resolveSenderCode(user);
                      const suggested = formatOfficialGroupName(senderCode, dep, ret);
                      const currentIsGeneric = !request.groupName || request.groupName.startsWith("مجموعة ") || request.groupName.startsWith("طلب جديد");
                      setNusukGroupName(currentIsGeneric && suggested ? suggested : (request.groupName || suggested || ""));
                      setShowNusukModal(true);
                    }}
                    disabled={actionLoading || !canCompleteSafa}
                    title={
                      !canCompleteSafa
                        ? docCheck.reason || "يجب تدقيق وقبول جميع المستندات أولاً"
                        : request.nusukGroupNumber
                        ? "تعديل رقم نسك وإكمال صفا"
                        : "إدخال رقم نسك وإكمال صفا"
                    }
                    className={
                      !canCompleteSafa
                        ? "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
                        : "bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                    }
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>
                      {request.nusukGroupNumber
                        ? "تعديل رقم نسك وإكمال صفا"
                        : "إدخال رقم نسك وإكمال صفا"}
                    </span>
                  </button>

                  {/* زر إرسال حزمة المعاملة لمجموعة الواتساب */}
                  <WhatsAppGroupSendButton
                    request={request}
                    ticketDoc={
                      request.groupDocuments?.find((d) => d.documentType === "FlightTicket") ||
                      request.travelers?.[0]?.documents?.find((d) => d.documentType === "FlightTicket")
                    }
                    hostDoc={
                      request.hostingInfo?.hostIdDocument ||
                      request.groupDocuments?.find((d) => d.documentType === "HostId")
                    }
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSendToSaudiAgent();
                    }}
                    disabled={actionLoading || !request.nusukGroupNumber || !canCompleteSafa}
                    title={
                      !canCompleteSafa
                        ? docCheck.reason || "يجب تدقيق وقبول جميع المستندات أولاً"
                        : !request.nusukGroupNumber
                        ? "يجب إدخال رقم مجموعة نسك أولاً"
                        : "إحالة إلى الوكيل السعودي"
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إحالة للوكيل السعودي</span>
                  </button>

                  {request.status === "SafaRegistrationCompleted" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSafaStartReview();
                      }}
                      disabled={actionLoading}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                      title="إعادة المعاملة لحالة قيد المراجعة لتعديل المستندات أو التدقيق"
                    >
                      <span>إعادة للمراجعة</span>
                    </button>
                  )}
                </>
              )}

            {/* Saudi Agent Actions: زر "تم" فقط */}
            {isSaudiAgent && (
              request.status === "Archived" ? (
                <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-xs font-black shadow-xs">
                  <Archive className="w-4 h-4 text-purple-600" />
                  <span>المعاملة في الأرشيف (تم) ✓</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAgentArchive();
                  }}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  title="اعتماد المعاملة ونقلها إلى الأرشيف (تم)"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تم</span>
                </button>
              )
            )}

            {/* Admin Testing Workflow Actions */}
            {isAdmin && !isSaudiAgent && request.status === "ReadyForSaudiAgent" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAgentReceive();
                }}
                disabled={actionLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تأكيد استلام المعاملة</span>
              </button>
            )}

            {isAdmin &&
              !isSaudiAgent &&
              (request.status === "ReceivedBySaudiAgent" ||
                request.status === "SaudiAgentProcessing") && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCorrectionTarget({});
                      setShowCorrectionModal(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>طلب تصحيح / ملاحظة</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLinkProgram();
                    }}
                    disabled={actionLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>تم ربط البرنامج</span>
                  </button>
                </>
              )}

            {isAdmin && !isSaudiAgent && request.status === "ProgramLinked" && (
              request.hasHosting ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRequestHostingAcceptance();
                  }}
                  disabled={actionLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>طلب قبول الاستضافة</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAgentComplete();
                  }}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تم اعتماده وإنهاء المعاملة ✓</span>
                </button>
              )
            )}

            {/* Step 3: Sender when HostingAcceptanceRequested sees "تم قبول طلب الاستضافة" */}
            {isSender && request.status === "HostingAcceptanceRequested" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAcceptHosting();
                }}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تم قبول طلب الاستضافة</span>
              </button>
            )}

            {/* Step 4: Sender when HostingAcceptedBySender sees "تأكيد الاستضافة للوكيل" */}
            {isSender && request.status === "HostingAcceptedBySender" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmHosting();
                }}
                disabled={actionLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تأكيد الاستضافة للوكيل</span>
              </button>
            )}

            {isAdmin && !isSaudiAgent && request.status === "HostingConfirmed" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAgentComplete();
                }}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تم اعتماده وإنهاء المعاملة ✓</span>
              </button>
            )}

            {isAdmin && !isSaudiAgent && request.status === "Completed" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAgentArchive();
                }}
                disabled={actionLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="إيداع المعاملة في الأرشيف (تم)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تم (إيداع في الأرشيف)</span>
              </button>
            )}

            {isAdmin && !isSaudiAgent && request.status === "Archived" && (
              <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <Archive className="w-3.5 h-3.5 text-purple-600" />
                <span>المعاملة مؤرشفة (تم) ✓</span>
              </div>
            )}

            {/* Admin Management Actions: Archive & Delete */}
            {role === "Admin" && (
              <div className="flex items-center gap-1.5 border-r border-gray-200 pr-2 mr-1">
                {request.status === "Archived" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAdminUnarchive();
                    }}
                    disabled={actionLoading}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="إلغاء أرشفة المعاملة"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>إلغاء الأرشفة</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAdminArchive();
                    }}
                    disabled={actionLoading}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="أرشفة المعاملة"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>أرشفة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAdminDelete();
                  }}
                  disabled={actionLoading}
                  className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer border border-red-200 transition-colors"
                  title="حذف المعاملة نهائياً من النظام"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح المعاملة</span>
                </button>
              </div>
            )}

            {/* Direct WhatsApp Messaging Trigger */}
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              title="إرسال رسالة واتساب بنماذج جاهزة ذكية"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>إرسال واتساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin View Mode Switcher */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500">تقسيم الواجهة والعرض (خاص بالإدارة):</span>
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setAdminViewMode("agent")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === "agent"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                عرض الوكيل السعودي
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode("safa")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === "safa"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                عرض مراجعة صفا
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode("full")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === "full"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                النموذج الشامل (المرسل)
              </button>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 font-medium">
            عرض الواجهة الموحدة لكافة أطراف المعاملة
          </div>
        </div>
      )}

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Safa Employee Review Status Banner */}
      {isSafaReviewer &&
        (request.status === "UnderReview" || request.status === "Submitted") &&
        !canCompleteSafa && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-800">
                زر إدخال رقم نسك معطل حتى تدقيق وقبول جميع المستندات
              </div>
              <div className="text-amber-700">
                يلزم مراجعة وقبول كافة وثائق ومستندات المسافرين والمستضيف (مقبول ✓) لتتمكن من إدخال رقم نسك وإكمال صفا.
              </div>
              {docCheck.reason && (
                <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg inline-block mt-1">
                  المستند المطلوب مراجعته حالياً: {docCheck.reason}
                </div>
              )}
            </div>
          </div>
        )}

      {isSafaReviewer &&
        request.status === "UnderReview" &&
        canCompleteSafa &&
        !request.nusukGroupNumber && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm flex items-center gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
            <div>
              <strong>اكتمل تدقيق المستندات:</strong> تم قبول جميع وثائق المسافرين والمستضيف بنجاح ✓. يمكنك الآن الضغط على زر <strong>«إدخال رقم نسك وإكمال صفا»</strong> بالأعلى لتوثيق رقم نسك.
            </div>
          </div>
        )}

      {/* Workflow Phase Info Banners */}
      {request.status === "ProgramLinked" && isAgent && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs sm:text-sm flex items-center gap-3">
          <Link2 className="w-5 h-5 shrink-0 text-purple-600" />
          <span>
            <strong>تم ربط البرنامج بنجاح:</strong> يرجى الضغط على زر <strong>&quot;طلب قبول الاستضافة&quot;</strong> لإحالة المعاملة إلى المرسل.
          </span>
        </div>
      )}

      {request.status === "HostingAcceptanceRequested" && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center gap-3">
          <Home className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            {isSender ? (
              <>
                <strong>طلب قبول الاستضافة:</strong> أرسل الوكيل السعودي طلباً لقبول الاستضافة لهذه المجموعة. يرجى الضغط على <strong>&quot;تم قبول طلب الاستضافة&quot;</strong> للمتابعة.
              </>
            ) : (
              <>
                <strong>بانتظار قبول الاستضافة:</strong> تمت إحالة المعاملة للمرسل لقبول الاستضافة وتأكيدها.
              </>
            )}
          </span>
        </div>
      )}

      {request.status === "HostingAcceptedBySender" && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-sky-600" />
          <span>
            {isSender ? (
              <>
                <strong>تم قبول الاستضافة:</strong> يرجى الآن الضغط على زر <strong>&quot;تأكيد الاستضافة للوكيل&quot;</strong> لإعادتها للوكيل للاعتماد النهائي.
              </>
            ) : (
              <>
                <strong>تم قبول الاستضافة من المرسل:</strong> بانتظار تأكيد الإرسال النهائي للوكيل.
              </>
            )}
          </span>
        </div>
      )}

      {request.status === "HostingConfirmed" && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-teal-600" />
          <span>
            {isAgent ? (
              <>
                <strong>تم تأكيد الاستضافة بنجاح:</strong> قام المرسل بتأكيد الاستضافة، المعاملة جاهزة الآن للاعتماد النهائي عبر زر <strong>&quot;تم اعتماده وإنهاء المعاملة ✓&quot;</strong>.
              </>
            ) : (
              <>
                <strong>تم تأكيد الاستضافة للوكيل:</strong> المعاملة الآن لدى الوكيل السعودي للاعتماد النهائي وإصدار التأشيرات.
              </>
            )}
          </span>
        </div>
      )}

      {/* Corrections Banner if any */}
      {request.correctionRequests.filter((c) => c.status === "Pending").length >
        0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>
              طلبات التصحيح والملاحظات المعلقة (
              {
                request.correctionRequests.filter((c) => c.status === "Pending")
                  .length
              }
              )
            </span>
          </div>

          <div className="space-y-2">
            {request.correctionRequests
              .filter((c) => c.status === "Pending")
              .map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-3.5 rounded-xl border border-rose-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-rose-950">
                      {c.travelerName ? `المسافر: ${c.travelerName}` : "المجموعة"} -{" "}
                      {c.targetField || "مستند"}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      السبب: <span className="font-bold text-gray-800">{c.reason}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      بواسطة: {c.requestedByName} •{" "}
                      {new Date(c.createdAt).toLocaleString("ar-SA")}
                    </div>
                  </div>

                  {role === "Sender" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleResolveCorrection(c.id);
                      }}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                    >
                      تأكيد المعالجة
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Role-Customized Layouts */}
      {isSaudiAgent || (isAdmin && adminViewMode === "agent") ? (
        <SaudiAgentView
          request={request}
          ticketDoc={ticketDoc}
          hostDoc={hostDoc}
          onPreviewDoc={setPreviewDoc}
          onDownloadDoc={handleDownloadDoc}
          onUpdateTraveler={handleUpdateTraveler}
          onSaveNusukNumber={handleSaveNusukNumber}
          onArchiveRequest={handleAgentArchive}
          onDoneRequest={handleAgentArchive}
          actionLoading={actionLoading}
        />
      ) : isSafaEmployee || (isAdmin && adminViewMode === "safa") ? (
        <SafaEmployeeView
          request={request}
          ticketDoc={ticketDoc}
          hostDoc={hostDoc}
          totalDocsCount={totalDocsCount}
          isDownloadingAll={isDownloadingAll}
          onDownloadAllDocs={handleDownloadAllDocs}
          onPreviewDoc={setPreviewDoc}
          onDownloadDoc={handleDownloadDoc}
          onQuickReview={handleQuickReview}
          onUpdateTraveler={handleUpdateTraveler}
          onRequestCorrection={(target) => {
            setCorrectionTarget(target);
            setShowCorrectionModal(true);
          }}
          actionLoading={actionLoading}
        />
      ) : (
        <>
          {/* Hosting Information Card */}
          {request.hasHosting && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-gray-900">
                بيانات الاستضافة المشتركة للمجموعة
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-1 rounded-md border border-amber-200">
                مشتركة لجميع المسافرين
              </span>
              {canEditAnyData && (
                <button
                  type="button"
                  onClick={() => {
                    setEditHostName(request.hostingInfo?.hostName || "");
                    setEditHostNationality(request.hostingInfo?.hostNationality || "");
                    setEditHostBirthDate(request.hostingInfo?.hostBirthDate || "");
                    setEditHostPhone(request.hostingInfo?.hostPhone || request.contactPhone || "");
                    setEditHostNationalId(request.hostingInfo?.hostNationalId || request.hostingInfo?.hostAddress || "");
                    setEditingHostInfo(!editingHostInfo);
                  }}
                  className="text-xs text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="تعديل بيانات المستضيف"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{editingHostInfo ? "إلغاء التعديل" : "تعديل بيانات المستضيف"}</span>
                </button>
              )}
            </div>
          </div>

          {editingHostInfo ? (
            <div className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">اسم المستضيف:</label>
                  <input
                    type="text"
                    value={editHostName}
                    onChange={(e) => setEditHostName(e.target.value)}
                    placeholder="اسم المستضيف رباعي"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">جنسية المستضيف:</label>
                  <input
                    type="text"
                    value={editHostNationality}
                    onChange={(e) => setEditHostNationality(e.target.value)}
                    placeholder="مثال: سعودي، مصري..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">تاريخ ميلاد المستضيف:</label>
                  <input
                    type="text"
                    value={editHostBirthDate}
                    onChange={(e) => setEditHostBirthDate(e.target.value)}
                    placeholder="YYYY/MM/DD"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">رقم هاتف المستضيف:</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editHostPhone}
                    onChange={(e) => setEditHostPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 text-left font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">العنوان أو الهوية:</label>
                  <input
                    type="text"
                    value={editHostNationalId}
                    onChange={(e) => setEditHostNationalId(e.target.value)}
                    placeholder="رقم الهوية أو الإقامة"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={handleSaveHostInfo}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حفظ بيانات المستضيف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingHostInfo(false)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إلغاء</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">اسم المستضيف:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {request.hostingInfo?.hostName || "مستضيف داخل المملكة"}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">جنسية المستضيف:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {request.hostingInfo?.hostNationality || "غير محدد"}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">تاريخ ميلاد المستضيف:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {request.hostingInfo?.hostBirthDate || "غير محدد"}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">رقم هاتف المستضيف:</span>
                {(request.hostingInfo?.hostPhone || request.contactPhone) ? (
                  <div className="inline-flex items-center gap-2 mt-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <a
                      href={getWhatsAppUrl(request.hostingInfo?.hostPhone || request.contactPhone || "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-800 hover:text-emerald-950 font-bold font-mono text-sm hover:underline"
                      title="مراسلة المستضيف عبر واتساب"
                      dir="ltr"
                    >
                      <MessageSquare className="w-4 h-4 fill-emerald-600 text-emerald-600 shrink-0" />
                      <span>
                        {normalizePhone(request.hostingInfo?.hostPhone || request.contactPhone).displayFormatted ||
                          (request.hostingInfo?.hostPhone || request.contactPhone)}
                      </span>
                    </a>
                    <span className="text-emerald-300">|</span>
                    <a
                      href={getTelUrl(request.hostingInfo?.hostPhone || request.contactPhone || "")}
                      className="p-1 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-100 transition-colors"
                      title="اتصال هاتفي بالمستضيف"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                ) : (
                  <span className="font-bold text-gray-400 text-sm">غير محدد</span>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">العنوان أو الهوية:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {request.hostingInfo?.hostNationalId
                    ? `هوية: ${request.hostingInfo.hostNationalId}`
                    : request.hostingInfo?.hostAddress || "غير محدد"}
                </span>
              </div>
            </div>
          )}

          {/* Host ID Document */}
          <div className="pt-2">
            <span className="block text-xs font-semibold text-gray-700 mb-2">
              مستند هوية المستضيف (مطلوب):
            </span>

            {(() => {
              const hostDoc =
                request.hostingInfo?.hostIdDocument ||
                request.groupDocuments?.find((d) => d.documentType === "HostId");

              return (
                <FileDropArea
                  disabled={!canEditAnyData}
                  onFileDrop={(file) => handleFileUpload(file, "HostId")}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="amber"
                  overlayText="أفلت هوية المستضيف هنا للرفع"
                  overlaySubtext="سيتم رفع الوثيقة وتحديث المعاملة مباشرة"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-xl"
                >
                  {hostDoc ? (
                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-600" />
                        <div>
                          <div className="font-semibold text-gray-800">
                            {hostDoc.originalFileName}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {(hostDoc.fileSize / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DocumentStatusBadge
                          status={hostDoc.reviewStatus}
                        />

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPreviewDoc(hostDoc);
                          }}
                          className="p-1.5 text-gray-600 hover:text-sky-600 hover:bg-gray-200 rounded-lg cursor-pointer"
                          title="معاينة المستند"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDownloadDoc(hostDoc);
                          }}
                          className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="تنزيل هوية المستضيف"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {canEditAnyData && (
                          <label
                            className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="استبدال / رفع هوية المستضيف مجدداً (أو اسحب الملف هنا)"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, "HostId");
                              }}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          disabled={isScanningHostIdDoc}
                          onClick={(e) => {
                            e.preventDefault();
                            handleScanExistingHostId(hostDoc);
                          }}
                          className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                          title="فحص واستخراج بيانات هوية المستضيف تلقائياً (مسح ذكي OCR)"
                        >
                          {isScanningHostIdDoc ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          ) : (
                            <ScanText className="w-4 h-4" />
                          )}
                        </button>

                        {/* Quick Review Buttons when Pending */}
                        {(isSafaReviewer || isAgent) && hostDoc.reviewStatus === "Pending" && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuickReview(hostDoc.id, "Accepted");
                              }}
                              disabled={actionLoading}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="قبول هوية المستضيف (صح)"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuickReview(hostDoc.id, "NeedsCorrection");
                              }}
                              disabled={actionLoading}
                              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="طلب تصحيح هوية المستضيف (مثلث الخطر)"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuickReview(hostDoc.id, "Rejected");
                              }}
                              disabled={actionLoading}
                              className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="رفض هوية المستضيف (إكس)"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Agent Return/Reset Action: only Agent can return reviewed documents */}
                        {isAgent && hostDoc.reviewStatus !== "Pending" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQuickReview(hostDoc.id, "Pending", "تمت إعادة المستند للمراجعة من قبل الوكيل");
                            }}
                            disabled={actionLoading}
                            className="p-1.5 bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="إعادة فتح تدقيق المستند لموظف الصفا (إعادة التدقيق)"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}

                        {canEditAnyData && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteDocument(hostDoc.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="حذف المستند"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-500 mb-2">
                        لم يتم رفع وثيقة هوية المستضيف بعد. (يمكنك سحب وإفلات الملف هنا)
                      </p>
                      {canEditAnyData && (
                        <label className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">
                          <UploadCloud className="w-4 h-4" />
                          <span>رفع هوية المستضيف</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, "HostId");
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </FileDropArea>
              );
            })()}
          </div>
        </div>
      )}

      {/* Flight & Shared Ticket Information Card (مباشرة تحت بيانات الاستضافة) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-sky-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                بيانات وتذكرة الطيران المشتركة للمجموعة
              </h2>
              <p className="text-xs text-gray-500">
                تذكرة ومواعيد سفر موحدة لكافة مسافري المعاملة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-sky-50 text-sky-800 font-semibold px-2.5 py-1 rounded-md border border-sky-200">
              مشتركة لجميع المسافرين
            </span>
            {(canEditDocs || role === "Admin" || role === "SafaEmployee") && (
              <button
                type="button"
                onClick={() => {
                  setEditAirline(request.airline || "");
                  setEditFlightNumber(request.flightNumber || "");
                  setEditReturnFlightNumber(request.returnFlightNumber || "");
                  setEditArrivalAirport(request.arrivalAirport || (request.destination?.includes("المدينة") && !request.destination?.includes("مكة") ? "مطار المدينة" : "مطار جدة"));
                  setEditSaudiArrivalTime(request.saudiArrivalTime || request.flightDepartureTime || "");
                  setEditReturnDepartureAirport(request.returnDepartureAirport || (request.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة"));
                  setEditReturnFlightDepartureTime(request.returnFlightDepartureTime || "");
                  setEditDepartureDate(request.departureDate || request.travelDate || "");
                  setEditReturnDate(request.returnDate || "");
                  setEditFlightDepartureTime(request.flightDepartureTime || "");
                  setEditAirportArrivalTime(request.airportArrivalTime || "");
                  setShowFlightEditModal(true);
                }}
                className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                تعديل بيانات ومواعيد الطيران
              </button>
            )}
          </div>
        </div>

        {/* Flight Information Grid Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {/* 1. شركة / نوع الطيران */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Plane className="w-3.5 h-3.5 text-sky-600" />
              <span>شركة / نوع الطيران:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.airline || "غير محدد"}
            </span>
          </div>

          {/* 2. رقم رحلة الذهاب */}
          <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
            <div className="flex items-center gap-1.5 text-sky-700 mb-1">
              <Ticket className="w-3.5 h-3.5 text-sky-600" />
              <span>رقم رحلة الذهاب:</span>
            </div>
            <span className="font-bold text-gray-900 text-sm font-mono uppercase">
              {request.flightNumber || "غير محدد"}
            </span>
          </div>

          {/* 3. مطار الوصول للسعودية (الذهاب) */}
          <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
            <div className="flex items-center gap-1.5 text-sky-700 mb-1">
              <Plane className="w-3.5 h-3.5 text-sky-600" />
              <span>مطار الوصول للسعودية (الذهاب):</span>
            </div>
            <span className="font-bold text-sky-950 text-sm">
              {request.arrivalAirport || (request.destination?.includes("المدينة") && !request.destination?.includes("مكة") ? "مطار المدينة" : "مطار جدة")}
            </span>
          </div>

          {/* 4. تاريخ الذهاب */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>تاريخ الذهاب:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.departureDate || request.travelDate
                ? new Date(request.departureDate || request.travelDate!).toLocaleDateString("ar-SA")
                : "غير محدد"}
            </span>
          </div>

          {/* 5. وقت إقلاع طائرة الذهاب */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>وقت إقلاع طائرة الذهاب:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm font-mono" dir="ltr">
              {request.flightDepartureTime || "غير محدد"}
            </span>
          </div>

          {/* 6. وقت وصول الطائرة للسعودية (الذهاب) */}
          <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
            <div className="flex items-center gap-1.5 text-sky-700 mb-1">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>وقت وصول الطائرة للسعودية:</span>
            </div>
            <span className="font-bold text-sky-950 text-sm font-mono" dir="ltr">
              {request.saudiArrivalTime || request.flightDepartureTime || "غير محدد"}
            </span>
          </div>

          {/* 7. رقم رحلة العودة */}
          <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
              <Ticket className="w-3.5 h-3.5 text-indigo-600" />
              <span>رقم رحلة العودة:</span>
            </div>
            <span className="font-bold text-gray-900 text-sm font-mono uppercase">
              {request.returnFlightNumber || request.flightNumber || "غير محدد"}
            </span>
          </div>

          {/* 8. مطار الإقلاع من السعودية (العودة) */}
          <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
              <Plane className="w-3.5 h-3.5 text-indigo-600 -scale-x-100" />
              <span>مطار الإقلاع من السعودية (العودة):</span>
            </div>
            <span className="font-bold text-indigo-950 text-sm">
              {request.returnDepartureAirport || (request.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")}
            </span>
          </div>

          {/* 9. تاريخ العودة */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>تاريخ العودة:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.returnDate
                ? new Date(request.returnDate).toLocaleDateString("ar-SA")
                : "غير محدد"}
            </span>
          </div>

          {/* 10. وقت إقلاع رحلة العودة من السعودية */}
          <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>وقت إقلاع رحلة العودة:</span>
            </div>
            <span className="font-bold text-indigo-950 text-sm font-mono" dir="ltr">
              {request.returnFlightDepartureTime || "غير محدد"}
            </span>
          </div>

          {/* 11. وقت تواجد المسافر في المطار */}
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 sm:col-span-2">
            <div className="flex items-center justify-between text-amber-900 mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>وقت تواجد المسافر في المطار:</span>
              </span>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                قبل الإقلاع بـ 3 ساعات
              </span>
            </div>
            <span className="font-bold text-gray-900 text-sm font-mono" dir="ltr">
              {request.airportArrivalTime || "غير محدد"}
            </span>
          </div>
        </div>

        {/* Shared Flight Ticket Document Widget */}
        <div className="pt-2 border-t border-gray-100">
          <span className="block text-xs font-semibold text-gray-700 mb-2">
            مستند تذكرة الطيران المشتركة (PDF / صورة):
          </span>

          {(() => {
            const ticketDoc =
              request.flightTicketDocument ||
              request.groupDocuments?.find((d) => d.documentType === "FlightTicket");

            return (
              <FileDropArea
                disabled={!canEditAnyData}
                onFileDrop={(file) => handleFileUpload(file, "FlightTicket")}
                accept=".pdf,.jpg,.jpeg,.png"
                maxSizeMb={15}
                activeBorderColor="sky"
                overlayText="أفلت تذكرة الطيران هنا للرفع"
                overlaySubtext="سيتم رفع التذكرة وتحديث المعاملة مباشرة"
                onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                className="rounded-xl"
              >
                {ticketDoc ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {ticketDoc.originalFileName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {(ticketDoc.fileSize / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <DocumentStatusBadge status={ticketDoc.reviewStatus} />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewDoc(ticketDoc);
                        }}
                        className="p-1.5 text-gray-600 hover:text-sky-600 hover:bg-gray-200 rounded-lg cursor-pointer"
                        title="معاينة المستند"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDownloadDoc(ticketDoc);
                        }}
                        className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="تنزيل تذكرة الطيران"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {canEditAnyData && (
                        <label
                          className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="استبدال / رفع تذكرة الطيران مجدداً (أو اسحب الملف هنا)"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, "FlightTicket");
                            }}
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        disabled={isScanningFlightTicketDoc}
                        onClick={(e) => {
                          e.preventDefault();
                          handleScanExistingFlightTicket(ticketDoc);
                        }}
                        className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="فحص واستخراج بيانات تذكرة الطيران بالذكاء الاصطناعي (Google Gemini)"
                      >
                        {isScanningFlightTicketDoc ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>

                      {/* Quick Review Buttons when Pending */}
                      {(isSafaReviewer || isAgent) && ticketDoc.reviewStatus === "Pending" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQuickReview(ticketDoc.id, "Accepted");
                            }}
                            disabled={actionLoading}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="قبول تذكرة الطيران (صح)"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQuickReview(ticketDoc.id, "NeedsCorrection");
                            }}
                            disabled={actionLoading}
                            className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="طلب تصحيح تذكرة الطيران (مثلث الخطر)"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQuickReview(ticketDoc.id, "Rejected");
                            }}
                            disabled={actionLoading}
                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="رفض تذكرة الطيران (إكس)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Agent Return/Reset Action */}
                      {isAgent && ticketDoc.reviewStatus !== "Pending" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleQuickReview(ticketDoc.id, "Pending", "تمت إعادة المستند للمراجعة من قبل الوكيل");
                          }}
                          disabled={actionLoading}
                          className="p-1.5 bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="إعادة فتح تدقيق تذكرة الطيران لموظف الصفا (إعادة التدقيق)"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      )}

                      {canEditAnyData && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteDocument(ticketDoc.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="حذف المستند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-2">
                      لم يتم رفع وثيقة تذكرة الطيران المشتركة بعد. (يمكنك سحب وإفلات الملف هنا)
                    </p>
                    {canEditAnyData && (
                      <label className="inline-flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer border border-sky-200">
                        <UploadCloud className="w-4 h-4" />
                        <span>رفع تذكرة الطيران (فحص واستخراج ذكي بالذكاء الاصطناعي)</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "FlightTicket");
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </FileDropArea>
            );
          })()}
        </div>
      </div>

      {/* Request Lifecycle Timer: 30-Day Auto-Deletion & Travel Auto-Archival */}
      {isAdmin && (
        <RequestLifecycleTimer
          createdAt={request.createdAt}
          travelDate={request.travelDate}
          departureDate={request.departureDate}
          flightDepartureTime={request.flightDepartureTime}
          status={request.status}
          mode="detailed"
        />
      )}

      {/* Travelers & Documents Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>بيانات ووثائق المسافرين ({request.travelers.length})</span>
          </h2>

          <button
            type="button"
            onClick={handleDownloadAllDocs}
            disabled={isDownloadingAll || totalDocsCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
          >
            {isDownloadingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>تحميل كافة المستندات ({totalDocsCount}) ZIP</span>
          </button>
        </div>

        {request.travelers.map((traveler, tIndex) => (
          <div
            key={traveler.id}
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4"
          >
            {/* Traveler Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                  {tIndex + 1}
                </span>
                {editingTravelerId === traveler.id ? (
                  <div className="flex flex-wrap items-center gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editTravelerName}
                        onChange={(e) => setEditTravelerName(e.target.value)}
                        placeholder="اسم المسافر بالعربية *"
                        className="text-xs px-2.5 py-1.5 border border-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleTranslateEditName}
                        disabled={actionLoading || !editTravelerName.trim()}
                        className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-blue-200"
                        title="ترجمة الاسم المكتوب فوراً بدقة عبر Google Translate"
                      >
                        <Languages className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">ترجمة جوجل</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={editTravelerPassport}
                      onChange={(e) => setEditTravelerPassport(e.target.value.toUpperCase())}
                      placeholder="رقم الجواز"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono bg-white w-28"
                    />

                    <input
                      type="tel"
                      dir="ltr"
                      value={editTravelerPhone}
                      onChange={(e) => setEditTravelerPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono bg-white w-36 text-right"
                    />

                    <input
                      type="text"
                      value={editTravelerNationality}
                      onChange={(e) => setEditTravelerNationality(e.target.value)}
                      placeholder="الجنسية"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white w-24"
                    />

                    <input
                      type="text"
                      value={editTravelerBirthDate}
                      onChange={(e) => setEditTravelerBirthDate(e.target.value)}
                      placeholder="تاريخ الميلاد (YYYY-MM-DD)"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono bg-white w-36"
                    />

                    <input
                      type="text"
                      value={editTravelerExpiryDate}
                      onChange={(e) => setEditTravelerExpiryDate(e.target.value)}
                      placeholder="انتهاء الجواز (YYYY-MM-DD)"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono bg-white w-36"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTraveler(
                            traveler.id,
                            editTravelerName,
                            editTravelerPassport,
                            editTravelerPhone,
                            editTravelerNationality,
                            editTravelerBirthDate,
                            editTravelerExpiryDate
                          )
                        }
                        disabled={actionLoading || !editTravelerName.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTravelerId(null)}
                        className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إلغاء</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        {traveler.fullName}
                      </h3>
                      {canEditTraveler && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTravelerId(traveler.id);
                            setEditTravelerName(traveler.fullName);
                            setEditTravelerPassport(traveler.passportNumber || "");
                            setEditTravelerPhone(traveler.phoneNumber || "");
                            setEditTravelerNationality(traveler.nationality || "");
                            setEditTravelerBirthDate(traveler.dateOfBirth || "");
                            setEditTravelerExpiryDate(traveler.expiryDate || "");
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          title="تعديل بيانات المسافر ورقم الهاتف"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                      {traveler.passportNumber && (
                        <span className="font-mono">
                          جواز: {traveler.passportNumber}
                        </span>
                      )}
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
                        canEditTraveler && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTravelerId(traveler.id);
                              setEditTravelerName(traveler.fullName);
                              setEditTravelerPassport(traveler.passportNumber || "");
                              setEditTravelerPhone("");
                              setEditTravelerNationality(traveler.nationality || "");
                              setEditTravelerBirthDate(traveler.dateOfBirth || "");
                              setEditTravelerExpiryDate(traveler.expiryDate || "");
                            }}
                            className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200 transition-colors cursor-pointer font-medium text-[11px]"
                            title="إضافة رقم هاتف المسافر (يمكن إدخاله بواسطة المرسل، المدير، الوكيل، أو موظف صفا)"
                          >
                            <Phone className="w-3 h-3 text-sky-600" />
                            <span>+ إضافة هاتف</span>
                          </button>
                        )
                      )}
                      {traveler.nationality && (
                        <span>• الجنسية: {traveler.nationality}</span>
                      )}
                      {traveler.dateOfBirth && (
                        <span>• الميلاد: {traveler.dateOfBirth}</span>
                      )}
                      {traveler.expiryDate && (
                        <span className="font-mono">• انتهاء الجواز: {traveler.expiryDate}</span>
                      )}
                      {(() => {
                        const validity = checkPassportValidity(traveler.expiryDate, request.travelDate);
                        if (validity.warning) {
                          return (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{validity.warning}</span>
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* MRZ Scan Button if passport document exists */}
                {traveler.documents?.some((d) => d.documentType === "Passport") && (
                  <button
                    type="button"
                    disabled={isMrzScanningTravelerId === traveler.id}
                    onClick={() => handleScanExistingPassport(traveler)}
                    className="text-xs text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                    title="إعادة فحص صورة الجواز المرفوعة لاستخراج الاسم والبيانات تلقائياً"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 ${
                        isMrzScanningTravelerId === traveler.id ? "animate-spin" : ""
                      }`}
                    />
                    <span>
                      {isMrzScanningTravelerId === traveler.id
                        ? "جاري فحص الجواز..."
                        : "فحص الجواز تلقائياً (MRZ)"}
                    </span>
                  </button>
                )}

                {(isSafaReviewer || isAgent) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCorrectionTarget({
                        travelerId: traveler.id,
                        targetField: "بيانات المسافر أو مستنداته",
                      });
                      setShowCorrectionModal(true);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md font-semibold cursor-pointer"
                  >
                    طلب تصحيح للمسافر
                  </button>
                )}
              </div>
            </div>

            {/* Traveler Documents Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(["Passport", "PersonalPhoto"] as DocumentType[]).map(
                (docType) => {
                  const doc = traveler.documents.find(
                    (d) => d.documentType === docType
                  );

                  return (
                    <FileDropArea
                      key={docType}
                      disabled={!canEditAnyData}
                      onFileDrop={(file) => handleFileUpload(file, docType, traveler.id)}
                      accept={docType === "Passport" ? ".pdf,.jpg,.jpeg,.png" : ".jpg,.jpeg,.png"}
                      maxSizeMb={10}
                      activeBorderColor={docType === "Passport" ? "blue" : "purple"}
                      overlayText={`أفلت ${DOCUMENT_TYPE_LABELS[docType]} هنا للرفع`}
                      overlaySubtext="سيتم رفع وتحديث المستند للمسافر مباشرة"
                      onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                      className="rounded-xl flex flex-col justify-between"
                    >
                      <div
                        className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60 flex flex-col justify-between h-full"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-700">
                            {DOCUMENT_TYPE_LABELS[docType]}
                            {docType === "Passport" || docType === "PersonalPhoto" ? (
                              <span className="text-red-500 mr-0.5">*</span>
                            ) : null}
                          </span>

                          {doc ? (
                            <DocumentStatusBadge status={doc.reviewStatus} />
                          ) : (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">
                              غير مرفوع
                            </span>
                          )}
                        </div>

                        {doc ? (
                          <div className="space-y-2 mt-2">
                            <div className="text-[11px] text-gray-600 truncate">
                              {doc.originalFileName}
                            </div>

                            {doc.reviewNote && (
                              <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded">
                                ملاحظة: {doc.reviewNote}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-200/60">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPreviewDoc(doc);
                                }}
                                className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                title="معاينة المستند"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDownloadDoc(doc);
                                }}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="تنزيل المستند"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {canEditAnyData && (
                                <label
                                  className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  title="استبدال / رفع مستند مصحح (أو اسحب الملف هنا)"
                                >
                                  <UploadCloud className="w-4 h-4" />
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(file, docType, traveler.id);
                                    }}
                                  />
                                </label>
                              )}

                              {/* Quick Review Buttons when Pending */}
                              {(isSafaReviewer || isAgent) && doc.reviewStatus === "Pending" && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuickReview(doc.id, "Accepted");
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                                    title="قبول المستند (صح)"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuickReview(doc.id, "NeedsCorrection");
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                                    title="طلب تصحيح للمستند (مثلث الخطر)"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuickReview(doc.id, "Rejected");
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                                    title="رفض المستند (إكس)"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              {/* Agent Return/Reset Action: only Agent can return reviewed documents */}
                              {isAgent && doc.reviewStatus !== "Pending" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleQuickReview(doc.id, "Pending", "تمت إعادة المستند للمراجعة من قبل الوكيل");
                                  }}
                                  disabled={actionLoading}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  title="إعادة فتح تدقيق المستند لموظف الصفا (إعادة التدقيق)"
                                >
                                  <Undo2 className="w-4 h-4" />
                                </button>
                              )}

                              {canEditAnyData && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteDocument(doc.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-col items-center justify-center p-3 border border-dashed border-gray-300 rounded-lg bg-white text-center">
                            {canEditAnyData ? (
                              <label className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer">
                                <UploadCloud className="w-4 h-4" />
                                <span>رفع المستند (أو اسحبه هنا)</span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, docType, traveler.id);
                                  }}
                                />
                              </label>
                            ) : (
                              <span className="text-[11px] text-gray-400">لم يُرفع</span>
                            )}
                          </div>
                        )}
                      </div>
                    </FileDropArea>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      {/* Status Timeline History */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Clock className="w-5 h-5 text-gray-600" />
            <span>سجل تتبع الحالات والإجراءات</span>
          </h2>

          <div className="space-y-3">
            {request.statusHistories.map((h, i) => (
              <div
                key={h.id}
                className="flex items-start gap-3 text-xs border-r-2 border-sky-600 pr-3 py-1"
              >
                <div className="w-2 h-2 rounded-full bg-sky-600 -mr-[17px] mt-1.5 ring-4 ring-white" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RequestStatusBadge status={h.toStatus} />
                    <span className="font-semibold text-gray-700">
                      بواسطة: {h.changedByName}
                    </span>
                    <span className="text-gray-400">
                      ({new Date(h.createdAt).toLocaleString("ar-SA")})
                    </span>
                  </div>
                  {h.note && (
                    <p className="text-gray-600 mt-1 text-[11px] bg-gray-50 p-2 rounded-lg">
                      {h.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL 1: Secure Document Previewer --- */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  {DOCUMENT_TYPE_LABELS[previewDoc.documentType]} - {previewDoc.originalFileName}
                </h3>
                <span className="text-[11px] text-gray-500">
                  معاينة آمنة ومشفرة عبر خادم المعاملات
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  title="تنزيل الملف على جهازك"
                >
                  <Download className="w-4 h-4" />
                </button>
                {previewDocUrl && (
                  <a
                    href={previewDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                    title="فتح في نافذة مستقلة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-900/5 p-4 overflow-auto flex items-center justify-center relative">
              {previewDocLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                  <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-xs font-medium">جاري تحميل المستند...</span>
                </div>
              ) : previewDocUrl ? (
                previewDoc.mimeType === "application/pdf" ? (
                  <iframe
                    src={previewDocUrl}
                    className="w-full h-full rounded-lg border-0 bg-white"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={previewDocUrl}
                    alt="Document preview"
                    className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                  />
                )
              ) : (
                <div className="text-center p-6 text-gray-500 text-xs">
                  تعذر استعراض المستند أو الملف غير متاح حالياً.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Document Review by Safa/Agent --- */}
      {reviewModalDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">
                تدقيق مستند ({DOCUMENT_TYPE_LABELS[reviewModalDoc.documentType]})
              </h3>
              <button
                onClick={() => setReviewModalDoc(null)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                قرار التدقيق:
              </label>
              <select
                value={reviewStatus}
                onChange={(e) =>
                  setReviewStatus(e.target.value as DocumentReviewStatus)
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="Accepted">مقبول ✓</option>
                <option value="NeedsCorrection">يحتاج تصحيح ⚠️</option>
                <option value="Rejected">مرفوض ✗</option>
                <option value="Pending">معلق</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ملاحظات أو سبب الرفض/التصحيح:
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="مثال: الصورة غير واضحة، أو جواز السفر تنتهي صلاحيته قريباً..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleReviewDocument}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs"
              >
                حفظ القرار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Enter Nusuk Number & Complete Safa --- */}
      {showNusukModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-teal-600" />
                <span>توثيق رقم مجموعة نسك وإكمال صفا</span>
              </h3>
              <button
                onClick={() => setShowNusukModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              أدخل رقم المجموعة المعتمد من منصة نسك الرسمية بعد إنهاء تسجيل صفا. هذا الرقم إلزامي لإتاحة الإحالة للوكيل السعودي.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                رقم مجموعة نسك *
              </label>
              <input
                type="text"
                value={nusukInput}
                onChange={(e) => setNusukInput(e.target.value)}
                placeholder="مثال: NUSUK-109283"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="block text-xs font-semibold text-gray-700">
                  اسم المجموعة *
                </label>
                {(() => {
                  if (!request) return null;
                  const dep = request.departureDate || request.travelDate;
                  const ret = request.returnDate;
                  const senderCode = request.senderCode || resolveSenderCode(user);
                  const suggestedName = formatOfficialGroupName(senderCode, dep, ret);
                  if (suggestedName && suggestedName !== nusukGroupName) {
                    return (
                      <button
                        type="button"
                        onClick={() => setNusukGroupName(suggestedName)}
                        className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        title="تطبيق التسمية المعتمدة تلقائياً بنقرة واحدة"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>توليد الاسم المعتمد 🪄 ({suggestedName})</span>
                      </button>
                    );
                  }
                  if (suggestedName && suggestedName === nusukGroupName) {
                    return (
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>الاسم المعتمد مفعّل ✓</span>
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <input
                type="text"
                value={nusukGroupName}
                onChange={(e) => setNusukGroupName(e.target.value)}
                placeholder="أدخل اسم المجموعة المعتمد..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium text-gray-900"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">
                سيتم استبدال وتحديث اسم المجموعة بهذا الاسم في كافة شاشات المنظومة.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ملاحظات إنهاء التسجيل (اختياري)
              </label>
              <textarea
                value={nusukNote}
                onChange={(e) => setNusukNote(e.target.value)}
                rows={2}
                placeholder="أي توجيهات خاصة بالباقة أو التأشيرة..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNusukModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCompleteSafa}
                disabled={actionLoading || !nusukInput.trim() || !nusukGroupName.trim() || !canCompleteSafa}
                className="px-4 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl shadow-xs cursor-pointer"
              >
                اعتماد واكتمال صفا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Issue Correction Request --- */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>إرسال طلب تصحيح وملاحظة</span>
              </h3>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              سيتم تغيير حالة المعاملة إلى (مطلوب تصحيح) وتنبيه المرسل لمعالجة النواقص أو إعادة رفع المستندات المطلوبة.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                سبب طلب التصحيح *
              </label>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={3}
                placeholder="وضح بالضبط ما هو المطلوب تصحيحه أو إعادة إرفاقه..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmitCorrection}
                disabled={actionLoading || !correctionReason.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                إرسال للمرسل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Edit Flight & Travel Details --- */}
      {showFlightEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Plane className="w-5 h-5 text-sky-600" />
                <span>تعديل مواعيد وبيانات الرحلة والطيران</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFlightEditModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFlightDetails} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto px-1 py-1">
                {/* 1. نوع / شركة الطيران */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Plane className="w-3.5 h-3.5 text-sky-600" />
                    <span>نوع / شركة الطيران</span>
                  </label>
                  <input
                    type="text"
                    value={editAirline}
                    onChange={(e) => setEditAirline(e.target.value)}
                    placeholder="مثال: الخطوط السعودية، مصر للطيران..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>

                {/* قسم رحلة الذهاب */}
                <div className="sm:col-span-2 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                  <span className="font-bold text-sky-800 text-xs flex items-center gap-1 mb-2">
                    <Plane className="w-3.5 h-3.5 text-sky-600" />
                    <span>بيانات رحلة الذهاب</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        رقم رحلة الذهاب
                      </label>
                      <input
                        type="text"
                        value={editFlightNumber}
                        onChange={(e) => setEditFlightNumber(e.target.value)}
                        placeholder="مثال: SV123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        مطار الوصول للسعودية (الذهاب)
                      </label>
                      <input
                        type="text"
                        value={editArrivalAirport}
                        onChange={(e) => setEditArrivalAirport(e.target.value)}
                        placeholder="مثال: مطار جدة أو مطار المدينة"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        تاريخ الذهاب
                      </label>
                      <input
                        type="date"
                        value={editDepartureDate}
                        onChange={(e) => setEditDepartureDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        وقت إقلاع طائرة الذهاب
                      </label>
                      <input
                        type="time"
                        value={editFlightDepartureTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFlightDepartureTime(val);
                          if (val) {
                            const calc = calculateAirportArrivalTime(val);
                            if (calc) setEditAirportArrivalTime(calc);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        وقت وصول الطائرة للسعودية (الذهاب)
                      </label>
                      <input
                        type="time"
                        value={editSaudiArrivalTime}
                        onChange={(e) => setEditSaudiArrivalTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        وقت تواجد المسافر في المطار (قبل الإقلاع بـ 3 ساعات)
                      </label>
                      <input
                        type="time"
                        value={editAirportArrivalTime}
                        onChange={(e) => setEditAirportArrivalTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* قسم رحلة العودة */}
                <div className="sm:col-span-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-800 text-xs flex items-center gap-1 mb-2">
                    <Plane className="w-3.5 h-3.5 text-indigo-600 -scale-x-100" />
                    <span>بيانات رحلة العودة</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        رقم رحلة العودة
                      </label>
                      <input
                        type="text"
                        value={editReturnFlightNumber}
                        onChange={(e) => setEditReturnFlightNumber(e.target.value)}
                        placeholder="مثال: SV124"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        مطار الإقلاع من السعودية (العودة)
                      </label>
                      <input
                        type="text"
                        value={editReturnDepartureAirport}
                        onChange={(e) => setEditReturnDepartureAirport(e.target.value)}
                        placeholder="مثال: مطار المدينة أو مطار جدة"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        تاريخ العودة
                      </label>
                      <input
                        type="date"
                        value={editReturnDate}
                        onChange={(e) => setEditReturnDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        وقت إقلاع رحلة العودة من السعودية
                      </label>
                      <input
                        type="time"
                        value={editReturnFlightDepartureTime}
                        onChange={(e) => setEditReturnFlightDepartureTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFlightEditModal(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 6: Edit General Transaction Details --- */}
      {showEditGeneralModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <span>تعديل بيانات المعاملة الأساسية</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditGeneralModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGeneralInfo} className="space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="block font-bold text-gray-700">
                      اسم المجموعة / المعاملة *
                    </label>
                    {(() => {
                      if (!request) return null;
                      const dep = request.departureDate || request.travelDate;
                      const ret = request.returnDate;
                      const senderCode = request.senderCode || resolveSenderCode(user);
                      const suggestedName = formatOfficialGroupName(senderCode, dep, ret);
                      if (suggestedName && suggestedName !== editGroupName) {
                        return (
                          <button
                            type="button"
                            onClick={() => setEditGroupName(suggestedName)}
                            className="text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            title="تطبيق التسمية المعتمدة تلقائياً بنقرة واحدة"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                            <span>توليد الاسم المعتمد 🪄 ({suggestedName})</span>
                          </button>
                        );
                      }
                      if (suggestedName && suggestedName === editGroupName) {
                        return (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>الاسم المعتمد مفعّل ✓</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <input
                    type="text"
                    required
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="مثال: OHD7oct26dec"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    رقم هاتف التواصل *
                  </label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 text-left font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    الوجهة / المدينة
                  </label>
                  <input
                    type="text"
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value)}
                    placeholder="مثال: مكة المكرمة / جدة"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    ملاحظات المعاملة
                  </label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية حول المعاملة..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditGeneralModal(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editGroupName.trim()}
                  className="px-5 py-2 font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 7: Smart WhatsApp Integration Modal --- */}
      {showWhatsAppModal && request && (
        <WhatsAppModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          request={request}
        />
      )}
    </div>
  );
}
