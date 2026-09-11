import * as XLSX from "xlsx";
import { GroupRequestDetail } from "@/types";
import { STATUS_MAP } from "./constants";

export function exportRequestsToExcel(requests: GroupRequestDetail[]) {
  // 1. Prepare Main Sheet: Transactions (المعاملات)
  const transactionsData = requests.map((r, index) => {
    const statusArabic = STATUS_MAP[r.status]?.label || r.status;
    let docCount = r.groupDocuments ? r.groupDocuments.length : 0;
    r.travelers.forEach((t) => {
      docCount += t.documents ? t.documents.length : 0;
    });

    return {
      "م": index + 1,
      "رقم المعاملة": r.requestNumber,
      "اسم الفوج / المجموعة": r.groupName,
      "الحالة الحالية": statusArabic,
      "عدد المعتمرين / المسافرين": r.travelers.length,
      "عدد الوثائق والمرفقات": docCount,
      "رقم مجموعة نسك": r.nusukGroupNumber || "لم يُسجل بعد",
      "وكيل الإرسال": r.senderName || "-",
      "موظف تسجيل الصفا": r.assignedSafaEmployeeName || "غير مسند",
      "الوكيل السعودي": r.assignedSaudiAgentName || "غير مسند",
      "رقم هاتف التواصل": r.contactPhone || "-",
      "تاريخ السفر / الذهاب": r.departureDate || r.travelDate || "-",
      "تاريخ العودة": r.returnDate || "-",
      "وقت إقلاع الطائرة": r.flightDepartureTime || "-",
      "وقت تواجد المسافر في المطار": r.airportArrivalTime || "-",
      "الوجهة": r.destination || "-",
      "يوجد استضافة / فندق": r.hasHosting ? "نعم" : "لا",
      "اسم الفندق / المستضيف": r.hostingInfo?.hostName || "-",
      "هاتف المستضيف": r.hostingInfo?.hostPhone || "-",
      "عنوان المستضيف": r.hostingInfo?.hostAddress || "-",
      "الملاحظات": r.notes || "-",
      "تاريخ الإنشاء": new Date(r.createdAt).toLocaleString("ar-SA"),
      "آخر تحديث": new Date(r.updatedAt).toLocaleString("ar-SA"),
    };
  });

  // 2. Prepare Secondary Sheet: Travelers & Pilgrims (المعتمرون والمسافرون)
  const travelersData: any[] = [];
  let travelerCounter = 1;

  requests.forEach((r) => {
    const statusArabic = STATUS_MAP[r.status]?.label || r.status;
    r.travelers.forEach((t) => {
      let tStatus = "قيد التدقيق";
      if (t.status === "Accepted") tStatus = "مقبول";
      else if (t.status === "NeedsCorrection") tStatus = "مطلوب تصحيح";
      else if (t.status === "Rejected") tStatus = "مرفوض";

      travelersData.push({
        "م": travelerCounter++,
        "رقم المعاملة": r.requestNumber,
        "اسم الفوج": r.groupName,
        "حالة المعاملة": statusArabic,
        "اسم المعتمر / المسافر": t.fullName,
        "رقم جواز السفر": t.passportNumber || "-",
        "الجنسية": t.nationality || "-",
        "تاريخ الميلاد": t.dateOfBirth || "-",
        "حالة تدقيق المعتمر": tStatus,
        "عدد الوثائق المرفوعة": t.documents ? t.documents.length : 0,
        "ملاحظات": t.notes || "-",
        "تاريخ الإضافة": t.createdAt ? new Date(t.createdAt).toLocaleDateString("ar-SA") : "-",
      });
    });
  });

  // Create new Workbook
  const workbook = XLSX.utils.book_new();

  // Create Worksheet 1: Transactions
  const wsTransactions = XLSX.utils.json_to_sheet(
    transactionsData.length > 0 ? transactionsData : [{ "ملاحظة": "لا توجد معاملات مسجلة حالياً" }]
  );
  // Set column widths
  wsTransactions["!cols"] = [
    { wch: 6 },  // م
    { wch: 16 }, // رقم المعاملة
    { wch: 28 }, // اسم الفوج
    { wch: 22 }, // الحالة
    { wch: 15 }, // عدد المسافرين
    { wch: 14 }, // عدد الوثائق
    { wch: 18 }, // رقم نسك
    { wch: 24 }, // وكيل الإرسال
    { wch: 24 }, // موظف الصفا
    { wch: 24 }, // الوكيل السعودي
    { wch: 18 }, // الهاتف
    { wch: 14 }, // تاريخ السفر
    { wch: 25 }, // الوجهة
    { wch: 12 }, // يوجد استضافة
    { wch: 22 }, // الفندق
    { wch: 16 }, // هاتف المستضيف
    { wch: 25 }, // عنوان المستضيف
    { wch: 30 }, // الملاحظات
    { wch: 20 }, // الإنشاء
    { wch: 20 }, // التحديث
  ];
  XLSX.utils.book_append_sheet(workbook, wsTransactions, "قائمة المعاملات");

  // Create Worksheet 2: Travelers
  const wsTravelers = XLSX.utils.json_to_sheet(
    travelersData.length > 0 ? travelersData : [{ "ملاحظة": "لا توجد بيانات مسافرين حالياً" }]
  );
  wsTravelers["!cols"] = [
    { wch: 6 },  // م
    { wch: 16 }, // رقم المعاملة
    { wch: 26 }, // اسم الفوج
    { wch: 20 }, // حالة المعاملة
    { wch: 28 }, // اسم المعتمر
    { wch: 18 }, // رقم الجواز
    { wch: 16 }, // الجنسية
    { wch: 14 }, // تاريخ الميلاد
    { wch: 18 }, // حالة التدقيق
    { wch: 14 }, // عدد الوثائق
    { wch: 25 }, // ملاحظات
    { wch: 16 }, // تاريخ الإضافة
  ];
  XLSX.utils.book_append_sheet(workbook, wsTravelers, "بيانات المعتمرين والمسافرين");

  // Format date for filename: YYYY-MM-DD
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `تقرير_معاملات_الحج_والعمرة_${dateStr}.xlsx`;

  // Trigger browser download
  XLSX.writeFile(workbook, fileName);
}
