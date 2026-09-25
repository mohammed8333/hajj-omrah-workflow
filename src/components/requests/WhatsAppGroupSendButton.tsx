"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  MessageCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  HelpCircle,
  Download,
  Copy,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  Building,
} from "lucide-react";
import { DocumentItem, GroupRequestDetail } from "@/types";
import { api } from "@/lib/api";
import { useDialog } from "@/lib/dialog-context";

interface WhatsAppGroupSendButtonProps {
  request: GroupRequestDetail;
  ticketDoc?: DocumentItem;
  hostDoc?: DocumentItem;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const BRIDGE_URL = "http://localhost:5055";
const STORAGE_KEY_GROUP = "safa_whatsapp_target_group";
const STORAGE_KEY_LINK = "safa_whatsapp_target_link";

// Statuses reached only after Safa employee clicks "إحالة للوكيل السعودي"
const POST_REFERRAL_STATUSES = [
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
];

export const WhatsAppGroupSendButton: React.FC<WhatsAppGroupSendButtonProps> = ({
  request,
  ticketDoc,
  hostDoc,
  className = "",
  disabled = false,
  disabledReason,
}) => {
  const { alert } = useDialog();
  const [showModal, setShowModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStep, setSendStep] = useState<string>("");

  // Button is only enabled once the request is officially referred to the Saudi Agent
  const isReferredToSaudiAgent =
    POST_REFERRAL_STATUSES.includes(request.status) ||
    Boolean(request.assignedSaudiAgentId) ||
    Boolean(request.statusHistory?.some((h) => POST_REFERRAL_STATUSES.includes(h.status)));

  const isButtonEnabled = isReferredToSaudiAgent && !disabled;
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    connected: boolean;
    hasQr: boolean;
    groupsCount: number;
  } | null>(null);
  const [targetGroup, setTargetGroup] = useState<string>("");
  const [groupLink, setGroupLink] = useState<string>("");
  const [copiedText, setCopiedText] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<
    Array<{ id: string; subject: string; participantsCount?: number }>
  >([]);

