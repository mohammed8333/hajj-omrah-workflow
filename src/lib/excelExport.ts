import XLSX from "xlsx-js-style";
import { GroupRequestDetail } from "@/types";
import { STATUS_MAP } from "./constants";

// Helper: build direct cloud link or fallback link to view document
function buildDocUrl(requestId: string, doc?: { id: string; storageUrl?: string } | null): string {
  if (!doc) return "لم يُرفع بعد";
  if (doc.storageUrl) return doc.storageUrl;
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  return `${origin}/requests/${encodeURIComponent(requestId)}?docId=${encodeURIComponent(doc.id)}`;
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
  if (r.flightTicketDocument) return r.flightTicketDocument;
  const groupTicket = r.groupDocuments?.find((d) => d.documentType === "FlightTicket");
  if (groupTicket) return groupTicket;
  if (r.travelers) {
    for (const t of r.travelers) {
      const doc = t.documents?.find((d) => d.documentType === "FlightTicket");
      if (doc) return doc;
    }
  }
  return undefined;
}

export function exportRequestsToExcel(requests: GroupRequestDetail[]) {
  // 1. Prepare Main Sheet: Transactions with grouped traveler rows underneath
  const transactionsData: any[] = [];
  const transactionsMeta: { reqIndex: number; isFirstRowOfReq: boolean }[] = [];
  let transactionCounter = 1;

  requests.forEach((r, rIdx) => {
    const statusArabic = STATUS_MAP[r.status]?.label || r.status;
    const hostDoc = getHostDocument(r);
    const hostLink = buildDocUrl(r.id, hostDoc);

    const travelers = r.travelers && r.travelers.length > 0 ? r.travelers : null;

    if (!travelers || travelers.length === 0) {
      // Transaction has no registered travelers yet
      const passDoc = getPassportDocument(r);
      const photoDoc = getPhotoDocument(r);
      const ticketDoc = getTicketDocument(r);

      transactionsData.push({
        "م": transactionCounter++,
        "رقم المعاملة": r.requestNumber,
        "الحالة الحالية": statusArabic,
        "عدد المعتمرين / المسافرين": 0,
        "رقم مجموعة نسك": r.nusukGroupNumber || "لم يُسجل بعد",
        "وكيل الإرسال": r.senderName || "-",
        "تاريخ السفر / الذهاب": r.departureDate || r.travelDate || "-",
        "شركة / نوع الطيران": r.airline || "-",
        "رقم الرحلة": r.flightNumber || "-",
        "وقت إقلاع الطائرة": r.flightDepartureTime || "-",
        "وقت تواجد المسافر في المطار": r.airportArrivalTime || "-",
        "تاريخ العودة": r.returnDate || "-",
        "اسم المعتمر / المسافر": "لا يوجد مسافرين مسجلين",
        "رقم جواز السفر": "-",
        "رقم هاتف المسافر": "-",
        "رابط صورة الجواز": buildDocUrl(r.id, passDoc),
        "رابط الصورة الشخصية": buildDocUrl(r.id, photoDoc),
        "رابط تذكرة الطيران": buildDocUrl(r.id, ticketDoc),
        "رابط صورة الاستضافة": hostLink,
        "يوجد استضافة / فندق": r.hasHosting ? "نعم" : "لا",
        "اسم الفندق / المستضيف": r.hostingInfo?.hostName || "-",
        "جنسية المستضيف": r.hostingInfo?.hostNationality || "-",
        "تاريخ ميلاد المستضيف": r.hostingInfo?.hostBirthDate || "-",
        "هاتف المستضيف": r.hostingInfo?.hostPhone || "-",
        "عنوان المستضيف": r.hostingInfo?.hostAddress || "-",
        "الملاحظات": r.notes || "-",
        "تاريخ الإنشاء": new Date(r.createdAt).toLocaleString("ar-SA"),
        "آخر تحديث": new Date(r.updatedAt).toLocaleString("ar-SA"),
      });
      transactionsMeta.push({ reqIndex: rIdx, isFirstRowOfReq: true });
    } else {
      // Transaction has one or more travelers: list them row under row
      travelers.forEach((t, tIndex) => {
        const isFirst = tIndex === 0;

        const tPassDoc =
          t.documents?.find((d) => d.documentType === "Passport") ||
          (isFirst ? getPassportDocument(r) : undefined);
        const tPhotoDoc =
          t.documents?.find((d) => d.documentType === "PersonalPhoto") ||
          (isFirst ? getPhotoDocument(r) : undefined);
        const tTicketDoc =
          t.documents?.find((d) => d.documentType === "FlightTicket") ||
          getTicketDocument(r);

        const tPassLink = buildDocUrl(r.id, tPassDoc);
        const tPhotoLink = buildDocUrl(r.id, tPhotoDoc);
        const tTicketLink = buildDocUrl(r.id, tTicketDoc);

        if (isFirst) {
          // Row 1: Full transaction details + First traveler's details
          transactionsData.push({
            "م": transactionCounter++,
            "رقم المعاملة": r.requestNumber,
            "الحالة الحالية": statusArabic,
            "عدد المعتمرين / المسافرين": travelers.length,
            "رقم مجموعة نسك": r.nusukGroupNumber || "لم يُسجل بعد",
            "وكيل الإرسال": r.senderName || "-",
            "تاريخ السفر / الذهاب": r.departureDate || r.travelDate || "-",
            "شركة / نوع الطيران": r.airline || "-",
            "رقم الرحلة": r.flightNumber || "-",
            "وقت إقلاع الطائرة": r.flightDepartureTime || "-",
            "وقت تواجد المسافر في المطار": r.airportArrivalTime || "-",
            "تاريخ العودة": r.returnDate || "-",
            "اسم المعتمر / المسافر": t.fullName,
            "رقم جواز السفر": t.passportNumber || "-",
            "رقم هاتف المسافر": t.phoneNumber || "-",
            "رابط صورة الجواز": tPassLink,
            "رابط الصورة الشخصية": tPhotoLink,
            "رابط تذكرة الطيران": tTicketLink,
            "رابط صورة الاستضافة": hostLink,
            "يوجد استضافة / فندق": r.hasHosting ? "نعم" : "لا",
            "اسم الفندق / المستضيف": r.hostingInfo?.hostName || "-",
            "جنسية المستضيف": r.hostingInfo?.hostNationality || "-",
            "تاريخ ميلاد المستضيف": r.hostingInfo?.hostBirthDate || "-",
            "هاتف المستضيف": r.hostingInfo?.hostPhone || "-",
            "عنوان المستضيف": r.hostingInfo?.hostAddress || "-",
            "الملاحظات": r.notes || "-",
            "تاريخ الإنشاء": new Date(r.createdAt).toLocaleString("ar-SA"),
            "آخر تحديث": new Date(r.updatedAt).toLocaleString("ar-SA"),
          });
          transactionsMeta.push({ reqIndex: rIdx, isFirstRowOfReq: true });
        } else {
          // Row 2..N: Subsequent travelers under this transaction
          // Transaction fields are kept blank, only traveler details and document links are shown
          transactionsData.push({
            "م": "",
            "رقم المعاملة": "",
            "الحالة الحالية": "",
            "عدد المعتمرين / المسافرين": "",
            "رقم مجموعة نسك": "",
            "وكيل الإرسال": "",
            "تاريخ السفر / الذهاب": "",
            "شركة / نوع الطيران": "",
            "رقم الرحلة": "",
            "وقت إقلاع الطائرة": "",
            "وقت تواجد المسافر في المطار": "",
            "تاريخ العودة": "",
            "اسم المعتمر / المسافر": t.fullName,
            "رقم جواز السفر": t.passportNumber || "-",
            "رقم هاتف المسافر": t.phoneNumber || "-",
            "رابط صورة الجواز": tPassLink,
            "رابط الصورة الشخصية": tPhotoLink,
            "رابط تذكرة الطيران": tTicketLink,
            "رابط صورة الاستضافة": "",
            "يوجد استضافة / فندق": "",
            "اسم الفندق / المستضيف": "",
            "جنسية المستضيف": "",
            "تاريخ ميلاد المستضيف": "",
            "هاتف المستضيف": "",
            "عنوان المستضيف": "",
            "الملاحظات": t.notes || "",
            "تاريخ الإنشاء": "",
            "آخر تحديث": "",
          });
          transactionsMeta.push({ reqIndex: rIdx, isFirstRowOfReq: false });
        }
      });
    }
  });

  // 2. Prepare Secondary Sheet: Travelers & Pilgrims (المعتمرون والمسافرون)
  const travelersData: any[] = [];
  const travelersMeta: { reqIndex: number; isFirstRowOfReq: boolean }[] = [];
  let travelerCounter = 1;

  requests.forEach((r, rIdx) => {
    const statusArabic = STATUS_MAP[r.status]?.label || r.status;
    const hostDoc = getHostDocument(r);
    const hostLink = buildDocUrl(r.id, hostDoc);

    r.travelers?.forEach((t, tIndex) => {
      let tStatus = "قيد التدقيق";
      if (t.status === "Accepted") tStatus = "مقبول";
      else if (t.status === "NeedsCorrection") tStatus = "مطلوب تصحيح";
      else if (t.status === "Rejected") tStatus = "مرفوض";

      const tPassDoc = t.documents?.find((d) => d.documentType === "Passport");
      const tPhotoDoc = t.documents?.find((d) => d.documentType === "PersonalPhoto");
      const tTicketDoc =
        t.documents?.find((d) => d.documentType === "FlightTicket") ||
        getTicketDocument(r);

      const tPassLink = buildDocUrl(r.id, tPassDoc);
      const tPhotoLink = buildDocUrl(r.id, tPhotoDoc);
      const tTicketLink = buildDocUrl(r.id, tTicketDoc);

      travelersData.push({
        "م": travelerCounter++,
        "رقم المعاملة": r.requestNumber,
        "اسم الفوج": r.groupName,
        "حالة المعاملة": statusArabic,
        "اسم المعتمر / المسافر": t.fullName,
        "رقم جواز السفر": t.passportNumber || "-",
        "رقم الهاتف": t.phoneNumber || "-",
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
      travelersMeta.push({ reqIndex: rIdx, isFirstRowOfReq: tIndex === 0 });
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
    { wch: 20 }, // شركة / نوع الطيران
    { wch: 14 }, // رقم الرحلة
    { wch: 16 }, // وقت إقلاع الطائرة
    { wch: 18 }, // وقت تواجد المسافر في المطار
    { wch: 16 }, // تاريخ العودة
    { wch: 26 }, // اسم المعتمر / المسافر
    { wch: 18 }, // رقم جواز السفر
    { wch: 18 }, // رقم هاتف المسافر
    { wch: 38 }, // رابط صورة الجواز
    { wch: 38 }, // رابط الصورة الشخصية
    { wch: 38 }, // رابط تذكرة الطيران
    { wch: 38 }, // رابط صورة الاستضافة
    { wch: 14 }, // يوجد استضافة / فندق
    { wch: 22 }, // اسم الفندق / المستضيف
    { wch: 18 }, // جنسية المستضيف
    { wch: 18 }, // تاريخ ميلاد المستضيف
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
    { wch: 18 }, // رقم الهاتف
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

  // Apply colors, alternating transaction tints, borders, fonts and clickable hyperlinks
  function styleWorksheet(
    ws: XLSX.WorkSheet,
    rowMetadata: { reqIndex: number; isFirstRowOfReq?: boolean }[]
  ) {
    if (!ws || !ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);

    // Enable Right-To-Left view natively for Arabic layout
    ws["!views"] = [{ RTL: true }];

    // 1. Style Header Row (R = 0)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C });
      const cell = ws[headerAddress];
      if (cell) {
        cell.s = {
          fill: {
            patternType: "solid",
            fgColor: { rgb: "0284C7" }, // Primary Sky Blue Header
          },
          font: {
            name: "Calibri",
            sz: 11,
            bold: true,
            color: { rgb: "FFFFFF" }, // White text
          },
          alignment: {
            vertical: "center",
            horizontal: "center",
            wrapText: true,
          },
          border: {
            top: { style: "medium", color: { rgb: "0369A1" } },
            bottom: { style: "medium", color: { rgb: "0369A1" } },
            left: { style: "thin", color: { rgb: "38BDF8" } },
            right: { style: "thin", color: { rgb: "38BDF8" } },
          },
        };
      }
    }

    // 2. Prepare row heights
    const rowHeights: { hpt: number }[] = [{ hpt: 28 }];

    // 3. Style Data Rows (R = 1..end)
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      rowHeights.push({ hpt: 24 });
      const metaIdx = R - (range.s.r + 1);
      const meta = rowMetadata[metaIdx];

      // Alternating blue shades for transactions:
      // Even transaction: "E0F2FE" (لبني فاتح ناعم ومريح)
      // Odd transaction:  "BAE6FD" (لبني أغمق سيكا للتمييز الواضح)
      const isOddTx = meta ? meta.reqIndex % 2 !== 0 : R % 2 !== 0;
      const bgRgb = isOddTx ? "BAE6FD" : "E0F2FE";
      const isNewTx = meta ? meta.isFirstRowOfReq : false;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        let cell = ws[cellAddress];
        if (!cell) {
          cell = { t: "s", v: "" };
          ws[cellAddress] = cell;
        }

        const isUrl = typeof cell.v === "string" && cell.v.startsWith("http");
        if (isUrl) {
          cell.l = { Target: cell.v, Tooltip: "انقر لفتح المستند في النظام" };
        }

        cell.s = {
          fill: {
            patternType: "solid",
            fgColor: { rgb: bgRgb },
          },
          font: {
            name: "Calibri",
            sz: 10,
            bold: isUrl || C === 0 || C === 1,
            color: isUrl ? { rgb: "0369A1" } : { rgb: "0F172A" },
            underline: isUrl,
          },
          alignment: {
            vertical: "center",
            horizontal: "center",
            wrapText: true,
          },
          border: {
            top: isNewTx && metaIdx > 0
              ? { style: "medium", color: { rgb: "0284C7" } } // Thicker border separating transactions
              : { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
          },
        };
      }
    }

    ws["!rows"] = rowHeights;
  }

  styleWorksheet(wsTransactions, transactionsMeta);
  styleWorksheet(wsTravelers, travelersMeta);

  XLSX.utils.book_append_sheet(workbook, wsTransactions, "قائمة المعاملات");
  XLSX.utils.book_append_sheet(workbook, wsTravelers, "بيانات المعتمرين والمسافرين");

  // Format date for filename: YYYY-MM-DD
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `تقرير_معاملات_الحج_والعمرة_${dateStr}.xlsx`;

  // Trigger browser download
  XLSX.writeFile(workbook, fileName);
}
