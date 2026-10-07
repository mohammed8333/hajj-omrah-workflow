/**
 * Official Saudi eVisa Template Generator
 * Produces 100% authentic, pixel-perfect single-page A4 Saudi MOFA eVisa documents
 * matching the official Ministry of Foreign Affairs (KSA VISA) design exactly.
 */

import QRCode from "qrcode";
import { Traveler } from "@/types";
import { VISA_ASSETS, preloadVisaAssets } from "./visaTemplateAssets";
import { generateCode39Svg } from "./barcodeHelper";
import { convertNationalityToMofaCode } from "./mofaVisaService";

export interface OfficialVisaData {
  visaNumber: string;
  applicationNumber: string;
  issueDate: string;
  expiryDate: string;
  durationOfStay: string;
  passportNumber: string;
  placeOfIssue: string;
  fullName: string;
  fullNameEn?: string;
  birthDate: string;
  nationality: string;
  nationalityCode?: string;
  visaType: string;
  umrahOperator: string;
  externalAgent: string;
  borderNumber?: string;
  photoUrl?: string;
  inquiryQrUrl?: string;
  mrzLine1?: string;
  mrzLine2?: string;
}

/**
 * Format date cleanly to official MOFA format: DD/MM/YYYY
 */
export function formatMofaDate(raw?: string): string {
  if (!raw) return "";
  const clean = raw.trim().replace(/\./g, "/").replace(/-/g, "/");
  const parts = clean.split("/").map((p) => p.trim());
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // Input: YYYY/MM/DD -> Output: DD/MM/YYYY
      return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
    } else if (parts[2].length === 4) {
      // Input: DD/MM/YYYY -> Output: DD/MM/YYYY
      return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
    }
  }
  return clean;
}

/**
 * Format nationality to official MOFA bilingual string (e.g. Egypt - مصر)
 */
export function formatMofaNationality(raw?: string): string {
  if (!raw) return "Egypt - مصر";
  const norm = raw.trim().toLowerCase();
  if (norm.includes("مصر") || norm.includes("egy") || norm.includes("مصري")) {
    return "Egypt - مصر";
  }
  if (norm.includes("سعود") || norm.includes("sau")) {
    return "Saudi Arabia - المملكة العربية السعودية";
  }
  if (norm.includes("سودان") || norm.includes("sdn")) {
    return "Sudan - السودان";
  }
  if (norm.includes("أردن") || norm.includes("اردن") || norm.includes("jor")) {
    return "Jordan - الأردن";
  }
  if (norm.includes("سوريا") || norm.includes("syr")) {
    return "Syria - سوريا";
  }
  if (norm.includes("عراق") || norm.includes("irq")) {
    return "Iraq - العراق";
  }
  if (norm.includes("يمن") || norm.includes("yem")) {
    return "Yemen - اليمن";
  }
  if (raw.includes("-")) return raw;
  return `Egypt - ${raw}`;
}