  // Load saved group settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedGroup = localStorage.getItem(STORAGE_KEY_GROUP) || "";
      const savedLink = localStorage.getItem(STORAGE_KEY_LINK) || "";
      setTargetGroup(savedGroup);
      setGroupLink(savedLink);
    }
  }, []);

  // Save settings when changed
  const handleSaveGroupSetting = (groupVal: string, linkVal: string) => {
    setTargetGroup(groupVal);
    setGroupLink(linkVal);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_GROUP, groupVal);
      localStorage.setItem(STORAGE_KEY_LINK, linkVal);
    }
  };

  // Check Bridge status
  const checkBridgeStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BRIDGE_URL}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setBridgeStatus({
          online: true,
          connected: Boolean(data.connected),
          hasQr: Boolean(data.hasQr),
          groupsCount: Number(data.groupsCount || 0),
        });
        if (data.connected) {
          fetchGroups();
        }
        return data;
      }
    } catch {
      // Bridge is not running
    }
    setBridgeStatus({ online: false, connected: false, hasQr: false, groupsCount: 0 });
    return null;
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

  // Convert File / Stream URL to Base64
  const docToBase64 = async (doc?: DocumentItem): Promise<{ base64: string; name: string } | null> => {
    if (!doc) return null;
    try {
      const streamUrl = await api.documents.getStreamUrl(doc.id);
      const response = await fetch(streamUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            base64: reader.result as string,
            name: doc.originalFileName || `doc-${doc.documentType}`,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Doc to base64 conversion failed:", e);
      return null;
    }
  };

  // Generate full text message for preview / copy fallback
  const generateMessageText = () => {
    const hasHosting = Boolean(request.hasHosting);
    const nusukNum = request.nusukGroupNumber || "---";
    let text =
      "=============================\n" +
      "ارجو عمل اتفاقيه سكن طرفكم\n" +
      "+ ارسال طلب اعاشه طرفنا\n";
    if (hasHosting) {
      text += "+ ارسال طلب استضافه\n";
    }
    text += `للمجموعة التالية ${nusukNum}\n`;

    if (hasHosting && (request.hostingInfo?.hostPhone || request.contactPhone)) {
      text += `\nرقم المستضيف:\n${request.hostingInfo?.hostPhone || request.contactPhone}\n`;
    }
    text += "=============================";
    return text;
  };

  // Main automated send execution
  const executeAutomatedSend = async (customGroup?: string) => {
    const selectedGroup = customGroup || targetGroup || groupLink;
    if (!selectedGroup.trim()) {
      setShowModal(true);
      return;
    }

    if (!request.nusukGroupNumber) {
      await alert({
        title: "تنبيه رقم نسك",
        message: "يجب إدخال وتوثيق رقم مجموعة نسك أولاً قبل إرسال الحزمة للمجموعة.",
        variant: "warning",
      });
      return;
    }

    try {
      setIsSending(true);
      setSendStep("جاري فحص الاتصال بخادم الواتساب...");

      const status = await checkBridgeStatus();
      if (!status || !status.connected) {
        setIsSending(false);
        setShowModal(true);
        return;
      }

      setSendStep("جاري تجهيز مستندات المعاملة (التذكرة والهوية)...");

      // 1. Prepare Ticket File
      const ticketResult = await docToBase64(ticketDoc);

      // 2. Prepare Host ID File if hosting is active
      let hostResult = null;
      if (request.hasHosting) {
        hostResult = await docToBase64(hostDoc);
      }

      setSendStep("جاري إرسال الرسائل والمستندات إلى مجموعة الواتساب...");

      // 3. Send Payload to Bridge
      const payload = {
        targetGroup: selectedGroup.trim(),
        groupLink: groupLink.trim() || undefined,
        nusukNumber: request.nusukGroupNumber.trim(),
        hasHosting: Boolean(request.hasHosting),
        hostPhone: request.hostingInfo?.hostPhone || request.contactPhone || undefined,
        hostIdFileBase64: hostResult?.base64,
        hostIdFileName: hostResult?.name,
        ticketFileBase64: ticketResult?.base64,
        ticketFileName: ticketResult?.name,
      };

      const res = await fetch(`${BRIDGE_URL}/send-group-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إرسال الحزمة عبر الواتساب");
      }

      setSendStep("تم الإرسال بنجاح! جاري فتح المجموعة للتأكيد...");

      // 4. Open WhatsApp Web to the group for visual verification
      setTimeout(() => {
        setIsSending(false);
        setShowModal(false);
        const urlToOpen = groupLink.trim() || data.webVerifyUrl || "https://web.whatsapp.com";
        window.open(urlToOpen, "_blank");
      }, 1000);
    } catch (err: any) {
      setIsSending(false);
      await alert({
        title: "خطأ في الإرسال",
        message: err.message || "تعذر إرسال الحزمة لمجموعة الواتساب.",
        variant: "danger",
      });
    }
  };

  // Fallback 1-click manual download & open WhatsApp
  const handleManualFallback = async () => {
    try {
      // 1. Copy text to clipboard
      const text = generateMessageText();
      await navigator.clipboard.writeText(text);
      setCopiedText(true);

      // 2. Download ticket if available
      if (ticketDoc) {
        const tUrl = await api.documents.getStreamUrl(ticketDoc.id);
        const a = document.createElement("a");
        a.href = tUrl;
        a.download = ticketDoc.originalFileName || "تذكرة_الطيران.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // 3. Download Host ID if available
      if (request.hasHosting && hostDoc) {
        setTimeout(async () => {
          const hUrl = await api.documents.getStreamUrl(hostDoc.id);
          const a = document.createElement("a");
          a.href = hUrl;
          a.download = hostDoc.originalFileName || "هوية_المستضيف.jpg";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, 300);
      }

      // 4. Open WhatsApp
      setTimeout(() => {
        const url = groupLink.trim() || "https://web.whatsapp.com";
        window.open(url, "_blank");
      }, 700);
    } catch (e: any) {
      console.warn("Manual fallback error:", e);
    }
  };

  return (
    <>
      {/* Inactive State: When not yet referred to Saudi Agent */}
      {!isButtonEnabled ? (
        <div
          className={`inline-flex items-stretch rounded-xl border border-gray-300 bg-gray-100 text-gray-400 opacity-75 shadow-none ${className}`}
          title={
            disabledReason ||
            "يتفعل هذا الزر تلقائياً بعد قيام موظف صفا بالضغط على «إحالة للوكيل السعودي»"
          }
        >
          <button
            type="button"
            onClick={async () => {
              await alert({
                title: "الزر غير مفعّل حالياً",
                message:
                  disabledReason ||
                  "لا يمكن إرسال حزمة المعاملة لمجموعة الواتساب في هذه المرحلة.\nيتفعل هذا الزر تلقائياً بعد قيام موظف صفا بالضغط على زر «إحالة للوكيل السعودي».",
                variant: "warning",
              });
            }}
            className="px-3.5 py-2 rounded-r-xl flex items-center gap-1.5 cursor-not-allowed font-bold text-xs text-gray-400 hover:text-gray-500 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>إرسال لمجموعة الواتساب 📲</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await alert({
                title: "الزر غير مفعّل حالياً",
                message:
                  disabledReason ||
                  "يتفعل هذا الزر وإعدادات الإرسال تلقائياً بعد قيام موظف صفا بالضغط على زر «إحالة للوكيل السعودي».",
                variant: "warning",
              });
            }}
            className="px-2.5 py-2 rounded-l-xl border-r border-gray-300 text-gray-400 hover:text-gray-500 cursor-not-allowed flex items-center justify-center transition-colors"
            title={
              disabledReason ||
              "يتفعل هذا الزر تلقائياً بعد قيام موظف صفا بالضغط على «إحالة للوكيل السعودي»"
            }
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Active State: The Main Action Button for Safa Employee with Settings Gear */
        <div className={`inline-flex items-stretch rounded-xl shadow-xs ${className}`}>
          <button
            type="button"
            disabled={isSending}
            onClick={() => {
              if (!targetGroup.trim() && !groupLink.trim()) {
                checkBridgeStatus();
                setShowModal(true);
              } else {
                executeAutomatedSend();
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-r-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="إرسال حزمة المعاملة بالكامل للواتساب (النص + التذكرة + الهوية)"
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الإرسال للمجموعة...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                <span>إرسال لمجموعة الواتساب 📲</span>
              </>
            )}
          </button>

          {/* زر الترس لفتح وتعديل إعدادات المجموعة في أي وقت */}
          <button
            type="button"
            onClick={() => {
              checkBridgeStatus();
              setShowModal(true);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-emerald-100 hover:text-white px-2.5 py-2 rounded-l-xl border-r border-emerald-500/50 transition-colors cursor-pointer flex items-center justify-center"
            title="تغيير وضبط إعدادات مجموعة الواتساب المستهدفة ⚙️"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control & Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900">
                    إرسال حزمة المعاملة لمجموعة الواتساب
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    إرسال (الطلب + رقم نسك + التذكرة + هوية المستضيف إن وجدت)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bridge Connection Status Badge */}
            <div className="p-3 rounded-xl border flex items-center justify-between text-xs bg-gray-50/70 border-gray-200">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    bridgeStatus?.connected
                      ? "bg-emerald-500 animate-pulse"
                      : bridgeStatus?.online
                      ? "bg-amber-500"
                      : "bg-red-400"
                  }`}
                ></span>
                <span className="font-bold">
                  {bridgeStatus?.connected
                    ? "خادم الواتساب المحلي: متصل وجاهز للإرسال ✓"
                    : bridgeStatus?.online
                    ? "الخادم يعمل وبانتظار مسح كود QR في شاشة السيرفر"
                    : "خادم الواتساب المحلي غير مشغّل حالياً"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="http://localhost:5055"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                >
                  <span>لوحة السيرفر 🖥️</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={checkBridgeStatus}
                  className="text-[11px] text-sky-600 hover:underline font-bold cursor-pointer"
                >
                  تحديث 🔄
                </button>
              </div>
            </div>

            {/* Instruction if bridge is offline */}
            {!bridgeStatus?.connected && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>لتفعيل الإرسال التلقائي بنقرة واحدة:</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  افتح مجلد <strong>whatsapp-bridge</strong> واضغط نقراً مزدوجاً على الملف{" "}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">start.bat</code>{" "}
                  لتشغيل الخادم، وامسح كود QR لمرة واحدة فقط.
                </p>
              </div>
            )}

            {/* Target Group Input / Selection */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  اسم أو رابط مجموعة الواتساب المستهدفة *
                </label>
                {availableGroups.length > 0 ? (
                  <select
                    value={targetGroup}
                    onChange={(e) => handleSaveGroupSetting(e.target.value, groupLink)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-gray-800"
                  >
                    <option value="">-- اختر المجموعة من قائمة مجموعاتك --</option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.subject} ({g.participantsCount} عضو)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={targetGroup}
                    onChange={(e) => handleSaveGroupSetting(e.target.value, groupLink)}
                    placeholder="مثال: مجموعة التسكين والإعاشة أو رابط الدعوة للمجموعة"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-800 font-bold"
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  يتم حفظ اسم المجموعة تلقائياً لاستخدامه دائماً في كل المعاملات.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  رابط المجموعة المباشر (اختياري لفتحها فوراً بعد الإرسال للتأكيد)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={groupLink}
                  onChange={(e) => handleSaveGroupSetting(targetGroup, e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-left font-mono"
                />
              </div>
            </div>

            {/* Package Summary Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2">
              <span className="font-bold text-gray-700 block">
                محتويات الحزمة التي سيتم إرسالها ({request.hasHosting ? "6 رسائل ومستندات" : "4 رسائل ومستندات"}):
              </span>
              <ul className="space-y-1 text-[11px] text-gray-600 list-disc list-inside">
                <li>الفاصل العلوي: <code className="font-mono text-[10px]">=============================</code></li>
                <li>
                  رسالة الطلب: سكن + إعاشة +{" "}
                  {request.hasHosting ? (
                    <strong className="text-emerald-700">طلب استضافة</strong>
                  ) : (
                    <span className="text-gray-400">بدون استضافة</span>
                  )}{" "}
                  + رقم نسك (<strong className="font-mono text-purple-700">{request.nusukGroupNumber || "غير محدد"}</strong>)
                </li>
                {request.hasHosting && (
                  <li className="text-emerald-800 font-semibold">
                    هوية المستضيف: {hostDoc ? `مرفوعة (${hostDoc.originalFileName}) ✓` : "غير مرفوعة ⚠️"}
                  </li>
                )}
                <li>
                  تذكرة الطيران: {ticketDoc ? `مرفوعة (${ticketDoc.originalFileName}) ✓` : "غير مرفوعة ⚠️"}
                </li>
                {request.hasHosting && (
                  <li className="text-emerald-800 font-semibold">
                    رقم هاتف المستضيف:{" "}
                    <span dir="ltr" className="font-mono font-bold">
                      {request.hostingInfo?.hostPhone || request.contactPhone || "غير محدد"}
                    </span>
                  </li>
                )}
                <li>الفاصل الختامي: <code className="font-mono text-[10px]">=============================</code></li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-gray-100">
              {/* Fallback button if bridge not running */}
              <button
                type="button"
                onClick={handleManualFallback}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="تنزيل الملفات ونسخ النص وفتح الواتساب يدوياً"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم النسخ والتحميل ✓</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-gray-500" />
                    <span>إرسال يدوي (نسخ وتحميل)</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isSending || !targetGroup.trim()}
                  onClick={() => executeAutomatedSend()}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{sendStep || "جاري الإرسال..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 -rotate-90" />
                      <span>إرسال آلي للمجموعة 🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
