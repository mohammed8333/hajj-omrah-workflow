"use client";

import React, { useState, useEffect } from "react";
import { Building, X, Sparkles, Check, Send, Loader2, Save, ExternalLink, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatOfficialGroupName, resolveSenderCode } from "@/lib/groupNaming";
import { sendWhatsAppGroupPackage } from "@/lib/whatsappGroupSend";
import { useDialog } from "@/lib/dialog-context";

interface NusukApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    id: string;
    groupName?: string;
    nusukGroupNumber?: string;
    senderCode?: string;
    travelDate?: string;
    departureDate?: string;
    returnDate?: string;
    hasHosting?: boolean;
    hostPhone?: string;
    contactPhone?: string;
    flightTicketDocumentId?: string;
    flightTicketDocumentUrl?: string;
    hostIdDocumentId?: string;
    hostIdDocumentUrl?: string;
    groupDocuments?: any[];
    travelers?: any[];
    hostingInfo?: any;
    flightTicketDocument?: any;
  } | null;
  currentUser?: any;
  onSuccess: (msg?: string) => void;
}

export const NusukApprovalModal: React.FC<NusukApprovalModalProps> = ({
  isOpen,
  onClose,
  request,
  currentUser,
  onSuccess,
}) => {
  const { alert, confirm } = useDialog();
  const [nusukInput, setNusukInput] = useState("");
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");
  const [customWaLink, setCustomWaLink] = useState("");
  const [generatedWaUrl, setGeneratedWaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [waSuccessMsg, setWaSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (request && isOpen) {
      const dep = request.departureDate || request.travelDate;
      const ret = request.returnDate;
      const senderCode = request.senderCode || resolveSenderCode(currentUser);
      const suggested = formatOfficialGroupName(senderCode, dep, ret);
      const currentIsGeneric =
        !request.groupName ||
        request.groupName.startsWith("مجموعة ") ||
        request.groupName.startsWith("طلب جديد");

      setGroupName(
        currentIsGeneric && suggested
          ? suggested
          : request.groupName || suggested || ""
      );
      setNusukInput(request.nusukGroupNumber || "");
      setNotes("");
      if (typeof window !== "undefined") {
        setCustomWaLink(localStorage.getItem("safa_whatsapp_target_link") || "");
      }
      setGeneratedWaUrl(null);
      setIsSaved(false);
      setSaveSuccessMsg(null);
      setWaSuccessMsg(null);
    }
  }, [request, isOpen, currentUser]);

  if (!isOpen || !request) return null;

  const dep = request.departureDate || request.travelDate;
  const ret = request.returnDate;
  const senderCode = request.senderCode || resolveSenderCode(currentUser);
  const suggestedName = formatOfficialGroupName(senderCode, dep, ret);

  const handleInputChange = (field: "nusuk" | "group", val: string) => {
    if (field === "nusuk") setNusukInput(val);
    if (field === "group") setGroupName(val);
    // Any change after saving resets the saved state
    if (isSaved) {
      setIsSaved(false);
      setSaveSuccessMsg(null);
    }
  };

  // 1. اعتماد وحفظ المعاملة فقط مع البقاء في نفس المكان
  const handleSaveOnly = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!nusukInput.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال رقم مجموعة نسك.",
        variant: "warning",
      });
      return;
    }
    if (!groupName.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال اسم المجموعة.",
        variant: "warning",
      });
      return;
    }

    try {
      setSaving(true);
      setSaveSuccessMsg(null);
      await api.requests.safaComplete(
        request.id,
        nusukInput.trim(),
        notes.trim() || undefined,
        groupName.trim()
      );

      request.nusukGroupNumber = nusukInput.trim();
      request.groupName = groupName.trim();
      setIsSaved(true);
      setSaveSuccessMsg("تم اعتماد وحفظ رقم نسك واسم المجموعة بنجاح ✓ يمكنك الآن الضغط على زر إرسال واتساب أدناه.");
      onSuccess?.("تم اعتماد وحفظ رقم نسك بنجاح");
    } catch (err: any) {
      await alert({
        title: "خطأ في الاعتماد",
        message: err.message || "تعذر اعتماد وحفظ رقم نسك.",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  // 2. إرسال الحزمة لمجموعة الواتساب (يحفظ تلقائياً إذا لم يتم الحفظ بعد)
  const handleSendWhatsApp = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!nusukInput.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال رقم مجموعة نسك أولاً.",
        variant: "warning",
      });
      return;
    }
    if (!groupName.trim()) {
      await alert({
        title: "تنبيه",
        message: "يرجى إدخال اسم المجموعة أولاً.",
        variant: "warning",
      });
      return;
    }

    // 🌟 فتح نافذة فارغة فورياً بشكل متزامن قبل أي استدعاء غير متزامن لتجاوز مانع النوافذ المنبثقة تماماً
    let waWindow: Window | null = null;
    try {
      waWindow = window.open("about:blank", "_blank");
      if (waWindow) {
        waWindow.document.write(
          '<html dir="rtl"><head><title>جاري فتح الواتساب...</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:24px;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:360px;"><h3 style="color:#059669;margin:0 0 8px 0;font-size:18px;">جاري تجهيز حزمة الواتساب... 📲</h3><p style="color:#6b7280;font-size:13px;margin:0;">سيتم فتح الواتساب فوراً، يرجى الانتظار ثوانٍ معدودة...</p></div></body></html>'
        );
      }
    } catch (popupErr) {
      console.warn("Pre-opening window warning:", popupErr);
    }

    try {
      setSendingWa(true);
      setWaSuccessMsg(null);

      // حفظ أولاً إذا لم يكن محفوظاً
      if (!isSaved) {
        await api.requests.safaComplete(
          request.id,
          nusukInput.trim(),
          notes.trim() || undefined,
          groupName.trim()
        );
        request.nusukGroupNumber = nusukInput.trim();
        request.groupName = groupName.trim();
        setIsSaved(true);
        onSuccess?.("تم اعتماد وحفظ رقم نسك بنجاح");
      }

      // إرسال الحزمة لمجموعة الواتساب
      const ticketDocId =
        request.flightTicketDocumentId ||
        request.groupDocuments?.find((d: any) => d.id === request.flightTicketDocumentId)?.id ||
        request.groupDocuments?.filter((d: any) => d.documentType === "FlightTicket").slice(-1)[0]?.id ||
        request.travelers?.[0]?.documents?.find((d: any) => d.documentType === "FlightTicket")?.id;

      const hostDocId =
        request.hostIdDocumentId ||
        request.hostingInfo?.hostIdDocumentId ||
        request.groupDocuments?.find((d: any) => d.id === request.hostingInfo?.hostIdDocumentId)?.id ||
        request.groupDocuments?.filter((d: any) => d.documentType === "HostId").slice(-1)[0]?.id;

      const result = await sendWhatsAppGroupPackage({
        nusukNumber: nusukInput.trim(),
        hasHosting: Boolean(request.hasHosting),
        hostPhone: request.hostPhone || request.hostingInfo?.hostPhone || request.contactPhone,
        contactPhone: request.contactPhone,
        ticketDocId,
        ticketDocUrl: request.flightTicketDocumentUrl,
        hostDocId,
        hostDocUrl: request.hostIdDocumentUrl,
        preOpenedWindow: waWindow,
        customGroupLink: customWaLink.trim() || undefined,
      });

      setGeneratedWaUrl(result.whatsappUrl);
      setWaSuccessMsg("تم نسخ رسالة المعاملة وتجهيزها وفتح الواتساب بنجاح 📲🕋");
    } catch (waErr: any) {
      if (waWindow && !waWindow.closed) {
        waWindow.close();
      }
      console.warn("WhatsApp group package auto-send error:", waErr);
      await alert({
        title: "تنبيه في إرسال الواتساب",
        message: waErr?.message || "تعذر إرسال الحزمة لمجموعة الواتساب تلقائياً.",
        variant: "warning",
      });
    } finally {
      setSendingWa(false);
    }
  };

  const handleRevert = async () => {
    if (!request || currentUser?.role !== "Admin") return;
    const ok = await confirm({
      title: "تأكيد التراجع عن اعتماد رقم نسك",
      message: `هل أنت متأكد من رغبتك كمسؤول (Admin) في التراجع عن اعتماد رقم نسك${request.nusukGroupNumber ? ` (${request.nusukGroupNumber})` : ""}؟\n\nسيتم حذف رقم نسك وإعادة حالة المعاملة إلى "قيد التدقيق والمراجعة" (UnderReview).`,
      confirmText: "نعم، تراجع عن اعتماد نسك",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setSaving(true);
      await api.requests.revertNusukApproval(request.id);
      onSuccess("تم التراجع عن اعتماد رقم نسك بنجاح");
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        await alert({ title: "خطأ", message: err.message, variant: "danger" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <span>اعتماد رقم نسك وتحويل للوكيل السعودي</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          أدخل رقم مجموعة نسك المعتمد لتثبيته، ثم يمكنك حفظه أو إرسال الحزمة فوراً لمجموعة الواتساب 📲.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleSaveOnly(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              رقم مجموعة نسك *
            </label>
            <input
              type="text"
              value={nusukInput}
              onChange={(e) => handleInputChange("nusuk", e.target.value)}
              placeholder="مثال: NUSUK-109283"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="block text-xs font-semibold text-gray-700">
                اسم المجموعة *
              </label>
              {suggestedName && suggestedName !== groupName && (
                <button
                  type="button"
                  onClick={() => handleInputChange("group", suggestedName)}
                  className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="تطبيق التسمية المعتمدة تلقائياً بنقرة واحدة"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>توليد الاسم المعتمد 🪄</span>
                </button>
              )}
              {suggestedName && suggestedName === groupName && (
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>الاسم المعتمد مفعّل ✓</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(e) => handleInputChange("group", e.target.value)}
              placeholder="أدخل اسم المجموعة المعتمد..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              ملاحظات إنهاء التسجيل (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي توجيهات خاصة بالباقة أو المعاملة..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              رابط مجموعة الواتساب (اختياري)
            </label>
            <input
              type="text"
              value={customWaLink}
              onChange={(e) => {
                setCustomWaLink(e.target.value);
                if (typeof window !== "undefined") {
                  localStorage.setItem("safa_whatsapp_target_link", e.target.value.trim());
                }
              }}
              placeholder="مثال: https://chat.whatsapp.com/..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              إذا لم تضع رابط مجموعة، سيتم فتح محادثة الواتساب مع تجهيز نص الرسالة وتنزيل المستندات تلقائياً.
            </p>
          </div>

          {/* تنبيهات النجاح في نفس المكان */}
          {saveSuccessMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {waSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{waSuccessMsg}</span>
              </div>
              {generatedWaUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={generatedWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح محادثة الواتساب الآن ↗</span>
                  </a>
                </div>
              )}
            </div>
          )}


          {/* أزرار الإجراءات: زر اعتماد/حفظ مع البقاء في نفس المكان، وزر إرسال واتساب جنبه */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || sendingWa}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
              >
                {isSaved ? "إغلاق النافذة" : "إلغاء"}
              </button>
              {currentUser?.role === "Admin" && request?.nusukGroupNumber && (
                <button
                  type="button"
                  onClick={handleRevert}
                  disabled={saving || sendingWa}
                  className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                  title="تراجع المسؤول عن اعتماد رقم نسك"
                >
                  <Undo2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>التراجع عن اعتماد نسك</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* زر اعتماد أو حفظ (يبقى في نفس المكان) */}
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={saving || sendingWa || !nusukInput.trim() || !groupName.trim()}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                  isSaved
                    ? "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                    : "bg-teal-600 hover:bg-teal-700 text-white"
                }`}
                title="اعتماد وحفظ رقم نسك مع البقاء في نفس الصفحة"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isSaved ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaved ? "تم الحفظ ✓" : "اعتماد وحفظ"}</span>
              </button>

              {/* زر إرسال واتساب بجانبه مباشرة */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={saving || sendingWa || !nusukInput.trim() || !groupName.trim()}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="إرسال المعاملة إلى مجموعة الواتساب"
              >
                {sendingWa ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>إرسال واتساب 📲</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