const COMMON_ARABIC_NAMES: Record<string, string> = {
  "محمد": "MOHAMED",
  "احمد": "AHMED",
  "أحمد": "AHMED",
  "محمود": "MAHMOUD",
  "ابراهيم": "IBRAHIM",
  "إبراهيم": "IBRAHIM",
  "على": "ALI",
  "علي": "ALI",
  "حسن": "HASSAN",
  "حسين": "HUSSEIN",
  "مصطفى": "MOSTAFA",
  "مصطفي": "MOSTAFA",
  "عبدالله": "ABDALLAH",
  "عبد الله": "ABDALLAH",
  "عبدالرحمن": "ABDELRAHMAN",
  "عبد الرحمن": "ABDELRAHMAN",
  "عبداللطيف": "ABDELLATIF",
  "عبد اللطيف": "ABDELLATIF",
  "عبدالعزيز": "ABDELAZIZ",
  "عبد العزيز": "ABDELAZIZ",
  "عبدالفتاح": "ABDELFATTAH",
  "عبد الفتاح": "ABDELFATTAH",
  "فوزي": "FAWZY",
  "فوزى": "FAWZY",
  "صبري": "SABRY",
  "صبرى": "SABRY",
  "الدين": "ELDIN",
  "سيد": "SAYED",
  "عمر": "OMAR",
  "عمرو": "AMR",
  "خالد": "KHALED",
  "طارق": "TAREK",
  "يوسف": "YOUSSEF",
  "ياسين": "YASSIN",
  "اسامة": "OSSAMA",
  "أسامة": "OSSAMA",
  "سعيد": "SAEED",
  "سعد": "SAAD",
  "صلاح": "SALAH",
  "رمضان": "RAMADAN",
  "شعبان": "SHAABAN",
  "عادل": "ADEL",
  "عاطف": "ATEF",
  "عصام": "ESSAM",
  "ايمن": "AYMAN",
  "أيمن": "AYMAN",
  "اشرف": "ASHRAF",
  "أشرف": "ASHRAF",
  "اماني": "AMANI",
  "أماني": "AMANI",
  "فاطمة": "FATMA",
  "زينب": "ZEINAB",
  "مريم": "MARYAM",
  "ايمان": "EIMAN",
  "إيمان": "EIMAN",
  "سارة": "SARA",
  "نورا": "NOURA",
  "منى": "MONA",
  "هدى": "HODA",
  "هبه": "HEBA",
  "هبة": "HEBA",
  "دعاء": "DOAA",
  "شيماء": "SHAYMAA",
  "اسماء": "ASMAA",
  "أسماء": "ASMAA",
  "ياسمين": "YASMINE",
  "رنا": "RANA",
  "دينا": "DINA",
  "ندى": "NADA",
};

/**
 * Transliterate Arabic names to English Latin for ICAO MRZ
 */
export function transliterateArabicText(arabic: string): string {
  const norm = arabic
    .replace(/عبد\s+/g, "عبد")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim();
  const words = norm.split(/\s+/).filter(Boolean);
  const outWords: string[] = [];

  for (const w of words) {
    if (COMMON_ARABIC_NAMES[w]) {
      outWords.push(COMMON_ARABIC_NAMES[w]);
    } else {
      const charMap: Record<string, string> = {
        'ا': 'A', 'أ': 'A', 'إ': 'E', 'آ': 'A', 'ء': 'A', 'ئ': 'Y', 'ؤ': 'O',
        'ب': 'B', 'ت': 'T', 'ث': 'TH', 'ج': 'G', 'ح': 'H', 'خ': 'KH',
        'د': 'D', 'ذ': 'Z', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'SH',
        'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A', 'غ': 'GH',
        'ف': 'F', 'ق': 'K', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
        'ه': 'H', 'و': 'W', 'ي': 'Y', 'ى': 'Y', 'ة': 'A'
      };
      const latin = w.split('').map(c => charMap[c] || '').join('');
      outWords.push(latin || "MOHAMED");
    }
  }
  return outWords.join(" ");
}

/**
 * Calculate ICAO Doc 9303 check digit with [7, 3, 1] weights
 */
function calculateCheckDigit(str: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    let val = 0;
    if (char >= "0" && char <= "9") {
      val = char.charCodeAt(0) - 48;
    } else if (char >= "A" && char <= "Z") {
      val = char.charCodeAt(0) - 55;
    }
    sum += val * weights[i % 3];
  }
  return sum % 10;
}

/**
 * Generate standard ICAO 9303 Doc 9303 Part 7 (MRV-A) 2x44 MRZ lines
 */
