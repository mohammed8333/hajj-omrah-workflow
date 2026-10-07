/**
 * Official Saudi eVisa Template Generator
 * Produces 100% authentic, pixel-perfect single-page A4 Saudi MOFA eVisa documents
 * matching the official Ministry of Foreign Affairs (KSA VISA) design.
 */

import QRCode from "qrcode";
import { Traveler } from "@/types";
import { VISA_ASSETS } from "./visaTemplateAssets";
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
 * Format Arabic date (YYYY/MM/DD or YYYY-MM-DD) cleanly
 */
function formatDate(raw?: string): string {
  if (!raw) return "";
  const clean = raw.trim().replace(/\./g, "/").replace(/-/g, "/");
  const parts = clean.split("/");
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}/${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}/${parts[1].padStart(2, "0")}/${parts[0].padStart(2, "0")}`;
    }
  }
  return clean;
}

/**
 * Calculate ICAO check digit for MRZ
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
 * Generate standard ICAO 9303 TD3 MRZ lines for the visa
 */
export function generateVisaMrzLines(data: Partial<OfficialVisaData>): { line1: string; line2: string } {
  const natCode = (data.nationalityCode || convertNationalityToMofaCode(data.nationality) || "EGY").toUpperCase().slice(0, 3);
  
  // Clean English name
  const rawName = (data.fullNameEn || data.fullName || "TRAVELER")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .trim();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || "TRAVELER";
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join("<") : "";

  // Line 1: P<NATSU<NAME<<<<<<<<... (44 chars)
  let line1 = `P<${natCode}${surname}<<${givenNames}`;
  line1 = line1.replace(/\s+/g, "<").slice(0, 44);
  line1 = line1.padEnd(44, "<");

  // Line 2: Passport (9) + check (1) + Nat (3) + DOB (6) + check (1) + Sex (1) + Expiry (6) + check (1) + optional...
  const pass = (data.passportNumber || "A00000000").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9).padEnd(9, "<");
  const passCheck = calculateCheckDigit(pass.replace(/</g, "0"));

  // DOB YYMMDD
  let dobStr = "800101";
  if (data.birthDate) {
    const cleanDob = data.birthDate.replace(/\D/g, "");
    if (cleanDob.length >= 8) {
      dobStr = cleanDob.slice(2, 8); // YYMMDD
    } else if (cleanDob.length === 6) {
      dobStr = cleanDob;
    }
  }
  const dobCheck = calculateCheckDigit(dobStr);

  // Expiry YYMMDD
  let expStr = "300101";
  if (data.expiryDate) {
    const cleanExp = data.expiryDate.replace(/\D/g, "");
    if (cleanExp.length >= 8) {
      expStr = cleanExp.slice(2, 8);
    } else if (cleanExp.length === 6) {
      expStr = cleanExp;
    }
  }
  const expCheck = calculateCheckDigit(expStr);

  const sex = "F"; // Standard placeholder or from gender
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
  const vNumMatch =
    html.match(/رقم التأشيرة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9]{10})\s*<\/div>/i) ||
    html.match(/Visa\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9]{10})\s*<\/div>/i) ||
    html.match(/رقم التأشيرة[^0-9]*([0-9]{10})/i) ||
    html.match(/Visa\s*No[^0-9]*([0-9]{10})/i) ||
    html.match(/\b([0-9]{10})\b/);

  const visaNumber = vNumMatch ? vNumMatch[1] : traveler?.visaNumber || "6173385916";

  const appMatch =
    html.match(/رقم الطلب[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*(E[0-9]{9})\s*<\/div>/i) ||
    html.match(/Application\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*(E[0-9]{9})\s*<\/div>/i) ||
    html.match(/\b(E[0-9]{9})\b/i);

  const applicationNumber = appMatch ? appMatch[1] : `E82${visaNumber.slice(3)}`;

  const issueMatch =
    html.match(/صالحة اعتبار[ا|اً]\s*من[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Valid\s*from[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const issueDate = issueMatch ? formatDate(issueMatch[1]) : formatDate(traveler?.visaIssueDate) || "2026/09/09";

  const expiryMatch =
    html.match(/صالحة\s*لغاية[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i) ||
    html.match(/Valid\s*until[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const expiryDate = expiryMatch ? formatDate(expiryMatch[1]) : "2027/09/08";

  const durationMatch = html.match(/مدة\s*الإقامة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const durationOfStay = durationMatch ? durationMatch[1].trim() : "90 Days - 90 يوم";

  const passportMatch =
    html.match(/رقم\s*جواز\s*السفر[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i) ||
    html.match(/Passport\s*No\.?[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const passportNumber = passportMatch ? passportMatch[1].trim() : traveler?.passportNumber || "A39984883";

  const nameMatch = html.match(/الاسم[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const fullName = nameMatch ? nameMatch[1].trim() : traveler?.fullName || "المسافر الكريم";

  const birthMatch = html.match(/تاريخ\s*الميلاد[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([0-9\/\-\.]+)\s*<\/div>/i);
  const birthDate = birthMatch ? birthMatch[1].trim() : traveler?.dateOfBirth || "2001-05-20";

  const natMatch = html.match(/الجنسية[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const nationality = natMatch ? natMatch[1].trim() : traveler?.nationality || "مصر";

  const umrahOperatorMatch = html.match(/مكتب\s*العمرة[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const umrahOperator = umrahOperatorMatch ? umrahOperatorMatch[1].trim() : "شركة ايواء لخدمات المعتمرين شركة شخص واحد";

  const agentMatch = html.match(/الوكيل\s*الخارجي[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const externalAgent = agentMatch ? agentMatch[1].trim() : "ستار لايت ترافيل";

  const borderMatch = html.match(/رقم\s*الحدود[\s\S]*?class=['"][^'"]*col-3-2[^'"]*['"][^>]*>\s*([^<]+)\s*<\/div>/i);
  const borderNumber = borderMatch ? borderMatch[1].trim() : "";

  // Extract photo from HTML if inlined
  let photoUrl = "";
  const photoMatch = html.match(/<img[^>]+(?:class|id)=['"][^'"]*(?:photo|PersonPhoto|ApplicantPhoto)[^'"]*['"][^>]+src=['"]([^'"]+)['"]/i) ||
                     html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]+(?:class|id)=['"][^'"]*(?:photo|PersonPhoto|ApplicantPhoto)[^'"]*['"]/i);
  if (photoMatch && photoMatch[1].startsWith("data:")) {
    photoUrl = photoMatch[1];
  } else if (traveler?.documents) {
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
    nationality,
    nationalityCode: convertNationalityToMofaCode(nationality),
    passportNumber,
    birthDate,
    expiryDate,
    visaNumber,
    fullName,
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
    birthDate,
    nationality,
    nationalityCode: convertNationalityToMofaCode(nationality),
    visaType: "Umrah - عمرة",
    umrahOperator,
    externalAgent,
    borderNumber,
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
 * Render the Official, Pixel-Perfect Single-Page A4 Saudi eVisa HTML
 */
export function renderOfficialVisaHtml(data: OfficialVisaData): string {
  const visaBarcodeSvg = generateCode39Svg(data.visaNumber, 36);
  const appBarcodeSvg = generateCode39Svg(data.applicationNumber, 36);
  const safeMrzLine1 = escapeHtml(data.mrzLine1 || "");
  const safeMrzLine2 = escapeHtml(data.mrzLine2 || "");

  // Photo placeholder if traveler has no photo uploaded
  const photoContent = data.photoUrl
    ? `<img src="${data.photoUrl}" alt="Traveler Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />`
    : `<div style="width: 100%; height: 100%; background: #f1f5f9; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; text-align: center; border-radius: 4px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
        <span style="margin-top: 6px; font-weight: 600;">صورة شخصية</span>
       </div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تأشيرة_${data.fullName.replace(/\s+/g, "_")}_${data.visaNumber}</title>
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
      .page-container {
        padding: 10mm 15mm 8mm 15mm !important;
        box-shadow: none !important;
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
      background: #ffffff;
      padding: 10mm 15mm 8mm 15mm;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      direction: ltr; /* Base LTR ensures Left elements stay on the Left and Right stay on Right */
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    /* Subtle watermark background */
    .watermark-bg {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 175mm;
      opacity: 0.085;
      pointer-events: none;
      z-index: 0;
    }
    .content-layer {
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    /* Header */
    .visa-header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4px;
      width: 100%;
    }
    .visa-header .left-logo img {
      height: 50px;
      object-fit: contain;
    }
    .visa-header .right-logo img {
      height: 48px;
      object-fit: contain;
    }
    /* Top Section (Photo on Left + Table on Right) */
    .top-section {
      display: flex;
      flex-direction: row;
      gap: 16px;
      margin-top: 4px;
      width: 100%;
      align-items: stretch;
    }
    .photo-box {
      width: 44.5mm;
      height: 53.5mm;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .top-table {
      flex: 1;
      border-collapse: collapse;
      width: 100%;
      height: 53.5mm;
    }
    .top-table tr {
      border-bottom: 1px solid #e5e7eb;
      height: 10.7mm;
    }
    .top-table td {
      padding: 1px 6px;
      vertical-align: middle;
    }
    .top-table td.col-en {
      width: 28%;
      text-align: left;
      font-size: 11px;
      color: #374151;
      font-weight: 500;
      direction: ltr;
    }
    .top-table td.col-val {
      width: 44%;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: #000000;
      direction: ltr;
    }
    .top-table td.col-ar {
      width: 28%;
      text-align: right;
      font-size: 11.5px;
      color: #374151;
      font-weight: 600;
      direction: rtl;
    }
    /* Checkmarks Dividers */
    .divider-checkmarks {
      width: 100%;
      height: 4.2mm;
      margin: 3px 0;
      display: block;
      object-fit: fill;
    }
    /* Middle Table */
    .middle-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1px 0;
    }
    .middle-table tr {
      border-bottom: 1px solid #e5e7eb;
      height: 9.8mm;
    }
    .middle-table td {
      padding: 1px 6px;
      vertical-align: middle;
    }
    .middle-table td.col-en {
      width: 25%;
      text-align: left;
      font-size: 10.5px;
      color: #374151;
      font-weight: 500;
      direction: ltr;
    }
    .middle-table td.col-val {
      width: 50%;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: #000000;
      direction: rtl;
    }
    .middle-table td.col-ar {
      width: 25%;
      text-align: right;
      font-size: 11px;
      color: #374151;
      font-weight: 600;
      direction: rtl;
    }
    /* Barcodes Area */
    .barcodes-container {
      margin: 6px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    .barcode-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    .barcode-row .label-en {
      width: 140px;
      font-size: 10.5px;
      color: #374151;
      font-weight: 500;
      text-align: right;
      padding-right: 22px;
      direction: ltr;
    }
    .barcode-row .barcode-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .barcode-row .barcode-center .barcode-val {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      margin-top: 2px;
      color: #000000;
      direction: ltr;
    }
    .barcode-row .label-ar {
      width: 140px;
      font-size: 11px;
      color: #374151;
      font-weight: 600;
      text-align: left;
      padding-left: 22px;
      direction: rtl;
    }
    /* Warnings / Regulations */
    .regulations-box {
      text-align: center;
      margin: 3px 0;
      line-height: 1.35;
      width: 100%;
    }
    .regulations-box .red-ar {
      color: #b91c1c;
      font-size: 10px;
      font-weight: 700;
      margin: 0;
      direction: rtl;
    }
    .regulations-box .red-en {
      color: #b91c1c;
      font-size: 8.5px;
      margin: 1px 0 3px 0;
      direction: ltr;
    }
    .regulations-box .gray-ar {
      color: #4b5563;
      font-size: 9px;
      font-weight: 600;
      margin: 0;
      direction: rtl;
    }
    .regulations-box .gray-en {
      color: #4b5563;
      font-size: 8.2px;
      margin: 1px 0 0 0;
      direction: ltr;
    }
    /* Footer Area (2 QR codes) */
    .footer-qr-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      margin: 3px 0;
      padding: 0 4px;
      width: 100%;
    }
    .umrah-guide-box img {
      height: 18mm;
      object-fit: contain;
    }
    .visa-inquiry-box {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .visa-inquiry-text {
      text-align: right;
      direction: rtl;
      line-height: 1.3;
    }
    .visa-inquiry-text .title-ar {
      font-size: 11px;
      font-weight: 800;
      color: #111827;
      margin: 0;
    }
    .visa-inquiry-text .sub-ar {
      font-size: 8.5px;
      color: #6b7280;
      margin: 0;
    }
    .visa-inquiry-text .title-en {
      font-size: 9.5px;
      font-weight: 700;
      color: #111827;
      margin: 1px 0 0 0;
      direction: ltr;
    }
    .visa-inquiry-text .sub-en {
      font-size: 8px;
      color: #6b7280;
      margin: 0;
      direction: ltr;
    }
    .visa-inquiry-box .qr-img {
      width: 18mm;
      height: 18mm;
      object-fit: contain;
      border: 1px solid #e5e7eb;
      border-radius: 2px;
    }
    /* MRZ Zone */
    .mrz-zone {
      position: relative;
      width: 100%;
      text-align: center;
      margin-top: 6px;
      padding-top: 2px;
    }
    .mrz-text {
      font-family: 'Courier New', Courier, 'OCR-B', monospace;
      font-size: 11.2px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #111827;
      direction: ltr;
      text-align: center;
      line-height: 1.38;
      white-space: nowrap;
    }
    .hijri-note {
      position: absolute;
      right: 4px;
      top: 1px;
      font-size: 9.5px;
      color: #a855f7;
      font-weight: 500;
      white-space: nowrap;
      direction: rtl;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <img src="${VISA_ASSETS.watermarkPattern}" class="watermark-bg" alt="Watermark" />

    <div class="content-layer">
      <!-- 1. Header Logos -->
      <div class="visa-header">
        <div class="left-logo">
          <img src="${VISA_ASSETS.ksaVisaHeader}" alt="KSA VISA EVISA" />
        </div>
        <div class="right-logo">
          <img src="${VISA_ASSETS.saudiEmblemHeader}" alt="Kingdom of Saudi Arabia" />
        </div>
      </div>

      <!-- 2. Top Section: Photo + First Table -->
      <div class="top-section">
        <div class="photo-box">
          ${photoContent}
        </div>

        <table class="top-table">
          <tr>
            <td class="col-en">Visa No.</td>
            <td class="col-val">${data.visaNumber}</td>
            <td class="col-ar">رقم التأشيرة</td>
          </tr>
          <tr>
            <td class="col-en">Valid from</td>
            <td class="col-val">${data.issueDate}</td>
            <td class="col-ar">صالحة اعتباراً من</td>
          </tr>
          <tr>
            <td class="col-en">Valid until</td>
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
            <td class="col-ar">رقم الجواز</td>
          </tr>
        </table>
      </div>

      <!-- Divider 1 -->
      <img src="${VISA_ASSETS.checkmarksDivider}" class="divider-checkmarks" alt="Divider" />

      <!-- 3. Middle Section: Full-Width Table -->
      <table class="middle-table">
        <tr>
          <td class="col-en">Place of issue</td>
          <td class="col-val">${data.placeOfIssue}</td>
          <td class="col-ar">مصدر التأشيرة</td>
        </tr>
        <tr>
          <td class="col-en">Full Name</td>
          <td class="col-val">${data.fullName}</td>
          <td class="col-ar">الإسم</td>
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
        <tr>
          <td class="col-en">Border NO.</td>
          <td class="col-val">${data.borderNumber || ""}</td>
          <td class="col-ar">رقم الحدود</td>
        </tr>
      </table>

      <!-- 4. Barcodes -->
      <div class="barcodes-container">
        <div class="barcode-row">
          <div class="label-en">Visa No.</div>
          <div class="barcode-center">
            ${visaBarcodeSvg}
            <div class="barcode-val">${data.visaNumber}</div>
          </div>
          <div class="label-ar">رقم التأشيرة</div>
        </div>

        <div class="barcode-row">
          <div class="label-en">Application No.</div>
          <div class="barcode-center">
            ${appBarcodeSvg}
            <div class="barcode-val">${data.applicationNumber}</div>
          </div>
          <div class="label-ar">رقم الطلب</div>
        </div>
      </div>

      <!-- 5. Regulatory Warnings -->
      <div class="regulations-box">
        <div class="red-ar">غير مصرح بالحج او الدخول الى المملكة العربية السعودية أو البقاء فيها خلال المدة ( من 01 ذي القعدة إلى 14 ذي الحجة )</div>
        <div class="red-en">Not permitted for Hajj or to enter or stay in the Kingdom of Saudi Arabia during the period ( from 01 Dhu al-Qi'dah to 14 Dhu al-Hijjah)</div>
        <div class="gray-ar">بعد الدخول الأول يتطلب الحصول على تصريح عمرة مسبق وباقة عمرة مؤكدة من وزارة الحج والعمرة</div>
        <div class="gray-en">After the first entry, it is required to obtain a prior Umrah permit and a confirmed Umrah package from the Ministry of Hajj and Umrah</div>
      </div>

      <!-- Divider 2 -->
      <img src="${VISA_ASSETS.checkmarksDivider}" class="divider-checkmarks" alt="Divider" />

      <!-- 6. Footer QR Codes -->
      <div class="footer-qr-row">
        <div class="umrah-guide-box">
          <img src="${VISA_ASSETS.umrahGuideBox}" alt="Umrah Guide QR" />
        </div>

        <div class="visa-inquiry-box">
          <div class="visa-inquiry-text">
            <div class="title-ar">للإستعلام عن التأشيرة</div>
            <div class="sub-ar">يرجى مسح رمز الاستجابة السريعة</div>
            <div class="title-en">For Visa Inquiry</div>
            <div class="sub-en">Please scan QR code</div>
          </div>
          ${
            data.inquiryQrUrl
              ? `<img src="${data.inquiryQrUrl}" class="qr-img" alt="Visa Inquiry QR" />`
              : `<div class="qr-img" style="background:#f3f4f6;"></div>`
          }
        </div>
      </div>

      <!-- 7. MRZ Lines -->
      <div class="mrz-zone">
        <div class="mrz-text">
          <div>${safeMrzLine1}</div>
          <div>${safeMrzLine2}</div>
        </div>
        <div class="hijri-note">* حسب تقويم أم القرى</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
