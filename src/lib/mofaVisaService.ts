/**
 * MOFA Saudi Visa Service (خدمة فحص وتنزيل تأشيرات وزارة الخارجية السعودية)
 * Interfaces with visa.mofa.gov.sa/visaservices/searchvisa via Cloudflare Worker proxy
 * and auto-solves Captchas using Google Gemini Vision AI.
 */

import { Traveler } from "@/types";
import { api } from "./api";
import { callGeminiVision, ensureGeminiApiKey } from "./geminiVision";

export const MOFA_WORKER_URL_KEY = "mofa_visa_worker_url";

export function getMofaWorkerUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MOFA_WORKER_URL_KEY) || null;
}

export function setMofaWorkerUrl(url: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(MOFA_WORKER_URL_KEY, url.trim());
  }
}

// Convert common Arabic & English nationality names to MOFA ISO 3-letter codes
export function convertNationalityToMofaCode(nationality?: string): string {
  if (!nationality) return "EGY";
  const clean = nationality.trim().toUpperCase();

  // If already 3-letter uppercase code
  if (/^[A-Z]{3}$/.test(clean)) {
    return clean;
  }

  const n = nationality.trim();
  if (n.includes("مصر")) return "EGY";
  if (n.includes("سعود")) return "SAU";
  if (n.includes("أردن") || n.includes("اردن")) return "JOR";
  if (n.includes("إمارات") || n.includes("امارات")) return "ARE";
  if (n.includes("كويت")) return "KWT";
  if (n.includes("عمان") || n.includes("عُمان")) return "OMN";
  if (n.includes("قطر")) return "QAT";
  if (n.includes("بحرين")) return "BHR";
  if (n.includes("سودان")) return "SDN";
  if (n.includes("يمن")) return "YEM";
  if (n.includes("سور")) return "SYR";
  if (n.includes("عراق")) return "IRQ";
  if (n.includes("تونس")) return "TUN";
  if (n.includes("مغرب")) return "MAR";
  if (n.includes("جزائر")) return "DZA";
  if (n.includes("ليب")) return "LBY";
  if (n.includes("لبنان")) return "LBN";
  if (n.includes("فلسطين")) return "PSE";
  if (n.includes("باكستان")) return "PAK";
  if (n.includes("هند")) return "IND";
  if (n.includes("بنجلاديش") || n.includes("بنغلاديش")) return "BGD";
  if (n.includes("إندونيس") || n.includes("اندونيس")) return "IDN";
  if (n.includes("ترك")) return "TUR";
  if (n.includes("إثيوب") || n.includes("اثيوب")) return "ETH";
  if (n.includes("تشاد")) return "TCD";
  if (n.includes("نيجير")) return "NGA";

  return "EGY";
}

// Extract First Name for search query (tbSecondValue)
export function extractFirstName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || fullName.trim();
}

/**
 * Automatically solve MOFA 6-digit Captcha using Google Gemini Vision AI
 */
export async function solveCaptchaWithGemini(captchaBase64: string): Promise<string | null> {
  const geminiKey = await ensureGeminiApiKey();
  if (!geminiKey) return null;

  const prompt = `
You are an expert OCR system.
The provided image is a 6-digit numeric captcha.
Extract strictly the 6 digits printed in the image (digits from 0 to 9, e.g. 790059).
Ignore background dots or colored noise.
Return ONLY the 6 digits with no spaces, no letters, and no explanations.
`;

  try {
    const rawRes = await callGeminiVision(prompt, captchaBase64, geminiKey);
    const match = rawRes.match(/\b\d{6}\b/) || rawRes.match(/\d{6}/);
    if (match) {
      return match[0];
    }
    // Clean all non-digits
    const digitsOnly = rawRes.replace(/\D/g, "");
    if (digitsOnly.length === 6) {
      return digitsOnly;
    }
    return digitsOnly.slice(0, 6) || null;
  } catch (err) {
    console.warn("Gemini Captcha auto-solve failed:", err);
    return null;
  }
}

export interface MofaVisaResult {
  success: boolean;
  visaNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  visaHtml?: string;
  status?: "Issued" | "UnderProcessing" | "NotApplied" | "Rejected";
  error?: string;
  errorType?: "INVALID_CAPTCHA" | "NOT_FOUND" | "NETWORK_ERROR";
}

