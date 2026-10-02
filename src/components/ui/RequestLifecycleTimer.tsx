"use client";

import React, { useEffect, useState } from "react";
import { RequestStatus } from "@/types";
import { Clock, Plane, Archive } from "lucide-react";

interface RequestLifecycleTimerProps {
  createdAt?: string;
  travelDate?: string;
  departureDate?: string;
  flightDepartureTime?: string;
  status: RequestStatus;
  mode?: "compact" | "detailed";
}

export function RequestLifecycleTimer({
  travelDate,
  departureDate,
  flightDepartureTime,
  status,
  mode = "compact",
}: RequestLifecycleTimerProps) {
  // Re-calculate every 30 seconds for live ticking
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Travel & Archival calculations
  const effectiveTravelDate = departureDate || travelDate;
  let travelEpoch: number | null = null;
  if (effectiveTravelDate) {
    try {
      const dateOnly = effectiveTravelDate.split("T")[0];
      if (
        flightDepartureTime &&
        /^\d{1,2}:\d{2}$/.test(flightDepartureTime.trim())
      ) {
        const d = new Date(`${dateOnly}T${flightDepartureTime.trim()}:00`);
        if (!isNaN(d.getTime())) travelEpoch = d.getTime();
      }
      if (travelEpoch === null) {
        const d = new Date(`${dateOnly}T23:59:59`);
        if (!isNaN(d.getTime())) travelEpoch = d.getTime();
      }
    } catch {
      const d = new Date(effectiveTravelDate);
      if (!isNaN(d.getTime())) travelEpoch = d.getTime();
    }
  }

  const isArchived = status === "Archived";
  const isTravelPassed = travelEpoch !== null && now >= travelEpoch;
  const travelRemainingMs = travelEpoch ? Math.max(0, travelEpoch - now) : 0;
  const trvDays = Math.floor(travelRemainingMs / (24 * 3600 * 1000));
  const trvHours = Math.floor(
    (travelRemainingMs % (24 * 3600 * 1000)) / (3600 * 1000)
  );

  let archiveColor = "bg-slate-100 text-slate-700 border-slate-200";
  let archiveText = "لم يحدد موعد السفر";

  if (isArchived) {
    archiveColor = "bg-zinc-100 text-zinc-700 border-zinc-300";
    archiveText = "مؤرشفة";
  } else if (isTravelPassed) {
    archiveColor = "bg-slate-200 text-slate-800 border-slate-300";
    archiveText = "انتهى موعد السفر (أرشفة)";
  } else if (travelEpoch !== null) {
    if (trvDays <= 2) {
      archiveColor = "bg-amber-50 text-amber-800 border-amber-200";
      archiveText = `السفر خلال ${trvDays} يوم و ${trvHours} س`;
    } else {
      archiveColor = "bg-indigo-50 text-indigo-800 border-indigo-200";
      archiveText = `السفر خلال ${trvDays} يوم`;
    }
  }

  // --- COMPACT VIEW (For tables and card lists) ---
  if (mode === "compact") {
    if (!effectiveTravelDate) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${archiveColor}`}
          title={
            isArchived
              ? "المعاملة مؤرشفة حالياً"
              : `تتأرشف تلقائياً فور انتهاء موعد السفر (${new Date(
                  travelEpoch || 0
                ).toLocaleString("ar-SA")})`
          }
        >
          {isArchived ? (
            <Archive className="w-3 h-3 shrink-0" />
          ) : (
            <Plane className="w-3 h-3 shrink-0" />
          )}
          <span>{archiveText}</span>
        </span>
      </div>
    );
  }

  // --- DETAILED VIEW (For Request Details Page) ---
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-gray-900">
            مؤقت الأرشفة التلقائية (موعد السفر)
          </h2>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${archiveColor}`}
        >
          {isArchived
            ? "مؤرشفة حالياً"
            : isTravelPassed
            ? "انتهى وقت السفر"
            : travelEpoch
            ? `متبقي ${trvDays} يوم و ${trvHours} س`
            : "غير محدد"}
        </span>
      </div>

      <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200 space-y-2.5 text-xs">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          تتحول المعاملة تلقائياً إلى حالة «مؤرشف» فور انقضاء موعد وتاريخ الرحلة لحفظها في الأرشيف التاريخي للنظام وتفادي تكدس المعاملات النشطة.
        </p>

        <div className="pt-1 text-[11px] flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100">
          <span className="text-gray-500 font-medium">موعد وتوقيت السفر:</span>
          <span className="font-bold text-gray-800 flex items-center gap-1.5">
            {effectiveTravelDate ? (
              <>
                <Plane className="w-4 h-4 text-sky-600" />
                <span>
                  {new Date(effectiveTravelDate).toLocaleDateString("ar-EG-u-nu-latn", {
                    weekday: "short",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  {flightDepartureTime ? `• الساعة ${flightDepartureTime}` : ""}
                </span>
              </>
            ) : (
              <span className="text-gray-400">لم يتم تحديد تاريخ الذهاب بعد</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
