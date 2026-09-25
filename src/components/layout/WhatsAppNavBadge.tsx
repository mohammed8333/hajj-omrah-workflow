"use client";

import React, { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { WhatsAppServerModal } from "@/components/requests/WhatsAppServerModal";

const BRIDGE_URL = "http://localhost:5055";

export function WhatsAppNavBadge() {
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<{
    online: boolean;
    connected: boolean;
    hasQr: boolean;
  }>({
    online: false,
    connected: false,
    hasQr: false,
  });

  const checkStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BRIDGE_URL}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setStatus({
          online: true,
          connected: Boolean(data.connected),
          hasQr: Boolean(data.hasQr),
        });
        return;
      }
    } catch {
      // offline
    }
    setStatus({ online: false, connected: false, hasQr: false });
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
          status.connected
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
            : status.hasQr
            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse"
            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
        }`}
        title={
          status.connected
            ? "خادم الواتساب متصل وجاهز للإرسال (انقر للإعدادات)"
            : status.hasQr
            ? "بانتظار مسح كود QR للواتساب (انقر للمسح)"
            : "خادم الواتساب المحلي غير مشغل (انقر لمعرفة التفاصيل)"
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            status.connected
              ? "bg-emerald-500 animate-pulse"
              : status.hasQr
              ? "bg-amber-500 animate-ping"
              : "bg-gray-400"
          }`}
        ></span>
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {status.connected
            ? "واتساب متصل"
            : status.hasQr
            ? "مسح كود QR"
            : "خادم الواتساب"}
        </span>
      </button>

      <WhatsAppServerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
