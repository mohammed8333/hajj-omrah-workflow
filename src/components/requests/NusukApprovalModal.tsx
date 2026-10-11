"use client";

import React, { useState, useEffect } from "react";
import { Building, X, Sparkles, Check, Loader2, Save, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatOfficialGroupName, resolveSenderCode } from "@/lib/groupNaming";
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
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

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
      setIsSaved(false);
      setSaveSuccessMsg(null);
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
    if (isSaved) {
      setIsSaved(false);
      setSaveSuccessMsg(null);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
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
      setSaveSuccessMsg("تم اعتماد وحفظ رقم نسك واسم المجموعة بنجاح ✓");
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
          أدخل رقم مجموعة نسك المعتمد واسم المجموعة لتثبيتهما واعتماد المعاملة.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
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

          {/* تنبيهات النجاح */}
          {saveSuccessMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
              >
                {isSaved ? "إغلاق النافذة" : "إلغاء"}
              </button>
              {currentUser?.role === "Admin" && request?.nusukGroupNumber && (
                <button
                  type="button"
                  onClick={handleRevert}
                  disabled={saving}
                  className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                  title="تراجع المسؤول عن اعتماد رقم نسك"
                >
                  <Undo2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>التراجع عن اعتماد نسك</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !nusukInput.trim() || !groupName.trim()}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                isSaved
                  ? "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
              title="اعتماد وحفظ رقم نسك"
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
          </div>
        </form>
      </div>
    </div>
  );
};
