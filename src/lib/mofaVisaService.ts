/**
 * MOFA Saudi Visa Service (خدمة فحص وتنزيل تأشيرات وزارة الخارجية السعودية)
 * Interfaces with visa.mofa.gov.sa/visaservices/searchvisa via Cloudflare Worker proxy
 * and auto-solves Captchas using Google Gemini Vision AI.
 */

import { Traveler, DocumentItem } from "@/types";
import { api } from "./api";
import { callGeminiVision, ensureGeminiApiKey } from "./geminiVision";
import { generateVisaPdfBlob, generateFallbackVisaPdf } from "./visaPdfGenerator";

export const MOFA_WORKER_URL_KEY = "mofa_visa_worker_url";

let memoryWorkerUrl: string | null = null;

/**
 * Synchronously retrieves the worker URL from memory or localStorage.
 */
export function getMofaWorkerUrl(): string | null {
  if (memoryWorkerUrl) return memoryWorkerUrl;
  if (typeof window === "undefined") return null;
  const url = localStorage.getItem(MOFA_WORKER_URL_KEY);
  if (url && url.trim()) {
    memoryWorkerUrl = url.trim();
    return memoryWorkerUrl;
  }
  return null;
}

/**
 * Loads the worker URL from the central database (Supabase system_settings).
 * Updates memory cache and localStorage so it is available across all users and persists browser clears.
 */
export async function syncMofaWorkerUrlFromDatabase(): Promise<string | null> {
  try {
    const cloudUrl = await api.settings.get(MOFA_WORKER_URL_KEY);
    if (cloudUrl && cloudUrl.trim()) {
      const clean = cloudUrl.trim();
      memoryWorkerUrl = clean;
      if (typeof window !== "undefined") {
        localStorage.setItem(MOFA_WORKER_URL_KEY, clean);
      }
      return clean;
    }
  } catch (err) {
    console.warn("Could not sync MOFA worker URL from database:", err);
  }
  return getMofaWorkerUrl();
}

/**
 * Ensures a valid worker URL is available: checks memory/localStorage, then fetches from central database.
 */
export async function ensureMofaWorkerUrl(explicitUrl?: string): Promise<string | null> {
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl.trim();
  }
  const current = getMofaWorkerUrl();
  if (current) return current;
  return await syncMofaWorkerUrlFromDatabase();
}

/**
 * Sets the worker URL, caches it in memory and localStorage, and persists it to the central database.
 */
export async function setMofaWorkerUrl(url: string, syncToDatabase = true): Promise<void> {
  const trimmed = url.trim();
  memoryWorkerUrl = trimmed || null;
  if (typeof window !== "undefined") {
    if (trimmed) {
      localStorage.setItem(MOFA_WORKER_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(MOFA_WORKER_URL_KEY);
    }
  }
  if (syncToDatabase) {
    try {
      await api.settings.set(MOFA_WORKER_URL_KEY, trimmed);
    } catch (e) {
      console.warn("Failed to persist MOFA Worker URL to database:", e);
    }
  }
}

/**
 * Removes the worker URL from memory, localStorage, and central database.
 */
export async function removeMofaWorkerUrl(): Promise<void> {
  memoryWorkerUrl = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(MOFA_WORKER_URL_KEY);
  }
  try {
    await api.settings.set(MOFA_WORKER_URL_KEY, "");
  } catch (e) {
    console.warn("Failed to remove MOFA Worker URL from database:", e);
  }
}

/**
 * Tests connection with the Cloudflare Worker proxy endpoint.
 */
export async function testMofaWorkerUrl(workerUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const clean = workerUrl.trim().replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      return { success: false, message: "يجب أن يبدأ الرابط بـ https:// أو http://" };
    }
    const res = await fetch(`${clean}/api/captcha`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { success: false, message: `الخادم رد برمز خطأ (${res.status}: ${res.statusText})` };
    }
    const data = await res.json();
    if (data && (data.success || data.captchaImage || data.token)) {
      return { success: true, message: "تم الاتصال بنجاح بخادم Cloudflare Worker وجلب رمز التحقق!" };
    }
    return { success: false, message: data.error || "استجابة غير متوقعة من خادم الوكيل" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل الاتصال بالرابط";
    return { success: false, message: `تعذر الاتصال بالخادم: ${msg}` };
  }
}

