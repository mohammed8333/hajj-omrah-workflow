"use client";

import React, { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { useDialog } from "@/lib/dialog-context";
import {
  bulkFetchVisasForRequest,
  getMofaWorkerUrl,
  ensureMofaWorkerUrl,
  syncMofaWorkerUrlFromDatabase,
  setMofaWorkerUrl,
} from "@/lib/mofaVisaService";
import { printAllVisasByRequestId } from "@/lib/visaPrintHelper";

interface RequestVisaActionButtonsProps {
  requestId: string;
  requestNumber: string;
  groupName?: string;
  status?: string;
  onRefresh?: () => Promise<void> | void;
}

export const RequestVisaActionButtons: React.FC<RequestVisaActionButtonsProps> = ({
  requestId,
  requestNumber,
  groupName,
  status,
  onRefresh,
}) => {
  if (status && status !== "Completed" && status !== "Archived") {
    return null;
  }

  const { alert, prompt } = useDialog();
  const [isFetching, setIsFetching] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

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

  const handleFetchAllVisas = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const workerUrl = await getOrPromptWorkerUrl();
    if (!workerUrl) return;

    try {
      setIsFetching(true);
      setProgressMsg("بدء فحص التأشيرات...");

      const res = await bulkFetchVisasForRequest(
        requestId,
        workerUrl,
        (step) => setProgressMsg(step)
      );

      if (res.error) {
        await alert({
          title: "تنبيه",
          message: res.error,
          variant: "warning",
        });
      } else {
        await alert({
          title: "اكتمل فحص التأشيرات 🇸🇦",
          message: `تم فحص المعاملة (${groupName || requestNumber}) بإجمالي (${res.total}) مسافرين:\n• تم جلب وتنزيل (${res.successCount}) تأشيرة بنجاح.\n• (${res.notFoundCount}) لم تصدر لهم تأشيرة بعد.`,
          variant: res.successCount > 0 ? "success" : "info",
        });
        if (onRefresh) {
          await onRefresh();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص التأشيرات.";
      await alert({
        title: "خطأ",
        message: msg,
        variant: "danger",
      });
    } finally {
      setIsFetching(false);
      setProgressMsg(null);
    }
  };

  const handlePrintAllVisas = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      setIsPrinting(true);
      const res = await printAllVisasByRequestId(requestId);

      if (res.error) {
        await alert({
          title: "تنبيه",
          message: res.error,
          variant: "info",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء تجهيز طباعة التأشيرات.";
      await alert({
        title: "خطأ",
        message: msg,
        variant: "danger",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-0.5 shrink-0">
      <div className="inline-flex items-center bg-white border border-emerald-300 rounded-lg shadow-2xs overflow-hidden shrink-0">
        {/* نصف جلب التأشيرات: أيقونة على شكل حرف V */}
        <button
          type="button"
          onClick={handleFetchAllVisas}
          disabled={isFetching || isPrinting}
          className="p-1 px-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50 shrink-0"
          title="جلب وفحص تأشيرات كافة مسافري المعاملة آلياً (منصة وزارة الخارجية MOFA)"
        >
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
          ) : (
            <svg
              className="w-3.5 h-3.5 text-emerald-600 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 6L12 18.5L19 6" />
            </svg>
          )}
        </button>

        {/* فاصل رفيع بين النصفين */}
        <span className="w-px h-3.5 bg-emerald-200 select-none shrink-0" />

        {/* نصف طباعة التأشيرات: علامة طباعة فقط بدون كتابة */}
        <button
          type="button"
          onClick={handlePrintAllVisas}
          disabled={isFetching || isPrinting}
          className="p-1 px-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-50 active:bg-purple-100 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50 shrink-0"
          title="طباعة كافة تأشيرات المسافرين في ملف واحد (صفحة رسمية لكل تأشيرة)"
        >
          {isPrinting ? (
            <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin shrink-0" />
          ) : (
            <Printer className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          )}
        </button>
      </div>

      {/* مؤشر التقدم أثناء فحص التأشيرات */}
      {isFetching && progressMsg && (
        <span
          className="text-[9.5px] font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md animate-pulse truncate max-w-[180px] whitespace-nowrap"
          title={progressMsg}
        >
          {progressMsg}
        </span>
      )}
    </div>
  );
};
