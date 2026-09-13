import React, { useState } from "react";
import { api } from "@/lib/api";
import { Download, Upload, RotateCcw, X, Check, AlertCircle, Database } from "lucide-react";
import { useDialog } from "@/lib/dialog-context";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export function BackupModal({ isOpen, onClose, onDataChanged }: BackupModalProps) {
  const { confirm } = useDialog();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      setErrorMsg(null);
      const jsonStr = api.system.exportBackup();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hajj_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg("تم تحميل ملف النسخة الاحتياطية بنجاح إلى جهازك.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg("فشل تصدير البيانات: " + err.message);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        api.system.importBackup(content);
        setSuccessMsg("تم استيراد البيانات وتحديث النظام بنجاح!");
        if (onDataChanged) onDataChanged();
        setTimeout(() => {
          setSuccessMsg(null);
          onClose();
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setErrorMsg("ملف غير صالح: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "استعادة البيانات التجريبية",
      message: "هل أنت متأكد من رغبتك في استعادة البيانات التجريبية الافتراضية؟\nسيتم مسح كافة التعديلات والمعاملات المحلية غير المحفوظة.",
      confirmText: "استعادة ومسح التعديلات",
      cancelText: "إلغاء",
      variant: "danger",
    });
    if (ok) {
      api.system.resetDefaults();
      setSuccessMsg("تمت استعادة البيانات التجريبية الافتراضية بنجاح.");
      if (onDataChanged) onDataChanged();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">إدارة البيانات والنسخ الاحتياطي</h3>
            <p className="text-xs text-gray-500">حفظ واستعادة بيانات المعاملات في متصفحك</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800 text-xs flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3 my-4 text-sm">
          <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-100 text-xs text-sky-900 leading-relaxed">
            ℹ️ <strong>ملاحظة هامة:</strong> هذه النسخة مستضافة مباشرة على <strong>GitHub Pages</strong> وتعمل بنظام قاعدة بيانات محلية داخل المتصفح (LocalStorage + IndexedDB). لن تفقد بياناتك عند إغلاق المتصفح أو إعادة تشغيله.
          </div>

          <button
            onClick={handleExport}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-sky-500 hover:bg-sky-50/50 transition-all font-medium text-gray-700 hover:text-sky-700 group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-600" />
              <span>تصدير نسخة احتياطية (JSON)</span>
            </span>
            <span className="text-xs text-gray-400 group-hover:text-sky-600">تحميل ملف</span>
          </button>

          <label className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all font-medium text-gray-700 hover:text-emerald-700 group cursor-pointer">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>استيراد نسخة احتياطية</span>
            </span>
            <span className="text-xs text-gray-400 group-hover:text-emerald-600">اختيار ملف</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            onClick={handleReset}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all font-medium text-gray-700 hover:text-amber-700 group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>استعادة البيانات الافتراضية</span>
            </span>
            <span className="text-xs text-gray-400 group-hover:text-amber-600">إعادة ضبط</span>
          </button>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
