import * as XLSX from "xlsx";
import { GroupRequestDetail } from "@/types";
import { STATUS_MAP } from "./constants";

// Helper: build direct link to view document inside request detail page
function buildDocUrl(requestId: string, docId: string): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const pathname = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
  return `${origin}${pathname}?requestId=${encodeURIComponent(requestId)}&docId=${encodeURIComponent(docId)}`;
}

// Helpers to extract documents from a request
function getHostDocument(r: GroupRequestDetail) {
  return (
    r.hostingInfo?.hostIdDocument ||
    r.groupDocuments?.find((d) => d.documentType === "HostId")
  );
}

function getPassportDocument(r: GroupRequestDetail) {
  if (r.travelers) {
    for (const t of r.travelers) {
      const doc = t.documents?.find((d) => d.documentType === "Passport");
      if (doc) return doc;
    }
  }
  return r.groupDocuments?.find((d) => d.documentType === "Passport");
}

function getPhotoDocument(r: GroupRequestDetail) {
  if (r.travelers) {
    for (const t of r.travelers) {
      const doc = t.documents?.find((d) => d.documentType === "PersonalPhoto");
      if (doc) return doc;
    }
  }
  return r.groupDocuments?.find((d) => d.documentType === "PersonalPhoto");
}

function getTicketDocument(r: GroupRequestDetail) {
  if (r.travelers) {
    for (const t of r.travelers) {
      const doc = t.documents?.find((d) => d.documentType === "FlightTicket");
      if (doc) return doc;
    }
  }
  return r.groupDocuments?.find((d) => d.documentType === "FlightTicket");
}

