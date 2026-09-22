import { GroupRequestDetail, GroupRequestSummary } from "@/types";

export type WhatsAppTemplateType =
  | "NEW_REQUEST"
  | "NUSUK_ISSUED"
  | "COMPLETED"
  | "NEEDS_CORRECTION"
  | "FLIGHT_REMINDER";

export interface WhatsAppTemplateOption {
  type: WhatsAppTemplateType;
  title: string;
  description: string;
  iconName: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateOption[] = [
  {
    type: "NUSUK_ISSUED",
    title: "إشعار صدور رقم مجموعة نسك 🕋",
    description: "إرسال رقم مجموعة نسك والرحلات للمرسل أو المعتمر",
    iconName: "CheckCircle",
  },
  {
    type: "COMPLETED",
    title: "إشعار اكتمال التأشيرة وتأكيد السفر ✈️",
    description: "تأكيد الجاهزية ومواعيد الذهاب والعودة وتوقيت الحضور للمطار",
    iconName: "Plane",
  },
  {
    type: "NEW_REQUEST",
    title: "إشعار استلام المعاملة وتأكيد التسجيل 📝",
    description: "إفادة باستلام المعاملة وبدء إجراءات التدقيق والمراجعة",
    iconName: "FileText",
  },
  {
    type: "FLIGHT_REMINDER",
    title: "تذكير عاجل بموعد الرحلة والتواجد بالمطار ⏰",
    description: "تنبيه بموعد الإقلاع والتواجد قبل 3 ساعات بمطار المغادرة",
    iconName: "Clock",
  },
  {
    type: "NEEDS_CORRECTION",
    title: "طلب تصحيح أو استكمال نواقص ⚠️",
    description: "إشعار المرسل بوجود مستند غير واضح أو بيانات بحاجة لتعديل",
    iconName: "AlertTriangle",
  },
];

/**
 * Clean phone number to ensure proper international format for WhatsApp wa.me
 * Automatically handles Saudi (966) and Egyptian (20) numbers if written locally (e.g. 05..., 01...)
 */
export function formatPhoneForWhatsApp(phone?: string): string {
  if (!phone) return "";
  let clean = phone.replace(/[^\d+]/g, "").trim();

  // If starts with +, remove +
  if (clean.startsWith("+")) clean = clean.substring(1);

  // Saudi local number e.g. 0501234567 -> 966501234567
  if (clean.startsWith("05") && clean.length === 10) {
    clean = "966" + clean.substring(1);
  }
  // Egyptian local number e.g. 01012345678 -> 201012345678
  else if (clean.startsWith("01") && clean.length === 11) {
    clean = "20" + clean.substring(1);
  }
  // 9-digit Saudi starting with 5 -> 9665...
  else if (clean.startsWith("5") && clean.length === 9) {
    clean = "966" + clean;
  }

  return clean;
}

/**
 * Generate formatted text based on template type and request data
 */
export function generateWhatsAppMessage(
  templateType: WhatsAppTemplateType,
  request: GroupRequestDetail | GroupRequestSummary,
  customNote?: string
): string {
  const travelersCount =
    "travelers" in request && Array.isArray(request.travelers)
      ? request.travelers.length
      : request.travelersCount || 1;

  const firstTraveler =
    "travelers" in request && request.travelers?.[0]
      ? request.travelers[0].fullName
      : request.travelersList?.[0]?.fullName || request.groupName || "المعتمر";

  const appTitle = "نظام مسار الحج والعمرة";

  switch (templateType) {
    case "NUSUK_ISSUED":
      return `السلام عليكم ورحمة الله وبركاته،
نفيدكم بصدور *رقم مجموعة نسك* الخاص بمعاملتكم بنجاح 🕋✨

📄 *بيانات المعاملة:*
• الفوج / المعتمر: ${request.groupName} (${firstTraveler})
• رقم المعاملة: ${request.requestNumber}
• *رقم مجموعة نسك:* ${request.nusukGroupNumber || "قيد الإصدار"}
• عدد المسافرين: ${travelersCount}
✈️ *رحلة الذهاب:* ${request.flightNumber || "تذكرة مشتركة"} بتاريخ ${request.departureDate || request.travelDate || "لم يحدد"}
🛬 *المطار:* ${request.arrivalAirport || "مطار جدة"}
${customNote ? `\nملاحظة: ${customNote}\n` : ""}
تقبل الله طاعتكم، نتمنى لكم رحلة ميسرة ومباركة!
— ${appTitle}`;

    case "COMPLETED":
      return `السلام عليكم ورحمة الله وبركاته،
يسعدنا إبلاغكم باكتمال كافة إجراءات المعاملة والتأشيرات وتذاكر الطيران بنجاح ✅✈️

📄 *تفاصيل السفر:*
• الفوج: ${request.groupName}
• رقم مجموعة نسك: ${request.nusukGroupNumber || "-"}
• عدد المسافرين: ${travelersCount}
• رحلة الذهاب: ${request.flightNumber || "-"}
• تاريخ الإقلاع: ${request.departureDate || request.travelDate || "-"}
• موعد الإقلاع: ${request.flightDepartureTime || "19:05"}
• ⚠️ *موعد الحضور للمطار:* ${request.airportArrivalTime || "16:05"} (قبل الإقلاع بـ 3 ساعات)
• رحلة العودة: ${request.returnFlightNumber || request.flightNumber || "-"}
• تاريخ العودة: ${request.returnDate || "-"}
${customNote ? `\nملاحظة: ${customNote}\n` : ""}
يرجى التأكد من طباعة تذاكر الطيران وجوازات السفر.
— ${appTitle}`;

    case "NEW_REQUEST":
      return `السلام عليكم ورحمة الله وبركاته،
تم استلام معاملتكم بنجاح في النظام وجاري تدقيق البيانات والمستندات 📝

📄 *ملخص الاستلام:*
• اسم الفوج: ${request.groupName}
• رقم المعاملة: ${request.requestNumber}
• عدد المسافرين: ${travelersCount}
• تاريخ السفر المجدول: ${request.departureDate || request.travelDate || "لم يحدد"}
${customNote ? `\nملاحظة: ${customNote}\n` : ""}
سيتم إشعاركم فور صدور رقم مجموعة نسك أو تحديث الحالة.
— ${appTitle}`;

    case "FLIGHT_REMINDER":
      return `تذكير هام بموعد رحلة الطيران ⏰✈️
السلام عليكم ورحمة الله وبركاته،
نود تذكيركم بموعد السفر القريب للفوج: *${request.groupName}*

✈️ *بيانات الرحلة:*
• رقم الرحلة: ${request.flightNumber || "-"}
• شركة الطيران: ${request.airline || "طيران النيل"}
• تاريخ السفر: ${request.departureDate || request.travelDate || "-"}
• موعد إقلاع الطائرة: ${request.flightDepartureTime || "19:05"}
• 🚨 *موعد التواجد الإلزامي بصالة المطار:* ${request.airportArrivalTime || "16:05"} (قبل الإقلاع بـ 3 ساعات لتفادي إغلاق الكاونتر).
• رقم مجموعة نسك: ${request.nusukGroupNumber || "-"}
${customNote ? `\nملاحظة: ${customNote}\n` : ""}
رافقتكم السلامة وتقبل الله منكم!
— ${appTitle}`;

    case "NEEDS_CORRECTION":
      return `السلام عليكم ورحمة الله وبركاته،
بخصوص المعاملة رقم: *${request.requestNumber}* (فوج: ${request.groupName}) ⚠️

نرجو التكرم بالدخول وتحديث البيانات أو إعادة إرفاق المستندات المطلوبة:
${customNote ? `\n*المطلوب تصحيحه:*\n${customNote}\n` : "\nيرجى مراجعة صفحة المعاملة لتعديل النواقص.\n"}
شاكرين ومقدرين حسن تعاونكم لإتمام المعاملة في أسرع وقت.
— ${appTitle}`;
  }
}

/**
 * Generate full WhatsApp web / app URL
 */
export function buildWhatsAppUrl(
  phone: string,
  templateType: WhatsAppTemplateType,
  request: GroupRequestDetail | GroupRequestSummary,
  customNote?: string
): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const text = generateWhatsAppMessage(templateType, request, customNote);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
