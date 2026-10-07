"use client";

import React, { useState } from "react";
import { DownloadCloud, Printer, Loader2 } from "lucide-react";
import { useDialog } from "@/lib/dialog-context";
import {
  bulkFetchVisasForRequest,
  getMofaWorkerUrl,
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
    let workerUrl = getMofaWorkerUrl();
    if (!workerUrl) {
      const enteredUrl = await prompt({
        title: "إعداد خادم الاستعلام عن التأشيرات (Cloudflare Worker)",
        message:
          "يرجى إدخال رابط خادم Cloudflare Worker الخاص بك للاستعلام المباشر وتنزيل التأشيرات الصادرة من منصة وزارة الخارجية (مثال: https://mofa-visa-proxy.yourname.workers.dev):",
        placeholder: "https://mofa-visa-proxy.yourname.workers.dev",
        confirmText: "حفظ ومتابعة",
        cancelText: "إلغاء",
        variant: "primary",
      });
      if (enteredUrl && enteredUrl.trim()) {
        setMofaWorkerUrl(enteredUrl.trim());
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
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg shadow-2xs">
        {/* زر جلب التأشيرات */}
        <button
          type="button"
          onClick={handleFetchAllVisas}
          disabled={isFetching || isPrinting}
          className="p-1 text-emerald-800 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
          title="جلب وفحص كافة تأشيرات المسافرين في هذه المعاملة آلياً من منصة وزارة الخارجية"
        >
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
          ) : (
            <DownloadCloud className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span className="text-[11px] font-bold">
            {isFetching ? "جاري الجلب..." : "جلب التأشيرات"}
          </span>
        </button>

        <span className="text-gray-300 select-none">|</span>

        {/* زر طباعة كافة التأشيرات في ملف واحد */}
        <button
          type="button"
          onClick={handlePrintAllVisas}
          disabled={isFetching || isPrinting}
          className="p-1 text-purple-800 hover:bg-purple-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
          title="طباعة كافة تأشيرات المسافرين في هذه المعاملة في ملف واحد (صفحة رسمية لكل تأشيرة)"
        >
          {isPrinting ? (
            <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
          ) : (
            <Printer className="w-3.5 h-3.5 text-purple-600" />
          )}
          <span className="text-[11px] font-bold">
            {isPrinting ? "جاري التجهيز..." : "طباعة التأشيرات"}
          </span>
        </button>
      </div>

      {/* مؤشر التقدم أثناء فحص التأشيرات */}
      {isFetching && progressMsg && (
        <span
          className="text-[9.5px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md animate-pulse truncate max-w-[200px]"
          title={progressMsg}
        >
          {progressMsg}
        </span>
      )}
    </div>
  );
};
