"use client";

import React, { useEffect, useState, useCallback } from "react";
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
import { RequestStatusBadge } from "@/components/ui/StatusBadge";
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
  Save,
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
  Plus,
  UserPlus,
  UserMinus,
  IdCard,
  User,
  Search,
  Printer,
} from "lucide-react";
import { scanPassportMRZ, translateEnglishNameToArabic } from "@/lib/mrzScanner";
import { scanHostId } from "@/lib/hostIdScanner";
import { scanFlightTicket, calculateAirportArrivalTime } from "@/lib/flightTicketScanner";
import { getGeminiApiKey, setGeminiApiKey } from "@/lib/geminiVision";
import {
  getMofaWorkerUrl,
  ensureMofaWorkerUrl,
  syncMofaWorkerUrlFromDatabase,
  setMofaWorkerUrl,
  fetchMofaSession,
  checkAndAttachVisaToTraveler,
  extractFirstName,
  convertNationalityToMofaCode,
} from "@/lib/mofaVisaService";
import {
  printVisaDocument,
  printPdfDocumentUrl,
  printAllVisasByRequestId,
  printHtmlViaIframe,
} from "@/lib/visaPrintHelper";
import { extractVisaData, renderOfficialVisaHtml } from "@/lib/officialVisaTemplate";
import { useDialog } from "@/lib/dialog-context";
import { FileDropArea } from "@/components/ui/FileDropArea";
import { getWhatsAppUrl, getTelUrl, normalizePhone, validateHostPhone, validateTravelerPhone } from "@/lib/phoneUtils";
import { WhatsAppModal } from "@/components/ui/WhatsAppModal";
import { formatOfficialGroupName, resolveSenderCode } from "@/lib/groupNaming";
import { downloadFile } from "@/lib/fileDownload";
import { sendWhatsAppGroupPackage } from "@/lib/whatsappGroupSend";
import { checkPassportValidity, findDuplicatePassportOrId } from "@/lib/passportValidation";
import { useRealtimeSync } from "@/lib/realtimeSync";

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
  const [previewDocHtml, setPreviewDocHtml] = useState<string | null>(null);
  const [reviewModalDoc, setReviewModalDoc] = useState<DocumentItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>("Accepted");
  const [reviewNote, setReviewNote] = useState("");

  // Safa Complete Modal & Nusuk Number
  const [showNusukModal, setShowNusukModal] = useState(false);
  const [nusukInput, setNusukInput] = useState("");
  const [nusukGroupName, setNusukGroupName] = useState("");
  const [nusukNote, setNusukNote] = useState("");
  const [editingNusuk, setEditingNusuk] = useState(false);
  const [nusukSaved, setNusukSaved] = useState(false);
  const [nusukSuccessMsg, setNusukSuccessMsg] = useState<string | null>(null);
  const [nusukWaMsg, setNusukWaMsg] = useState<string | null>(null);
  const [nusukSaving, setNusukSaving] = useState(false);
  const [nusukSendingWa, setNusukSendingWa] = useState(false);

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
  const [editTravelerAffiliation, setEditTravelerAffiliation] = useState("");
  const [editTravelerNotes, setEditTravelerNotes] = useState("");
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

  // Dedicated Add / Edit Host Modal State
  const [showAddHostModal, setShowAddHostModal] = useState(false);
  const [hostModalName, setHostModalName] = useState("");
  const [hostModalPhone, setHostModalPhone] = useState("");
  const [hostModalNationalId, setHostModalNationalId] = useState("");
  const [hostModalNationality, setHostModalNationality] = useState("سعودي");
  const [hostModalBirthDate, setHostModalBirthDate] = useState("");
  const [hostModalFile, setHostModalFile] = useState<File | null>(null);
  const [hostModalFilePreview, setHostModalFilePreview] = useState<string | null>(null);
  const [isScanningHostModalFile, setIsScanningHostModalFile] = useState(false);

  // General Transaction Info Edit Modal
  const [showEditGeneralModal, setShowEditGeneralModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editNusukGroupNumber, setEditNusukGroupNumber] = useState("");
  const [editSenderCode, setEditSenderCode] = useState("");

  // Add New Traveler Modal
  const [showAddTravelerModal, setShowAddTravelerModal] = useState(false);
  const [newTravelerName, setNewTravelerName] = useState("");
  const [newTravelerPassport, setNewTravelerPassport] = useState("");
  const [newTravelerPhone, setNewTravelerPhone] = useState("");
  const [newTravelerNationality, setNewTravelerNationality] = useState("");
  const [newTravelerBirthDate, setNewTravelerBirthDate] = useState("");
  const [newTravelerExpiryDate, setNewTravelerExpiryDate] = useState("");
  const [newTravelerAffiliation, setNewTravelerAffiliation] = useState("");
  const [newTravelerNotes, setNewTravelerNotes] = useState("");
  const [isTranslatingNewName, setIsTranslatingNewName] = useState(false);
  const [newTravelerPassportFile, setNewTravelerPassportFile] = useState<File | null>(null);
  const [newTravelerPassportPreview, setNewTravelerPassportPreview] = useState<string | null>(null);
  const [isScanningNewTravelerPassport, setIsScanningNewTravelerPassport] = useState(false);
  const [newTravelerScanSuccess, setNewTravelerScanSuccess] = useState(false);
  const [newTravelerScanMessage, setNewTravelerScanMessage] = useState<string | null>(null);
  const [newTravelerExpiryWarning, setNewTravelerExpiryWarning] = useState<string | null>(null);
  const [newTravelerDuplicateWarning, setNewTravelerDuplicateWarning] = useState<string | null>(null);
  const [newTravelerPhotoFile, setNewTravelerPhotoFile] = useState<File | null>(null);
  const [newTravelerPhotoPreview, setNewTravelerPhotoPreview] = useState<string | null>(null);

  // MOFA Visa Checking state
  const [isCheckingVisaTravelerId, setIsCheckingVisaTravelerId] = useState<string | null>(null);
  const [isBulkCheckingVisas, setIsBulkCheckingVisas] = useState(false);
  const [isPrintingAllVisas, setIsPrintingAllVisas] = useState(false);
  const [visaProgressMsg, setVisaProgressMsg] = useState<string | null>(null);
  const [cachedVisaHtmlMap, setCachedVisaHtmlMap] = useState<Record<string, string>>({});
  const [mofaModalData, setMofaModalData] = useState<{
    isOpen: boolean;
    traveler: Traveler;
    workerUrl: string;
    token: string;
    cookie: string;
    captchaImage: string;
    userCaptcha: string;
    searchPassportNo: string;
    searchFirstName: string;
    searchNationality: string;
    loading: boolean;
    refreshingCaptcha: boolean;
    error?: string | null;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl: string | null = null;
    setPreviewDocHtml(null);

    if (previewDoc) {
      setPreviewDocLoading(true);

      const isVisaDoc =
        previewDoc.documentType === "Visa" ||
        previewDoc.originalFileName?.toLowerCase().endsWith(".html") ||
        previewDoc.originalFileName?.toLowerCase().endsWith(".htm") ||
        previewDoc.mimeType?.includes("html");

      if (isVisaDoc) {
        const trv = request?.travelers.find(
          (t) =>
            t.documents?.some((d) => d.id === previewDoc.id) ||
            t.id === previewDoc.travelerId
        );

        const setupHtmlPreview = async (rawHtml: string) => {
          if (!isMounted) return;
          let finalRenderedHtml = rawHtml;
          try {
            const visaData = await extractVisaData(rawHtml, trv);
            finalRenderedHtml = renderOfficialVisaHtml(visaData);
          } catch (e) {
            console.warn("Could not parse official visa template, fallback to raw HTML:", e);
          }

          if (!isMounted) return;
          setPreviewDocHtml(finalRenderedHtml);
          const blob = new Blob([finalRenderedHtml], { type: "text/html;charset=utf-8" });
          createdBlobUrl = URL.createObjectURL(blob);
          setPreviewDocUrl(createdBlobUrl);
          setPreviewDocLoading(false);
        };

        // 1. Direct memory or local storage cache
        let directHtml: string | null = null;
        if (trv) {
          directHtml = cachedVisaHtmlMap[trv.id] || null;
          if (!directHtml && typeof window !== "undefined") {
            try {
              directHtml = localStorage.getItem(`mofa_visa_html_${trv.id}`) || null;
            } catch {}
          }
        }

        if (directHtml) {
          setupHtmlPreview(directHtml);
          return () => {
            isMounted = false;
            if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
          };
        }

        // 2. Fetch from document stream
        const fetchDocHtml = async () => {
          try {
            let docStream = previewDoc.storageUrl;
            if (!docStream) {
              docStream = await api.documents.getStreamUrl(previewDoc.id);
            }
            if (!isMounted) return;

            if (docStream) {
              if (
                docStream.startsWith("data:text/html;base64,") ||
                docStream.startsWith("data:text/html;charset=utf-8;base64,")
              ) {
                const base64 = docStream.split(",")[1];
                const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                const decodedHtml = new TextDecoder().decode(bytes);
                await setupHtmlPreview(decodedHtml);
                return;
              } else if (docStream.startsWith("data:text/html")) {
                const decodedHtml = decodeURIComponent(docStream.split(",")[1] || "");
                await setupHtmlPreview(decodedHtml);
                return;
              } else if (
                docStream.startsWith("http") ||
                docStream.startsWith("blob:") ||
                docStream.startsWith("/")
              ) {
                try {
                  const res = await fetch(docStream);
                  const fetchedHtml = await res.text();
                  if (
                    fetchedHtml &&
                    (fetchedHtml.includes("<html") ||
                      fetchedHtml.includes("<!DOCTYPE") ||
                      fetchedHtml.includes("<table") ||
                      fetchedHtml.includes("<div"))
                  ) {
                    await setupHtmlPreview(fetchedHtml);
                    return;
                  }
                } catch {}
              }
            }

            if (trv && (trv.visaNumber || trv.status === "Accepted")) {
              await setupHtmlPreview("");
              return;
            }

            applyUrl(docStream);
          } catch {
            if (isMounted) {
              if (trv && (trv.visaNumber || trv.status === "Accepted")) {
                await setupHtmlPreview("");
              } else {
                setPreviewDocUrl(null);
                setPreviewDocLoading(false);
              }
            }
          }
        };

        fetchDocHtml();
        return () => {
          isMounted = false;
          if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
        };
      }

      const applyUrl = (rawUrl: string | null) => {
        if (!isMounted) return;
        if (rawUrl && rawUrl.startsWith("data:application/pdf;base64,")) {
          try {
            const bstr = atob(rawUrl.split(",")[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: "application/pdf" });
            createdBlobUrl = URL.createObjectURL(blob);
            setPreviewDocUrl(createdBlobUrl);
            setPreviewDocLoading(false);
            return;
          } catch {}
        }
        setPreviewDocUrl(rawUrl);
        setPreviewDocLoading(false);
      };

      if (previewDoc.storageUrl) {
        applyUrl(previewDoc.storageUrl);
      } else {
        api.documents
          .getStreamUrl(previewDoc.id)
          .then((url) => {
            applyUrl(url);
          })
          .catch(() => {
            if (isMounted) {
              setPreviewDocUrl(null);
              setPreviewDocLoading(false);
            }
          });
      }
    } else {
      setPreviewDocUrl(null);
      setPreviewDocLoading(false);
    }
    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
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
      if (!showNusukModal && !editingNusuk) {
        if (data.nusukGroupNumber) {
          setNusukInput(data.nusukGroupNumber);
        }
        if (data.groupName) {
          setNusukGroupName(data.groupName);
        }
      }

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
                (data.hostingInfo?.hostIdDocumentId
                  ? data.groupDocuments?.find((d) => d.id === data.hostingInfo.hostIdDocumentId)
                  : undefined) ||
                data.hostingInfo?.hostIdDocument ||
                data.groupDocuments?.filter((d) => d.documentType === "HostId").slice(-1)[0];
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

  useRealtimeSync(
    useCallback(() => {
      if (requestId) {
        loadRequest(false);
      }
    }, [requestId])
  );

  const handleFileUpload = async (
    file: File,
    docType: DocumentType,
    travelerId?: string
  ) => {
    try {
      setActionLoading(true);
      setUploadingFor({ travelerId, docType });
      setError(null);

      // 1. Delete previous document(s) of the same type to ensure only the newly uploaded file remains
      if (docType === "HostId") {
        const oldHostDocs = request?.groupDocuments?.filter((d) => d.documentType === "HostId") || [];
        for (const oldDoc of oldHostDocs) {
          try {
            await api.documents.delete(oldDoc.id);
          } catch (delErr) {
            console.warn("Could not delete previous host ID document:", delErr);
          }
        }
        if (request?.hostingInfo?.hostIdDocumentId) {
          try {
            await api.documents.delete(request.hostingInfo.hostIdDocumentId);
          } catch {}
        }
      } else if (docType === "FlightTicket") {
        const oldTicketDocs = request?.groupDocuments?.filter((d) => d.documentType === "FlightTicket") || [];
        for (const oldDoc of oldTicketDocs) {
          try {
            await api.documents.delete(oldDoc.id);
          } catch (delErr) {
            console.warn("Could not delete previous flight ticket document:", delErr);
          }
        }
        if (request?.flightTicketDocumentId) {
          try {
            await api.documents.delete(request.flightTicketDocumentId);
          } catch {}
        }
      } else if (travelerId) {
        const currentTrv = request?.travelers?.find((t) => t.id === travelerId);
        const oldDocs = currentTrv?.documents?.filter((d) => d.documentType === docType) || [];
        for (const oldDoc of oldDocs) {
          try {
            await api.documents.delete(oldDoc.id);
          } catch (delErr) {
            console.warn("Could not delete previous traveler document:", delErr);
          }
        }
      }

      // 2. Upload the new document
      await api.documents.upload(requestId, file, docType, travelerId);

      // 3. AI Scan & extract data to overwrite / update with the correct information
      if (docType === "HostId") {
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
              `تم استبدال هوية المستضيف واستخراج البيانات بنجاح: ${scanResult.hostName || ""} ${
                scanResult.hostNationality ? `[${scanResult.hostNationality}]` : ""
              } ${scanResult.hostBirthDate ? `(تاريخ الميلاد: ${scanResult.hostBirthDate})` : ""} ${
                scanResult.idNumber ? `(رقم الهوية: ${scanResult.idNumber})` : ""
              }`
            );
          } else {
            setSuccess(`تم تحديث مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (hostScanErr) {
          console.warn("Host ID auto-scan error:", hostScanErr);
          setSuccess(`تم استبدال مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
        }
      } else if (docType === "Passport" && travelerId) {
        try {
          const scanResult = await scanPassportMRZ(file);
          if (
            scanResult &&
            (scanResult.fullNameArabic || scanResult.fullNameEnglish || scanResult.passportNumber)
          ) {
            const currentTraveler = request?.travelers?.find((t) => t.id === travelerId);
            const targetFullName =
              scanResult.fullNameArabic ||
              scanResult.fullNameEnglish ||
              currentTraveler?.fullName;

            await api.travelers.update(travelerId, {
              fullName: targetFullName,
              passportNumber: scanResult.passportNumber || currentTraveler?.passportNumber,
              nationality: scanResult.nationality || currentTraveler?.nationality,
              dateOfBirth: scanResult.dateOfBirth || currentTraveler?.dateOfBirth,
              expiryDate: scanResult.expiryDate || currentTraveler?.expiryDate,
            });
            setSuccess(
              `تم استبدال الجواز وتحديث بيانات المسافر بنجاح: (${targetFullName || ""}) ${
                scanResult.passportNumber ? `| رقم الجواز: ${scanResult.passportNumber}` : ""
              }`
            );
          } else {
            setSuccess(`تم تحديث مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (mrzErr) {
          console.warn("MRZ auto-scan error:", mrzErr);
          setSuccess(`تم استبدال مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
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
              `تم استبدال تذكرة الطيران واستخراج البيانات بنجاح: ${scanResult.airline || ""} ${
                scanResult.flightNumber ? `(رحلة ${scanResult.flightNumber})` : ""
              } ${scanResult.departureDate ? `| الذهاب: ${scanResult.departureDate}` : ""} ${
                scanResult.flightDepartureTime ? `| الإقلاع: ${scanResult.flightDepartureTime}` : ""
              }`
            );
          } else {
            setSuccess(`تم تحديث مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
          }
        } catch (ticketScanErr) {
          console.warn("Flight ticket auto-scan error:", ticketScanErr);
          setSuccess(`تم استبدال مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
        }
      } else {
        setSuccess(`تم استبدال مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
      }

      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("فشل استبدال المستند.");
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
    expiryDate?: string,
    affiliation?: string,
    notes?: string
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
        affiliation: affiliation !== undefined ? affiliation.trim() : current?.affiliation,
        notes: notes !== undefined ? notes.trim() : current?.notes,
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

  const openHostModal = () => {
    setHostModalName(request?.hostingInfo?.hostName || "");
    setHostModalNationality(request?.hostingInfo?.hostNationality || "سعودي");
    setHostModalBirthDate(request?.hostingInfo?.hostBirthDate || "");
    setHostModalPhone(request?.hostingInfo?.hostPhone || request?.contactPhone || "");
    setHostModalNationalId(request?.hostingInfo?.hostNationalId || request?.hostingInfo?.hostAddress || "");
    setHostModalFile(null);
    setHostModalFilePreview(null);
    setShowAddHostModal(true);
  };

  const handleHostModalFileChange = async (file: File) => {
    setHostModalFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setHostModalFilePreview(url);
    } else {
      setHostModalFilePreview(null);
    }

    try {
      setIsScanningHostModalFile(true);
      const scanResult = await scanHostId(file);
      if (scanResult) {
        if (scanResult.hostName) setHostModalName(scanResult.hostName);
        if (scanResult.idNumber) setHostModalNationalId(scanResult.idNumber);
        if (scanResult.hostNationality) setHostModalNationality(scanResult.hostNationality);
        if (scanResult.hostBirthDate) setHostModalBirthDate(scanResult.hostBirthDate);
      }
    } catch (err) {
      console.warn("Host ID modal scan error:", err);
    } finally {
      setIsScanningHostModalFile(false);
    }
  };

  const handleSaveHostModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    if (!hostModalPhone.trim()) {
      setError("يرجى إدخال رقم هاتف المستضيف.");
      return;
    }

    const hVal = validateHostPhone(hostModalPhone);
    if (!hVal.isValid) {
      setError(hVal.error || "رقم المستضيف غير صحيح");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      // 1. Update request with hosting data
      await api.requests.update(requestId, {
        hasHosting: true,
        hostName: hostModalName.trim() || "مستضيف داخل المملكة",
        hostPhone: hVal.formatted || hostModalPhone.trim(),
        hostNationalId: hostModalNationalId.trim() || undefined,
        hostNationality: hostModalNationality.trim() || "سعودي",
        hostBirthDate: hostModalBirthDate.trim() || undefined,
      });

      // 2. Upload file if selected (deleting previous HostId documents first)
      if (hostModalFile) {
        const oldHostDocs = request.groupDocuments?.filter((d) => d.documentType === "HostId") || [];
        for (const oldDoc of oldHostDocs) {
          try {
            await api.documents.delete(oldDoc.id);
          } catch {}
        }
        if (request.hostingInfo?.hostIdDocumentId) {
          try {
            await api.documents.delete(request.hostingInfo.hostIdDocumentId);
          } catch {}
        }
        await api.documents.upload(requestId, hostModalFile, "HostId");
      }

      setSuccess("تمت إضافة بيانات ومستند المستضيف للمعاملة بنجاح 🕋");
      setShowAddHostModal(false);
      setHostModalFile(null);
      setHostModalFilePreview(null);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل حفظ بيانات المستضيف.");
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
        nusukGroupNumber: isSender ? request.nusukGroupNumber : (editNusukGroupNumber.trim() || undefined),
        senderCode: editSenderCode.trim().toUpperCase() || undefined,
      });
      setSuccess("تم تحديث بيانات المعاملة بنجاح.");
      setShowEditGeneralModal(false);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل تحديث بيانات المعاملة.");
    } finally {
      setActionLoading(false);
    }
  };

  const resetAddTravelerForm = () => {
    setNewTravelerName("");
    setNewTravelerPassport("");
    setNewTravelerPhone("");
    setNewTravelerNationality("");
    setNewTravelerBirthDate("");
    setNewTravelerExpiryDate("");
    setNewTravelerAffiliation("");
    setNewTravelerNotes("");
    setNewTravelerPassportFile(null);
    setNewTravelerPassportPreview(null);
    setIsScanningNewTravelerPassport(false);
    setNewTravelerScanSuccess(false);
    setNewTravelerScanMessage(null);
    setNewTravelerExpiryWarning(null);
    setNewTravelerDuplicateWarning(null);
    setNewTravelerPhotoFile(null);
    setNewTravelerPhotoPreview(null);
  };

  const handleNewTravelerPassportChange = async (file: File | null) => {
    if (!file) {
      setNewTravelerPassportFile(null);
      setNewTravelerPassportPreview(null);
      setIsScanningNewTravelerPassport(false);
      setNewTravelerScanSuccess(false);
      setNewTravelerScanMessage(null);
      setNewTravelerExpiryWarning(null);
      setNewTravelerDuplicateWarning(null);
      return;
    }

    setNewTravelerPassportFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setNewTravelerPassportPreview(url);
    } else {
      setNewTravelerPassportPreview(null);
    }

    setIsScanningNewTravelerPassport(true);
    setNewTravelerScanSuccess(false);
    setNewTravelerScanMessage("جاري فحص وقراءة بيانات الجواز (بالذكاء الاصطناعي)...");
    setNewTravelerExpiryWarning(null);
    setNewTravelerDuplicateWarning(null);

    try {
      const result = await scanPassportMRZ(file, (msg) => {
        setNewTravelerScanMessage(msg);
      });

      if (result && (result.fullNameArabic || result.fullNameEnglish || result.passportNumber)) {
        if (result.fullNameArabic) {
          setNewTravelerName(result.fullNameArabic);
        } else if (result.fullNameEnglish) {
          try {
            const tr = await translateEnglishNameToArabic(result.fullNameEnglish);
            setNewTravelerName(tr || result.fullNameEnglish);
          } catch {
            setNewTravelerName(result.fullNameEnglish);
          }
        }

        if (result.passportNumber) {
          const cleanP = result.passportNumber.trim().toUpperCase();
          setNewTravelerPassport(cleanP);

          const dupInCurrent = (request?.travelers || []).some(
            (t) => t.passportNumber && t.passportNumber.trim().toUpperCase() === cleanP
          );
          if (dupInCurrent) {
            setNewTravelerDuplicateWarning("⚠️ رقم الجواز مكرر مع مسافر آخر في نفس المعاملة!");
          } else {
            const found = await findDuplicatePassportOrId(cleanP, "passport", requestId);
            if (found && found.isDuplicate) {
              setNewTravelerDuplicateWarning(
                `⚠️ تنبيه: رقم الجواز مسجل مسبقاً في المعاملة (${found.requestNumber} - ${found.matchedName})`
              );
            }
          }
        }

        if (result.nationality) {
          setNewTravelerNationality(result.nationality);
        }
        if (result.dateOfBirth) {
          setNewTravelerBirthDate(result.dateOfBirth);
        }
        if (result.expiryDate) {
          setNewTravelerExpiryDate(result.expiryDate);
          const depDate = request?.departureDate || request?.travelDate;
          const validity = checkPassportValidity(result.expiryDate, depDate);
          if (validity.isExpiringSoon || validity.isExpired) {
            setNewTravelerExpiryWarning(validity.message);
          }
        }

        setNewTravelerScanSuccess(true);
        setNewTravelerScanMessage(
          `تم التعرف بنجاح على: ${result.fullNameArabic || result.fullNameEnglish || result.passportNumber}`
        );
      } else {
        setNewTravelerScanSuccess(false);
        setNewTravelerScanMessage("لم يتم التقاط بيانات الجواز بدقة، يمكنك كتابة البيانات يدوياً.");
      }
    } catch (err: any) {
      setNewTravelerScanSuccess(false);
      setNewTravelerScanMessage(err?.message || "تعذر فحص الجواز، يرجى كتابة البيانات يدوياً.");
    } finally {
      setIsScanningNewTravelerPassport(false);
    }
  };

  const handleNewTravelerPhotoChange = (file: File | null) => {
    if (!file) {
      setNewTravelerPhotoFile(null);
      setNewTravelerPhotoPreview(null);
      return;
    }
    setNewTravelerPhotoFile(file);
    if (file.type.startsWith("image/")) {
      setNewTravelerPhotoPreview(URL.createObjectURL(file));
    } else {
      setNewTravelerPhotoPreview(null);
    }
  };

  const handleTranslateNewName = async () => {
    if (!newTravelerName.trim()) return;
    try {
      setIsTranslatingNewName(true);
      const translated = await translateEnglishNameToArabic(newTravelerName.trim());
      if (translated) {
        setNewTravelerName(translated);
      }
    } catch (e) {
      console.warn("Translation failed:", e);
    } finally {
      setIsTranslatingNewName(false);
    }
  };

  const handleAddTraveler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTravelerName.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى كتابة اسم المسافر على الأقل.",
        variant: "warning",
      });
      return;
    }

    let formattedPhone: string | undefined = undefined;
    if (newTravelerPhone.trim()) {
      const pVal = validateTravelerPhone(newTravelerPhone);
      if (!pVal.isValid) {
        await alert({
          title: "تنبيه رقم الهاتف",
          message: pVal.error || "رقم هاتف المسافر غير صحيح",
          variant: "warning",
        });
        return;
      }
      formattedPhone = pVal.formatted;
    }

    try {
      setActionLoading(true);
      setError(null);
      const newTraveler = await api.travelers.add(requestId, {
        fullName: newTravelerName.trim(),
        passportNumber: newTravelerPassport.trim() || undefined,
        phoneNumber: formattedPhone,
        nationality: newTravelerNationality.trim() || undefined,
        dateOfBirth: newTravelerBirthDate.trim() || undefined,
        expiryDate: newTravelerExpiryDate.trim() || undefined,
        affiliation: newTravelerAffiliation.trim() || undefined,
        notes: newTravelerNotes.trim() || undefined,
      });

      // Upload passport document if attached
      if (newTravelerPassportFile && newTraveler?.id) {
        try {
          await api.documents.upload(
            requestId,
            newTravelerPassportFile,
            "Passport",
            newTraveler.id
          );
        } catch (uploadErr) {
          console.error("Failed to upload passport document:", uploadErr);
        }
      }

      // Upload photo document if attached
      if (newTravelerPhotoFile && newTraveler?.id) {
        try {
          await api.documents.upload(
            requestId,
            newTravelerPhotoFile,
            "PersonalPhoto",
            newTraveler.id
          );
        } catch (uploadErr) {
          console.error("Failed to upload photo document:", uploadErr);
        }
      }

      setSuccess("تمت إضافة المسافر ومستنداته بنجاح إلى المعاملة.");
      setShowAddTravelerModal(false);
      resetAddTravelerForm();
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل إضافة المسافر.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTraveler = async (travelerId: string, travelerName: string) => {
    if (role === "Sender") {
      await alert({
        title: "غير مصرح",
        message: "غير مسموح للمرسل بحذف المسافرين من المعاملة، يُسمح بالإضافة فقط.",
        variant: "warning",
      });
      return;
    }

    const isConfirmed = await confirm({
      title: "تأكيد حذف المسافر",
      message: `هل أنت متأكد من رغبتك في حذف المسافر "${travelerName}" وجميع مستنداته من هذه المعاملة نهائياً؟`,
      confirmText: "نعم، حذف المسافر",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!isConfirmed) return;

    try {
      setActionLoading(true);
      setError(null);
      await api.travelers.delete(travelerId);
      setSuccess(`تم حذف المسافر (${travelerName}) بنجاح.`);
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("فشل حذف المسافر.");
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
      const streamUrl = passDoc.storageUrl || (await api.documents.getStreamUrl(passDoc.id));
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

  const getOrPromptWorkerUrl = async (): Promise<string | null> => {
    let workerUrl = await ensureMofaWorkerUrl();
    if (!workerUrl) {
      workerUrl = await syncMofaWorkerUrlFromDatabase();
    }
    if (!workerUrl) {
      const enteredUrl = await prompt({
        title: "إعداد خادم الاستعلام عن التأشيرات (Cloudflare Worker)",
        message:
          "يرجى إدخال رابط خادم Cloudflare Worker الخاص بك للاستعلام المباشر وتنزيل التأشيرات الصادرة من منصة وزارة الخارجية (سيتم حفظه في قاعدة البيانات لجميع المستخدمين ولن يُمسح بمسح بيانات المتصفح):",
        placeholder: "https://mofa-visa-proxy.yourname.workers.dev",
        confirmText: "حفظ في قاعدة البيانات ومتابعة",
        cancelText: "إلغاء",
        variant: "primary",
      });
      if (enteredUrl && enteredUrl.trim()) {
        await setMofaWorkerUrl(enteredUrl.trim(), true);
        workerUrl = enteredUrl.trim();
      }
    }
    return workerUrl;
  };

  const handleCheckSingleVisa = async (traveler: Traveler) => {
    if (!traveler.passportNumber) {
      await alert({
        title: "بيانات ناقصة",
        message: "يجب تسجيل رقم جواز السفر للمسافر أولاً للتمكن من فحص التأشيرة.",
        variant: "warning",
      });
      return;
    }

    const workerUrl = await getOrPromptWorkerUrl();
    if (!workerUrl) return;

    try {
      setIsCheckingVisaTravelerId(traveler.id);
      setError(null);

      const res = await checkAndAttachVisaToTraveler(
        requestId,
        traveler,
        workerUrl,
        (msg) => setVisaProgressMsg(msg)
      );

      if (res.success) {
        if (res.searchResult?.visaHtml) {
          setCachedVisaHtmlMap((prev) => ({
            ...prev,
            [traveler.id]: res.searchResult!.visaHtml!,
          }));
          // Trigger immediate print command formatted as clean 1-page A4
          printVisaDocument(res.searchResult.visaHtml, traveler);
        }

        setSuccess(
          `تم بنجاح استخراج التأشيرة وتنزيلها للمسافر (${traveler.fullName}) ${
            res.visaNumber ? `| رقم التأشيرة: ${res.visaNumber}` : ""
          } 🇸🇦`
        );
        setRequest((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            travelers: prev.travelers.map((t) => {
              if (t.id === traveler.id) {
                const existingDocs = t.documents ? t.documents.filter((d) => d.documentType !== "Visa") : [];
                const updatedDocs = res.attachedDoc ? [...existingDocs, res.attachedDoc] : existingDocs;
                return {
                  ...t,
                  visaNumber: res.visaNumber || t.visaNumber,
                  visaStatus: "Issued",
                  documents: updatedDocs,
                };
              }
              return t;
            }),
          };
        });
        await loadRequest(false);
      } else if (res.errorType === "INVALID_CAPTCHA" && res.session) {
        // Open interactive Captcha verification dialog
        setMofaModalData({
          isOpen: true,
          traveler,
          workerUrl,
          token: res.session.token,
          cookie: res.session.cookie,
          captchaImage: res.session.captchaImage,
          userCaptcha: "",
          searchPassportNo: traveler.passportNumber?.trim() || "",
          searchFirstName: extractFirstName(traveler.fullName),
          searchNationality: convertNationalityToMofaCode(traveler.nationality),
          loading: false,
          refreshingCaptcha: false,
          error: res.error || null,
        });
      } else {
        await alert({
          title: "نتيجة فحص التأشيرة",
          message: res.error || "لم يتم العثور على تأشيرة صادرة لهذا الجواز.",
          variant: "info",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص التأشيرة.";
      setError(msg);
    } finally {
      setIsCheckingVisaTravelerId(null);
      setVisaProgressMsg(null);
    }
  };

  const handleRefreshModalCaptcha = async () => {
    if (!mofaModalData) return;
    try {
      setMofaModalData((prev) => (prev ? { ...prev, refreshingCaptcha: true, error: null } : null));
      const newSession = await fetchMofaSession(mofaModalData.workerUrl);
      setMofaModalData((prev) =>
        prev
          ? {
              ...prev,
              token: newSession.token,
              cookie: newSession.cookie,
              captchaImage: newSession.captchaImage,
              userCaptcha: "",
              refreshingCaptcha: false,
            }
          : null
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تحديث رمز الصورة";
      setMofaModalData((prev) => (prev ? { ...prev, refreshingCaptcha: false, error: msg } : null));
    }
  };

  const handleConfirmModalCaptcha = async () => {
    if (!mofaModalData) return;
    if (!mofaModalData.userCaptcha || mofaModalData.userCaptcha.trim().length !== 6) {
      setMofaModalData((prev) =>
        prev ? { ...prev, error: "يرجى كتابة رمز التحقق المكون من 6 أرقام كاملاً." } : null
      );
      return;
    }

    try {
      setMofaModalData((prev) => (prev ? { ...prev, loading: true, error: null } : null));

      const res = await checkAndAttachVisaToTraveler(
        requestId,
        mofaModalData.traveler,
        mofaModalData.workerUrl,
        undefined,
        { token: mofaModalData.token, cookie: mofaModalData.cookie },
        mofaModalData.userCaptcha.trim(),
        {
          passportNo: mofaModalData.searchPassportNo.trim(),
          firstName: mofaModalData.searchFirstName.trim(),
          nationality: mofaModalData.searchNationality.trim(),
        }
      );

      if (res.success) {
        const trvName = mofaModalData.traveler.fullName;
        const trvId = mofaModalData.traveler.id;
        const vNum = res.visaNumber;

        if (res.searchResult?.visaHtml) {
          setCachedVisaHtmlMap((prev) => ({
            ...prev,
            [trvId]: res.searchResult!.visaHtml!,
          }));
          // Trigger immediate print command formatted as clean 1-page A4
          printVisaDocument(res.searchResult.visaHtml, mofaModalData.traveler);
        }

        setMofaModalData(null);
        setSuccess(
          `تم بنجاح استخراج التأشيرة وتنزيلها للمسافر (${trvName}) ${
            vNum ? `| رقم التأشيرة: ${vNum}` : ""
          } 🇸🇦`
        );
        setRequest((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            travelers: prev.travelers.map((t) => {
              if (t.id === trvId) {
                const existingDocs = t.documents ? t.documents.filter((d) => d.documentType !== "Visa") : [];
                const updatedDocs = res.attachedDoc ? [...existingDocs, res.attachedDoc] : existingDocs;
                return {
                  ...t,
                  visaNumber: vNum || t.visaNumber,
                  visaStatus: "Issued",
                  documents: updatedDocs,
                };
              }
              return t;
            }),
          };
        });
        await loadRequest(false);
      } else if (res.errorType === "INVALID_CAPTCHA") {
        try {
          const newSession = await fetchMofaSession(mofaModalData.workerUrl);
          setMofaModalData((prev) =>
            prev
              ? {
                  ...prev,
                  token: newSession.token,
                  cookie: newSession.cookie,
                  captchaImage: newSession.captchaImage,
                  userCaptcha: "",
                  loading: false,
                  error: "رمز الصورة غير مطابق، تم تحديث الصورة، يرجى إدخال الرمز الجديد.",
                }
              : null
          );
        } catch {
          setMofaModalData((prev) =>
            prev
              ? {
                  ...prev,
                  loading: false,
                  error: "رمز الصورة غير مطابق، يرجى الضغط على زر التحديث وإعادة المحاولة.",
                }
              : null
          );
        }
      } else if (res.errorType === "NOT_FOUND") {
        try {
          const newSession = await fetchMofaSession(mofaModalData.workerUrl);
          setMofaModalData((prev) =>
            prev
              ? {
                  ...prev,
                  token: newSession.token,
                  cookie: newSession.cookie,
                  captchaImage: newSession.captchaImage,
                  userCaptcha: "",
                  loading: false,
                  error:
                    "لم يتم العثور على تأشيرة مطابقة لهذه البيانات. جرب كتابة الاسم الأول بالإنجليزية (كالمسجل بالجواز) أو بهمزات مختلفة، ثم أدخل الرمز الجديد.",
                }
              : null
          );
        } catch {
          setMofaModalData((prev) =>
            prev
              ? {
                  ...prev,
                  loading: false,
                  error:
                    "لم يتم العثور على تأشيرة مطابقة. تأكد من الاسم الأول ورقم الجواز، أو اضغط زر التحديث لإعادة المحاولة.",
                }
              : null
          );
        }
      } else {
        const errMsg = res.error || "فشل الاستعلام عن التأشيرة.";
        setMofaModalData((prev) =>
          prev ? { ...prev, loading: false, error: errMsg } : null
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص التأشيرة.";
      setMofaModalData((prev) => (prev ? { ...prev, loading: false, error: msg } : null));
    }
  };

  const handlePrintVisa = async (traveler: Traveler) => {
    // 1. Check in-memory cache or localStorage
    let cachedHtml = cachedVisaHtmlMap[traveler.id];
    if (!cachedHtml && typeof window !== "undefined") {
      try {
        cachedHtml = localStorage.getItem(`mofa_visa_html_${traveler.id}`) || "";
      } catch {}
    }

    if (traveler.visaNumber || cachedHtml) {
      await printVisaDocument(cachedHtml || "", traveler);
      return;
    }

    // 2. Otherwise look for attached Visa document
    const visaDoc = traveler.documents?.find((d) => d.documentType === "Visa");
    if (visaDoc) {
      try {
        let rawUrl = visaDoc.storageUrl;
        if (!rawUrl) {
          rawUrl = await api.documents.getStreamUrl(visaDoc.id);
        }
        if (rawUrl) {
          if (
            rawUrl.startsWith("data:text/html;base64,") ||
            rawUrl.startsWith("data:text/html;charset=utf-8;base64,")
          ) {
            const base64 = rawUrl.split(",")[1];
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const decodedHtml = new TextDecoder().decode(bytes);
            await printVisaDocument(decodedHtml, traveler);
            return;
          } else if (rawUrl.startsWith("data:text/html")) {
            const decodedHtml = decodeURIComponent(rawUrl.split(",")[1] || "");
            await printVisaDocument(decodedHtml, traveler);
            return;
          } else if (
            visaDoc.originalFileName?.toLowerCase().endsWith(".html") ||
            visaDoc.mimeType?.includes("html")
          ) {
            const res = await fetch(rawUrl);
            const htmlContent = await res.text();
            await printVisaDocument(htmlContent, traveler);
            return;
          } else {
            printPdfDocumentUrl(rawUrl);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to load visa document for print:", err);
      }
    }

    await alert({
      title: "تنبيه",
      message: "لم يتم استخراج أو إرفاق مستند التأشيرة لهذا المسافر بعد. يرجى الضغط على زر فحص وتنزيل التأشيرة أولاً.",
      variant: "warning",
    });
  };

  const handlePreviewVisa = (traveler: Traveler) => {
    const existingDoc = traveler.documents?.find((d) => d.documentType === "Visa");
    if (existingDoc) {
      setPreviewDoc(existingDoc);
    } else {
      const syntheticVisaDoc: DocumentItem = {
        id: `visa-${traveler.id}`,
        groupRequestId: request?.id || "",
        travelerId: traveler.id,
        documentType: "Visa",
        originalFileName: `تأشيرة_${(traveler.fullName || "المسافر").replace(/[\/\\:*?"<>|]/g, "_")}_${traveler.visaNumber || traveler.passportNumber || ""}.html`,
        mimeType: "text/html;charset=utf-8",
        fileSize: 1024,
        version: 1,
        uploadedById: "system",
        uploadedByName: "النظام",
        uploadedAt: new Date().toISOString(),
        reviewStatus: "Accepted",
      };
      setPreviewDoc(syntheticVisaDoc);
    }
  };

  const handleBulkCheckVisas = async () => {
    if (!request || !request.travelers || request.travelers.length === 0) {
      await alert({
        title: "تنبيه",
        message: "لا يوجد مسافرين في هذه المعاملة.",
        variant: "info",
      });
      return;
    }

    const eligibleTravelers = request.travelers.filter((t) => !!t.passportNumber);
    if (eligibleTravelers.length === 0) {
      await alert({
        title: "تنبيه",
        message: "لا يوجد مسافرون مسجل لهم أرقام جوازات في هذه المعاملة.",
        variant: "warning",
      });
      return;
    }

    const workerUrl = await getOrPromptWorkerUrl();
    if (!workerUrl) return;

    try {
      setIsBulkCheckingVisas(true);
      setError(null);
      let successCount = 0;
      let notFoundCount = 0;

      for (let i = 0; i < eligibleTravelers.length; i++) {
        const t = eligibleTravelers[i];
        setVisaProgressMsg(`جاري فحص وتنزيل تأشيرة المسافر (${i + 1} من ${eligibleTravelers.length}): ${t.fullName}...`);

        try {
          const res = await checkAndAttachVisaToTraveler(
            requestId,
            t,
            workerUrl,
            (step) => setVisaProgressMsg(`(${i + 1}/${eligibleTravelers.length}) ${t.fullName}: ${step}`)
          );
          if (res.success) {
            successCount++;
          } else {
            notFoundCount++;
          }
        } catch (singleErr) {
          console.warn(`Error checking visa for ${t.fullName}:`, singleErr);
          notFoundCount++;
        }
      }

      await loadRequest(false);
      setSuccess(
        `اكتمل فحص المجموعة 🇸🇦: تم العثور على (${successCount}) تأشيرة وتنزيلها وربطها بالمسافرين تلقائياً${
          notFoundCount > 0 ? `، و(${notFoundCount}) لم تصدر لهم بعد.` : "."
        }`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص تأشيرات المجموعة.";
      setError(msg);
    } finally {
      setIsBulkCheckingVisas(false);
      setVisaProgressMsg(null);
    }
  };

  const handlePrintAllVisas = async () => {
    if (!request) return;
    try {
      setIsPrintingAllVisas(true);
      setError(null);
      const res = await printAllVisasByRequestId(request.id, cachedVisaHtmlMap);
      if (res.error) {
        await alert({
          title: "تنبيه",
          message: res.error,
          variant: "info",
        });
      } else {
        setSuccess(`تم فتح أمر طباعة (${res.count}) تأشيرات في ملف واحد بنجاح 🖨️`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء تجهيز طباعة التأشيرات.";
      setError(msg);
    } finally {
      setIsPrintingAllVisas(false);
    }
  };

  const handleDownloadDoc = async (doc: DocumentItem) => {
    try {
      setActionLoading(true);
      if (doc.documentType === "Visa") {
        const trv = request?.travelers.find(
          (t) =>
            t.documents?.some((d) => d.id === doc.id) ||
            t.id === doc.travelerId
        );
        let html = previewDocHtml || (trv ? cachedVisaHtmlMap[trv.id] : null);
        if (!html && trv && typeof window !== "undefined") {
          try {
            html = localStorage.getItem(`mofa_visa_html_${trv.id}`);
          } catch {}
        }
        if (!html && trv && (trv.visaNumber || trv.status === "Accepted")) {
          const visaData = await extractVisaData("", trv);
          html = renderOfficialVisaHtml(visaData);
        }
        if (html) {
          const safeName = (trv?.fullName || "المسافر").replace(/[\/\\:*?"<>|]/g, "_");
          const vNum = trv?.visaNumber || doc.id;
          const blob = new Blob([html], { type: "text/html;charset=utf-8" });
          const blobUrl = URL.createObjectURL(blob);
          await downloadFile(blobUrl, `تأشيرة_${safeName}_${vNum}.html`);
          URL.revokeObjectURL(blobUrl);
          return;
        }
      }
      const url = doc.storageUrl || (await api.documents.getStreamUrl(doc.id));
      const fileName =
        doc.originalFileName ||
        `document-${doc.documentType}.${doc.mimeType?.includes("pdf") ? "pdf" : doc.mimeType?.includes("html") ? "html" : "jpg"}`;
      await downloadFile(url, fileName);
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
        (request.hostingInfo?.hostIdDocumentId
          ? request.groupDocuments?.find((d) => d.id === request.hostingInfo.hostIdDocumentId)
          : undefined) ||
        request.hostingInfo?.hostIdDocument ||
        request.groupDocuments?.filter((d) => d.documentType === "HostId").slice(-1)[0];
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
        (request.flightTicketDocumentId
          ? request.groupDocuments?.find((d) => d.id === request.flightTicketDocumentId)
          : undefined) ||
        request.flightTicketDocument ||
        request.groupDocuments?.filter((d) => d.documentType === "FlightTicket").slice(-1)[0];
      if (ticketDoc) {
        const ext =
          ticketDoc.originalFileName?.split(".").pop() ||
          (ticketDoc.mimeType?.includes("pdf") ? "pdf" : "jpg");
        docEntries.push({
          doc: ticketDoc,
          customName: `2_تذكرة_الطيران_المشتركة.${ext}`,
        });
      }

      // 3. Traveler Documents (Passport, Photo & Visa)
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
        const visaDoc = traveler.documents?.find(
          (d) => d.documentType === "Visa"
        );
        if (visaDoc) {
          const ext =
            visaDoc.originalFileName?.split(".").pop() ||
            (visaDoc.mimeType?.includes("pdf") ? "pdf" : visaDoc.mimeType?.includes("html") ? "html" : "html");
          docEntries.push({
            doc: visaDoc,
            customName: `مسافر_${tIdx + 1}_${safeName}_تأشيرة_السفر.${ext}`,
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
      const streamUrl = doc.storageUrl || (await api.documents.getStreamUrl(doc.id));
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
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص صورة هوية المستضيف بالذكاء الاصطناعي.";
      setError(msg);
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
    if (role === "Sender") {
      await alert({
        title: "غير مصرح",
        message: "غير مسموح للمرسل بحذف المستندات من المعاملة.",
        variant: "warning",
      });
      return;
    }

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
      const url = ticketDoc.storageUrl || (await api.documents.getStreamUrl(ticketDoc.id));
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

  // 1. اعتماد وحفظ رقم نسك فقط مع البقاء في نفس المكان
  const handleSaveNusukOnly = async () => {
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
      setNusukSaving(true);
      setError(null);
      setNusukSuccessMsg(null);
      await api.requests.safaComplete(
        requestId,
        nusukInput.trim(),
        nusukNote.trim() || undefined,
        nusukGroupName.trim()
      );
      if (request) {
        request.groupName = nusukGroupName.trim();
        request.nusukGroupNumber = nusukInput.trim();
        request.status = "ReadyForSaudiAgent";
      }
      setNusukSaved(true);
      setNusukSuccessMsg("تم اعتماد وحفظ رقم نسك واسم المجموعة بنجاح ✓ يمكنك الآن الضغط على زر إرسال واتساب أدناه.");
      await loadRequest(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ في الحفظ", message: err.message, variant: "danger" });
      }
    } finally {
      setNusukSaving(false);
    }
  };

  // 2. إرسال حزمة المعاملة لمجموعة الواتساب (يحفظ تلقائياً إذا لم يكن محفوظاً)
  const handleSendNusukWhatsApp = async () => {
    if (!nusukInput.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال رقم مجموعة نسك أولاً.",
        variant: "warning",
      });
      return;
    }
    if (!nusukGroupName.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال اسم المجموعة أولاً.",
        variant: "warning",
      });
      return;
    }
    try {
      setNusukSendingWa(true);
      setError(null);
      setNusukWaMsg(null);

      // إذا لم يكن قد تم الحفظ بعد، نحفظ أولاً
      if (!nusukSaved) {
        await api.requests.safaComplete(
          requestId,
          nusukInput.trim(),
          nusukNote.trim() || undefined,
          nusukGroupName.trim()
        );
        if (request) {
          request.groupName = nusukGroupName.trim();
          request.nusukGroupNumber = nusukInput.trim();
          request.status = "ReadyForSaudiAgent";
        }
        setNusukSaved(true);
        await loadRequest(false);
      }

      // إرسال الحزمة لمجموعة الواتساب
      const ticketDoc =
        (request?.flightTicketDocumentId
          ? request?.groupDocuments?.find((d) => d.id === request.flightTicketDocumentId)
          : undefined) ||
        request?.flightTicketDocument ||
        request?.groupDocuments?.filter((d) => d.documentType === "FlightTicket").slice(-1)[0] ||
        request?.travelers?.[0]?.documents?.find((d) => d.documentType === "FlightTicket");

      const hostDoc =
        (request?.hostingInfo?.hostIdDocumentId
          ? request?.groupDocuments?.find((d) => d.id === request.hostingInfo.hostIdDocumentId)
          : undefined) ||
        request?.hostingInfo?.hostIdDocument ||
        request?.groupDocuments?.filter((d) => d.documentType === "HostId").slice(-1)[0];

      await sendWhatsAppGroupPackage({
        nusukNumber: nusukInput.trim(),
        hasHosting: Boolean(request?.hasHosting),
        hostPhone: request?.hostingInfo?.hostPhone || request?.contactPhone,
        contactPhone: request?.contactPhone,
        ticketDocId: ticketDoc?.id,
        hostDocId: hostDoc?.id,
      });

      setNusukWaMsg("تم إرسال حزمة المعاملة لمجموعة الواتساب بنجاح 📲🕋");
      await loadRequest(false);
    } catch (waErr: unknown) {
      console.warn("WhatsApp group auto-send error:", waErr);
      await alert({
        title: "تنبيه في إرسال الواتساب",
        message: (waErr instanceof Error ? waErr.message : "تعذر إرسال الحزمة لمجموعة الواتساب تلقائياً."),
        variant: "warning",
      });
    } finally {
      setNusukSendingWa(false);
    }
  };

  const handleCompleteSafa = handleSendNusukWhatsApp;

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
      setSuccess("تمت إحالة المجموعة بنجاح للوكيل السعودي وتم تفعيل زر إرسال حزمة الواتساب 📲 بنجاح.");
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

  const cleanNusuk = request.nusukGroupNumber?.trim();
  const hasNusukGroupNumber = Boolean(
    cleanNusuk &&
    cleanNusuk !== "" &&
    cleanNusuk !== "-" &&
    cleanNusuk !== "لم يُسجل بعد" &&
    cleanNusuk !== "لم يسجل بعد" &&
    cleanNusuk.toLowerCase() !== "null" &&
    cleanNusuk.toLowerCase() !== "undefined"
  );

  const canSenderEditWithoutNusuk =
    role === "Sender" &&
    !hasNusukGroupNumber &&
    request.status !== "Cancelled" &&
    request.status !== "Archived";

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
    role === "Admin" ||
    canSenderEditWithoutNusuk ||
    (role === "Sender" &&
      (request.status === "Draft" ||
        request.status === "CorrectionRequired" ||
        request.status === "MissingDocuments" ||
        hasItemsNeedingCorrection));

  const canEditAnyData =
    role === "Admin" ||
    canSenderEditWithoutNusuk ||
    canEditDocs ||
    hasItemsNeedingCorrection;

  const canAddTraveler =
    role === "Admin" ||
    (role === "Sender" &&
      request.status !== "Cancelled" &&
      request.status !== "Archived") ||
    canEditAnyData;

  const isAdmin = role === "Admin";
  const isSafaEmployee = role === "SafaEmployee";
  const isSaudiAgent = role === "SaudiAgent";
  const isSender = role === "Sender";

  const isSafaReviewer = role === "SafaEmployee" || role === "Admin";
  const isAgent = role === "SaudiAgent" || role === "Admin";
  const canEditTraveler =
    role === "Admin" ||
    canSenderEditWithoutNusuk ||
    canEditAnyData ||
    role === "SafaEmployee" ||
    role === "SaudiAgent";

  const hostDoc =
    (request.hostingInfo?.hostIdDocumentId
      ? request.groupDocuments?.find((d) => d.id === request.hostingInfo.hostIdDocumentId)
      : undefined) ||
    request.hostingInfo?.hostIdDocument ||
    request.groupDocuments?.filter((d) => d.documentType === "HostId").slice(-1)[0];
  const ticketDoc =
    (request.flightTicketDocumentId
      ? request.groupDocuments?.find((d) => d.id === request.flightTicketDocumentId)
      : undefined) ||
    request.flightTicketDocument ||
    request.groupDocuments?.filter((d) => d.documentType === "FlightTicket").slice(-1)[0];

  let totalDocsCount = (hostDoc ? 1 : 0) + (ticketDoc ? 1 : 0);
  request.travelers?.forEach((t) => {
    if (t.documents?.some((d) => d.documentType === "Passport")) totalDocsCount++;
    if (t.documents?.some((d) => d.documentType === "PersonalPhoto")) totalDocsCount++;
  });

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

  const hasHostingReq = request?.hasHosting === false
    ? false
    : Boolean(
        request?.hasHosting ||
        request?.hostingInfo?.hostName ||
        request?.hostingInfo?.hostPhone ||
        request?.hostName ||
        request?.hostNationalId ||
        request?.hostIdDocumentId ||
        request?.hostIdDocumentUrl
      );

  const handleLinkProgram = async () => {
    if (!isSaudiAgent && !isAdmin) return;
    try {
      setActionLoading(true);
      if (hasHostingReq) {
        await api.requests.requestHostingAcceptance(
          requestId,
          "تم ربط البرنامج وتحويل المعاملة للمرسل لقبول الاستضافة"
        );
        setSuccess("تم ربط البرنامج بنجاح وإحالة المعاملة للمُرسل لقبول الاستضافة ✓");
      } else {
        await api.requests.linkProgram(requestId, "تم ربط البرنامج بنجاح");
        setSuccess("تم ربط البرنامج بنجاح، المعاملة جاهزة لدفع الفاتورة ✓");
      }
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء ربط البرنامج.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptHosting = async () => {
    if (!isAdmin && (!isSender || !isOwnerSender)) return;
    try {
      setActionLoading(true);
      await api.requests.acceptHosting(
        requestId,
        isAdmin
          ? "تم قبول وتمرير الاستضافة بواسطة إدارة النظام"
          : "تم قبول طلب الاستضافة من قِبل المُرسل"
      );
      setSuccess("تم قبول الاستضافة بنجاح وإعادة المعاملة للوكيل السعودي لدفع الفاتورة ✓");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء قبول الاستضافة.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!isSaudiAgent && !isAdmin) return;
    try {
      setActionLoading(true);
      await api.requests.agentComplete(
        requestId,
        "تم دفع الفاتورة وإنجاز كافة متطلبات المعاملة بنجاح"
      );
      setSuccess("تم تأكيد دفع الفاتورة واكتمال المعاملة بنجاح (تم) ✓");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء تأكيد دفع الفاتورة.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertInvoicePayment = async () => {
    if (!isAdmin || !request) return;
    try {
      setActionLoading(true);
      const targetStatus = hasHostingReq ? "HostingAcceptedBySender" : "ProgramLinked";
      await api.requests.transition(
        requestId,
        targetStatus,
        "تم التراجع عن دفع الفاتورة بواسطة إدارة النظام وإعادتها لمرحلة الدفع"
      );
      setSuccess("تم التراجع عن دفع الفاتورة وإعادة المعاملة لانتظار الدفع ✓");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء التراجع عن دفع الفاتورة.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertHostingAcceptance = async () => {
    if (!isAdmin || !request) return;
    try {
      setActionLoading(true);
      await api.requests.transition(
        requestId,
        "HostingAcceptanceRequested",
        "تم التراجع عن قبول الاستضافة بواسطة إدارة النظام وإعادتها لانتظار قبول الاستضافة"
      );
      setSuccess("تم التراجع عن قبول الاستضافة وإعادة المعاملة لانتظار قبول الاستضافة ✓");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء التراجع عن قبول الاستضافة.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertProgramLink = async () => {
    if (!isAdmin || !request) return;
    try {
      setActionLoading(true);
      await api.requests.transition(
        requestId,
        "ReadyForSaudiAgent",
        "تم التراجع عن ربط البرنامج بواسطة إدارة النظام وإعادتها لانتظار ربط البرنامج"
      );
      setSuccess("تم التراجع عن ربط البرنامج وإعادة المعاملة لانتظار ربط البرنامج للوكيل السعودي ✓");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء التراجع عن ربط البرنامج.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Top Breadcrumb & Status Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4 max-w-full overflow-hidden">
        {/* Row 1: Breadcrumb + Group Name + Edit button on Right, Status Badge on Left */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors cursor-pointer"
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
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight break-words">
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
                    setEditNusukGroupNumber(request.nusukGroupNumber || "");
                    setEditSenderCode(request.senderCode || "");
                    setShowEditGeneralModal(true);
                  }}
                  className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="تعديل بيانات المعاملة (الاسم، الهاتف، الملاحظات، رقم نسك، الكود)"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل المعاملة</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Badge in its own dedicated corner */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {request.status === "Completed" || request.status === "Archived" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>(تم)</span>
              </span>
            ) : isSaudiAgent ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs">
                <Check className="w-3.5 h-3.5 text-sky-600" />
                <span>تم الاستلام</span>
              </span>
            ) : (
              <RequestStatusBadge status={request.status} />
            )}
          </div>
        </div>

        {/* Row 2: Metadata / Quick info */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-150">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-bold text-gray-700">{request.travelers.length} مسافرين</span>
          </span>
          {request.travelDate && (
            <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-150">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700 font-medium">
                {new Date(request.travelDate).toLocaleDateString("ar-SA")}
              </span>
            </span>
          )}
          {request.nusukGroupNumber && (
            <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <span>رقم نسك:</span>
              <span className="font-mono">{request.nusukGroupNumber}</span>
            </span>
          )}
          {request.senderCode && (
            <span className="bg-sky-50 text-sky-800 font-bold px-2.5 py-1 rounded-lg border border-sky-200 flex items-center gap-1">
              <span>كود المرسل:</span>
              <span className="font-mono">{request.senderCode}</span>
            </span>
          )}
        </div>

        {/* Row 3: Action Toolbar - Full width, wraps smoothly without overflow */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 w-full">
          {/* Sender & Admin Actions: تقديم الطلب للاعتماد */}
          {(role === "Sender" || role === "Admin") && request.status === "Draft" && (
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



          {isSafaReviewer &&
            (request.status === "Submitted" ||
              request.status === "UnderReview" ||
              request.status === "DocumentsCompleted" ||
              request.status === "SafaRegistrationCompleted") && (
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  const dep = request.departureDate || request.travelDate;
                  const ret = request.returnDate;
                  const senderCode = request.senderCode || resolveSenderCode(user);
                  const suggested = formatOfficialGroupName(senderCode, dep, ret);
                  const currentIsGeneric = !request.groupName || request.groupName.startsWith("مجموعة ") || request.groupName.startsWith("طلب جديد");
                  setNusukGroupName(currentIsGeneric && suggested ? suggested : (request.groupName || suggested || ""));
                  setNusukInput(request.nusukGroupNumber || "");
                  setNusukSaved(false);
                  setNusukSuccessMsg(null);
                  setNusukWaMsg(null);
                  setShowNusukModal(true);
                }}
                disabled={actionLoading}
                title="اعتماد رقم نسك وتحويل المعاملة فوراً للوكيل السعودي"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Building className="w-3.5 h-3.5" />
                <span>
                  {request.nusukGroupNumber
                    ? "تعديل رقم نسك وتحويل للوكيل السعودي"
                    : "اعتماد رقم نسك وتحويل للوكيل السعودي"}
                </span>
              </button>
            )}

          {isSafaReviewer && request.status === "ReadyForSaudiAgent" && (
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                setNusukGroupName(request.groupName || "");
                setNusukInput(request.nusukGroupNumber || "");
                setNusukSaved(false);
                setNusukSuccessMsg(null);
                setNusukWaMsg(null);
                setShowNusukModal(true);
              }}
              disabled={actionLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="تعديل رقم مجموعة نسك"
            >
              <Building className="w-3.5 h-3.5" />
              <span>تعديل رقم نسك</span>
            </button>
          )}

          {/* Workflow Action 1: تم ربط البرنامج (الوكيل السعودي أو الآدمن فقط) */}
          {(isSaudiAgent || isAdmin) &&
            (request.status === "ReadyForSaudiAgent" || request.status === "ReceivedBySaudiAgent") && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkProgram();
                }}
                disabled={actionLoading}
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs sm:text-sm font-black px-5 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                title="تأكيد ربط البرنامج"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>تم ربط البرنامج</span>
              </button>
            )}

          {/* Workflow Action 2: تم قبول الاستضافة (المرسل صاحب الطلب أو الآدمن فقط) */}
          {((isSender && isOwnerSender) || isAdmin) &&
            (request.status === "HostingAcceptanceRequested" ||
              (hasHostingReq && request.status === "ProgramLinked")) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAcceptHosting();
                  }}
                  disabled={actionLoading}
                  className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs sm:text-sm font-black px-5 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 animate-pulse"
                  title="تأكيد قبول الاستضافة"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تم قبول الاستضافة</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRevertProgramLink();
                    }}
                    disabled={actionLoading}
                    className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار ربط البرنامج"
                  >
                    <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                    <span>تراجع عن ربط البرنامج</span>
                  </button>
                )}
              </div>
            )}

          {/* Workflow Action 3: تم دفع الفاتورة (الوكيل السعودي أو الآدمن فقط) */}
          {(isSaudiAgent || isAdmin) &&
            (request.status === "HostingAcceptedBySender" ||
              request.status === "HostingConfirmed" ||
              (!hasHostingReq && request.status === "ProgramLinked")) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePayInvoice();
                  }}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black px-5 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  title="تأكيد دفع الفاتورة واكتمال المعاملة"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تم دفع الفاتورة</span>
                </button>
                {isAdmin && (
                  hasHostingReq ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRevertHostingAcceptance();
                      }}
                      disabled={actionLoading}
                      className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      title="تراجع عن قبول الاستضافة وإعادة المعاملة لانتظار قبول الاستضافة"
                    >
                      <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                      <span>تراجع عن قبول الاستضافة</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRevertProgramLink();
                      }}
                      disabled={actionLoading}
                      className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار ربط البرنامج"
                    >
                      <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                      <span>تراجع عن ربط البرنامج</span>
                    </button>
                  )
                )}
              </div>
            )}

          {/* شارات الانتظار للطرف المقابل: */}
          {/* للمرسل أثناء تواجد المعاملة لدى الوكيل السعودي */}
          {isSender &&
            (request.status === "ReadyForSaudiAgent" ||
              request.status === "ReceivedBySaudiAgent" ||
              (!hasHostingReq && request.status === "ProgramLinked") ||
              request.status === "HostingAcceptedBySender") && (
              <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                <span>قيد المعالجة لدى الوكيل السعودي ⏳</span>
              </div>
            )}

          {/* للوكيل أثناء انتظار قبول الاستضافة من المرسل */}
          {isSaudiAgent &&
            (request.status === "HostingAcceptanceRequested" ||
              (hasHostingReq && request.status === "ProgramLinked")) && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>بانتظار قبول الاستضافة من قِبل المُرسل ⏳</span>
            </div>
          )}

          {/* اكتمال المعاملة */}
          {request.status === "Completed" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span>تم دفع الفاتورة واكتمال المعاملة (تم) ✓</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRevertInvoicePayment();
                  }}
                  disabled={actionLoading}
                  className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="تراجع عن دفع الفاتورة وإعادة المعاملة لانتظار الدفع"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                  <span>تراجع عن دفع الفاتورة</span>
                </button>
              )}
              {(isSaudiAgent || isAdmin) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAgentArchive();
                  }}
                  disabled={actionLoading}
                  className="bg-stone-600 hover:bg-stone-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="نقل المعاملة إلى الأرشيف"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>أرشفة</span>
                </button>
              )}
            </div>
          )}

          {/* أرشفة المعاملة */}
          {request.status === "Archived" && (
            <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-xs font-black shadow-xs">
              <Archive className="w-4 h-4 text-purple-600" />
              <span>المعاملة في الأرشيف (تم) ✓</span>
            </div>
          )}

          {/* Admin Management Actions: Archive & Delete */}
          {role === "Admin" && (
            <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

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

                  {(role === "Sender" || role === "Admin") && (
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
      {!isAdmin && isSaudiAgent ? (
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
          onLinkProgram={handleLinkProgram}
          onPayInvoice={handlePayInvoice}
          actionLoading={actionLoading}
        />
      ) : !isAdmin && isSafaEmployee ? (
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
          {/* 1. بيانات ومستندات المستضيف (المستضيف ببياناته) */}
          {request.hasHosting ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3 space-y-2.5">
            {/* عنوان الاستضافة بالأعلى */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    بيانات الاستضافة المشتركة للمجموعة
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    بيانات ومستند المستضيف المعتمدة لكافة مسافري المعاملة
                  </p>
                </div>
              </div>
            </div>

            {/* الأزرار والشارات تحت العنوان مباشرة دون أي تداخل أو خروج عن الإطار */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* زر قبول الاستضافة للمرسل والآدمن داخل كارت الاستضافة مباشرة */}
              {((isSender && isOwnerSender) || isAdmin) && request.status === "HostingAcceptanceRequested" && (
                <button
                  type="button"
                  onClick={handleAcceptHosting}
                  disabled={actionLoading}
                  className="text-xs bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 animate-pulse"
                  title="تأكيد قبول الاستضافة"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>تم قبول الاستضافة</span>
                </button>
              )}

              {/* زر التراجع عن ربط البرنامج للآدمن داخل كارت الاستضافة */}
              {isAdmin && request.status === "HostingAcceptanceRequested" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRevertProgramLink();
                  }}
                  disabled={actionLoading}
                  className="text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="تراجع عن ربط البرنامج وإعادة المعاملة لانتظار ربط البرنامج"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>تراجع عن ربط البرنامج</span>
                </button>
              )}

              {/* زر التراجع عن قبول الاستضافة للآدمن داخل كارت الاستضافة */}
              {isAdmin && (request.status === "HostingAcceptedBySender" || request.status === "HostingConfirmed") && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRevertHostingAcceptance();
                  }}
                  disabled={actionLoading}
                  className="text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="تراجع عن قبول الاستضافة وإعادة المعاملة لانتظار قبول الاستضافة"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>تراجع عن قبول الاستضافة</span>
                </button>
              )}

              <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>مشتركة لجميع المسافرين</span>
              </span>

              {canEditAnyData && (
                <>
                  <button
                    type="button"
                    onClick={openHostModal}
                    className="text-xs text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="تعديل بيانات ومستند المستضيف"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>تعديل بيانات ومستند المستضيف</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: "تحويل المعاملة إلى سفر عادي (بدون مستضيف)",
                        message: "هل أنت متأكد من إلغاء الاستضافة وتحويل المعاملة إلى سفر عادي بدون مستضيف؟",
                        variant: "danger",
                        confirmText: "نعم، تحويل لعادي",
                        cancelText: "تراجع",
                      });
                      if (confirmed) {
                        try {
                          setActionLoading(true);
                          await api.requests.update(requestId, {
                            hasHosting: false,
                            hostName: "",
                            hostPhone: "",
                            hostNationalId: "",
                            hostBirthDate: "",
                            hostNationality: "",
                            hostAddress: "",
                          });
                          setSuccess("تم تحويل المعاملة إلى سفر عادي بدون مستضيف بنجاح.");
                          await loadRequest(false);
                        } catch (err: unknown) {
                          if (err instanceof Error) setError(err.message);
                        } finally {
                          setActionLoading(false);
                        }
                      }
                    }}
                    className="text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="تحويل لسفر عادي بدون مستضيف"
                  >
                    <UserMinus className="w-3.5 h-3.5 text-rose-600" />
                    <span>إلغاء الاستضافة (تحويل لعادي)</span>
                  </button>
                </>
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
                (request.hostingInfo?.hostIdDocumentId
                  ? request.groupDocuments?.find((d) => d.id === request.hostingInfo.hostIdDocumentId)
                  : undefined) ||
                request.hostingInfo?.hostIdDocument ||
                request.groupDocuments?.filter((d) => d.documentType === "HostId").slice(-1)[0];

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
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-3">
                      {/* السطر الأول: بيانات الملف بوضوح وشارة الحالة */}
                      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-700 shrink-0">الملف:</span>
                              <span className="font-semibold text-gray-900 break-all text-xs" dir="ltr">
                                {hostDoc.originalFileName}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {(hostDoc.fileSize / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {hostDoc.reviewStatus === "NeedsCorrection" ? (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                              مطلوب تعديل
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                              تم الرفع ✓
                            </span>
                          )}
                        </div>
                      </div>

                      {/* السطر الثاني: أزرار العمليات */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-gray-200/70">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setPreviewDoc(hostDoc);
                            }}
                            className="p-1.5 text-gray-700 bg-white hover:text-sky-600 hover:bg-sky-50 border border-gray-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
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
                            className="p-1.5 text-emerald-700 bg-white hover:bg-emerald-50 border border-gray-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="تنزيل هوية المستضيف"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isScanningHostIdDoc}
                            onClick={(e) => {
                              e.preventDefault();
                              handleScanExistingHostId(hostDoc);
                            }}
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                            title="فحص واستخراج بيانات هوية المستضيف تلقائياً (مسح ذكي بالذكاء الاصطناعي)"
                          >
                            {isScanningHostIdDoc ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            ) : (
                              <ScanText className="w-4 h-4" />
                            )}
                          </button>

                          {canEditAnyData && (
                            <label
                              className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="استبدال / رفع هوية المستضيف مجدداً"
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

                          {canEditAnyData && role !== "Sender" && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                const confirmed = await confirm({
                                  title: "تأكيد حذف المستند",
                                  message: "هل أنت متأكد من رغبتك في حذف هوية المستضيف نهائياً من المعاملة؟",
                                  variant: "danger",
                                  confirmText: "نعم، حذف",
                                  cancelText: "إلغاء",
                                });
                                if (confirmed) {
                                  try {
                                    setActionLoading(true);
                                    await api.documents.delete(hostDoc.id);
                                    setSuccess("تم حذف مستند هوية المستضيف بنجاح.");
                                    await loadRequest(false);
                                  } catch (err: unknown) {
                                    if (err instanceof Error) setError(err.message);
                                  } finally {
                                    setActionLoading(false);
                                  }
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 bg-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="حذف المستند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-800">بيانات الاستضافة</div>
              <div className="text-xs text-gray-500">معاملة سفر عادي (بدون مستضيف)</div>
            </div>
          </div>
          {canEditAnyData && (
            <button
              type="button"
              onClick={openHostModal}
              className="text-xs text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>إضافة مستضيف للمعاملة</span>
            </button>
          )}
        </div>
      )}

      {/* 2. بيانات وتذكرة الطيران (تحتيها التذكرة ببياناتها) */}
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
            {(canEditAnyData || isSafaReviewer) && (
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
              (request.flightTicketDocumentId
                ? request.groupDocuments?.find((d) => d.id === request.flightTicketDocumentId)
                : undefined) ||
              request.flightTicketDocument ||
              request.groupDocuments?.filter((d) => d.documentType === "FlightTicket").slice(-1)[0];

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
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-3">
                    {/* السطر الأول: بيانات الملف بوضوح وشارة الحالة */}
                    <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-700 shrink-0">الملف:</span>
                            <span className="font-semibold text-gray-900 break-all text-xs" dir="ltr">
                              {ticketDoc.originalFileName}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {(ticketDoc.fileSize / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {ticketDoc.reviewStatus === "NeedsCorrection" ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                            مطلوب تعديل
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                            تم الرفع ✓
                          </span>
                        )}
                      </div>
                    </div>

                    {/* السطر الثاني: أزرار العمليات */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-gray-200/70">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPreviewDoc(ticketDoc);
                          }}
                          className="p-1.5 text-gray-700 bg-white hover:text-sky-600 hover:bg-sky-50 border border-gray-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
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
                          className="p-1.5 text-emerald-700 bg-white hover:bg-emerald-50 border border-gray-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="تنزيل تذكرة الطيران"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isScanningFlightTicketDoc}
                          onClick={(e) => {
                            e.preventDefault();
                            handleScanExistingFlightTicket(ticketDoc);
                          }}
                          className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                          title="فحص واستخراج بيانات تذكرة الطيران بالذكاء الاصطناعي (Google Gemini)"
                        >
                          {isScanningFlightTicketDoc ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                          )}
                        </button>

                        {canEditAnyData && (
                          <label
                            className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="استبدال / رفع تذكرة الطيران مجدداً"
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

                        {canEditAnyData && role !== "Sender" && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              const confirmed = await confirm({
                                title: "تأكيد حذف المستند",
                                message: "هل أنت متأكد من رغبتك في حذف تذكرة الطيران نهائياً من المعاملة؟",
                                variant: "danger",
                                confirmText: "نعم، حذف",
                                cancelText: "إلغاء",
                              });
                              if (confirmed) {
                                try {
                                  setActionLoading(true);
                                  await api.documents.delete(ticketDoc.id);
                                  setSuccess("تم حذف تذكرة الطيران بنجاح.");
                                  await loadRequest(false);
                                } catch (err: unknown) {
                                  if (err instanceof Error) setError(err.message);
                                } finally {
                                  setActionLoading(false);
                                }
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 bg-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="حذف المستند"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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

      {/* 3. بيانات ووثائق المسافرين (تحتيها المسافرين ببياناتهم) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>بيانات ووثائق المسافرين ({request.travelers.length})</span>
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {canAddTraveler && (
              <button
                type="button"
                onClick={() => {
                  resetAddTravelerForm();
                  setShowAddTravelerModal(true);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مسافر للمجموعة +</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBulkCheckVisas}
              disabled={isBulkCheckingVisas || request.travelers.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="فحص وتنزيل التأشيرات الصادرة لكافة مسافري المعاملة من منصة وزارة الخارجية"
            >
              {isBulkCheckingVisas ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>فحص وتنزيل تأشيرات المجموعة (MOFA) 🇸🇦</span>
            </button>

            {(request.status === "Completed" || request.status === "Archived") && (
              <button
                type="button"
                onClick={handlePrintAllVisas}
                disabled={isPrintingAllVisas || request.travelers.length === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="طباعة كافة تأشيرات المسافرين الصادرة في هذه المعاملة في ملف واحد (صفحة لكل تأشيرة)"
              >
                {isPrintingAllVisas ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>طباعة كافة التأشيرات في ملف واحد 🖨️</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadAllDocs}
              disabled={isDownloadingAll || totalDocsCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              {isDownloadingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>تحميل كافة المستندات ({totalDocsCount}) ZIP</span>
            </button>
          </div>
        </div>

        {visaProgressMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2 animate-pulse shadow-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
            <span className="font-semibold">{visaProgressMsg}</span>
          </div>
        )}

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

                    <input
                      type="text"
                      value={editTravelerAffiliation}
                      onChange={(e) => setEditTravelerAffiliation(e.target.value)}
                      placeholder="التبعية / المندوب"
                      className="text-xs px-2.5 py-1.5 border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold text-purple-900 bg-purple-50/40 w-36"
                    />

                    <input
                      type="text"
                      value={editTravelerNotes}
                      onChange={(e) => setEditTravelerNotes(e.target.value)}
                      placeholder="ملاحظات المسافر"
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white w-36"
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
                            editTravelerExpiryDate,
                            editTravelerAffiliation,
                            editTravelerNotes
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
                            setEditTravelerAffiliation(traveler.affiliation || "");
                            setEditTravelerNotes(traveler.notes || "");
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
                      {traveler.affiliation && (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                          <span>التبعية:</span>
                          <span className="font-black text-purple-950">{traveler.affiliation}</span>
                        </span>
                      )}
                      {traveler.notes && (
                        <span className="text-[11px] text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                          ملاحظة: {traveler.notes}
                        </span>
                      )}
                      {traveler.visaNumber ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                          <span>تأشيرة صادرة: {traveler.visaNumber} 🇸🇦</span>
                        </span>
                      ) : traveler.visaStatus === "UnderProcessing" ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-medium px-2 py-0.5 rounded">
                          <span>التأشيرة: قيد الإجراء ⏳</span>
                        </span>
                      ) : null}
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

              <div className="flex items-center gap-2 flex-wrap">
                {/* MOFA Visa Check Button */}
                {traveler.passportNumber && (
                  <button
                    type="button"
                    disabled={isCheckingVisaTravelerId === traveler.id}
                    onClick={() => handleCheckSingleVisa(traveler)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                    title="فحص التأشيرة الصادرة وتنزيلها تلقائياً من منصة وزارة الخارجية"
                  >
                    {isCheckingVisaTravelerId === traveler.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isCheckingVisaTravelerId === traveler.id
                        ? "جاري فحص وتنزيل التأشيرة..."
                        : "فحص وتنزيل التأشيرة 🇸🇦"}
                    </span>
                  </button>
                )}

                {/* Official Visa Actions: Preview & Print */}
                {(traveler.visaNumber || traveler.documents?.some((d) => d.documentType === "Visa")) && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePreviewVisa(traveler)}
                      className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      title="معاينة التأشيرة الرسمية (HTML)"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                      <span>معاينة التأشيرة 👁️</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintVisa(traveler)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      title="طباعة التأشيرة الرسمية مباشرة (أمر طباعة / حفظ بتنسيق PDF)"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-600" />
                      <span>طباعة التأشيرة 🖨️</span>
                    </button>
                  </div>
                )}

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

                {canEditAnyData && role !== "Sender" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTraveler(traveler.id, traveler.fullName)}
                    disabled={actionLoading}
                    className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="حذف المسافر من المعاملة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">حذف المسافر</span>
                  </button>
                )}
              </div>
            </div>

            {/* Traveler Documents Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {(["Passport", "PersonalPhoto", "Visa"] as DocumentType[]).map(
                (docType) => {
                  const doc = traveler.documents?.find(
                    (d) => d.documentType === docType
                  );

                  return (
                    <FileDropArea
                      key={docType}
                      disabled={!canEditAnyData}
                      onFileDrop={(file) => handleFileUpload(file, docType, traveler.id)}
                      accept={docType === "PersonalPhoto" ? ".jpg,.jpeg,.png" : ".pdf,.html,.htm,.jpg,.jpeg,.png"}
                      maxSizeMb={10}
                      activeBorderColor={docType === "Passport" ? "blue" : docType === "PersonalPhoto" ? "purple" : "emerald"}
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
                            doc.reviewStatus === "NeedsCorrection" ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                                مطلوب تعديل
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                                تم الرفع ✓
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">
                              {docType === "Visa" ? "لم تصدر بعد" : "غير مرفوع"}
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

                              {doc.documentType === "Visa" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePrintVisa(traveler);
                                  }}
                                  className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                  title="طباعة التأشيرة الرسمية (PDF)"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              )}

                              {canEditAnyData && (
                                <label
                                  className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  title="استبدال / رفع مستند مصحح (أو اسحب الملف هنا)"
                                >
                                  <UploadCloud className="w-4 h-4" />
                                  <input
                                    type="file"
                                    accept={docType === "PersonalPhoto" ? ".jpg,.jpeg,.png" : ".pdf,.html,.htm,.jpg,.jpeg,.png"}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(file, docType, traveler.id);
                                    }}
                                  />
                                </label>
                              )}


                              {canEditAnyData && role !== "Sender" && (
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
                                  accept={docType === "PersonalPhoto" ? ".jpg,.jpeg,.png" : ".pdf,.html,.htm,.jpg,.jpeg,.png"}
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, docType, traveler.id);
                                  }}
                                />
                              </label>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {docType === "Visa" ? "لم تصدر بعد" : "لم يُرفع"}
                              </span>
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
                  <button
                    type="button"
                    onClick={() => {
                      if (previewDocHtml) {
                        printHtmlViaIframe(previewDocHtml);
                        return;
                      }
                      if (previewDoc.documentType === "Visa") {
                        const trv = request?.travelers.find(
                          (t) =>
                            t.documents?.some((d) => d.id === previewDoc.id) ||
                            t.id === previewDoc.travelerId
                        );
                        if (trv) {
                          handlePrintVisa(trv);
                          return;
                        }
                      }
                      printPdfDocumentUrl(previewDocUrl);
                    }}
                    className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="أمر طباعة المستند (Print / Save as PDF)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
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
                previewDoc.mimeType === "application/pdf" ||
                previewDoc.originalFileName?.toLowerCase().endsWith(".pdf") ||
                previewDocUrl.toLowerCase().includes(".pdf") ||
                previewDoc.documentType === "Visa" ||
                previewDoc.mimeType?.includes("html") ||
                previewDoc.originalFileName?.toLowerCase().endsWith(".html") ||
                previewDoc.originalFileName?.toLowerCase().endsWith(".htm") ? (
                  <iframe
                    src={previewDocUrl}
                    className="w-full h-full rounded-lg border-0 bg-white"
                    title="Document Preview"
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

      {/* --- MODAL: MOFA Visa Captcha Verification --- */}
      {mofaModalData && mofaModalData.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  🇸🇦
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                    رمز التحقق لمنصة التأشيرات
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    وزارة الخارجية السعودية (MOFA)
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={mofaModalData.loading}
                onClick={() => setMofaModalData(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Traveler info & search parameters preview */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1.5">
                <span className="font-bold text-gray-900 truncate">
                  {mofaModalData.traveler.fullName}
                </span>
                <span className="text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-semibold shrink-0">
                  معايير البحث
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    الاسم الأول (fName):
                  </label>
                  <input
                    type="text"
                    disabled={mofaModalData.loading}
                    value={mofaModalData.searchFirstName}
                    onChange={(e) =>
                      setMofaModalData((prev) => (prev ? { ...prev, searchFirstName: e.target.value } : null))
                    }
                    className="w-full bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 outline-hidden transition-all"
                    placeholder="ابراهيم أو IBRAHIM"
                    title="الاسم الأول كما هو مسجل في التأشيرة (جرب بالإنجليزية أو بالعربية مع/بدون همزة)"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    جرب بالإنجليزية إذا لم تظهر
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    رقم الجواز:
                  </label>
                  <input
                    type="text"
                    disabled={mofaModalData.loading}
                    value={mofaModalData.searchPassportNo}
                    onChange={(e) =>
                      setMofaModalData((prev) =>
                        prev ? { ...prev, searchPassportNo: e.target.value.toUpperCase() } : null
                      )
                    }
                    className="w-full bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-gray-900 outline-hidden transition-all"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    كالمكتوب في الجواز
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  الجنسية:
                </label>
                <select
                  disabled={mofaModalData.loading}
                  value={mofaModalData.searchNationality}
                  onChange={(e) =>
                    setMofaModalData((prev) => (prev ? { ...prev, searchNationality: e.target.value } : null))
                  }
                  className="w-full bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 outline-hidden transition-all"
                >
                  <option value="EGY">مصر (EGY)</option>
                  <option value="SAU">السعودية (SAU)</option>
                  <option value="JOR">الأردن (JOR)</option>
                  <option value="SDN">السودان (SDN)</option>
                  <option value="YEM">اليمن (YEM)</option>
                  <option value="SYR">سوريا (SYR)</option>
                  <option value="IRQ">العراق (IRQ)</option>
                  <option value="TUN">تونس (TUN)</option>
                  <option value="MAR">المغرب (MAR)</option>
                  <option value="DZA">الجزائر (DZA)</option>
                  <option value="LBN">لبنان (LBN)</option>
                  <option value="KWT">الكويت (KWT)</option>
                  <option value="ARE">الإمارات (ARE)</option>
                  <option value="OMN">عُمان (OMN)</option>
                  <option value="QAT">قطر (QAT)</option>
                  <option value="BHR">البحرين (BHR)</option>
                  <option value="PAK">باكستان (PAK)</option>
                  <option value="IND">الهند (IND)</option>
                  <option value="BGD">بنغلاديش (BGD)</option>
                  <option value="IDN">إندونيسيا (IDN)</option>
                  <option value="TUR">تركيا (TUR)</option>
                </select>
              </div>
            </div>

            {/* Captcha Image and refresh button */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                رمز الصورة (Captcha):
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-2 flex items-center justify-center min-h-[58px]">
                  {mofaModalData.refreshingCaptcha ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>جاري تحديث الرمز...</span>
                    </div>
                  ) : mofaModalData.captchaImage ? (
                    <img
                      src={mofaModalData.captchaImage}
                      alt="MOFA Captcha"
                      className="h-10 object-contain rounded select-none pointer-events-none"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">لا توجد صورة</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={mofaModalData.refreshingCaptcha || mofaModalData.loading}
                  onClick={handleRefreshModalCaptcha}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                  title="تحديث رمز الصورة برمز جديد"
                >
                  <RotateCcw className={`w-4 h-4 ${mofaModalData.refreshingCaptcha ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">تحديث الرمز</span>
                </button>
              </div>
            </div>

            {/* Captcha Input */}
            <div className="space-y-1.5">
              <input
                type="text"
                autoFocus
                maxLength={6}
                disabled={mofaModalData.loading}
                value={mofaModalData.userCaptcha}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setMofaModalData((prev) => (prev ? { ...prev, userCaptcha: val, error: null } : null));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmModalCaptcha();
                  }
                }}
                placeholder="123456"
                className="w-full text-center font-mono text-2xl tracking-[0.35em] font-bold border-2 border-emerald-500 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 rounded-xl py-2.5 outline-hidden transition-all placeholder:text-sm placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400"
              />
              <span className="text-[11px] text-gray-500 block text-center">
                أدخل الأرقام الـ 6 الظاهرة في الصورة ثم اضغط Enter أو زر البحث
              </span>
            </div>

            {/* Error banner if any */}
            {mofaModalData.error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{mofaModalData.error}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={mofaModalData.loading}
                onClick={() => setMofaModalData(null)}
                className="flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={mofaModalData.loading || mofaModalData.userCaptcha.trim().length !== 6}
                onClick={handleConfirmModalCaptcha}
                className="flex-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                {mofaModalData.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الاستعلام وتنزيل التأشيرة...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>استعلام وتنزيل التأشيرة 🇸🇦</span>
                  </>
                )}
              </button>
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

      {/* --- MODAL 3: Enter Nusuk Number & Transfer to Saudi Agent --- */}
      {showNusukModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <span>اعتماد رقم نسك وتحويل للوكيل السعودي</span>
              </h3>
              <button
                onClick={() => setShowNusukModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              أدخل رقم مجموعة نسك المعتمد لتثبيته، ثم يمكنك حفظه أو إرسال الحزمة فوراً لمجموعة الواتساب 📲.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                رقم مجموعة نسك *
              </label>
              <input
                type="text"
                value={nusukInput}
                onChange={(e) => {
                  setNusukInput(e.target.value);
                  setNusukSaved(false);
                  setNusukSuccessMsg(null);
                  setNusukWaMsg(null);
                }}
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
                        onClick={() => {
                          setNusukGroupName(suggestedName);
                          setNusukSaved(false);
                          setNusukSuccessMsg(null);
                          setNusukWaMsg(null);
                        }}
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
                onChange={(e) => {
                  setNusukGroupName(e.target.value);
                  setNusukSaved(false);
                  setNusukSuccessMsg(null);
                  setNusukWaMsg(null);
                }}
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

            {nusukSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{nusukSuccessMsg}</span>
              </div>
            )}

            {nusukWaMsg && (
              <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-600 shrink-0" />
                <span>{nusukWaMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowNusukModal(false)}
                disabled={nusukSaving || nusukSendingWa}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
              >
                {nusukSaved ? "إغلاق النافذة" : "إلغاء"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNusukOnly}
                  disabled={nusukSaving || nusukSendingWa || !nusukInput.trim() || !nusukGroupName.trim()}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                    nusukSaved
                      ? "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                  title="اعتماد وحفظ رقم نسك مع البقاء في نفس الصفحة"
                >
                  {nusukSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : nusukSaved ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{nusukSaved ? "تم الحفظ ✓" : "اعتماد وحفظ"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendNusukWhatsApp}
                  disabled={nusukSaving || nusukSendingWa || !nusukInput.trim() || !nusukGroupName.trim()}
                  className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                  title="إرسال المعاملة إلى مجموعة الواتساب"
                >
                  {nusukSendingWa ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>إرسال واتساب 📲</span>
                </button>
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  {!isSender && (
                    <div>
                      <label className="block font-bold text-teal-800 mb-1 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-teal-600" />
                        <span>رقم مجموعة نسك</span>
                      </label>
                      <input
                        type="text"
                        value={editNusukGroupNumber}
                        onChange={(e) => setEditNusukGroupNumber(e.target.value)}
                        placeholder="مثال: NUSUK-109283"
                        className="w-full px-3 py-2 border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 text-teal-900 font-mono font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      كود الوكالة / المرسل
                    </label>
                    <input
                      type="text"
                      value={editSenderCode}
                      onChange={(e) => setEditSenderCode(e.target.value.toUpperCase())}
                      placeholder="مثال: OHD أو SAF"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800 font-mono font-bold uppercase"
                    />
                  </div>
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

      {/* --- MODAL 8: Add New Traveler to Group --- */}
      {showAddTravelerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>إضافة مسافر جديد للمعاملة</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddTravelerModal(false);
                  resetAddTravelerForm();
                }}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTraveler} className="space-y-4 text-xs">
              {/* قسم رفع جواز السفر والصورة الشخصية */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5 items-stretch">
                {/* 1. جواز السفر (مع فحص الذكاء الاصطناعي MRZ) */}
                <FileDropArea
                  onFileDrop={(file) => handleNewTravelerPassportChange(file)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="blue"
                  overlayText="أفلت جواز السفر هنا"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-2xl h-full"
                >
                  {newTravelerPassportFile ? (
                    <div className="relative h-28 sm:h-32 p-3 bg-blue-50/70 border-2 border-blue-400 rounded-2xl flex flex-col items-center justify-center text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNewTravelerPassportChange(null);
                        }}
                        className="absolute top-1.5 left-1.5 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                        title="إزالة واستبدال الجواز"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-1 overflow-hidden">
                        {isScanningNewTravelerPassport ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : newTravelerPassportPreview ? (
                          <img src={newTravelerPassportPreview} alt="جواز السفر" className="w-full h-full object-cover" />
                        ) : (
                          <IdCard className="w-5 h-5 sm:w-6 sm:h-6" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-900 truncate max-w-[90%]" title={newTravelerPassportFile.name}>
                        {newTravelerPassportFile.name}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        {isScanningNewTravelerPassport ? "جاري الفحص..." : "تم الرفع ✓"}
                      </span>
                    </div>
                  ) : (
                    <label
                      htmlFor="modal-new-traveler-passport"
                      className="h-28 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 rounded-2xl cursor-pointer transition-all p-2 text-center group"
                    >
                      <input
                        type="file"
                        id="modal-new-traveler-passport"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleNewTravelerPassportChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-1 shadow-2xs">
                        <IdCard className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-blue-950">جواز السفر</span>
                      <span className="text-[10px] text-blue-600 font-medium">قراءة آلية بالذكاء الاصطناعي</span>
                    </label>
                  )}
                </FileDropArea>

                {/* 2. الصورة الشخصية (اختياري) */}
                <FileDropArea
                  onFileDrop={(file) => handleNewTravelerPhotoChange(file)}
                  accept=".jpg,.jpeg,.png"
                  maxSizeMb={10}
                  activeBorderColor="purple"
                  overlayText="أفلت الصورة هنا"
                  onError={(msg) => alert({ title: "تنبيه", message: msg, variant: "warning" })}
                  className="rounded-2xl h-full"
                >
                  {newTravelerPhotoFile ? (
                    <div className="relative h-28 sm:h-32 p-3 bg-purple-50/70 border-2 border-purple-400 rounded-2xl flex flex-col items-center justify-center text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNewTravelerPhotoChange(null);
                        }}
                        className="absolute top-1.5 left-1.5 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full cursor-pointer transition-colors shadow-2xs"
                        title="إزالة واستبدال الصورة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-1 overflow-hidden border border-purple-300">
                        {newTravelerPhotoPreview ? (
                          <img src={newTravelerPhotoPreview} alt="الصورة الشخصية" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 sm:w-6 sm:h-6" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-900 truncate max-w-[90%]" title={newTravelerPhotoFile.name}>
                        {newTravelerPhotoFile.name}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        تم الرفع ✓
                      </span>
                    </div>
                  ) : (
                    <label
                      htmlFor="modal-new-traveler-photo"
                      className="h-28 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/70 rounded-2xl cursor-pointer transition-all p-2 text-center group"
                    >
                      <input
                        type="file"
                        id="modal-new-traveler-photo"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => handleNewTravelerPhotoChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform mb-1 shadow-2xs">
                        <User className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-purple-950">الصورة الشخصية</span>
                      <span className="text-[10px] text-purple-600 font-medium">اختياري</span>
                    </label>
                  )}
                </FileDropArea>
              </div>

              {/* شريط حالة فحص الجواز */}
              {newTravelerScanMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                    isScanningNewTravelerPassport
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : newTravelerScanSuccess
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  {isScanningNewTravelerPassport ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  ) : newTravelerScanSuccess ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="leading-relaxed">{newTravelerScanMessage}</span>
                </div>
              )}

              {/* تنبيه صلاحية الجواز أقل من 6 أشهر */}
              {newTravelerExpiryWarning && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-2.5 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold leading-relaxed">{newTravelerExpiryWarning}</span>
                </div>
              )}

              {/* تنبيه تكرار رقم الجواز */}
              {newTravelerDuplicateWarning && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-2.5 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold leading-relaxed">{newTravelerDuplicateWarning}</span>
                </div>
              )}

              {/* حقول البيانات */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="block font-bold text-gray-700">
                      اسم المسافر بالعربية *
                    </label>
                    <button
                      type="button"
                      onClick={handleTranslateNewName}
                      disabled={isTranslatingNewName || !newTravelerName.trim()}
                      className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      title="ترجمة الاسم بالذكاء الاصطناعي وجوجل"
                    >
                      <Languages className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isTranslatingNewName ? "جاري الترجمة..." : "ترجمة جوجل"}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newTravelerName}
                    onChange={(e) => setNewTravelerName(e.target.value)}
                    placeholder="الاسم الرباعي للمسافر"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      رقم الجواز
                    </label>
                    <input
                      type="text"
                      value={newTravelerPassport}
                      onChange={async (e) => {
                        const val = e.target.value.toUpperCase();
                        setNewTravelerPassport(val);
                        const cleanP = val.trim().toUpperCase();
                        if (cleanP) {
                          const dupInCurrent = (request?.travelers || []).some(
                            (t) => t.passportNumber && t.passportNumber.trim().toUpperCase() === cleanP
                          );
                          if (dupInCurrent) {
                            setNewTravelerDuplicateWarning("⚠️ رقم الجواز مكرر مع مسافر آخر في نفس المعاملة!");
                          } else {
                            const found = await findDuplicatePassportOrId(cleanP, "passport", requestId);
                            if (found && found.isDuplicate) {
                              setNewTravelerDuplicateWarning(
                                `⚠️ تنبيه: رقم الجواز مسجل مسبقاً في المعاملة (${found.requestNumber} - ${found.matchedName})`
                              );
                            } else {
                              setNewTravelerDuplicateWarning(null);
                            }
                          }
                        } else {
                          setNewTravelerDuplicateWarning(null);
                        }
                      }}
                      placeholder="A12345678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-mono font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={newTravelerPhone}
                      onChange={(e) => setNewTravelerPhone(e.target.value)}
                      placeholder="05xxxxxxxx أو 010xxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 text-left font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      الجنسية
                    </label>
                    <input
                      type="text"
                      value={newTravelerNationality}
                      onChange={(e) => setNewTravelerNationality(e.target.value)}
                      placeholder="مثال: مصري / سعودي"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      تاريخ الميلاد
                    </label>
                    <input
                      type="date"
                      value={newTravelerBirthDate}
                      onChange={(e) => setNewTravelerBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-gray-700 mb-1">
                      تاريخ انتهاء الجواز
                    </label>
                    <input
                      type="date"
                      value={newTravelerExpiryDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewTravelerExpiryDate(val);
                        if (val) {
                          const depDate = request?.departureDate || request?.travelDate;
                          const validity = checkPassportValidity(val, depDate);
                          if (validity.isExpiringSoon || validity.isExpired) {
                            setNewTravelerExpiryWarning(validity.message);
                          } else {
                            setNewTravelerExpiryWarning(null);
                          }
                        } else {
                          setNewTravelerExpiryWarning(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      التبعية / اسم المندوب
                    </label>
                    <input
                      type="text"
                      value={newTravelerAffiliation}
                      onChange={(e) => setNewTravelerAffiliation(e.target.value)}
                      placeholder="اسم المندوب أو العميل التابع له"
                      className="w-full px-3 py-2 border border-purple-300 bg-purple-50/20 rounded-xl focus:ring-2 focus:ring-purple-500 text-purple-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      ملاحظات خاصة بالمعتمر
                    </label>
                    <input
                      type="text"
                      value={newTravelerNotes}
                      onChange={(e) => setNewTravelerNotes(e.target.value)}
                      placeholder="أي ملاحظات تخص هذا المعتمر"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTravelerModal(false);
                    resetAddTravelerForm();
                  }}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || isScanningNewTravelerPassport || !newTravelerName.trim()}
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإضافة ورفع المستندات...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>إضافة المسافر الآن</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- MODAL 9: Add / Edit Host Modal (بيانات ومستند المستضيف) --- */}
      {showAddHostModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600" />
                <span>إضافة وتعديل بيانات ومستند المستضيف</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddHostModal(false);
                  setHostModalFile(null);
                  setHostModalFilePreview(null);
                }}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHostModal} className="space-y-4 text-xs">
              {/* Host ID Document Upload Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-gray-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>صورة / وثيقة هوية المستضيف (مطلوبة أو اختيارية)</span>
                  </label>
                  {isScanningHostModalFile && (
                    <span className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري القراءة الذكية للبيانات...</span>
                    </span>
                  )}
                </div>

                {hostModalFile ? (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {hostModalFilePreview ? (
                        <img
                          src={hostModalFilePreview}
                          alt="Host ID preview"
                          className="w-12 h-12 object-cover rounded-lg border border-amber-300 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                          PDF
                        </div>
                      )}
                      <div className="truncate">
                        <div className="font-bold text-gray-800 truncate">{hostModalFile.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {(hostModalFile.size / 1024).toFixed(1)} KB • جاهز للرفع عند الحفظ
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <label className="p-1.5 text-xs text-amber-800 hover:bg-amber-100 rounded-lg font-bold cursor-pointer">
                        <span>تغيير</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleHostModalFileChange(f);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setHostModalFile(null);
                          setHostModalFilePreview(null);
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="إزالة الملف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/30 hover:bg-amber-50/70 rounded-xl p-4 text-center cursor-pointer block transition-colors">
                    <UploadCloud className="w-8 h-8 text-amber-500 mx-auto mb-1.5" />
                    <p className="font-bold text-gray-800 text-xs">
                      انقر لاختيار صورة هوية المستضيف أو اسحبها وأفلتها هنا
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      يقبل ملفات الصور (JPG, PNG) أو مستند PDF (حد أقصى 10 ميجابايت)
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleHostModalFileChange(f);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Host Phone Number (Main field) */}
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  رقم هاتف المستضيف (في المملكة) *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={hostModalPhone}
                    onChange={(e) => setHostModalPhone(e.target.value)}
                    placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-gray-900 font-mono font-bold text-sm text-left pl-10"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  رقم جوال المستضيف المعتمد للتواصل والإشعارات ورسائل الواتساب.
                </p>
              </div>

              {/* Grid of Other Host Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">اسم المستضيف رباعي</label>
                  <input
                    type="text"
                    value={hostModalName}
                    onChange={(e) => setHostModalName(e.target.value)}
                    placeholder="مثال: عبد الله محمد الشريف"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-gray-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">رقم الهوية أو الإقامة</label>
                  <input
                    type="text"
                    value={hostModalNationalId}
                    onChange={(e) => setHostModalNationalId(e.target.value)}
                    placeholder="10xxxxxxxx أو 20xxxxxxxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-gray-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">الجنسية</label>
                  <input
                    type="text"
                    value={hostModalNationality}
                    onChange={(e) => setHostModalNationality(e.target.value)}
                    placeholder="سعودي"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">تاريخ ميلاد المستضيف</label>
                  <input
                    type="text"
                    value={hostModalBirthDate}
                    onChange={(e) => setHostModalBirthDate(e.target.value)}
                    placeholder="YYYY/MM/DD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-gray-800 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddHostModal(false);
                    setHostModalFile(null);
                    setHostModalFilePreview(null);
                  }}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !hostModalPhone.trim()}
                  className="px-5 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ بيانات ومستند المستضيف</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