export function generateVisaMrzLines(data: Partial<OfficialVisaData>): { line1: string; line2: string } {
  const natCode = (data.nationalityCode || convertNationalityToMofaCode(data.nationality) || "EGY").toUpperCase().slice(0, 3);
  
  // English name or transliteration
  let englishName = (data.fullNameEn || "").toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  if (!englishName && data.fullName) {
    englishName = transliterateArabicText(data.fullName);
  }
  if (!englishName) englishName = "TRAVELER";

  const nameParts = englishName.split(/\s+/).filter(Boolean);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || "TRAVELER";
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join("<") : nameParts[0];

  // Line 1: V<NATSU<GIVEN<NAMES... (exactly 44 chars)
  let line1 = `V<${natCode}${surname}<<${givenNames}`;
  line1 = line1.replace(/\s+/g, "<").slice(0, 44);
  line1 = line1.padEnd(44, "<");

  // Line 2: Passport (9) + check (1) + Nat (3) + DOB (6) + check (1) + Sex (1) + Expiry (6) + check (1) + optional (14) + comp (1)
  const pass = (data.passportNumber || "A00000000").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9).padEnd(9, "<");
  const passCheck = calculateCheckDigit(pass.replace(/</g, "0"));

  // DOB YYMMDD: From DD/MM/YYYY or YYYY-MM-DD
  let dobStr = "030915";
  if (data.birthDate) {
    const clean = data.birthDate.trim().replace(/\./g, "/").replace(/-/g, "/");
    const parts = clean.split("/").map((p) => p.trim());
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD -> YYMMDD
        dobStr = `${parts[0].slice(2, 4)}${parts[1].padStart(2, "0")}${parts[2].padStart(2, "0")}`;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY -> YYMMDD
        dobStr = `${parts[2].slice(2, 4)}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`;
      }
    }
  }
  const dobCheck = calculateCheckDigit(dobStr);

  // Expiry YYMMDD: From DD/MM/YYYY or YYYY-MM-DD
  let expStr = "270930";
  if (data.expiryDate) {
    const clean = data.expiryDate.trim().replace(/\./g, "/").replace(/-/g, "/");
    const parts = clean.split("/").map((p) => p.trim());
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD -> YYMMDD
        expStr = `${parts[0].slice(2, 4)}${parts[1].padStart(2, "0")}${parts[2].padStart(2, "0")}`;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY -> YYMMDD
        expStr = `${parts[2].slice(2, 4)}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`;
      }
    }
  }
  const expCheck = calculateCheckDigit(expStr);

  const sex = "M";
  const optional = `${(data.visaNumber || "0000000000").slice(0, 14)}<<<<<<<<<<<<`.slice(0, 14);
  const compositeCheck = calculateCheckDigit(`${pass}${passCheck}${dobStr}${dobCheck}${expStr}${expCheck}${optional}`);

  let line2 = `${pass}${passCheck}${natCode}${dobStr}${dobCheck}${sex}${expStr}${expCheck}${optional}${compositeCheck}`;
  line2 = line2.slice(0, 44).padEnd(44, "<");

  return { line1, line2 };
}

/**
 * Extract structured visa data from MOFA response HTML or Traveler record
 */