export function exportRequestsToExcel(requests: GroupRequestDetail[]) {
  // 1. Prepare Main Sheet: Transactions (المعاملات)
  const transactionsData = requests.map((r, index) => {
    const statusArabic = STATUS_MAP[r.status]?.label || r.status;

    const hostDoc = getHostDocument(r);
    const passDoc = getPassportDocument(r);
    const photoDoc = getPhotoDocument(r);
    const ticketDoc = getTicketDocument(r);

    const hostLink = hostDoc ? buildDocUrl(r.id, hostDoc.id) : "لم يُرفع بعد";
    const passLink = passDoc ? buildDocUrl(r.id, passDoc.id) : "لم يُرفع بعد";
    const photoLink = photoDoc ? buildDocUrl(r.id, photoDoc.id) : "لم يُرفع بعد";
    const ticketLink = ticketDoc ? buildDocUrl(r.id, ticketDoc.id) : "لم يُرفع بعد";

    return {
      "م": index + 1,
      "رقم المعاملة": r.requestNumber,
      "الحالة الحالية": statusArabic,
      "عدد المعتمرين / المسافرين": r.travelers ? r.travelers.length : 0,
      "رقم مجموعة نسك": r.nusukGroupNumber || "لم يُسجل بعد",
      "وكيل الإرسال": r.senderName || "-",
      "تاريخ السفر / الذهاب": r.departureDate || r.travelDate || "-",
      "وقت إقلاع الطائرة": r.flightDepartureTime || "-",
      "وقت تواجد المسافر في المطار": r.airportArrivalTime || "-",
      "تاريخ العودة": r.returnDate || "-",
      "رابط صورة الاستضافة": hostLink,
      "رابط صورة الجواز": passLink,
      "رابط الصورة الشخصية": photoLink,
      "رابط تذكرة الطيران": ticketLink,
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
    const hostDoc = getHostDocument(r);
    const hostLink = hostDoc ? buildDocUrl(r.id, hostDoc.id) : "لم يُرفع بعد";

    r.travelers?.forEach((t) => {
      let tStatus = "قيد التدقيق";
      if (t.status === "Accepted") tStatus = "مقبول";
      else if (t.status === "NeedsCorrection") tStatus = "مطلوب تصحيح";
      else if (t.status === "Rejected") tStatus = "مرفوض";

      const tPassDoc = t.documents?.find((d) => d.documentType === "Passport");
      const tPhotoDoc = t.documents?.find((d) => d.documentType === "PersonalPhoto");
      const tTicketDoc = t.documents?.find((d) => d.documentType === "FlightTicket");

      const tPassLink = tPassDoc ? buildDocUrl(r.id, tPassDoc.id) : "لم يُرفع بعد";
      const tPhotoLink = tPhotoDoc ? buildDocUrl(r.id, tPhotoDoc.id) : "لم يُرفع بعد";
      const tTicketLink = tTicketDoc ? buildDocUrl(r.id, tTicketDoc.id) : "لم يُرفع بعد";

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
        "رابط صورة الجواز": tPassLink,
        "رابط الصورة الشخصية": tPhotoLink,
        "رابط تذكرة الطيران": tTicketLink,
        "رابط وثيقة الاستضافة": hostLink,
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

  // Set column widths for Sheet 1
  wsTransactions["!cols"] = [
    { wch: 6 },  // م
    { wch: 16 }, // رقم المعاملة
    { wch: 22 }, // الحالة الحالية
    { wch: 15 }, // عدد المعتمرين / المسافرين
    { wch: 18 }, // رقم مجموعة نسك
    { wch: 24 }, // وكيل الإرسال
    { wch: 16 }, // تاريخ السفر / الذهاب
    { wch: 16 }, // وقت إقلاع الطائرة
    { wch: 18 }, // وقت تواجد المسافر في المطار
    { wch: 16 }, // تاريخ العودة
    { wch: 38 }, // رابط صورة الاستضافة
    { wch: 38 }, // رابط صورة الجواز
    { wch: 38 }, // رابط الصورة الشخصية
    { wch: 38 }, // رابط تذكرة الطيران
    { wch: 14 }, // يوجد استضافة / فندق
    { wch: 22 }, // اسم الفندق / المستضيف
    { wch: 16 }, // هاتف المستضيف
    { wch: 25 }, // عنوان المستضيف
    { wch: 30 }, // الملاحظات
    { wch: 20 }, // تاريخ الإنشاء
    { wch: 20 }, // آخر تحديث
  ];

  // Create Worksheet 2: Travelers
  const wsTravelers = XLSX.utils.json_to_sheet(
    travelersData.length > 0 ? travelersData : [{ "ملاحظة": "لا توجد بيانات مسافرين حالياً" }]
  );

  // Set column widths for Sheet 2
  wsTravelers["!cols"] = [
    { wch: 6 },  // م
    { wch: 16 }, // رقم المعاملة
    { wch: 26 }, // اسم الفوج
    { wch: 20 }, // حالة المعاملة
    { wch: 28 }, // اسم المعتمر / المسافر
    { wch: 18 }, // رقم جواز السفر
    { wch: 16 }, // الجنسية
    { wch: 14 }, // تاريخ الميلاد
    { wch: 18 }, // حالة تدقيق المعتمر
    { wch: 38 }, // رابط صورة الجواز
    { wch: 38 }, // رابط الصورة الشخصية
    { wch: 38 }, // رابط تذكرة الطيران
    { wch: 38 }, // رابط وثيقة الاستضافة
    { wch: 14 }, // عدد الوثائق
    { wch: 25 }, // ملاحظات
    { wch: 16 }, // تاريخ الإضافة
  ];

  // Attach clickable hyperlinks to all URL cells in both worksheets
  function attachHyperlinks(ws: XLSX.WorkSheet) {
    if (!ws || !ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddress];
        if (cell && typeof cell.v === "string" && cell.v.startsWith("http")) {
          cell.l = { Target: cell.v, Tooltip: "انقر لفتح المستند في النظام" };
        }
      }
    }
  }

  attachHyperlinks(wsTransactions);
  attachHyperlinks(wsTravelers);

  XLSX.utils.book_append_sheet(workbook, wsTransactions, "قائمة المعاملات");
  XLSX.utils.book_append_sheet(workbook, wsTravelers, "بيانات المعتمرين والمسافرين");

  // Format date for filename: YYYY-MM-DD
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `تقرير_معاملات_الحج_والعمرة_${dateStr}.xlsx`;

  // Trigger browser download
  XLSX.writeFile(workbook, fileName);
}
