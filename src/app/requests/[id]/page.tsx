"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
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
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
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
} from "lucide-react";

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: requestId } = use(params);
  const router = useRouter();
  const { user, role } = useAuth();

  const [request, setRequest] = useState<GroupRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [reviewModalDoc, setReviewModalDoc] = useState<DocumentItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>("Accepted");
  const [reviewNote, setReviewNote] = useState("");

  // Safa Complete Modal
  const [showNusukModal, setShowNusukModal] = useState(false);
  const [nusukInput, setNusukInput] = useState("");
  const [nusukNote, setNusukNote] = useState("");

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
  const [editDepartureDate, setEditDepartureDate] = useState("");
  const [editReturnDate, setEditReturnDate] = useState("");
  const [editFlightDepartureTime, setEditFlightDepartureTime] = useState("");
  const [editAirportArrivalTime, setEditAirportArrivalTime] = useState("");

  const loadRequest = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.requests.getById(requestId);
      setRequest(data);
      if (data.nusukGroupNumber) {
        setNusukInput(data.nusukGroupNumber);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("تعذر تحميل بيانات المعاملة.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
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
      setSuccess(`تم رفع مستند (${DOCUMENT_TYPE_LABELS[docType]}) بنجاح.`);
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

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المستند؟")) return;
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
    if (!confirm("هل أنت متأكد من تقديم الطلب لموظف الصفا للمراجعة؟")) return;
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

  const handleCompleteSafa = async () => {
    if (!nusukInput.trim()) {
      alert("يرجى إدخال رقم مجموعة نسك.");
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.requests.safaComplete(requestId, nusukInput.trim(), nusukNote.trim() || undefined);
      setSuccess("تم اكتمال تسجيل صفا وتوثيق رقم نسك بنجاح.");
      setShowNusukModal(false);
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToSaudiAgent = async () => {
    if (!confirm("هل أنت متأكد من إحالة المعاملة المكتملة إلى الوكيل السعودي؟")) return;
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
    if (!confirm("هل أنت متأكد من اكتمال كافة الإجراءات واعتماد المعاملة نهائياً؟")) return;
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
      alert("يرجى كتابة سبب طلب التصحيح.");
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
      <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center">
        <h2 className="text-lg font-bold text-gray-800">المعاملة غير موجودة</h2>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 text-xs font-semibold text-sky-600 hover:underline"
        >
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  const canEditDocs =
    role === "Sender" &&
    (request.status === "Draft" ||
      request.status === "CorrectionRequired" ||
      request.status === "MissingDocuments");

  const isSafaReviewer = role === "SafaEmployee" || role === "Admin";
  const isAgent = role === "SaudiAgent" || role === "Admin";
  const isSender = role === "Sender" || role === "Admin";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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

          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            {request.groupName}
          </h1>

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
          <RequestStatusBadge status={request.status} />

          {/* Action buttons by Role */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Sender Actions */}
            {role === "Sender" && request.status === "Draft" && (
              <button
                onClick={handleSubmitRequest}
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
                onClick={handleSafaStartReview}
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
                    onClick={() => setShowNusukModal(true)}
                    disabled={actionLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>
                      {request.nusukGroupNumber
                        ? "تعديل رقم نسك وإكمال صفا"
                        : "إدخال رقم نسك وإكمال صفا"}
                    </span>
                  </button>

                  <button
                    onClick={handleSendToSaudiAgent}
                    disabled={actionLoading || !request.nusukGroupNumber}
                    title={
                      !request.nusukGroupNumber
                        ? "يجب إدخال رقم مجموعة نسك أولاً"
                        : "إحالة إلى الوكيل السعودي"
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إحالة للوكيل السعودي</span>
                  </button>

                  {request.status === "SafaRegistrationCompleted" && (
                    <button
                      onClick={handleSafaStartReview}
                      disabled={actionLoading}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                      title="إعادة المعاملة لحالة قيد المراجعة لتعديل المستندات أو التدقيق"
                    >
                      <span>إعادة للمراجعة</span>
                    </button>
                  )}
                </>
              )}

            {/* Saudi Agent Actions */}
            {isAgent && request.status === "ReadyForSaudiAgent" && (
              <button
                onClick={handleAgentReceive}
                disabled={actionLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تأكيد استلام المعاملة</span>
              </button>
            )}

            {/* Step 1: Saudi Agent after receiving sees "طلب تصحيح" + "تم ربط البرنامج" */}
            {isAgent &&
              (request.status === "ReceivedBySaudiAgent" ||
                request.status === "SaudiAgentProcessing") && (
                <>
                  <button
                    onClick={() => {
                      setCorrectionTarget({});
                      setShowCorrectionModal(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>طلب تصحيح / ملاحظة</span>
                  </button>

                  <button
                    onClick={handleLinkProgram}
                    disabled={actionLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>تم ربط البرنامج</span>
                  </button>
                </>
              )}

            {/* Step 2: Saudi Agent after Program Linked sees "طلب قبول الاستضافة" (Correction button is hidden) */}
            {isAgent && request.status === "ProgramLinked" && (
              <button
                onClick={handleRequestHostingAcceptance}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>طلب قبول الاستضافة</span>
              </button>
            )}

            {/* Step 3: Sender when HostingAcceptanceRequested sees "تم قبول طلب الاستضافة" */}
            {isSender && request.status === "HostingAcceptanceRequested" && (
              <button
                onClick={handleAcceptHosting}
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
                onClick={handleConfirmHosting}
                disabled={actionLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تأكيد الاستضافة للوكيل</span>
              </button>
            )}

            {/* Step 5: Saudi Agent when HostingConfirmed sees "تم اعتماده وإنهاء المعاملة ✓" */}
            {isAgent && request.status === "HostingConfirmed" && (
              <button
                onClick={handleAgentComplete}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تم اعتماده وإنهاء المعاملة ✓</span>
              </button>
            )}
          </div>
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
                      onClick={() => handleResolveCorrection(c.id)}
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
            <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-1 rounded-md border border-amber-200">
              مشتركة لجميع المسافرين
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">اسم المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostName || "مستضيف داخل المملكة"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">رقم هاتف المستضيف:</span>
              <span className="font-bold text-gray-800 text-sm" dir="ltr">
                {request.hostingInfo?.hostPhone || request.contactPhone || "غير محدد"}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-gray-400 block mb-0.5">العنوان والسكن:</span>
              <span className="font-bold text-gray-800 text-sm">
                {request.hostingInfo?.hostAddress || "غير محدد"}
              </span>
            </div>
          </div>

          {/* Host ID Document */}
          <div className="pt-2">
            <span className="block text-xs font-semibold text-gray-700 mb-2">
              مستند هوية المستضيف (مطلوب):
            </span>

            {(() => {
              const hostDoc =
                request.hostingInfo?.hostIdDocument ||
                request.groupDocuments?.find((d) => d.documentType === "HostId");

              return hostDoc ? (
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
                      onClick={() => setPreviewDoc(hostDoc)}
                      className="p-1.5 text-gray-600 hover:text-sky-600 hover:bg-gray-200 rounded-lg"
                      title="معاينة المستند"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {isSafaReviewer && (
                      <button
                        onClick={() => {
                          setReviewModalDoc(hostDoc);
                          setReviewStatus(hostDoc.reviewStatus);
                          setReviewNote(hostDoc.reviewNote || "");
                        }}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[11px] font-semibold"
                      >
                        تدقيق
                      </button>
                    )}

                    {canEditDocs && (
                      <button
                        onClick={() => handleDeleteDocument(hostDoc.id)}
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
                    لم يتم رفع وثيقة هوية المستضيف بعد.
                  </p>
                  {canEditDocs && (
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
              );
            })()}
          </div>
        </div>
      )}

      {/* Flight & Travel Information Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-gray-900">
              بيانات ومواعيد الرحلة والطيران
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-sky-50 text-sky-800 font-semibold px-2.5 py-1 rounded-md border border-sky-200">
              مواعيد السفر الرسمية
            </span>
            {(canEditDocs || role === "Admin") && (
              <button
                type="button"
                onClick={() => {
                  setEditDepartureDate(request.departureDate || request.travelDate || "");
                  setEditReturnDate(request.returnDate || "");
                  setEditFlightDepartureTime(request.flightDepartureTime || "");
                  setEditAirportArrivalTime(request.airportArrivalTime || "");
                  setShowFlightEditModal(true);
                }}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold px-2.5 py-1 rounded-lg border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer"
              >
                تعديل المواعيد
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* تاريخ ذهاب */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>تاريخ ذهاب:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">
              {request.departureDate || request.travelDate
                ? new Date(request.departureDate || request.travelDate!).toLocaleDateString("ar-SA")
                : "غير محدد"}
            </span>
          </div>

          {/* تاريخ عودة */}
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

          {/* وقت إقلاع الطائرة */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>وقت إقلاع الطائرة:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm" dir="ltr">
              {request.flightDepartureTime || "غير محدد"}
            </span>
          </div>

          {/* وقت تواجد المسافر في المطار */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>وقت تواجد المسافر في المطار:</span>
            </div>
            <span className="font-bold text-gray-800 text-sm" dir="ltr">
              {request.airportArrivalTime || "غير محدد"}
            </span>
          </div>
        </div>
      </div>

      {/* Travelers & Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>بيانات ووثائق المسافرين ({request.travelers.length})</span>
          </h2>
        </div>

        {request.travelers.map((traveler, tIndex) => (
          <div
            key={traveler.id}
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4"
          >
            {/* Traveler Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  {tIndex + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {traveler.fullName}
                  </h3>
                  <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                    {traveler.passportNumber && (
                      <span className="font-mono">
                        جواز: {traveler.passportNumber}
                      </span>
                    )}
                    {traveler.nationality && (
                      <span>• الجنسية: {traveler.nationality}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(isSafaReviewer || isAgent) && (
                  <button
                    onClick={() => {
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {(["Passport", "PersonalPhoto", "FlightTicket"] as DocumentType[]).map(
                (docType) => {
                  const doc = traveler.documents.find(
                    (d) => d.documentType === docType
                  );

                  return (
                    <div
                      key={docType}
                      className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60 flex flex-col justify-between"
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
                              onClick={() => setPreviewDoc(doc)}
                              className="px-2.5 py-1 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-md font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>معاينة</span>
                            </button>

                            {isSafaReviewer && (
                              <button
                                onClick={() => {
                                  setReviewModalDoc(doc);
                                  setReviewStatus(doc.reviewStatus);
                                  setReviewNote(doc.reviewNote || "");
                                }}
                                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium cursor-pointer"
                              >
                                تدقيق
                              </button>
                            )}

                            {canEditDocs && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
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
                          {canEditDocs ? (
                            <label className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer">
                              <UploadCloud className="w-4 h-4" />
                              <span>رفع المستند</span>
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
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status Timeline History */}
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
                <a
                  href={api.documents.getStreamUrl(previewDoc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
                >
                  فتح في نافذة مستقلة
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-900/5 p-4 overflow-auto flex items-center justify-center relative">
              {previewDoc.mimeType === "application/pdf" ? (
                <iframe
                  src={api.documents.getStreamUrl(previewDoc.id)}
                  className="w-full h-full rounded-lg border-0 bg-white"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={api.documents.getStreamUrl(previewDoc.id)}
                  alt="Document preview"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
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
                disabled={actionLoading || !nusukInput.trim()}
                className="px-4 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    <span>تاريخ ذهاب</span>
                  </label>
                  <input
                    type="date"
                    value={editDepartureDate}
                    onChange={(e) => setEditDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>تاريخ عودة</span>
                  </label>
                  <input
                    type="date"
                    value={editReturnDate}
                    onChange={(e) => setEditReturnDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>وقت إقلاع الطائرة</span>
                  </label>
                  <input
                    type="time"
                    value={editFlightDepartureTime}
                    onChange={(e) => setEditFlightDepartureTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>وقت تواجد المسافر في المطار</span>
                  </label>
                  <input
                    type="time"
                    value={editAirportArrivalTime}
                    onChange={(e) => setEditAirportArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-gray-800"
                  />
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
    </div>
  );
}
