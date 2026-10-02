"use client";

import React, { useEffect, useState } from "react";
import { RequestStatus } from "@/types";
import { Clock, ShieldCheck, Plane, Archive } from "lucide-react";

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
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {/* Permanent Retention Badge */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium bg-emerald-50 text-emerald-800 border-emerald-200"
          title="المعاملة ووثائقها محفوظة بشكل دائم دون أي حذف تلقائي"
        >
          <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-600" />
          <span>حفظ دائم</span>
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
            متابعة موعد السفر وحالة حفظ المعاملة
          </h2>
        </div>
        <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md font-medium">
          الحفظ الدائم مفعّل (بدون حذف تلقائي)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Card 1: Permanent Retention (Auto-Deletion Disabled) */}
        <div className="bg-emerald-50/40 rounded-xl p-4 border border-emerald-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>حالة الحفظ (دائم للأبد)</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] border bg-emerald-50 text-emerald-800 border-emerald-200">
              محفوظة بشكل دائم ✓
            </span>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed">
            خاصية الحذف التلقائي معطّلة. يتم الاحتفاظ بكافة بيانات المعاملة ووثائقها وملفات المعتمرين التابعة لها بشكل دائم للأبد في النظام دون أي حذف.
          </p>

          <div className="pt-2 text-[11px] flex items-center justify-between bg-white/80 p-2.5 rounded-lg border border-emerald-100">
            <span className="text-gray-500">تاريخ إنشاء المعاملة:</span>
            <span className="font-bold text-gray-800">
              {new Date(createdAt).toLocaleDateString("ar-EG-u-nu-latn", {
                weekday: "short",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
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
            تتحول المعاملة تلقائياً إلى حالة «مؤرشف» فور انقضاء موعد وتاريخ الرحلة لحفظها في الأرشيف التاريخي للنظام وتفادي تكدس المعاملات النشطة.
          </p>

          <div className="pt-2 text-[11px] flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500">موعد وتوقيت السفر:</span>
            <span className="font-bold text-gray-800 flex items-center gap-1">
              {effectiveTravelDate ? (
                <>
                  <Plane className="w-3.5 h-3.5 text-sky-600" />
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
    </div>
  );
}