// Background auto-sync on load
if (typeof window !== "undefined") {
  syncMofaWorkerUrlFromDatabase().catch(() => {});
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

export interface MofaSession {
  success: boolean;
  token: string;
  cookie: string;
  captchaImage: string;
  error?: string;
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
 * Fetch a fresh session and Captcha image from MOFA via Cloudflare proxy
 */
export async function fetchMofaSession(workerUrl: string): Promise<MofaSession> {
  const cleanWorkerUrl = workerUrl.trim().replace(/\/+$/, "");
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

  return sessionData;
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
Extract strictly the 6 digits printed in the image (0-9).
Ignore colored background noise.
Return strictly in valid JSON format:
{
  "code": "123456"
}
`;

  try {
    const rawRes = await callGeminiVision(prompt, captchaBase64, geminiKey);
    try {
      const parsed = JSON.parse(rawRes);
      if (parsed.code && /^\d{6}$/.test(String(parsed.code).trim())) {
        return String(parsed.code).trim();
      }
    } catch {}

    const match = rawRes.match(/\b\d{6}\b/) || rawRes.match(/\d{6}/);
    if (match) {
      return match[0];
    }
    const digitsOnly = rawRes.replace(/\D/g, "");
    if (digitsOnly.length === 6) {
      return digitsOnly;
    }
    return null;
  } catch (err) {
    console.warn("Gemini Captcha auto-solve failed:", err);
    return null;
  }
}

/**
 * Execute search on MOFA using known session & captcha
 */
export async function executeMofaSearch(
  workerUrl: string,
  traveler: Traveler,
  session: { token: string; cookie: string },
  captcha: string,
  overrideParams?: {
    passportNo?: string;
    firstName?: string;
    nationality?: string;
  }
): Promise<MofaVisaResult> {
  const cleanWorkerUrl = workerUrl.trim().replace(/\/+$/, "");
  const fName = overrideParams?.firstName?.trim() || extractFirstName(traveler.fullName);
  const passportNo = overrideParams?.passportNo?.trim() || traveler.passportNumber?.trim() || "";
  const nationalityCode = overrideParams?.nationality?.trim() || convertNationalityToMofaCode(traveler.nationality);

  const searchRes = await fetch(`${cleanWorkerUrl}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: session.token,
      cookie: session.cookie,
      passportNo,
      fName,
      nationality: nationalityCode,
      captcha: captcha.trim(),
    }),
  });

  if (!searchRes.ok) {
    throw new Error(`فشل إرسال طلب البحث: ${searchRes.statusText}`);
  }

  const searchData: MofaVisaResult = await searchRes.json();
  return searchData;
}

/**
 * Attach downloaded visa document to traveler
 */
export async function attachVisaDocumentToTraveler(
  requestId: string,
  traveler: Traveler,
  result: MofaVisaResult
): Promise<DocumentItem | undefined> {
  // 1. Update Traveler record with visa details
  await api.travelers.update(traveler.id, {
    visaNumber: result.visaNumber || traveler.visaNumber,
    visaStatus: "Issued",
    visaIssueDate: result.issueDate,
  });

  // 2. If visa HTML is returned, convert to high-resolution A4 PDF and attach to traveler
  if (result.visaHtml) {
    try {
      const oldVisaDocs = traveler.documents?.filter((d) => d.documentType === "Visa") || [];
      for (const oldDoc of oldVisaDocs) {
        try {
          await api.documents.delete(oldDoc.id);
        } catch {}
      }

      const safeName = (traveler.fullName || "traveler").replace(/[\/\\:*?"<>|]/g, "_");
      const vNum = result.visaNumber || traveler.passportNumber || traveler.id;
      const fileName = `تأشيرة_${safeName}_${vNum}.pdf`;

      // Convert HTML to real PDF Blob (with fallback if canvas fails)
      let pdfBlob: Blob;
      try {
        pdfBlob = await generateVisaPdfBlob(result.visaHtml, traveler);
      } catch (pdfErr) {
        console.warn("Canvas PDF generation warning, using structured PDF fallback:", pdfErr);
        pdfBlob = await generateFallbackVisaPdf(result, traveler);
      }

      const visaFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
        lastModified: Date.now(),
      });

      const uploaded = await api.documents.upload(requestId, visaFile, "Visa", traveler.id);
      return uploaded;
    } catch (uploadErr) {
      console.error("Failed to attach visa document file:", uploadErr);
      throw new Error(
        uploadErr instanceof Error
          ? `تم جلب التأشيرة لكن تعذر إنشاء أو حفظ ملف الـ PDF: ${uploadErr.message}`
          : "تعذر حفظ مستند التأشيرة بصيغة PDF"
      );
    }
  }
  return undefined;
}

/**
 * Check visa and automatically download + attach visa document to traveler.
 * If Captcha fails or needs manual input, returns the session so UI can prompt user!
 */
