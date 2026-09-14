"use client";

import React, { useState, useRef, DragEvent } from "react";
import { FileUp } from "lucide-react";

export interface FileDropAreaProps {
  onFileDrop: (file: File) => void;
  accept?: string;
  maxSizeMb?: number;
  disabled?: boolean;
  className?: string;
  activeBorderColor?: "amber" | "sky" | "blue" | "purple" | "emerald" | "default";
  overlayText?: string;
  overlaySubtext?: string;
  onError?: (message: string) => void;
  children: React.ReactNode;
}

const colorConfig = {
  amber: {
    border: "border-amber-500 ring-2 ring-amber-300 ring-offset-1 bg-amber-50/50",
    overlayBg: "bg-amber-50/95 border-2 border-dashed border-amber-500",
    text: "text-amber-900",
    subtext: "text-amber-700",
    iconBg: "bg-amber-100 text-amber-700",
  },
  sky: {
    border: "border-sky-500 ring-2 ring-sky-300 ring-offset-1 bg-sky-50/50",
    overlayBg: "bg-sky-50/95 border-2 border-dashed border-sky-500",
    text: "text-sky-900",
    subtext: "text-sky-700",
    iconBg: "bg-sky-100 text-sky-700",
  },
  blue: {
    border: "border-blue-500 ring-2 ring-blue-300 ring-offset-1 bg-blue-50/50",
    overlayBg: "bg-blue-50/95 border-2 border-dashed border-blue-500",
    text: "text-blue-900",
    subtext: "text-blue-700",
    iconBg: "bg-blue-100 text-blue-700",
  },
  purple: {
    border: "border-purple-500 ring-2 ring-purple-300 ring-offset-1 bg-purple-50/50",
    overlayBg: "bg-purple-50/95 border-2 border-dashed border-purple-500",
    text: "text-purple-900",
    subtext: "text-purple-700",
    iconBg: "bg-purple-100 text-purple-700",
  },
  emerald: {
    border: "border-emerald-500 ring-2 ring-emerald-300 ring-offset-1 bg-emerald-50/50",
    overlayBg: "bg-emerald-50/95 border-2 border-dashed border-emerald-500",
    text: "text-emerald-900",
    subtext: "text-emerald-700",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  default: {
    border: "border-blue-500 ring-2 ring-blue-300 ring-offset-1 bg-blue-50/50",
    overlayBg: "bg-blue-50/95 border-2 border-dashed border-blue-500",
    text: "text-blue-900",
    subtext: "text-blue-700",
    iconBg: "bg-blue-100 text-blue-700",
  },
};

export const FileDropArea: React.FC<FileDropAreaProps> = ({
  onFileDrop,
  accept,
  maxSizeMb,
  disabled = false,
  className = "",
  activeBorderColor = "default",
  overlayText = "أفلت الملف هنا للرفع",
  overlaySubtext,
  onError,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const colors = colorConfig[activeBorderColor] || colorConfig.default;

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {}
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Check extension if accept is specified
    if (accept) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const acceptedList = accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const isAllowed = acceptedList.some((pattern) => {
        if (pattern.startsWith(".")) {
          return ext === pattern;
        }
        if (pattern.endsWith("/*")) {
          const prefix = pattern.slice(0, -2);
          return file.type.toLowerCase().startsWith(prefix);
        }
        return file.type.toLowerCase() === pattern;
      });

      if (!isAllowed) {
        const msg = `نوع الملف غير مدعوم (${file.name}). الصيغ المسموحة هي: ${accept}`;
        if (onError) onError(msg);
        else window.alert(msg);
        return;
      }
    }

    // Check size if maxSizeMb is specified
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      const msg = `حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${maxSizeMb} ميجابايت).`;
      if (onError) onError(msg);
      else window.alert(msg);
      return;
    }

    onFileDrop(file);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative transition-all duration-200 ${
        isDragging ? colors.border : ""
      } ${className}`}
    >
      {children}

      {isDragging && (
        <div
          className={`absolute inset-0 z-30 rounded-xl flex flex-col items-center justify-center p-4 text-center pointer-events-none transition-all animate-in fade-in duration-150 ${colors.overlayBg}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 animate-bounce shadow-md ${colors.iconBg}`}
          >
            <FileUp className="w-6 h-6" />
          </div>
          <p className={`text-sm font-bold ${colors.text}`}>{overlayText}</p>
          {overlaySubtext ? (
            <p className={`text-xs mt-0.5 ${colors.subtext}`}>{overlaySubtext}</p>
          ) : (
            <p className={`text-[11px] mt-0.5 opacity-80 ${colors.subtext}`}>
              أفلت الملف هنا للرفع والمعالجة الفورية
            </p>
          )}
        </div>
      )}
    </div>
  );
};
