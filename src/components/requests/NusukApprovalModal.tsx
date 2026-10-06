"use client";

import React, { useState, useEffect } from "react";
import { Building, X, Sparkles, Check, Send, Loader2 } from "lucide-react";
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
  const { alert } = useDialog();
  const [nusukInput, setNusukInput] = useState("");
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    }
  }, [request, isOpen, currentUser]);

  if (!isOpen || !request) return null;

  const dep = request.departureDate || request.travelDate;
  const ret = request.returnDate;
  const senderCode = request.senderCode || resolveSenderCode(currentUser);
  const suggestedName = formatOfficialGroupName(senderCode, dep, ret);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setSubmitting(true);
      await api.requests.safaComplete(
        request.id,
        nusukInput.trim(),
        notes.trim() || undefined,
        groupName.trim()
      );

      // Auto send to WhatsApp group
      try {
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

        await sendWhatsAppGroupPackage({
          nusukNumber: nusukInput.trim(),
          hasHosting: Boolean(request.hasHosting),
          hostPhone: request.hostPhone || request.hostingInfo?.hostPhone || request.contactPhone,
          contactPhone: request.contactPhone,
          ticketDocId,
          ticketDocUrl: request.flightTicketDocumentUrl,
          hostDocId,
          hostDocUrl: request.hostIdDocumentUrl,
        });
      } catch (waErr) {
        console.warn("WhatsApp group package auto-send error:", waErr);
      }

      onSuccess("تم اعتماد رقم نسك وتحويل المعاملة للوكيل السعودي وإرسالها للواتس بنجاح 📲🕋");
      onClose();
    } catch (err: any) {
      await alert({
        title: "خطأ في الاعتماد",
        message: err.message || "تعذر اعتماد رقم نسك.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
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
          أدخل رقم مجموعة نسك المعتمد لتثبيته وتحويل المعاملة فوراً إلى الوكيل السعودي وإرسال حزمة المعاملة لمجموعة الواتساب 📲.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              رقم مجموعة نسك *
            </label>
            <input
              type="text"
              value={nusukInput}
              onChange={(e) => setNusukInput(e.target.value)}
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
                  onClick={() => setGroupName(suggestedName)}
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
              onChange={(e) => setGroupName(e.target.value)}
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
              placeholder="أي توجيهات خاصة بالباقة أو التأشيرة..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || !nusukInput.trim() || !groupName.trim()}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>اعتماد وتحويل وإرسال للواتس 📲</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