/**
 * Query MOFA for a single traveler's visa
 */
export async function queryTravelerVisa(
  traveler: Traveler,
  workerUrl: string,
  manualCaptcha?: string,
  onProgress?: (step: string) => void
): Promise<MofaVisaResult> {
  const cleanWorkerUrl = workerUrl.trim().replace(/\/+$/, "");

  if (!traveler.passportNumber) {
    return { success: false, error: "رقم جواز السفر غير مسجل للمسافر." };
  }

  const fName = extractFirstName(traveler.fullName);
  const nationalityCode = convertNationalityToMofaCode(traveler.nationality);

  onProgress?.("جاري الاتصال بخادم الاستعلام وجلب رمز التحقق...");

  // 1. Fetch Session & Captcha
  const captchaRes = await fetch(`${cleanWorkerUrl}/api/captcha`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!captchaRes.ok) {
    throw new Error(`تعذر الاتصال بخادم الاستعلام: ${captchaRes.statusText}`);
  }

  const sessionData = await captchaRes.json();
  if (!sessionData.success || !sessionData.captchaImage) {
    throw new Error(sessionData.error || "فشل جلب رمز التحقق من منصة التأشيرات.");
  }

  // 2. Solve Captcha (AI or manual)
  let solvedCaptcha = manualCaptcha?.trim();
  if (!solvedCaptcha) {
    onProgress?.("جاري قراءة رمز التحقق بالذكاء الاصطناعي (Gemini Vision)...");
    solvedCaptcha = (await solveCaptchaWithGemini(sessionData.captchaImage)) || "";
  }

  if (!solvedCaptcha || solvedCaptcha.length !== 6) {
    return {
      success: false,
      errorType: "INVALID_CAPTCHA",
      error: "تعذر قراءة رمز التحقق تلقائياً بدقة، يرجى إدخال الرمز يدوياً.",
    };
  }

  onProgress?.(`جاري فحص التأشيرة برقم الجواز (${traveler.passportNumber})...`);

  // 3. Search Visa
  const searchRes = await fetch(`${cleanWorkerUrl}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: sessionData.token,
      cookie: sessionData.cookie,
      passportNo: traveler.passportNumber.trim(),
      fName,
      nationality: nationalityCode,
      captcha: solvedCaptcha,
    }),
  });

  if (!searchRes.ok) {
    throw new Error(`فشل إرسال طلب البحث: ${searchRes.statusText}`);
  }

  const searchData: MofaVisaResult = await searchRes.json();
  return searchData;
}

/**
 * Check visa and automatically download + attach visa document to traveler
 */
export async function checkAndAttachVisaToTraveler(
  requestId: string,
  traveler: Traveler,
  workerUrl: string,
  onProgress?: (step: string) => void
): Promise<{
  success: boolean;
  visaNumber?: string;
  error?: string;
}> {
  const result = await queryTravelerVisa(traveler, workerUrl, undefined, onProgress);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  onProgress?.("تم العثور على التأشيرة! جاري ربطها وتنزيل المستند...");

  // 1. Update Traveler record with visa details
  await api.travelers.update(traveler.id, {
    visaNumber: result.visaNumber || traveler.visaNumber,
    visaStatus: "Issued",
    visaIssueDate: result.issueDate,
  });

  // 2. If visa HTML is returned, save it as a document attached to the traveler
  if (result.visaHtml) {
    try {
      // Remove previous Visa documents for this traveler
      const oldVisaDocs = traveler.documents?.filter((d) => d.documentType === "Visa") || [];
      for (const oldDoc of oldVisaDocs) {
        try {
          await api.documents.delete(oldDoc.id);
        } catch {}
      }

      // Create Visa Document File (HTML printable page)
      const fileName = `visa-${traveler.passportNumber || traveler.id}.html`;
      const blob = new Blob([result.visaHtml], { type: "text/html;charset=utf-8" });
      const visaFile = new File([blob], fileName, { type: "text/html" });

      await api.documents.upload(requestId, visaFile, "Visa", traveler.id);
    } catch (uploadErr) {
      console.warn("Failed to attach visa document file:", uploadErr);
    }
  }

  return {
    success: true,
    visaNumber: result.visaNumber,
  };
}