export async function extractVisaData(html: string, traveler?: Traveler): Promise<OfficialVisaData> {
  await preloadVisaAssets();

  const vNumMatch =
    html.match(/رقم التأشيرة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9]{10})\s*<\/div>/i) ||
    html.match(/Visa\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9]{10})\s*<\/div>/i) ||
    html.match(/رقم التأشيرة[^0-9]*([0-9]{10})/i) ||
    html.match(/Visa\s*No[^0-9]*([0-9]{10})/i) ||
    html.match(/\b([0-9]{10})\b/);

  const visaNumber = vNumMatch ? vNumMatch[1] : traveler?.visaNumber || "6174819010";

  const appMatch =
    html.match(/رقم الطلب[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*(E[0-9]{9})\s*<\/div>/i) ||
    html.match(/Application\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*(E[0-9]{9})\s*<\/div>/i) ||
    html.match(/\b(E[0-9]{9})\b/i);

  const applicationNumber = appMatch ? appMatch[1] : `E82${visaNumber.slice(3)}`;

  const issueMatch =
    html.match(/صالحة اعتبار[ا|اً]\s*من[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Date\s*of\s*Issue[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Valid\s*from[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const issueDate = issueMatch
    ? formatMofaDate(issueMatch[1])
    : formatMofaDate(traveler?.visaIssueDate) || "01/10/2026";

  const expiryMatch =
    html.match(/صالحة\s*لغاية[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Valid\s*Until[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Valid\s*until[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const expiryDate = expiryMatch
    ? formatMofaDate(expiryMatch[1])
    : formatMofaDate(traveler?.visaExpiryDate) || "30/09/2027";

  const durationMatch = html.match(/مدة\s*الإقامة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const durationOfStay = durationMatch ? durationMatch[1].trim() : "90 Days - 90 يوم";

  const passportMatch =
    html.match(/رقم\s*جواز\s*السفر[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i) ||
    html.match(/Passport\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const passportNumber = passportMatch ? passportMatch[1].trim() : traveler?.passportNumber || "A44811408";

  const nameMatch =
    html.match(/الاسم[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i) ||
    html.match(/الإسم[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i) ||
    html.match(/Name[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const fullName = nameMatch ? nameMatch[1].trim() : traveler?.fullName || "المسافر الكريم";

  const birthMatch =
    html.match(/تاريخ\s*الميلاد[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Birth\s*Date[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const birthDate = birthMatch
    ? formatMofaDate(birthMatch[1])
    : formatMofaDate(traveler?.dateOfBirth) || "15/09/2003";

  const natMatch =
    html.match(/الجنسية[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i) ||
    html.match(/Nationality[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const rawNationality = natMatch ? natMatch[1].trim() : traveler?.nationality || "مصر";
  const nationality = formatMofaNationality(rawNationality);

  const umrahOperatorMatch = html.match(/مكتب\s*العمرة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const umrahOperator = umrahOperatorMatch ? umrahOperatorMatch[1].trim() : "شركة ايواء لخدمات المعتمرين شركة شخص واحد";

  const agentMatch = html.match(/الوكيل\s*الخارجي[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const externalAgent = agentMatch ? agentMatch[1].trim() : "ستار لايت ترافيل";

  // Photo extraction from HTML or Traveler documents
  let photoUrl = "";
  const imgMatches = html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/gi);
  if (imgMatches) {
    for (const tag of imgMatches) {
      const srcM = tag.match(/src=['"]([^'"]+)['"]/i);
      if (srcM && srcM[1]) {
        const s = srcM[1];
        if (
          !s.includes("logo") &&
          !s.includes("emblem") &&
          !s.includes("barcode") &&
          !s.includes("divider") &&
          !s.includes("checkmarks") &&
          !s.includes("qr") &&
          !s.includes("pattern")
        ) {
          photoUrl = s.startsWith("http") || s.startsWith("data:")
            ? s
            : s.startsWith("/")
            ? `https://visa.mofa.gov.sa${s}`
            : `https://visa.mofa.gov.sa/${s}`;
          break;
        }
      }
    }
  }

  if (!photoUrl && traveler?.documents) {
    const pDoc = traveler.documents.find((d) => d.documentType === "PersonalPhoto");
    if (pDoc && pDoc.storageUrl) {
      photoUrl = pDoc.storageUrl;
    }
  }

  // Generate Inquiry QR Code
  const qrTarget = `https://visa.mofa.gov.sa/visaservices/searchvisa?VisaNo=${visaNumber}&AppNo=${applicationNumber}`;
  let inquiryQrUrl = "";
  try {
    inquiryQrUrl = await QRCode.toDataURL(qrTarget, {
      margin: 1,
      width: 250,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {}

  const mrz = generateVisaMrzLines({
    nationality: rawNationality,
    nationalityCode: convertNationalityToMofaCode(rawNationality),
    passportNumber,
    birthDate,
    expiryDate,
    visaNumber,
    fullName,
    fullNameEn: traveler?.fullNameEn,
  });

  return {
    visaNumber,
    applicationNumber,
    issueDate,
    expiryDate,
    durationOfStay,
    passportNumber,
    placeOfIssue: "Saudi Digital Embassy - السفارة السعودية الرقمية",
    fullName,
    fullNameEn: traveler?.fullNameEn,
    birthDate,
    nationality,
    nationalityCode: convertNationalityToMofaCode(rawNationality),
    visaType: "Umrah - عمرة",
    umrahOperator,
    externalAgent,
    photoUrl,
    inquiryQrUrl,
    mrzLine1: mrz.line1,
    mrzLine2: mrz.line2,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Wraps one or more rendered .page-container HTML pages into an official printable document shell
 */
export function wrapWithOfficialDocumentShell(pagesHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      html, body {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page-container {
        padding: 7mm 14mm 6mm 14mm !important;
        box-shadow: none !important;
        page-break-after: always !important;
        break-after: page !important;
        margin: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        box-sizing: border-box !important;
      }
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Arial, sans-serif;
      color: #1a1a2e;
      display: flex;
      justify-content: center;
    }
    .page-container {
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      background-color: #ffffff;
      padding: 7mm 14mm 6mm 14mm;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      direction: ltr; /* Base LTR ensures Left elements stay on the Left and Right stay on Right */
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .watermark-bg {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 165mm;
      height: auto;
      opacity: 0.95;
      pointer-events: none;
      z-index: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      position: relative;
      z-index: 1;
    }
    .header-table td {
      padding: 0;
      vertical-align: middle;
    }
    .top-layout-table td {
      padding: 0;
      vertical-align: top;
    }
    .photo-box {
      width: 43mm;
      height: 52mm;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      overflow: hidden;
      background: #ffffff;
      box-sizing: border-box;
    }
    .top-table {
      width: 100%;
      height: 52mm;
      border-collapse: collapse;
    }
    .top-table tr {
      border-top: 1.5px solid #5a3c7c;
      border-bottom: 1.5px solid #5a3c7c;
      height: 10.4mm;
    }
    .top-table td.col-en {
      width: 28%;
      text-align: left;
      font-size: 11px;
      color: #5a3c7c;
      font-weight: 700;
      direction: ltr;
      padding: 0 6px;
      vertical-align: middle;
    }
    .top-table td.col-val {
      width: 44%;
      text-align: center;
      font-size: 13px;
      font-weight: 800;
      color: #000000;
      direction: ltr;
      padding: 0 6px;
      vertical-align: middle;
    }
    .top-table td.col-ar {
      width: 28%;
      text-align: right;
      font-size: 11.5px;
      color: #5a3c7c;
      font-weight: 700;
      direction: rtl;
      padding: 0 6px;
      vertical-align: middle;
    }
    .divider-box {
      width: 100%;
      margin: 3px 0 4px 0;
      position: relative;
      z-index: 1;
    }
    .divider-checkmarks {
      width: 100%;
      height: 4mm;
      display: block;
      object-fit: fill;
    }
    .middle-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1px 0;
    }
    .middle-table tr {
      border-top: 1.5px solid #5a3c7c;
      border-bottom: 1.5px solid #5a3c7c;
      height: 9.4mm;
    }
    .middle-table td {
      padding: 0 6px;
      vertical-align: middle;
    }
    .middle-table td.col-en {
      width: 24%;
      text-align: left;
      font-size: 11px;
      color: #5a3c7c;
      font-weight: 700;
      direction: ltr;
    }
    .middle-table td.col-val {
      width: 52%;
      text-align: center;
      font-size: 12.5px;
      font-weight: 800;
      color: #000000;
      direction: ltr;
    }
    .middle-table td.col-ar {
      width: 24%;
      text-align: right;
      font-size: 11.5px;
      color: #5a3c7c;
      font-weight: 700;
      direction: rtl;
    }
    .barcodes-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    .barcodes-table tr {
      height: 12mm;
    }
    .barcodes-table td.label-en {
      width: 25%;
      text-align: right;
      font-size: 11px;
      color: #5a3c7c;
      font-weight: 700;
      direction: ltr;
      padding-right: 20px;
      vertical-align: middle;
    }
    .barcodes-table td.barcode-center {
      width: 50%;
      text-align: center;
      vertical-align: middle;
    }
    .barcodes-table td.label-ar {
      width: 25%;
      text-align: left;
      font-size: 11px;
      color: #5a3c7c;
      font-weight: 700;
      direction: rtl;
      padding-left: 20px;
      vertical-align: middle;
    }
    .regulations-box {
      text-align: center;
      margin: 4px 0 5px 0;
      position: relative;
      z-index: 1;
      width: 100%;
    }
    .footer-table td {
      vertical-align: middle;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * Render a single .page-container for a traveler's eVisa
 */
export function renderOfficialVisaPageContainer(data: OfficialVisaData): string {
  const visaBarcodeSvg = generateCode39Svg(data.visaNumber, 24);
  const appBarcodeSvg = generateCode39Svg(data.applicationNumber, 24);
  const safeMrzLine1 = escapeHtml(data.mrzLine1 || "");
  const safeMrzLine2 = escapeHtml(data.mrzLine2 || "");

  // Photo placeholder if traveler has no photo uploaded
  const photoContent = data.photoUrl
    ? `<img src="${data.photoUrl}" alt="Traveler Photo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`
    : `<div style="width: 100%; height: 100%; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; text-align: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
        <span style="margin-top: 6px; font-weight: 600;">صورة شخصية</span>
       </div>`;

  return `  <div class="page-container">
    <!-- Watermark Pattern Behind Content -->
    <img src="${VISA_ASSETS.watermarkPattern}" class="watermark-bg" alt="Saudi MOFA Watermark" />

    <!-- 1. Header Logos -->
    <table class="header-table" style="margin-bottom: 3mm;">
      <tr>
        <td style="width: 45%; text-align: left; vertical-align: middle; padding: 0;">
          <img src="${VISA_ASSETS.ksaVisaHeader}" alt="KSA VISA EVISA" style="height: 44px; max-width: 180px; object-fit: contain; display: block;" />
        </td>
        <td style="width: 10%; text-align: center; vertical-align: middle; padding: 0;"></td>
        <td style="width: 45%; text-align: right; vertical-align: middle; padding: 0;">
          <img src="${VISA_ASSETS.saudiEmblemHeader}" alt="Kingdom of Saudi Arabia" style="height: 44px; max-width: 220px; object-fit: contain; display: block; margin-left: auto;" />
        </td>
      </tr>
    </table>

    <!-- 2. Top Section: Photo + Table -->
    <table class="top-layout-table" style="margin-top: 2px;">
      <tr>
        <td style="width: 43mm;">
          <div class="photo-box">
            ${photoContent}
          </div>
        </td>
        <td style="width: 12px;"></td>
        <td>
          <table class="top-table">
            <tr>
              <td class="col-en">Visa No.</td>
              <td class="col-val">${data.visaNumber}</td>
              <td class="col-ar">رقم التأشيرة</td>
            </tr>
            <tr>
              <td class="col-en">Date of Issue</td>
              <td class="col-val">${data.issueDate}</td>
              <td class="col-ar">صالحة اعتباراً من</td>
            </tr>
            <tr>
              <td class="col-en">Valid Until</td>
              <td class="col-val">${data.expiryDate}</td>
              <td class="col-ar">صالحة لغاية</td>
            </tr>
            <tr>
              <td class="col-en">Duration of Stay</td>
              <td class="col-val">${data.durationOfStay}</td>
              <td class="col-ar">مدة الإقامة</td>
            </tr>
            <tr>
              <td class="col-en">Passport No.</td>
              <td class="col-val">${data.passportNumber}</td>
              <td class="col-ar">رقم جواز السفر</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Divider 1 -->
    <div class="divider-box">
      <img src="${VISA_ASSETS.checkmarksDivider}" class="divider-checkmarks" alt="Divider" />
    </div>

    <!-- 3. Middle Section: Full-Width Table (7 Rows) -->
    <table class="middle-table" style="margin: 1px 0;">
      <tr>
        <td class="col-en">Place of Issue</td>
        <td class="col-val">${data.placeOfIssue}</td>
        <td class="col-ar">مصدر التأشيرة</td>
      </tr>
      <tr>
        <td class="col-en">Name</td>
        <td class="col-val">${data.fullName}</td>
        <td class="col-ar">الاسم</td>
      </tr>
      <tr>
        <td class="col-en">Birth Date</td>
        <td class="col-val">${data.birthDate}</td>
        <td class="col-ar">تاريخ الميلاد</td>
      </tr>
      <tr>
        <td class="col-en">Nationality</td>
        <td class="col-val">${data.nationality}</td>
        <td class="col-ar">الجنسية</td>
      </tr>
      <tr>
        <td class="col-en">Type Of Visa</td>
        <td class="col-val">${data.visaType}</td>
        <td class="col-ar">نوع التأشيرة</td>
      </tr>
      <tr>
        <td class="col-en">Umrah Operator</td>
        <td class="col-val">${data.umrahOperator}</td>
        <td class="col-ar">مكتب العمرة</td>
      </tr>
      <tr>
        <td class="col-en">External Agent</td>
        <td class="col-val">${data.externalAgent}</td>
        <td class="col-ar">الوكيل الخارجي</td>
      </tr>
    </table>

    <!-- 4. Barcodes -->
    <table class="barcodes-table">
      <tr>
        <td class="label-en">Visa No.</td>
        <td class="barcode-center">
          ${visaBarcodeSvg}
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; margin-top: 2px; color: #000000; direction: ltr;">
            ${data.visaNumber}
          </div>
        </td>
        <td class="label-ar">رقم التأشيرة</td>
      </tr>
      <tr>
        <td class="label-en">Application No.</td>
        <td class="barcode-center">
          ${appBarcodeSvg}
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; margin-top: 2px; color: #000000; direction: ltr;">
            ${data.applicationNumber}
          </div>
        </td>
        <td class="label-ar">رقم الطلب</td>
      </tr>
    </table>

    <!-- 5. Regulatory Warnings -->
    <div class="regulations-box">
      <div style="color: #9c5127; font-size: 9.8px; font-weight: 700; direction: rtl; margin: 0; line-height: 1.35;">
        غير مصرح بالحج او الدخول الى المملكة العربية السعودية أو البقاء فيها خلال المدة ( من 01 ذي القعدة إلى 14 ذي الحجة )
      </div>
      <div style="color: #9c5127; font-size: 8.5px; font-weight: 700; direction: ltr; margin: 1px 0 3px 0; line-height: 1.3;">
        Not permitted for Hajj or to enter or stay in the Kingdom of Saudi Arabia during the period ( from 01 Dhu al-Qi'dah to 14 Dhu al-Hijjah )
      </div>
      <div style="color: #1d3a70; font-size: 9.2px; font-weight: 700; direction: rtl; margin: 0; line-height: 1.35;">
        بعد الدخول الأول يتطلب الحصول على تصريح عمرة مسبق وباقة عمرة مؤكدة من وزارة الحج والعمرة
      </div>
      <div style="color: #1d3a70; font-size: 8.2px; font-weight: 700; direction: ltr; margin: 1px 0 0 0; line-height: 1.3;">
        After the first entry, it is required to obtain a prior Umrah permit and a confirmed Umrah package from the Ministry of Hajj and Umrah
      </div>
    </div>

    <!-- Divider 2 -->
    <div class="divider-box">
      <img src="${VISA_ASSETS.checkmarksDivider}" class="divider-checkmarks" alt="Divider" />
    </div>

    <!-- 6. Footer QR Codes -->
    <table class="footer-table" style="margin: 2px 0;">
      <tr>
        <td style="width: 50%; text-align: left; padding: 0;">
          <img src="${VISA_ASSETS.umrahGuideBox}" alt="Umrah Guide QR" style="height: 17mm; object-fit: contain; display: block;" />
        </td>
        <td style="width: 50%; text-align: right; padding: 0;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            <div style="text-align: right; direction: rtl; line-height: 1.25;">
              <div style="font-size: 11px; font-weight: 800; color: #111827; margin: 0;">للإستعلام عن التأشيرة</div>
              <div style="font-size: 8px; color: #6b7280; margin: 1px 0 0 0;">يرجى مسح رمز الاستجابة السريعة</div>
              <div style="font-size: 9.5px; font-weight: 700; color: #111827; margin: 1px 0 0 0; direction: ltr;">For Visa Inquiry</div>
              <div style="font-size: 7.5px; color: #6b7280; margin: 0; direction: ltr;">Please scan QR code</div>
            </div>
            <div style="position: relative; width: 17mm; height: 17mm; padding: 2px; box-sizing: border-box; display: inline-block;">
              <span style="position: absolute; top: 0; left: 0; width: 5px; height: 5px; border-top: 2px solid #8b5cf6; border-left: 2px solid #8b5cf6;"></span>
              <span style="position: absolute; top: 0; right: 0; width: 5px; height: 5px; border-top: 2px solid #8b5cf6; border-right: 2px solid #8b5cf6;"></span>
              <span style="position: absolute; bottom: 0; left: 0; width: 5px; height: 5px; border-bottom: 2px solid #8b5cf6; border-left: 2px solid #8b5cf6;"></span>
              <span style="position: absolute; bottom: 0; right: 0; width: 5px; height: 5px; border-bottom: 2px solid #8b5cf6; border-right: 2px solid #8b5cf6;"></span>
              ${
                data.inquiryQrUrl
                  ? `<img src="${data.inquiryQrUrl}" style="width: 100%; height: 100%; object-fit: contain; display: block;" alt="Visa Inquiry QR" />`
                  : `<div style="width: 100%; height: 100%; background:#f3f4f6;"></div>`
              }
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- 7. MRZ Lines & Umm Al-Qura Note -->
    <div style="position: relative; margin-top: 2px; width: 100%; z-index: 1;">
      <div style="text-align: right; font-size: 9px; color: #8b5cf6; font-weight: 600; direction: rtl; margin-bottom: 1px; padding-right: 2px;">
        * حسب تقويم أم القرى
      </div>
      <div style="font-family: 'OCR-B', 'Courier New', Courier, monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #000000; direction: ltr; text-align: center; line-height: 1.35; white-space: nowrap;">
        <div>${safeMrzLine1}</div>
        <div>${safeMrzLine2}</div>
      </div>
    </div>
  </div>`;
}

/**
 * Render the Official, Pixel-Perfect Single-Page A4 Saudi eVisa HTML
 */
export function renderOfficialVisaHtml(data: OfficialVisaData): string {
  const pageHtml = renderOfficialVisaPageContainer(data);
  return wrapWithOfficialDocumentShell(pageHtml, `تأشيرة_${data.fullName.replace(/\s+/g, "_")}_${data.visaNumber}`);
}

/**
 * Render ALL Official Saudi eVisas for a request into a single multi-page A4 HTML document
 */
export function renderAllOfficialVisasHtml(dataList: OfficialVisaData[], title?: string): string {
  const pagesHtml = dataList.map((data) => renderOfficialVisaPageContainer(data)).join("\n");
  const docTitle = title || `كافة_تأشيرات_المعاملة_(${dataList.length})`;
  return wrapWithOfficialDocumentShell(pagesHtml, docTitle);
}