export async function checkAndAttachVisaToTraveler(
  requestId: string,
  traveler: Traveler,
  workerUrl?: string,
  onProgress?: (step: string) => void,
  manualSession?: { token: string; cookie: string },
  manualCaptcha?: string,
  overrideParams?: {
    passportNo?: string;
    firstName?: string;
    nationality?: string;
  }
): Promise<{
  success: boolean;
  visaNumber?: string;
  attachedDoc?: DocumentItem;
  searchResult?: MofaVisaResult;
  error?: string;
  errorType?: "INVALID_CAPTCHA" | "NOT_FOUND" | "NETWORK_ERROR";
  session?: MofaSession;
}> {
  const effectivePassportNo = overrideParams?.passportNo?.trim() || traveler.passportNumber?.trim();
  if (!effectivePassportNo) {
    return { success: false, error: "رقم جواز السفر غير مسجل للمسافر." };
  }

  const effectiveWorkerUrl = (workerUrl && workerUrl.trim()) || (await ensureMofaWorkerUrl());
  if (!effectiveWorkerUrl) {
    return {
      success: false,
      errorType: "NETWORK_ERROR",
      error: "رابط خادم الاستعلام عن التأشيرات غير متوفر في قاعدة البيانات. يرجى إدخال الرابط أولاً.",
    };
  }

  try {
    // 1. Prepare session
    let session: MofaSession;
    if (manualSession) {
      session = {
        success: true,
        token: manualSession.token,
        cookie: manualSession.cookie,
        captchaImage: "",
      };
    } else {
      onProgress?.("جاري الاتصال بخادم الاستعلام وجلب رمز التحقق...");
      session = await fetchMofaSession(effectiveWorkerUrl);
    }

    // 2. Solve Captcha
    let solvedCaptcha = manualCaptcha?.trim();
    if (!solvedCaptcha) {
      onProgress?.("جاري قراءة رمز التحقق بالذكاء الاصطناعي (Gemini Vision)...");
      solvedCaptcha = (await solveCaptchaWithGemini(session.captchaImage)) || "";
    }

    // If still no valid 6-digit captcha, return session for manual input modal
    if (!solvedCaptcha || solvedCaptcha.length !== 6) {
      return {
        success: false,
        errorType: "INVALID_CAPTCHA",
        session,
        error: "يرجى كتابة رمز التحقق الموضح في الصورة.",
      };
    }

    onProgress?.(`جاري فحص التأشيرة برقم الجواز (${effectivePassportNo})...`);

    // 3. Search Visa
    const searchResult = await executeMofaSearch(effectiveWorkerUrl, traveler, session, solvedCaptcha, overrideParams);

    if (!searchResult.success) {
      // If Captcha was wrong according to MOFA, return with fresh session possibility
      if (searchResult.errorType === "INVALID_CAPTCHA") {
        return {
          success: false,
          errorType: "INVALID_CAPTCHA",
          session,
          error: "رمز الصورة غير صحيح، يرجى إعادة المحاولة.",
        };
      }
      return {
        success: false,
        errorType: searchResult.errorType,
        error: searchResult.error,
      };
    }

    // 4. Attach document to traveler
    onProgress?.("تم العثور على التأشيرة! جاري ربطها وتنزيل المستند...");
    const attachedDoc = await attachVisaDocumentToTraveler(requestId, traveler, searchResult);

    return {
      success: true,
      visaNumber: searchResult.visaNumber,
      attachedDoc,
      searchResult,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل فحص التأشيرة";
    return {
      success: false,
      errorType: "NETWORK_ERROR",
      error: msg,
    };
  }
}

/**
 * Bulk check and attach visas for all travelers in a request
 */
export async function bulkFetchVisasForRequest(
  requestId: string,
  workerUrl?: string,
  onProgress?: (step: string) => void
): Promise<{
  successCount: number;
  notFoundCount: number;
  total: number;
  error?: string;
}> {
  const effectiveWorkerUrl = (workerUrl && workerUrl.trim()) || (await ensureMofaWorkerUrl());
  if (!effectiveWorkerUrl) {
    return {
      successCount: 0,
      notFoundCount: 0,
      total: 0,
      error: "رابط خادم الاستعلام عن التأشيرات غير متوفر في قاعدة البيانات. يرجى إدخال الرابط أولاً.",
    };
  }

  const req = await api.requests.getById(requestId);
  if (!req || !req.travelers || req.travelers.length === 0) {
    return { successCount: 0, notFoundCount: 0, total: 0, error: "لا يوجد مسافرون في هذه المعاملة." };
  }

  const eligibleTravelers = req.travelers.filter((t) => !!t.passportNumber);
  if (eligibleTravelers.length === 0) {
    return { successCount: 0, notFoundCount: 0, total: 0, error: "لا يوجد مسافرون مسجل لهم أرقام جوازات في هذه المعاملة." };
  }

  let successCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < eligibleTravelers.length; i++) {
    const t = eligibleTravelers[i];
    onProgress?.(`(${i + 1}/${eligibleTravelers.length}) ${t.fullName}: جاري فحص التأشيرة...`);

    try {
      const res = await checkAndAttachVisaToTraveler(
        requestId,
        t,
        effectiveWorkerUrl,
        (step) => onProgress?.(`(${i + 1}/${eligibleTravelers.length}) ${t.fullName}: ${step}`)
      );
      if (res.success) {
        successCount++;
      } else {
        notFoundCount++;
      }
    } catch (singleErr) {
      console.warn(`Error checking visa for ${t.fullName}:`, singleErr);
      notFoundCount++;
    }
  }

  return { successCount, notFoundCount, total: eligibleTravelers.length };
}

