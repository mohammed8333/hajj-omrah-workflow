"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  HelpCircle,
  X,
} from "lucide-react";

export type DialogVariant = "danger" | "warning" | "info" | "success" | "primary";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  inputType?: "text" | "textarea";
  required?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  variant?: DialogVariant;
}

type DialogType = "confirm" | "prompt" | "alert";

interface ActiveDialog {
  type: DialogType;
  title?: string;
  message: string;
  variant: DialogVariant;
  confirmText: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: "text" | "textarea";
  resolve: (value: any) => void;
}

interface DialogContextValue {
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  prompt: (options: string | PromptOptions) => Promise<string | null>;
  alert: (options: string | AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (activeDialog?.type === "prompt") {
      setInputValue(activeDialog.defaultValue || "");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (inputRef.current instanceof HTMLInputElement) {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [activeDialog]);

  const handleClose = useCallback(
    (confirmed: boolean) => {
      if (!activeDialog) return;
      const { type, resolve } = activeDialog;
      setActiveDialog(null);

      if (type === "confirm") {
        resolve(confirmed);
      } else if (type === "prompt") {
        resolve(confirmed ? inputValue : null);
      } else if (type === "alert") {
        resolve(undefined);
      }
    },
    [activeDialog, inputValue]
  );

  const confirm = useCallback((options: string | ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === "string" ? { message: options } : options;
      setActiveDialog({
        type: "confirm",
        title: opts.title || "تأكيد الإجراء",
        message: opts.message,
        variant: opts.variant || "warning",
        confirmText: opts.confirmText || "تأكيد",
        cancelText: opts.cancelText || "إلغاء",
        resolve,
      });
    });
  }, []);

  const prompt = useCallback(
    (options: string | PromptOptions): Promise<string | null> => {
      return new Promise<string | null>((resolve) => {
        const opts: PromptOptions =
          typeof options === "string" ? { message: options } : options;
        setActiveDialog({
          type: "prompt",
          title: opts.title || "إدخال بيانات",
          message: opts.message,
          variant: opts.variant || "primary",
          confirmText: opts.confirmText || "تأكيد",
          cancelText: opts.cancelText || "إلغاء",
          placeholder: opts.placeholder || "",
          defaultValue: opts.defaultValue || "",
          inputType: opts.inputType || "text",
          resolve,
        });
      });
    },
    []
  );

  const alert = useCallback((options: string | AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      const opts: AlertOptions =
        typeof options === "string" ? { message: options } : options;
      setActiveDialog({
        type: "alert",
        title: opts.title || "تنبيه",
        message: opts.message,
        variant: opts.variant || "info",
        confirmText: opts.confirmText || "حسناً",
        resolve,
      });
    });
  }, []);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose(false);
      } else if (
        e.key === "Enter" &&
        activeDialog.type !== "prompt"
      ) {
        e.preventDefault();
        handleClose(true);
      } else if (
        e.key === "Enter" &&
        activeDialog.type === "prompt" &&
        activeDialog.inputType !== "textarea"
      ) {
        e.preventDefault();
        handleClose(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDialog, handleClose]);

  // Variant helper styles
  const getVariantStyles = (variant: DialogVariant) => {
    switch (variant) {
      case "danger":
        return {
          icon: <AlertOctagon className="w-7 h-7 text-rose-600" />,
          iconBg: "bg-rose-100",
          btnConfirm:
            "bg-rose-600 hover:bg-rose-700 text-white shadow-xs hover:shadow-md focus:ring-rose-400",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-7 h-7 text-amber-600" />,
          iconBg: "bg-amber-100",
          btnConfirm:
            "bg-amber-500 hover:bg-amber-600 text-white shadow-xs hover:shadow-md focus:ring-amber-400",
        };
      case "success":
        return {
          icon: <CheckCircle2 className="w-7 h-7 text-emerald-600" />,
          iconBg: "bg-emerald-100",
          btnConfirm:
            "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md focus:ring-emerald-400",
        };
      case "primary":
        return {
          icon: <HelpCircle className="w-7 h-7 text-sky-600" />,
          iconBg: "bg-sky-100",
          btnConfirm:
            "bg-sky-600 hover:bg-sky-700 text-white shadow-xs hover:shadow-md focus:ring-sky-400",
        };
      case "info":
      default:
        return {
          icon: <Info className="w-7 h-7 text-sky-600" />,
          iconBg: "bg-sky-100",
          btnConfirm:
            "bg-sky-600 hover:bg-sky-700 text-white shadow-xs hover:shadow-md focus:ring-sky-400",
        };
    }
  };

  const vStyles = activeDialog ? getVariantStyles(activeDialog.variant) : null;

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}

      {/* Render Dialog Modal */}
      {activeDialog && vStyles && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={() => handleClose(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative transition-transform animate-in zoom-in-95 duration-150 text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Icon */}
            <div className="flex flex-col items-center text-center mb-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-xs ${vStyles.iconBg}`}
              >
                {vStyles.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {activeDialog.title}
              </h3>
            </div>

            {/* Message Body */}
            <div className="text-center mb-5">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line font-medium">
                {activeDialog.message}
              </p>
            </div>

            {/* Prompt Input if applicable */}
            {activeDialog.type === "prompt" && (
              <div className="mb-5">
                {activeDialog.inputType === "textarea" ? (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={activeDialog.placeholder}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-900 placeholder:text-gray-400 resize-none transition-all"
                  />
                ) : (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={activeDialog.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-hidden focus:ring-2 ${vStyles.btnConfirm}`}
              >
                {activeDialog.confirmText}
              </button>

              {activeDialog.type !== "alert" && (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-semibold transition-all cursor-pointer focus:outline-hidden"
                >
                  {activeDialog.cancelText || "إلغاء"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
