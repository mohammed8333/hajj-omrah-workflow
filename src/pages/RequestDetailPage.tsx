import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  Hash,
  Copy,
  Plus,
  Edit2,
} from "lucide-react";

export default function RequestDetailPage() {
  const { id: requestId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [request, setRequest] = useState<GroupRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  // Add Traveler Modal
  const [showAddTravelerModal, setShowAddTravelerModal] = useState(false);
  const [newTrvName, setNewTrvName] = useState("");
  const [newTrvPassport, setNewTrvPassport] = useState("");
  const [newTrvNationality, setNewTrvNationality] = useState("سعودي");
  const [newTrvDob, setNewTrvDob] = useState("");

  const [copiedNusuk, setCopiedNusuk] = useState(false);

  const loadRequest = async () => {
    if (!requestId) return;
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

  // Handle preview opening
  const handleOpenPreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    const url = await api.documents.getStreamUrl(doc.id);
    setPreviewUrl(url);
  };

  const handleFileUpload = async (
    file: File,
    docType: DocumentType,
    travelerId?: string
  ) => {
    if (!requestId) return;
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

  const handleSubmitRequest = async () => {
    if (!requestId) return;
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
    if (!requestId) return;
    try {
      setActionLoading(true);
      setError(null);
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

  const handleSafaComplete = async () => {
    if (!requestId) return;
    if (!nusukInput.trim()) {
      alert("يرجى إدخال رقم المجموعة الصادر من منصة نسك");
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.safaComplete(requestId, nusukInput.trim(), nusukNote.trim());
      setSuccess("تم حفظ رقم نسك وإكمال إجراءات تسجيل الصفا بنجاح.");
      setShowNusukModal(false);
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToAgent = async () => {
    if (!requestId) return;
    if (!confirm("هل أنت متأكد من إحالة المعاملة إلى الوكيل السعودي؟")) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.sendToAgent(requestId);
      setSuccess("تمت إحالة المعاملة بنجاح إلى الوكيل السعودي.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgentReceive = async () => {
    if (!requestId) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.agentReceive(requestId, "استلام المعاملة وبدء المعالجة");
      setSuccess("تم استلام المعاملة وتغيير حالتها إلى قيد المعالجة.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgentComplete = async () => {
    if (!requestId) return;
    if (!confirm("هل تم إصدار جميع التأشيرات وإنهاء المعاملة بالكامل؟")) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.agentComplete(requestId, "تم إصدار التأشيرات وإتمام المعاملة بنجاح");
      setSuccess("تهانينا! اكتملت المعاملة نهائياً بنجاح.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCorrection = async () => {
    if (!requestId) return;
    if (!correctionReason.trim()) {
      alert("يرجى كتابة سبب طلب التصحيح بالتفصيل");
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.requestCorrection(requestId, {
        travelerId: correctionTarget.travelerId,
        documentId: correctionTarget.documentId,
        targetField: correctionTarget.targetField,
        reason: correctionReason.trim(),
      });
      setSuccess("تم تسجيل طلب التصحيح وإشعار مرسل المعاملة.");
      setShowCorrectionModal(false);
      setCorrectionReason("");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveCorrection = async (corrId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await api.requests.resolveCorrection(corrId, "تم التعديل وحل الملاحظة");
      setSuccess("تم حل الملاحظة وإعادة المعاملة لحالة المراجعة.");
      await loadRequest();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTraveler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || !newTrvName.trim()) return;
    try {
      setActionLoading(true);
      await api.travelers.add(requestId, {
        fullName: newTrvName.trim(),
        passportNumber: newTrvPassport.trim() || undefined,
        nationality: newTrvNationality.trim() || undefined,
        dateOfBirth: newTrvDob || undefined,
      });
      setSuccess("تمت إضافة المعتمر بنجاح.");
      setShowAddTravelerModal(false);
      setNewTrvName("");
      setNewTrvPassport("");
      setNewTrvDob("");
      await loadRequest();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTraveler = async (trvId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المعتمر وجميع مستنداته؟")) return;
    try {
      setActionLoading(true);
      await api.travelers.delete(trvId);
      setSuccess("تم حذف المعتمر بنجاح.");
      await loadRequest();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-sm">جاري تحميل تفاصيل المعاملة...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center text-gray-500 max-w-lg mx-auto border border-gray-100 shadow-xs">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-800">المعاملة غير موجودة</h2>
        <p className="text-xs text-gray-400 mt-1 mb-4">
          قد تكون المعاملة حذفت أو أن الرابط غير صحيح.
        </p>
        <Link
          to="/requests"
          className="inline-flex items-center gap-2 bg-sky-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
          <span>العودة لقائمة المعاملات</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                title="رجوع"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                {request.requestNumber}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                {request.groupName}
              </h1>
              <RequestStatusBadge status={request.status} />
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap mr-7">
              <span>المرسل: <strong>{request.senderName}</strong></span>
              <span>تاريخ التقديم: {new Date(request.createdAt).toLocaleDateString("ar-SA")}</span>
              {request.travelDate && <span>السفر: {request.travelDate}</span>}
              {request.contactPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span dir="ltr">{request.contactPhone}</span>
                </span>
              )}
            </div>
          </div>

          {/* Role-based Action Bar */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
            {/* SENDER ACTIONS */}
            {role === "Sender" && request.status === "Draft" && (
              <button
                onClick={handleSubmitRequest}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>تقديم المعاملة للتدقيق</span>
              </button>
            )}

            {/* SAFA EMPLOYEE ACTIONS */}
            {(role === "SafaEmployee" || role === "Admin") && (
              <>
                {request.status === "Submitted" && (
                  <button
                    onClick={handleSafaStartReview}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>بدء مراجعة الصفا</span>
                  </button>
                )}

                {(request.status === "UnderReview" || request.status === "Submitted") && (
                  <button
                    onClick={() => setShowNusukModal(true)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Hash className="w-4 h-4" />
                    <span>إدخال رقم نسك وإنهاء تسجيل الصفا</span>
                  </button>
                )}

                {request.status === "SafaRegistrationCompleted" && (
                  <button
                    onClick={handleSendToAgent}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>إحالة المعاملة للوكيل السعودي</span>
                  </button>
                )}
              </>
            )}

            {/* SAUDI AGENT ACTIONS */}
            {(role === "SaudiAgent" || role === "Admin") && (
              <>
                {request.status === "ReadyForSaudiAgent" && (
                  <button
                    onClick={handleAgentReceive}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>استلام المعاملة من قبل الوكيل</span>
                  </button>
                )}

                {request.status === "ReceivedBySaudiAgent" && (
                  <button
                    onClick={handleAgentComplete}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>إصدار التأشيرات وإنهاء المعاملة ✓</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Nusuk Banner if present */}
        {request.nusukGroupNumber && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 text-xs font-medium">
              <Hash className="w-4 h-4 text-emerald-600" />
              <span>رقم المجموعة المعتمد في منصة نسك:</span>
              <strong className="font-mono text-sm text-emerald-800">
                {request.nusukGroupNumber}
              </strong>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(request.nusukGroupNumber!);
                setCopiedNusuk(true);
                setTimeout(() => setCopiedNusuk(false), 2000);
              }}
              className="px-2.5 py-1 rounded bg-white text-emerald-700 border border-emerald-300 text-xs font-semibold hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
            >
              {copiedNusuk ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNusuk ? "تم النسخ" : "نسخ الرقم"}</span>
            </button>
          </div>
        )}

        {/* Success / Error alerts */}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between border border-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center justify-between border border-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Pending Corrections Alert */}
      {request.correctionRequests.filter((c) => c.status === "Pending").length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>تنبيه: توجد ملاحظات تصحيح مطلوبة على هذه المعاملة</span>
          </div>
          <div className="space-y-2">
            {request.correctionRequests
              .filter((c) => c.status === "Pending")
              .map((corr) => (
                <div
                  key={corr.id}
                  className="bg-white p-3 rounded-xl border border-rose-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-800">
                      {corr.travelerName ? `المعتمر: ${corr.travelerName}` : "المعاملة العامة"}
                      {corr.targetField && ` (${corr.targetField})`}
                    </div>
                    <div className="text-rose-700 mt-0.5">{corr.reason}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      طلب بواسطة: {corr.requestedByName} في {new Date(corr.createdAt).toLocaleDateString("ar-SA")}
                    </div>
                  </div>

                  {(role === "Sender" || role === "Admin") && (
                    <button
                      onClick={() => handleResolveCorrection(corr.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs cursor-pointer shrink-0"
                    >
                      تأكيد التصحيح
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Main Grid: Travelers & Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Travelers Column (2 cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-bold text-gray-900">
                  قائمة المعتمرين ({request.travelers.length})
                </h2>
              </div>

              {(role === "Sender" || role === "Admin") && (
                <button
                  onClick={() => setShowAddTravelerModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة معتمر</span>
                </button>
              )}
            </div>

            {request.travelers.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs">
                لا يوجد معتمرين مسجلين في هذا الفوج حتى الآن.
              </div>
            ) : (
              <div className="space-y-4">
                {request.travelers.map((trv, idx) => (
                  <div
                    key={trv.id}
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3"
                  >
                    {/* Traveler Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {trv.fullName}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            جواز: {trv.passportNumber || "لم يُحدد"} | الجنسية: {trv.nationality || "سعودي"} | الميلاد: {trv.dateOfBirth || "لم يُحدد"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Request Correction button for Safa / Agent */}
                        {(role === "SafaEmployee" || role === "SaudiAgent" || role === "Admin") && (
                          <button
                            onClick={() => {
                              setCorrectionTarget({
                                travelerId: trv.id,
                                targetField: "بيانات المعتمر والجواز",
                              });
                              setShowCorrectionModal(true);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="طلب تصحيح على هذا المعتمر"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="hidden sm:inline">طلب تصحيح</span>
                          </button>
                        )}

                        {(role === "Sender" || role === "Admin") && (
                          <button
                            onClick={() => handleDeleteTraveler(trv.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="حذف المعتمر"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Traveler Documents */}
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-600 font-semibold">
                        <span>المستندات والوثائق المرفقة:</span>

                        {/* Upload doc button */}
                        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2 py-1 rounded cursor-pointer">
                          <FileUp className="w-3 h-3" />
                          <span>رفع جواز / وثيقة</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, "Passport", trv.id);
                            }}
                          />
                        </label>
                      </div>

                      {trv.documents && trv.documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {trv.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-2.5 rounded-lg bg-white border border-gray-200 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                                <div className="truncate">
                                  <div className="font-semibold text-gray-800 truncate">
                                    {DOCUMENT_TYPE_LABELS[doc.documentType]}
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    {doc.originalFileName}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <DocumentStatusBadge status={doc.reviewStatus} />

                                <button
                                  onClick={() => handleOpenPreview(doc)}
                                  className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer"
                                  title="معاينة"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {(role === "SafaEmployee" || role === "SaudiAgent" || role === "Admin") && (
                                  <button
                                    onClick={() => {
                                      setReviewModalDoc(doc);
                                      setReviewStatus(doc.reviewStatus);
                                    }}
                                    className="p-1 text-gray-500 hover:text-emerald-600 rounded cursor-pointer"
                                    title="تدقيق المستند"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400 italic bg-white p-2 rounded border border-dashed border-gray-200">
                          لم يتم إرفاق جواز سفر أو صورة شخصية لهذا المعتمر بعد.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group General Documents */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-gray-900">
                  مستندات الفوج العامة (تذاكر، كشوفات، عقد السكن)
                </h2>
              </div>

              <label className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl cursor-pointer">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>رفع مستند عام</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, "FlightTicket");
                  }}
                />
              </label>
            </div>

            {request.groupDocuments.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-xs">
                لا توجد مستندات عامة مرفقة بالفوج.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.groupDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-gray-800">
                          {DOCUMENT_TYPE_LABELS[doc.documentType]}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {doc.originalFileName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DocumentStatusBadge status={doc.reviewStatus} />
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer"
                        title="معاينة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info & Timeline (1 col on desktop) */}
        <div className="space-y-6">
          {/* Hosting Info Card */}
          {request.hasHosting && request.hostingInfo && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <Home className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-sm text-gray-900">بيانات السكن والاستضافة</h3>
              </div>
              <div className="text-xs space-y-1.5 text-gray-600">
                <div>
                  <span className="text-gray-400">الفندق / المستضيف: </span>
                  <strong className="text-gray-800">{request.hostingInfo.hostName}</strong>
                </div>
                <div>
                  <span className="text-gray-400">الهاتف: </span>
                  <strong className="text-gray-800" dir="ltr">{request.hostingInfo.hostPhone}</strong>
                </div>
                {request.hostingInfo.hostAddress && (
                  <div>
                    <span className="text-gray-400">العنوان: </span>
                    <strong className="text-gray-800">{request.hostingInfo.hostAddress}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline / Status History */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-sm text-gray-900">سجل تتبع ومراحل المعاملة</h3>
            </div>

            <div className="space-y-3 relative before:absolute before:inset-0 before:right-2.5 before:w-0.5 before:bg-gray-100">
              {request.statusHistories.map((h, idx) => (
                <div key={h.id || idx} className="relative flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-sky-100 border-2 border-white text-sky-700 flex items-center justify-center shrink-0 z-10 text-[10px] font-bold">
                    ✓
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <RequestStatusBadge status={h.toStatus} />
                      <span className="text-[10px] text-gray-400">
                        {new Date(h.createdAt).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                    {h.note && (
                      <p className="text-gray-600 text-[11px] pt-0.5">{h.note}</p>
                    )}
                    <div className="text-[10px] text-gray-400">
                      بواسطة: {h.changedByName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  معاينة: {DOCUMENT_TYPE_LABELS[previewDoc.documentType]}
                </h3>
                <p className="text-xs text-gray-400">{previewDoc.originalFileName}</p>
              </div>
              <button
                onClick={() => {
                  setPreviewDoc(null);
                  setPreviewUrl(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-2 border border-gray-100">
              {previewUrl ? (
                previewDoc.mimeType.startsWith("image/") ? (
                  <img
                    src={previewUrl}
                    alt="معاينة المستند"
                    className="max-h-[55vh] rounded-lg object-contain"
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    className="w-full h-96 rounded-lg border-0"
                    title="معاينة المستند"
                  />
                )
              ) : (
                <div className="py-12 text-gray-400 text-xs">جاري تحميل المعاينة...</div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setPreviewDoc(null);
                  setPreviewUrl(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Review Document Modal */}
      {reviewModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">تدقيق واعتماد المستند</h3>
              <button
                onClick={() => setReviewModalDoc(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  حالة الاعتماد
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as DocumentReviewStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white"
                >
                  <option value="Accepted">مقبول ومطابق ✓</option>
                  <option value="NeedsCorrection">يحتاج تصحيح ⚠️</option>
                  <option value="Rejected">مرفوض ✗</option>
                  <option value="Pending">قيد الانتظار</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ملاحظة التدقيق
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  placeholder="اكتب أي ملاحظة عن الوثيقة أو سبب الرفض..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setReviewModalDoc(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleReviewDocument}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                حفظ نتيجة التدقيق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Nusuk Number Modal (Safa Employee) */}
      {showNusukModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-sm">تسجيل رقم مجموعة نسك</h3>
              </div>
              <button
                onClick={() => setShowNusukModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رقم المجموعة في منصة نسك <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nusukInput}
                  onChange={(e) => setNusukInput(e.target.value)}
                  placeholder="مثال: NSK-12345678"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ملاحظة حول التسجيل (اختياري)
                </label>
                <textarea
                  value={nusukNote}
                  onChange={(e) => setNusukNote(e.target.value)}
                  rows={2}
                  placeholder="تم اعتماد الفوج في منصة نسك..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowNusukModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleSafaComplete}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                تأكيد وإتمام تسجيل الصفا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Request Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-gray-900 text-sm">طلب تصحيح أو استكمال</h3>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  سبب طلب التصحيح بالتفصيل <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  rows={4}
                  placeholder="مثال: صورة الجواز غير واضحة، أو تاريخ الميلاد غير مطابق للوثيقة..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateCorrection}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                إرسال طلب التصحيح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Traveler Modal */}
      {showAddTravelerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-gray-900 text-sm">إضافة معتمر جديد إلى الفوج</h3>
              </div>
              <button
                onClick={() => setShowAddTravelerModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTraveler} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTrvName}
                  onChange={(e) => setNewTrvName(e.target.value)}
                  placeholder="الاسم الرباعي كما في الجواز"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رقم جواز السفر
                </label>
                <input
                  type="text"
                  value={newTrvPassport}
                  onChange={(e) => setNewTrvPassport(e.target.value)}
                  placeholder="مثال: A12345678"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    الجنسية
                  </label>
                  <input
                    type="text"
                    value={newTrvNationality}
                    onChange={(e) => setNewTrvNationality(e.target.value)}
                    placeholder="الجنسية"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    تاريخ الميلاد
                  </label>
                  <input
                    type="date"
                    value={newTrvDob}
                    onChange={(e) => setNewTrvDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddTravelerModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  حفظ المعتمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
