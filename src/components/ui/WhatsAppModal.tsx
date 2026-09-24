"use client";

import React, { useState, useEffect } from "react";
import { GroupRequestDetail, GroupRequestSummary } from "@/types";
import {
  WHATSAPP_TEMPLATES,
  WhatsAppTemplateType,
  generateWhatsAppMessage,
  formatPhoneForWhatsApp,
  buildWhatsAppUrl,
} from "@/lib/whatsappTemplates";
import {
  X,
  Send,
  Copy,
  Check,
  Phone,
  MessageCircle,
  Sparkles,
  Plane,
  AlertTriangle,
  FileText,
  CheckCircle2,
} from "lucide-react";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: GroupRequestDetail | GroupRequestSummary;
}

export function WhatsAppModal({ isOpen, onClose, request }: WhatsAppModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateType>("NUSUK_ISSUED");
  const [phone, setPhone] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize recipient phone from request contact or host phone
  useEffect(() => {
    if (isOpen && request) {
      const hostPhone = (request as any).hostPhone || (request as any).hostingInfo?.hostPhone;
      const defaultPhone = request.contactPhone || hostPhone || "";
      setPhone(defaultPhone);
      // Auto-select template based on request state
      if (request.nusukGroupNumber && request.status !== "Completed") {
        setSelectedTemplate("NUSUK_ISSUED");
      } else if (request.status === "Completed") {
        setSelectedTemplate("COMPLETED");
      } else if (request.status === "CorrectionRequired") {
        setSelectedTemplate("NEEDS_CORRECTION");
      } else {
        setSelectedTemplate("NEW_REQUEST");
      }
    }
  }, [isOpen, request]);

  if (!isOpen) return null;

  const currentMessage = generateWhatsAppMessage(selectedTemplate, request, customNote);
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const isValidPhone = cleanPhone.length >= 8;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    const url = buildWhatsAppUrl(phone, selectedTemplate, request, customNote);
    window.open(url, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">إرسال إشعار واتساب ذكي</h3>
              <p className="text-xs text-emerald-100">
                المعاملة: {request.requestNumber} ({request.groupName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-right overflow-y-auto max-h-[75vh]">
          {/* Phone Number Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
              <span>رقم هاتف المستلم (واتساب):</span>
              <span className="text-[11px] text-gray-500 font-normal">
                {request.contactPhone && (
                  <button
                    type="button"
                    onClick={() => setPhone(request.contactPhone)}
                    className="text-emerald-700 hover:underline mr-2 cursor-pointer"
                  >
                    هاتف التواصل ({request.contactPhone})
                  </button>
                )}
                {(() => {
                  const hPhone = (request as any).hostPhone || (request as any).hostingInfo?.hostPhone;
                  if (hPhone && hPhone !== request.contactPhone) {
                    return (
                      <button
                        type="button"
                        onClick={() => setPhone(hPhone)}
                        className="text-emerald-700 hover:underline cursor-pointer"
                      >
                        هاتف المستضيف ({hPhone})
                      </button>
                    );
                  }
                  return null;
                })()}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 0501234567 أو 01012345678"
                className="w-full text-left font-mono px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all pl-10"
              />
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
            </div>
            {!isValidPhone && phone.trim() !== "" && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                يرجى التأكد من كتابة الرقم بشكل صحيح (سعودي أو مصري أو دولي).
              </p>
            )}
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              اختر نوع الإشعار / القالب:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WHATSAPP_TEMPLATES.map((tpl) => {
                const isSelected = selectedTemplate === tpl.type;
                return (
                  <button
                    key={tpl.type}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.type)}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold"
                        : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-slate-50 text-gray-800"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center justify-between">
                      {tpl.title}
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-1 block leading-tight font-normal">
                      {tpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Custom Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              ملاحظة إضافية (اختياري تضاف لنص الرسالة):
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="مثال: يرجى إحضار أصل الجوازات والتأشيرات..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                معاينة رسالة الواتساب:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ" : "نسخ النص"}</span>
              </button>
            </div>
            <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-3.5 text-xs text-gray-900 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
              {currentMessage}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!isValidPhone}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isValidPhone
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20 active:scale-98"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4 rotate-180" />
            <span>إرسال عبر واتساب الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
