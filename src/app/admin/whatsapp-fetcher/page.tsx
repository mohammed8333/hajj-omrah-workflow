"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { GroupRequestSummary, Traveler } from "@/types";
import {
  PhoneCall,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  X,
  Shield,
  ArrowRight,
  Eye,
  ExternalLink,
  Sparkles,
  Filter,
  Users,
  Download,
  Copy,
  Layers,
  FileText,
  Phone,
  HelpCircle,
  AlertCircle,
  CheckSquare,
  Square,
  UploadCloud,
  IdCard,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/dialog-context";
import { scanPassportMRZ, ScannedPassportData } from "@/lib/mrzScanner";
import { formatPhoneForWhatsApp, getWhatsAppUrl } from "@/lib/phoneUtils";

const BRIDGE_URL = "http://localhost:5055";
const STORAGE_KEY_GROUP = "safa_whatsapp_fetcher_group";

interface ExtractedPhonePair {
  id: string;
  sender: string;
  senderName: string;
  timestamp: number;
  phoneNumber: string;
  additionalPhones?: string[];
  imageBase64: string;
  matchedBy: "caption" | "reply" | "proximity" | "simulation" | "unpaired";
  details?: string;

  // OCR state
  ocrStatus: "idle" | "scanning" | "done" | "failed";
  fullNameArabic?: string;
  fullNameEnglish?: string;
  passportNumber?: string;
  ocrProgressMsg?: string;

  // Request matching state
  matchedRequestId?: string;
  matchedRequestNumber?: string;
  matchedGroupName?: string;
  matchedTravelerId?: string;
  matchedTravelerName?: string;
  matchedCurrentPhone?: string;
  matchType?: "passport" | "name" | "none";

  // Application state
  isApplied?: boolean;
  isApplying?: boolean;
  applyError?: string;
}

export default function WhatsAppPhoneFetcherPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const { alert, confirm } = useDialog();

  // Requests from DB
  const [requests, setRequests] = useState<GroupRequestSummary[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Bridge status
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    connected: boolean;
    hasQr: boolean;
    qrImage?: string | null;
    groupsCount: number;
  } | null>(null);
  const [checkingBridge, setCheckingBridge] = useState(false);

  // Available groups from WhatsApp
  const [availableGroups, setAvailableGroups] = useState<
    Array<{ id: string; subject: string; participantsCount?: number }>
  >([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [scanLimit, setScanLimit] = useState<number>(100);

  // Scanning & Extracted data
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [extractedPairs, setExtractedPairs] = useState<ExtractedPhonePair[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Options
  const [attachPassportDoc, setAttachPassportDoc] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "MATCHED" | "UNMATCHED" | "APPLIED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Preview modal for passport photo
  const [previewImage, setPreviewImage] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: "",
    title: "",
  });

  // Test simulation modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testImageFile, setTestImageFile] = useState<File | null>(null);
  const [testImagePreview, setTestImagePreview] = useState<string>("");

  // Only Admin is authorized
  useEffect(() => {
    if (role && role !== "Admin") {
      router.push("/dashboard");
    }
  }, [role, router]);

  // Load requests
  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const data = await api.requests.getAll();
      setRequests(data);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Check bridge status and groups
  const checkBridge = async () => {
    try {
      setCheckingBridge(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${BRIDGE_URL}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setBridgeStatus({
          online: true,
          connected: Boolean(data.connected),
          hasQr: Boolean(data.hasQr),
          qrImage: data.qrImage || null,
          groupsCount: Number(data.groupsCount || 0),
        });

        if (data.connected) {
          fetchGroups();
        }
      } else {
        setBridgeStatus({ online: false, connected: false, hasQr: false, groupsCount: 0 });
      }
    } catch {
      setBridgeStatus({ online: false, connected: false, hasQr: false, groupsCount: 0 });
    } finally {
      setCheckingBridge(false);
    }
  };

  // Reset session and generate fresh QR
  const handleResetSession = async () => {
    try {
      setCheckingBridge(true);
      const res = await fetch(`${BRIDGE_URL}/reset-session`, { method: "POST" });
      if (res.ok) {
        await alert({
          title: "تمت إعادة الضبط",
          message: "تم مسح الجلسة القديمة، وسيتم توليد كود QR جديد للمسح خلال ثوانٍ.",
          variant: "success",
        });
        setTimeout(checkBridge, 1000);
      }
    } catch {
      await alert({
        title: "خطأ",
        message: "تعذر الاتصال بالخادم لإعادة ضبط الجلسة.",
        variant: "danger",
      });
    } finally {
      setCheckingBridge(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/groups`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.groups)) {
          setAvailableGroups(data.groups);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRequests();
    checkBridge();

    // Auto poll bridge status every 3 seconds while on this page
    const interval = setInterval(() => {
      checkBridge();
    }, 3000);

    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_GROUP);
      if (saved) setSelectedGroup(saved);
    }

    return () => clearInterval(interval);
  }, []);

  const handleGroupChange = (val: string) => {
    setSelectedGroup(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_GROUP, val);
    }
  };

  // Match an extracted passport with loaded requests
  const matchPairWithRequests = (
    passportNumber?: string,
    fullNameArabic?: string,
    fullNameEnglish?: string
  ): {
    requestId?: string;
    requestNumber?: string;
    groupName?: string;
    travelerId?: string;
    travelerName?: string;
    currentPhone?: string;
    matchType: "passport" | "name" | "none";
  } => {
    const cleanPass = passportNumber?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
    const cleanAr = fullNameArabic?.trim().toLowerCase() || "";
    const cleanEn = fullNameEnglish?.trim().toLowerCase() || "";

    // 1. Exact or Clean Passport Match (Highest Priority)
    if (cleanPass.length >= 5) {
      for (const req of requests) {
        // Search in travelers list
        if (req.travelersList && req.travelersList.length > 0) {
          for (const trav of req.travelersList) {
            const travPass = (trav.passportNumber || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (travPass && (travPass === cleanPass || cleanPass.includes(travPass) || travPass.includes(cleanPass))) {
              return {
                requestId: req.id,
                requestNumber: req.requestNumber,
                groupName: req.groupName,
                travelerId: trav.id,
                travelerName: trav.fullName,
                currentPhone: trav.phoneNumber || req.contactPhone || "",
                matchType: "passport",
              };
            }
          }
        }

        // Search in group request level passport
        if (req.travelerPassport) {
          const reqPass = req.travelerPassport.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (reqPass && (reqPass === cleanPass || cleanPass.includes(reqPass))) {
            return {
              requestId: req.id,
              requestNumber: req.requestNumber,
              groupName: req.groupName,
              travelerId: req.travelersList?.[0]?.id,
              travelerName: req.travelersList?.[0]?.fullName || req.groupName,
              currentPhone: req.contactPhone || "",
              matchType: "passport",
            };
          }
        }
      }
    }

    // 2. Name Matching Fallback
    if (cleanAr.length >= 6 || cleanEn.length >= 6) {
      for (const req of requests) {
        if (req.travelersList && req.travelersList.length > 0) {
          for (const trav of req.travelersList) {
            const tName = (trav.fullName || "").trim().toLowerCase();
            if (tName && (tName.includes(cleanAr) || cleanAr.includes(tName))) {
              return {
                requestId: req.id,
                requestNumber: req.requestNumber,
                groupName: req.groupName,
                travelerId: trav.id,
                travelerName: trav.fullName,
                currentPhone: trav.phoneNumber || req.contactPhone || "",
                matchType: "name",
              };
            }
          }
        }

        // Group name fallback
        const gName = (req.groupName || "").trim().toLowerCase();
        if (gName && (gName.includes(cleanAr) || cleanAr.includes(gName))) {
          return {
            requestId: req.id,
            requestNumber: req.requestNumber,
            groupName: req.groupName,
            travelerId: req.travelersList?.[0]?.id,
            travelerName: req.groupName,
            currentPhone: req.contactPhone || "",
            matchType: "name",
          };
        }
      }
    }

    return { matchType: "none" };
  };

  // Scan passport image using MRZ / Gemini AI
  const processPairOCR = async (pair: ExtractedPhonePair): Promise<ExtractedPhonePair> => {
    if (!pair.imageBase64) return pair;

    try {
      const ocrResult = await scanPassportMRZ(pair.imageBase64, (msg) => {
        setExtractedPairs((prev) =>
          prev.map((p) => (p.id === pair.id ? { ...p, ocrProgressMsg: msg } : p))
        );
      });

      if (ocrResult) {
        const match = matchPairWithRequests(
          ocrResult.passportNumber,
          ocrResult.fullNameArabic,
          ocrResult.fullNameEnglish
        );

        return {
          ...pair,
          ocrStatus: "done",
          fullNameArabic: ocrResult.fullNameArabic,
          fullNameEnglish: ocrResult.fullNameEnglish,
          passportNumber: ocrResult.passportNumber,
          matchedRequestId: match.requestId,
          matchedRequestNumber: match.requestNumber,
          matchedGroupName: match.groupName,
          matchedTravelerId: match.travelerId,
          matchedTravelerName: match.travelerName,
          matchedCurrentPhone: match.currentPhone,
          matchType: match.matchType,
        };
      } else {
        return {
          ...pair,
          ocrStatus: "failed",
          ocrProgressMsg: "تعذر قراءة الجواز (قد تكون الصورة غير واضحة)",
          matchType: "none",
        };
      }
    } catch (err: unknown) {
      return {
        ...pair,
        ocrStatus: "failed",
        ocrProgressMsg: err instanceof Error ? err.message : "خطأ أثناء المعالجة",
        matchType: "none",
      };
    }
  };

  // Scan group messages from bridge
  const handleScanGroup = async () => {
    if (!selectedGroup.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى اختيار أو كتابة اسم مجموعة الواتساب المستهدفة أولاً.",
        variant: "warning",
      });
      return;
    }

    try {
      setIsScanning(true);
      setScanStep("جاري الاتصال بخادم الواتساب والبحث في رسائل المجموعة...");

      const res = await fetch(`${BRIDGE_URL}/scan-group-phones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetGroup: selectedGroup.trim(),
          limit: scanLimit,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "تعذر فحص رسائل المجموعة من الواتساب");
      }

      const data = await res.json();
      const rawPairs: ExtractedPhonePair[] = (data.pairs || []).map((p: any) => ({
        ...p,
        ocrStatus: "idle",
        ocrProgressMsg: "",
        matchType: "none",
        isApplied: false,
      }));

      if (rawPairs.length === 0) {
        await alert({
          title: "لا توجد نتائج",
          message: "تم فحص المجموعة بنجاح، ولكن لم يتم العثور على صور جوازات أو أرقام هواتف في الرسائل الأخيرة.",
          variant: "info",
        });
        setExtractedPairs([]);
        return;
      }

      setExtractedPairs(rawPairs);
      setScanStep(`تم العثور على (${rawPairs.length}) جواز وهاتف. جاري تحليل صور الجوازات بالذكاء الاصطناعي...`);

      // Sequentially run OCR on each extracted passport image
      const processed: ExtractedPhonePair[] = [];
      for (let i = 0; i < rawPairs.length; i++) {
        setScanStep(`جاري فحص الجواز (${i + 1} من ${rawPairs.length})...`);
        const item = rawPairs[i];
        const resPair = await processPairOCR(item);
        processed.push(resPair);
        setExtractedPairs([...processed, ...rawPairs.slice(i + 1)]);
      }

      setScanStep("اكتمل الفحص والتحليل بنجاح!");
      await alert({
        title: "اكتمل الفحص بنجاح",
        message: `تم جلب وتحليل (${processed.length}) جواز سفر، وربطها بالمعاملات في النظام.`,
        variant: "success",
      });
    } catch (err: unknown) {
      console.error(err);
      await alert({
        title: "خطأ أثناء الفحص",
        message: err instanceof Error ? err.message : "فشل جلب رسائل المجموعة",
        variant: "danger",
      });
    } finally {
      setIsScanning(false);
      setScanStep("");
    }
  };

  // Convert Base64 data URL to File object
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Apply a single item to the matched request in DB
  const handleApplySingle = async (pairId: string) => {
    const pair = extractedPairs.find((p) => p.id === pairId);
    if (!pair || !pair.phoneNumber || !pair.matchedRequestId) return;

    try {
      setExtractedPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, isApplying: true, applyError: undefined } : p))
      );

      // 1. Update Traveler Phone (if traveler ID is matched)
      if (pair.matchedTravelerId) {
        await api.travelers.update(pair.matchedTravelerId, {
          phoneNumber: pair.phoneNumber.trim(),
          passportNumber: pair.passportNumber || undefined,
        });
      }

      // 2. Also update Request Contact Phone if empty
      if (!pair.matchedCurrentPhone || !pair.matchedCurrentPhone.trim()) {
        await api.requests.update(pair.matchedRequestId, {
          contactPhone: pair.phoneNumber.trim(),
        });
      }

      // 3. Optional: Attach passport image as official document if requested
      if (attachPassportDoc && pair.imageBase64) {
        try {
          const passFile = dataUrlToFile(
            pair.imageBase64,
            `passport_${pair.passportNumber || pair.id}.jpg`
          );
          await api.documents.upload(
            pair.matchedRequestId,
            passFile,
            "Passport",
            pair.matchedTravelerId
          );
        } catch (uploadErr) {
          console.warn("Failed to attach passport doc:", uploadErr);
        }
      }

      // Mark applied
      setExtractedPairs((prev) =>
        prev.map((p) =>
          p.id === pairId
            ? { ...p, isApplying: false, isApplied: true, matchedCurrentPhone: pair.phoneNumber }
            : p
        )
      );

      // Refresh requests list in background
      loadRequests();
    } catch (err: unknown) {
      console.error(err);
      setExtractedPairs((prev) =>
        prev.map((p) =>
          p.id === pairId
            ? {
                ...p,
                isApplying: false,
                applyError: err instanceof Error ? err.message : "فشل التحديث",
              }
            : p
        )
      );
    }
  };

  // Bulk Apply: update all matched items with a single click
  const handleApplyAllMatched = async () => {
    const eligible = extractedPairs.filter(
      (p) => !p.isApplied && p.matchedRequestId && p.phoneNumber && p.matchType !== "none"
    );

    if (eligible.length === 0) {
      await alert({
        title: "لا توجد عناصر مطابقة جاهزة",
        message: "لم يتم العثور على عناصر مطابقة جديدة تحتاج للتحديث حالياً.",
        variant: "info",
      });
      return;
    }

    const ok = await confirm({
      title: "تأكيد اعتماد وتحديث الكل",
      message: `أنت على وشك تحديث أرقام التليفونات لـ (${eligible.length}) مسافر/معاملة مطابقة في النظام دفعة واحدة بنقرة واحدة.\n\nهل ترغب في المتابعة؟`,
      confirmText: "نعم، اعتمد وحدّث الكل ✓",
      cancelText: "إلغاء",
      variant: "success",
    });

    if (!ok) return;

    let successCount = 0;
    for (const pair of eligible) {
      await handleApplySingle(pair.id);
      successCount++;
    }

    await alert({
      title: "تم التحديث بنجاح!",
      message: `تم اعتماد وتحديث بيانات (${successCount}) مسافر بنجاح في قاعدة البيانات.`,
      variant: "success",
    });
  };

  // Manual test simulation handler
  const handleRunSimulation = async () => {
    if (!testPhone.trim() || !testImagePreview) {
      await alert({
        title: "بيانات ناقصة",
        message: "يرجى كتابة رقم الهاتف واختيار صورة جواز سفر لإجراء التجربة.",
        variant: "warning",
      });
      return;
    }

    const simPair: ExtractedPhonePair = {
      id: `sim_${Date.now()}`,
      sender: "manual_tester",
      senderName: "اختبار يدوي للأدمن",
      timestamp: Math.floor(Date.now() / 1000),
      phoneNumber: testPhone.trim(),
      additionalPhones: [],
      imageBase64: testImagePreview,
      matchedBy: "simulation",
      details: "إدخال تجريبي مباشر من شاشة الأدمن",
      ocrStatus: "scanning",
      matchType: "none",
    };

    setTestModalOpen(false);
    setTestPhone("");
    setTestImageFile(null);
    setTestImagePreview("");

    // Add to list and process OCR
    setExtractedPairs((prev) => [simPair, ...prev]);
    const processed = await processPairOCR(simPair);
    setExtractedPairs((prev) => prev.map((p) => (p.id === simPair.id ? processed : p)));
  };

  // Filter pairs
  const filteredPairs = useMemo(() => {
    return extractedPairs.filter((p) => {
      // Type filter
      if (filterType === "MATCHED" && (!p.matchedRequestId || p.matchType === "none")) return false;
      if (filterType === "UNMATCHED" && p.matchedRequestId && p.matchType !== "none") return false;
      if (filterType === "APPLIED" && !p.isApplied) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const phoneMatch = p.phoneNumber.toLowerCase().includes(q);
        const nameMatch =
          p.fullNameArabic?.toLowerCase().includes(q) ||
          p.fullNameEnglish?.toLowerCase().includes(q) ||
          p.matchedTravelerName?.toLowerCase().includes(q) ||
          p.matchedGroupName?.toLowerCase().includes(q);
        const passMatch = p.passportNumber?.toLowerCase().includes(q);
        const reqMatch = p.matchedRequestNumber?.toLowerCase().includes(q);
        if (!phoneMatch && !nameMatch && !passMatch && !reqMatch) return false;
      }

      return true;
    });
  }, [extractedPairs, filterType, searchQuery]);

  // Statistics
  const totalCount = extractedPairs.length;
  const matchedCount = extractedPairs.filter(
    (p) => p.matchedRequestId && p.matchType !== "none"
  ).length;
  const appliedCount = extractedPairs.filter((p) => p.isApplied).length;
  const pendingApplyCount = extractedPairs.filter(
    (p) => !p.isApplied && p.matchedRequestId && p.phoneNumber && p.matchType !== "none"
  ).length;

  if (role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-rose-500 mb-3" />
        <h1 className="text-xl font-bold text-gray-800">صلاحية غير كافية</h1>
        <p className="text-xs text-gray-500 mt-1">
          هذه الصفحة مخصصة لمدير النظام (Admin) فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Shield className="w-3 h-3 text-indigo-600" />
              <span>لوحة الأدمن فقط</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>مطابقة ذكية بالذكاء الاصطناعي</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-emerald-600" />
            <span>نظام جلب أرقام التليفونات من الواتساب</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            جلب أرقام الهواتف وصور الجوازات تلقائياً من جروب الواتساب ومطابقتها وتحديثها في المعاملات بنقرة واحدة.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
            title="تجربة مطابقة جواز ورقم هاتف يدوياً"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>تجربة إدخال سريع 🧪</span>
          </button>

          <button
            type="button"
            onClick={() => {
              checkBridge();
              loadRequests();
            }}
            disabled={checkingBridge || loadingRequests}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors cursor-pointer"
            title="تحديث حالة الاتصال والمعاملات"
          >
            <RefreshCw className={`w-4 h-4 ${checkingBridge || loadingRequests ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Connection & Group Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        {/* Connection Status Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-gray-50/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                bridgeStatus?.connected
                  ? "bg-emerald-500 animate-pulse"
                  : bridgeStatus?.online
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <div>
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-gray-900">
                <span>حالة خادم الواتساب (WhatsApp Bridge):</span>
                {bridgeStatus?.connected ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                    متصل بالواتساب وجاهز لجلب الرسائل ✓
                  </span>
                ) : bridgeStatus?.online ? (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">
                    السيرفر يعمل - بانتظار مسح كود QR في شاشة السيرفر
                  </span>
                ) : (
                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-xs">
                    الخادم غير متصل (قم بتشغيل whatsapp-bridge/start.bat)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                يعمل محلياً على المنفذ 5055 بمكتبة Baileys لقراءة رسائل الجروبات والميديا بأمان.
              </p>
            </div>
          </div>

          {bridgeStatus?.connected && (
            <span className="text-xs text-gray-500 font-medium bg-white px-2.5 py-1 rounded-lg border border-gray-200">
              عدد الجروبات المتاحة: <strong className="text-gray-900">{availableGroups.length || bridgeStatus.groupsCount}</strong>
            </span>
          )}
        </div>

        {/* QR Code Presentation Box (When not connected & QR available) */}
        {!bridgeStatus?.connected && bridgeStatus?.online && (
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
            {bridgeStatus.qrImage ? (
              <div className="bg-white p-2 rounded-xl shadow-xs border border-amber-200 shrink-0">
                <img
                  src={bridgeStatus.qrImage}
                  alt="WhatsApp QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>
            ) : (
              <div className="w-44 h-44 bg-white rounded-xl border border-dashed border-amber-300 flex flex-col items-center justify-center p-3 text-center shrink-0">
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mb-2" />
                <span className="text-[11px] text-amber-800 font-bold">جاري توليد كود QR جديد...</span>
              </div>
            )}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                <span>📲 امسح كود QR من تطبيق الواتساب بهاتفك للربط:</span>
              </h4>
              <ol className="text-xs text-amber-900 list-decimal list-inside space-y-1 leading-relaxed">
                <li>افتح تطبيق <strong>الواتساب</strong> على هاتفك المحمول.</li>
                <li>انتقل إلى <strong>الإعدادات (Settings)</strong> ثم اختر <strong>الأجهزة المرتبطة (Linked Devices)</strong>.</li>
                <li>انقر على <strong>ربط جهاز (Link a Device)</strong> ووجّه الكاميرا نحو كود QR الظاهر هنا.</li>
              </ol>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={checkingBridge}
                  className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingBridge ? "animate-spin" : ""}`} />
                  <span>توليد كود QR جديد / إعادة ضبط الجلسة 🔄</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group Selection and Scan Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">
              المجموعة المستهدفة في الواتساب (الجروب):
            </label>
            <div className="relative">
              {availableGroups.length > 0 ? (
                <select
                  value={selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer font-medium"
                >
                  <option value="">-- اختر مجموعة من قائمة الواتساب --</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.subject} ({g.participantsCount || 0} عضو)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  placeholder="اكتب اسم المجموعة أو ضع رابطها أو معرفها (@g.us)..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">عدد الرسائل للفحص:</label>
            <select
              value={scanLimit}
              onChange={(e) => setScanLimit(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer font-medium"
            >
              <option value={30}>آخر 30 رسالة</option>
              <option value={60}>آخر 60 رسالة</option>
              <option value={100}>آخر 100 رسالة</option>
              <option value={200}>آخر 200 رسالة</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanGroup}
              disabled={isScanning || !bridgeStatus?.connected}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Search className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "جاري الفحص..." : "فحص وجلب الرسائل الآن"}</span>
            </button>
          </div>
        </div>

        {/* Scan step banner */}
        {isScanning && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            <span className="font-semibold">{scanStep}</span>
          </div>
        )}
      </div>

      {/* Summary KPI Cards & Bulk Action Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-400 block">إجمالي الجوازات المجلوبة</span>
          <span className="text-xl font-bold text-gray-900 mt-1 block">{totalCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 block">معاملات مطابقة في النظام</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">{matchedCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-600 block">بانتظار الاعتماد</span>
          <span className="text-xl font-bold text-indigo-700 mt-1 block">{pendingApplyCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-teal-600 block">تم التحديث بنجاح</span>
          <span className="text-xl font-bold text-teal-700 mt-1 block">{appliedCount}</span>
        </div>
      </div>

      {/* Bulk Action & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              filterType === "ALL"
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            الكل ({extractedPairs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("MATCHED")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              filterType === "MATCHED"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            المطابقة ({matchedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("UNMATCHED")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              filterType === "UNMATCHED"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            غير مطابقة ({extractedPairs.length - matchedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("APPLIED")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              filterType === "APPLIED"
                ? "bg-teal-600 text-white"
                : "bg-teal-50 text-teal-700 hover:bg-teal-100"
            }`}
          >
            المعتمدة ({appliedCount})
          </button>
        </div>

        {/* Options & Batch Update Button */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={attachPassportDoc}
              onChange={(e) => setAttachPassportDoc(e.target.checked)}
              className="rounded-sm text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span>إرفاق صورة الجواز تلقائياً في المعاملة</span>
          </label>

          <button
            type="button"
            onClick={handleApplyAllMatched}
            disabled={pendingApplyCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>اعتماد وتحديث الكل بنقرة واحدة ({pendingApplyCount}) ✓</span>
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {filteredPairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
            <IdCard className="w-12 h-12 text-gray-300 mb-2" />
            <span className="font-bold text-sm text-gray-700">لا توجد عناصر لعرضها</span>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              اختر مجموعة الواتساب واضغط «فحص وجلب الرسائل الآن» لجلب صور الجوازات وأرقام الهواتف تلقائياً، أو استخدم زر التجربة اليدوية.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-700 font-bold">
                <tr>
                  <th className="py-3 px-3 text-center">صورة الجواز</th>
                  <th className="py-3 px-3">بيانات الجواز المستخرجة (AI)</th>
                  <th className="py-3 px-3">رقم الهاتف المجلوب</th>
                  <th className="py-3 px-3">طريقة الالتقاط</th>
                  <th className="py-3 px-3">المعاملة المطابقة في النظام</th>
                  <th className="py-3 px-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPairs.map((pair) => {
                  const isMatched = pair.matchedRequestId && pair.matchType !== "none";
                  const waUrl = getWhatsAppUrl(pair.phoneNumber, "السلام عليكم");

                  return (
                    <tr
                      key={pair.id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        pair.isApplied
                          ? "bg-teal-50/30"
                          : isMatched
                          ? "bg-emerald-50/20"
                          : "bg-white"
                      }`}
                    >
                      {/* 1. Passport Image Preview */}
                      <td className="py-3 px-3 text-center">
                        {pair.imageBase64 ? (
                          <div
                            onClick={() =>
                              setPreviewImage({
                                isOpen: true,
                                url: pair.imageBase64,
                                title: pair.fullNameArabic || pair.passportNumber || "صورة جواز السفر",
                              })
                            }
                            className="relative group w-16 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 mx-auto cursor-pointer shadow-2xs hover:ring-2 hover:ring-emerald-500 transition-all"
                            title="انقر للتكبير والمعاينة"
                          >
                            <img
                              src={pair.imageBase64}
                              alt="Passport"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">بدون صورة</span>
                        )}
                      </td>

                      {/* 2. Extracted Passport Data */}
                      <td className="py-3 px-3">
                        {pair.ocrStatus === "scanning" ? (
                          <div className="flex items-center gap-1.5 text-sky-700 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{pair.ocrProgressMsg || "جاري القراءة..."}</span>
                          </div>
                        ) : pair.ocrStatus === "failed" ? (
                          <div className="text-rose-600 text-[11px]">
                            <span>{pair.ocrProgressMsg || "تعذر قراءة الجواز"}</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-900 text-xs sm:text-sm">
                              {pair.fullNameArabic || pair.fullNameEnglish || "اسم غير محدد"}
                            </div>
                            {pair.fullNameEnglish && pair.fullNameArabic && (
                              <div className="text-[11px] text-gray-500 font-mono">
                                {pair.fullNameEnglish}
                              </div>
                            )}
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 mt-1">
                              <span>رقم الجواز:</span>
                              <strong className="tracking-wide">
                                {pair.passportNumber || "لم يُكتشف"}
                              </strong>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. Phone Number Input */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={pair.phoneNumber}
                              onChange={(e) => {
                                const newPhone = e.target.value;
                                setExtractedPairs((prev) =>
                                  prev.map((p) =>
                                    p.id === pair.id ? { ...p, phoneNumber: newPhone } : p
                                  )
                                );
                              }}
                              placeholder="رقم الهاتف..."
                              className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white w-36 text-left dir-ltr"
                            />
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                title="محادثة واتساب سريعة"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          {pair.additionalPhones && pair.additionalPhones.length > 0 && (
                            <span className="text-[10px] text-gray-400 block">
                              أرقام إضافية: {pair.additionalPhones.join(", ")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Pairing Method */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              pair.matchedBy === "caption"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : pair.matchedBy === "reply"
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : pair.matchedBy === "proximity"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {pair.matchedBy === "caption"
                              ? "كابشن مع الصورة"
                              : pair.matchedBy === "reply"
                              ? "رد مقتبس (Reply)"
                              : pair.matchedBy === "proximity"
                              ? "نفس المرسل (توقيت)"
                              : pair.matchedBy === "simulation"
                              ? "تجريبي"
                              : "منفرد"}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            بواسطة: {pair.senderName || pair.sender || "غير معروف"}
                          </span>
                        </div>
                      </td>

                      {/* 5. Matched Request In System */}
                      <td className="py-3 px-3">
                        {isMatched ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  pair.matchType === "passport"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {pair.matchType === "passport"
                                  ? "🎯 مطابقة مؤكدة برقم الجواز"
                                  : "📝 مطابقة باسم المسافر"}
                              </span>
                              <Link
                                href={`/requests/${pair.matchedRequestId}`}
                                target="_blank"
                                className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-0.5"
                              >
                                <span>{pair.matchedRequestNumber}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                            <div className="font-semibold text-gray-900 text-xs">
                              المعتمر: {pair.matchedTravelerName || pair.matchedGroupName}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              الهاتف الحالي في المعاملة:{" "}
                              <span className="font-mono text-gray-700">
                                {pair.matchedCurrentPhone || "غير مسجل"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>لم يتم العثور على معاملة مطابقة</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Action */}
                      <td className="py-3 px-3 text-center">
                        {pair.isApplied ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-100 border border-teal-200">
                            <Check className="w-3.5 h-3.5" />
                            <span>تم التحديث بنجاح ✓</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplySingle(pair.id)}
                            disabled={!isMatched || !pair.phoneNumber || pair.isApplying}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title={
                              isMatched
                                ? "اعتماد وتحديث رقم الهاتف في المعاملة"
                                : "لا يمكن الاعتماد لعدم وجود معاملة مطابقة"
                            }
                          >
                            {pair.isApplying ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>اعتماد وتحديث</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Passport Image Preview Modal */}
      {previewImage.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-bold text-sm text-gray-900">{previewImage.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewImage({ isOpen: false, url: "", title: "" })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-2">
              <img
                src={previewImage.url}
                alt="Passport Full"
                className="max-h-[70vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Test Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-gray-900">
                  تجربة إدخال سريع (فحص ومطابقة)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              يمكنك هنا رفع صورة جواز سفر وكتابة رقم هاتف لاختبار دقة القراءة والمطابقة مع المعاملات حتى في حال عدم اتصال الواتساب.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  رقم الهاتف التجريبي:
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="مثال: 01012345678 أو 0512345678"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  صورة جواز السفر:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTestImageFile(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        setTestImagePreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              {testImagePreview && (
                <div className="h-32 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center">
                  <img
                    src={testImagePreview}
                    alt="Preview"
                    className="h-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleRunSimulation}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                بدء الفحص والربط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
