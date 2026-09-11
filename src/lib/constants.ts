import {
  DocumentReviewStatus,
  DocumentType,
  RequestStatus,
  UserRole,
} from "@/types";

export const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  Sender: { label: "مرسل المعاملات", color: "bg-blue-100 text-blue-800" },
  SafaEmployee: { label: "موظف تسجيل الصفا", color: "bg-emerald-100 text-emerald-800" },
  SaudiAgent: { label: "الوكيل السعودي", color: "bg-amber-100 text-amber-800" },
  Admin: { label: "مدير النظام", color: "bg-purple-100 text-purple-800" },
};

export const STATUS_MAP: Record<
  RequestStatus,
  { label: string; color: string; step: number }
> = {
  Draft: { label: "مسودة", color: "bg-gray-100 text-gray-700 border-gray-300", step: 1 },
  Submitted: { label: "تم التقديم", color: "bg-blue-50 text-blue-700 border-blue-200", step: 2 },
  UnderReview: { label: "قيد مراجعة الصفا", color: "bg-amber-50 text-amber-700 border-amber-200", step: 3 },
  MissingDocuments: { label: "مستندات ناقصة", color: "bg-orange-50 text-orange-700 border-orange-300", step: 3 },
  CorrectionRequired: { label: "مطلوب تصحيح", color: "bg-rose-50 text-rose-700 border-rose-300", step: 3 },
  DocumentsCompleted: { label: "المستندات مكتملة ومقبولة", color: "bg-teal-50 text-teal-700 border-teal-200", step: 4 },
  SafaRegistrationCompleted: { label: "اكتمل تسجيل صفا (تم إدخال نسك)", color: "bg-emerald-50 text-emerald-700 border-emerald-200", step: 5 },
  ReadyForSaudiAgent: { label: "جاهز ومحال للوكيل السعودي", color: "bg-indigo-50 text-indigo-700 border-indigo-200", step: 6 },
  ReceivedBySaudiAgent: { label: "تم الاستلام من الوكيل", color: "bg-sky-50 text-sky-700 border-sky-200", step: 7 },
  SaudiAgentProcessing: { label: "قيد معالجة الوكيل السعودي", color: "bg-cyan-50 text-cyan-700 border-cyan-200", step: 8 },
  SaudiAgentCorrectionRequired: { label: "مطلوب تصحيح من الوكيل", color: "bg-red-50 text-red-700 border-red-300", step: 8 },
  Completed: { label: "مكتمل نهائياً ✓", color: "bg-green-100 text-green-800 border-green-300", step: 9 },
  Cancelled: { label: "ملغي", color: "bg-zinc-200 text-zinc-700 border-zinc-300", step: 0 },
  Archived: { label: "مؤرشف", color: "bg-slate-200 text-slate-700 border-slate-300", step: 0 },
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  Passport: "جواز السفر",
  PersonalPhoto: "الصورة الشخصية",
  FlightTicket: "تذكرة الطيران",
  HostId: "هوية المستضيف",
  Other: "مستند إضافي",
};

export const REVIEW_STATUS_MAP: Record<
  DocumentReviewStatus,
  { label: string; color: string }
> = {
  Pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  Accepted: { label: "مقبول ✓", color: "bg-green-100 text-green-800" },
  Rejected: { label: "مرفوض ✗", color: "bg-red-100 text-red-800" },
  NeedsCorrection: { label: "يحتاج تصحيح", color: "bg-orange-100 text-orange-800" },
  Missing: { label: "مفقود", color: "bg-rose-100 text-rose-800" },
};
