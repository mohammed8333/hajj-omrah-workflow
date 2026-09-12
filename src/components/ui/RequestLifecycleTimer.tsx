"use client";

import React, { useEffect, useState } from "react";
import { RequestStatus } from "@/types";
import { Clock, Hourglass, Plane, Archive } from "lucide-react";

interface RequestLifecycleTimerProps {
  createdAt: string;
  travelDate?: string;
  departureDate?: string;
  flightDepartureTime?: string;
  status: RequestStatus;
  mode?: "compact" | "detailed";
}

export function RequestLifecycleTimer({
  createdAt,
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

  // 1. Deletion calculations (30 days from creation)
  const createdTime = new Date(createdAt).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const deleteTargetTime = createdTime + thirtyDaysMs;
  const deletionRemainingMs = Math.max(0, deleteTargetTime - now);
  const deletionPassedRatio = Math.min(
    100,
    Math.max(0, ((now - createdTime) / thirtyDaysMs) * 100)
  );

  const delDays = Math.floor(deletionRemainingMs / (24 * 3600 * 1000));
  const delHours = Math.floor(
    (deletionRemainingMs % (24 * 3600 * 1000)) / (3600 * 1000)
  );
  const delMinutes = Math.floor(
    (deletionRemainingMs % (3600 * 1000)) / (60 * 1000)
  );

  let deletionColor = "bg-sky-50 text-sky-800 border-sky-200";
  let deletionBarColor = "bg-sky-500";
  if (delDays <= 2) {
    deletionColor = "bg-rose-50 text-rose-800 border-rose-200";
    deletionBarColor = "bg-rose-500";
  } else if (delDays <= 7) {
    deletionColor = "bg-amber-50 text-amber-800 border-amber-200";
    deletionBarColor = "bg-amber-500";
  }

  const deletionText =
    deletionRemainingMs <= 0
      ? "مستحقة للحذف التلقائي"
      : delDays > 0
      ? `متبقي ${delDays} يوم و ${delHours} س`
      : `متبقي ${delHours} س و ${delMinutes} د`;

  // 2. Travel & Archival calculations
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
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {/* Deletion Timer Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${deletionColor}`}
          title={`سيتم حذف المعاملة تلقائياً بعد مرور 30 يوماً من تاريخ الإنشاء (${new Date(
            deleteTargetTime
          ).toLocaleDateString("ar-SA")})`}
        >
          <Hourglass className="w-3 h-3 shrink-0" />
          <span>حذف: {delDays > 0 ? `${delDays} يوم` : `${delHours} س`}</span>
        </span>

        {/* Archival Timer Badge */}
        {effectiveTravelDate && (
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
        )}
      </div>
    );
  }

  // --- DETAILED VIEW (For Request Details Page) ---
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-gray-900">
            مؤقت دورة حياة المعاملة (الحذف والأرشفة التلقائية)
          </h2>
        </div>
        <span className="text-[11px] text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md font-medium">
          نظام الصيانة والتدوير الذاتي
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Card 1: 30-Day Auto-Deletion */}
        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-800">
              <Hourglass className="w-4 h-4 text-amber-600" />
              <span>مؤقت الحذف التلقائي (30 يوماً من الإنشاء)</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${deletionColor}`}
            >
              {deletionText}
            </span>
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            يتم حذف المعاملة ووثائقها بالكامل تلقائياً بعد مرور 30 يوماً لتخفيف السعة والحفاظ على خصوصية البيانات.
          </p>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>تاريخ الإنشاء: {new Date(createdAt).toLocaleDateString("ar-SA")}</span>
              <span>
                موعد الحذف: {new Date(deleteTargetTime).toLocaleDateString("ar-SA")}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${deletionBarColor}`}
                style={{ width: `${deletionPassedRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Travel Date Auto-Archival */}
        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-800">
              <Archive className="w-4 h-4 text-slate-600" />
              <span>مؤقت الأرشفة التلقائية (موعد السفر)</span>
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

          <p className="text-[11px] text-gray-500 leading-relaxed">
            تتحول المعاملة تلقائياً إلى حالة «مؤرشف» فور انقضاء موعد وتاريخ الرحلة لحفظها في الأرشيف التاريخي.
          </p>

          <div className="pt-2 text-[11px] flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500">موعد وتوقيت السفر:</span>
            <span className="font-bold text-gray-800 flex items-center gap-1">
              {effectiveTravelDate ? (
                <>
                  <Plane className="w-3.5 h-3.5 text-sky-600" />
                  <span>
                    {new Date(effectiveTravelDate).toLocaleDateString("ar-SA")}{" "}
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
    </div>
  );
}
