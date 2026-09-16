/**
 * Google Gemini AI Vision Service for Intelligent Document Scanning
 * Supports Passports, National IDs (Saudi, Egyptian, etc.), Iqamas, and Flight Tickets.
 */

const GEMINI_API_KEY_STORAGE_KEY = "gemini_ai_api_key";
const GEMINI_SELECTED_MODEL_KEY = "gemini_selected_model";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export interface GeminiPassportResult {
  fullNameArabic?: string;
  fullNameEnglish?: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  sex?: "ذكر" | "أنثى" | string;
  confidence?: "high" | "medium" | "low";
}

export interface GeminiHostIdResult {
  hostName?: string;
  hostBirthDate?: string;
  hostNationality?: string;
  idNumber?: string;
  hostPhone?: string;
  hostAddress?: string;
}

export interface GeminiFlightTicketResult {
  departureDate?: string;
  returnDate?: string;
  flightDepartureTime?: string;
  airportArrivalTime?: string;
  airline?: string;
  flightNumber?: string;
  returnFlightNumber?: string;
  arrivalAirport?: string;
  saudiArrivalTime?: string;
  returnDepartureAirport?: string;
  returnFlightDepartureTime?: string;
}

// 1. Storage & Key Management
export function getGeminiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  return key ? key.trim() : null;
}

export function setGeminiApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  const trimmed = apiKey.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  }
}

export function removeGeminiApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}

// 2. Probing helper to verify if a Gemini model is active and working
async function pingGeminiModel(
  modelName: string,
  apiKey: string
): Promise<{ ok: boolean; suggestedModel?: string; error?: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "OK" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });

    if (res.ok) {
      return { ok: true };
    }

    const errData = await res.json().catch(() => ({}));
    const errMsg: string = errData?.error?.message || `HTTP ${res.status}`;

    // Extract any model suggestion from Google's response
    // e.g. "Please update your code to use models/gemini-3.6-flash"
    const suggestedMatch = errMsg.match(/models\/([a-zA-Z0-9\.\-_]+)/);
    const suggestedModel = suggestedMatch ? suggestedMatch[1] : undefined;

    return { ok: false, suggestedModel, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل الاتصال";
    return { ok: false, error: msg };
  }
}

// Dynamically discover and resolve the available Gemini model for the user's API key
export async function resolveAvailableGeminiModel(
  apiKey: string,
  forceRefresh = false
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return DEFAULT_GEMINI_MODEL;

  // 1. Check cached model if not force refreshing
  if (!forceRefresh && typeof window !== "undefined") {
    const cached = localStorage.getItem(GEMINI_SELECTED_MODEL_KEY);
    // Discard any deprecated or broken cached models
    if (cached && cached !== "gemini-2.5-flash") {
      return cached;
    }
  }

  // Known candidate models (newest first, explicitly starting with gemini-3.6-flash)
  const candidatePool: string[] = [
    "gemini-3.6-flash",
    "gemini-3.6-flash-preview",
    "gemini-3.6",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];

  // 2. Query Google's ListModels API to discover exact available models
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const res = await fetch(listUrl);
    if (res.ok) {
      const data = await res.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> =
        data.models || [];
      const contentModels = models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((name) => {
          const lower = name.toLowerCase();
          return (
            lower.includes("gemini") &&
            !lower.includes("embedding") &&
            !lower.includes("imagen") &&
            !lower.includes("aqa") &&
            name !== "gemini-2.5-flash"
          );
        });

      // Sort: prioritize flash and higher version numbers
      contentModels.sort((a, b) => {
        const aFlash = a.includes("flash") ? 1 : 0;
        const bFlash = b.includes("flash") ? 1 : 0;
        if (aFlash !== bFlash) return bFlash - aFlash;
        return b.localeCompare(a, undefined, { numeric: true });
      });

      for (const m of contentModels) {
        if (!candidatePool.includes(m)) {
          candidatePool.push(m);
        }
      }
    }
  } catch (err) {
    console.warn("Could not list Gemini models from API, testing standard candidates:", err);
  }

  // 3. Probe candidate models until one succeeds!
  for (let i = 0; i < candidatePool.length; i++) {
    const candidate = candidatePool[i];
    const pingRes = await pingGeminiModel(candidate, cleanKey);

    if (pingRes.ok) {
      if (typeof window !== "undefined") {
        localStorage.setItem(GEMINI_SELECTED_MODEL_KEY, candidate);
      }
      return candidate;
    }

    // If Google explicitly suggested a model in the error message (e.g. gemini-3.6-flash), test it immediately!
    if (pingRes.suggestedModel && pingRes.suggestedModel !== candidate) {
      const suggestedPing = await pingGeminiModel(pingRes.suggestedModel, cleanKey);
      if (suggestedPing.ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem(GEMINI_SELECTED_MODEL_KEY, pingRes.suggestedModel);
        }
        return pingRes.suggestedModel;
      }
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(GEMINI_SELECTED_MODEL_KEY, DEFAULT_GEMINI_MODEL);
  }
  return DEFAULT_GEMINI_MODEL;
}

// 3. Test API Key validity
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string; modelName?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: "يرجى إدخال مفتاح الـ API أولاً." };
  }

  try {
    // 1. Force resolve the best active model (probes candidates live)
    const model = await resolveAvailableGeminiModel(cleanKey, true);

    const pingRes = await pingGeminiModel(model, cleanKey);
    if (pingRes.ok) {
      return {
        success: true,
        message: `تم الاتصال بنجاح بمحرك Google Gemini (${model})! المفتاح يعمل بشكل ممتاز وجاهز للاستخدام.`,
        modelName: model,
      };
    }

    return {
      success: false,
      message: pingRes.error || `الموديل (${model}) غير متاح لهذا الحساب`,
    };
  } catch (err: unknown) {
    const errMessage =
      err instanceof Error ? err.message : "فشل الاتصال بخادم Google Gemini.";
    return { success: false, message: errMessage };
  }
}

// 3. Helper: Convert File or URL to Base64 and MIME type
async function fileOrUrlToBase64(
  fileOrUrl: File | Blob | string
): Promise<{ base64: string; mimeType: string }> {
  if (typeof fileOrUrl === "string") {
    // Check if it's already a Data URL
    if (fileOrUrl.startsWith("data:")) {
      const commaIdx = fileOrUrl.indexOf(",");
      const meta = fileOrUrl.substring(5, commaIdx);
      const mimeType = meta.split(";")[0] || "image/jpeg";
      const base64 = fileOrUrl.substring(commaIdx + 1);
      return { base64, mimeType };
    }

    // Fetch URL (blob: or http:)
    const res = await fetch(fileOrUrl);
    const blob = await res.blob();
    return blobToBase64(blob);
  }

  // It's a File or Blob
  return blobToBase64(fileOrUrl);
}

function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      const meta = result.substring(5, commaIdx);
      let mimeType = meta.split(";")[0] || blob.type || "image/jpeg";
      if (!mimeType || mimeType === "application/octet-stream") {
        mimeType = "image/jpeg";
      }
      const base64 = result.substring(commaIdx + 1);
      resolve({ base64, mimeType });
    };
    reader.onerror = () => reject(new Error("فشل قراءة ملف الصورة أو المستند."));
    reader.readAsDataURL(blob);
  });
}

// 4. Core Gemini Multimodal Caller
async function callGeminiVision(
  prompt: string,
  fileOrUrl: File | Blob | string,
  explicitApiKey?: string
): Promise<string> {
  const apiKey = (explicitApiKey || getGeminiApiKey() || "").trim();
  if (!apiKey) {
    throw new Error(
      "لم يتم العثور على مفتاح Google Gemini API. يرجى حفظ المفتاح في الإعدادات أولاً."
    );
  }

  const { base64, mimeType } = await fileOrUrlToBase64(fileOrUrl);

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json",
    },
  };

  let model = await resolveAvailableGeminiModel(apiKey);
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // If model is deprecated or not found, resolve a fresh active model and retry once
  if (!response.ok && (response.status === 404 || response.status === 400)) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = (errorData?.error?.message || "").toLowerCase();
    if (
      errMsg.includes("not found") ||
      errMsg.includes("no longer available") ||
      errMsg.includes("not supported")
    ) {
      console.warn(`Model ${model} failed, resolving a fresh active model...`);
      model = await resolveAvailableGeminiModel(apiKey, true);
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg =
      errorData?.error?.message ||
      `خطأ في فحص الوثيقة بالذكاء الاصطناعي (${response.status})`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error("لم يرجع محرك الذكاء الاصطناعي أي بيانات للمستند.");
  }

  return textOutput;
}

// 5. Intelligent Passport Scanner
export async function scanPassportWithGemini(
  fileOrUrl: File | Blob | string,
  apiKey?: string
): Promise<GeminiPassportResult | null> {
  const prompt = `
You are an expert passport and travel document OCR inspection system.
Analyze the provided passport image or document carefully.
Extract the passport information accurately, paying attention to both the visual text fields and the MRZ (Machine Readable Zone) at the bottom if present.

Strict Requirements:
1. "fullNameArabic":
   - If the passport contains the Arabic name, extract it exactly (first, father, grandfather, family name).
   - If the passport only contains the English name, transcribe / translate the English name accurately into standard Arabic (e.g., "MOHAMED AHMED ALI" -> "محمد أحمد علي").
2. "fullNameEnglish": The complete English name in capital letters as written on the passport (Given names + Surname).
3. "passportNumber": The passport number exactly as printed, uppercase, without spaces or symbols.
4. "nationality": The nationality in Arabic (e.g., "مصري", "سعودي", "عماني", "أردني", "كويتي", "إماراتي", "باكستاني", etc.).
5. "dateOfBirth": Date of birth in YYYY-MM-DD format.
6. "expiryDate": Passport expiry date in YYYY-MM-DD format.
7. "sex": Gender either "ذكر" or "أنثى".
8. "confidence": "high" if clear, otherwise "medium".

Return strictly a JSON object with this structure:
{
  "fullNameArabic": "string",
  "fullNameEnglish": "string",
  "passportNumber": "string",
  "nationality": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "sex": "ذكر" or "أنثى",
  "confidence": "high"
}
`;

  const rawJson = await callGeminiVision(prompt, fileOrUrl, apiKey);
  try {
    const parsed = JSON.parse(rawJson);
    return {
      fullNameArabic: parsed.fullNameArabic?.trim(),
      fullNameEnglish: parsed.fullNameEnglish?.trim(),
      passportNumber: parsed.passportNumber?.trim()?.toUpperCase(),
      nationality: parsed.nationality?.trim(),
      dateOfBirth: parsed.dateOfBirth?.trim(),
      expiryDate: parsed.expiryDate?.trim(),
      sex: parsed.sex?.trim(),
      confidence: parsed.confidence || "high",
    };
  } catch (err) {
    console.error("Failed to parse Gemini passport JSON response:", rawJson, err);
    throw new Error("تعذر معالجة البيانات المستخرجة من الجواز بالذكاء الاصطناعي.");
  }
}

// 6. Intelligent Host ID / Iqama / National ID Scanner
export async function scanHostIdWithGemini(
  fileOrUrl: File | Blob | string,
  apiKey?: string
): Promise<GeminiHostIdResult | null> {
  const prompt = `
You are an expert Arabic National ID, Residency (Iqama), and Passport inspection system.
Examine the provided image (which is a Saudi National ID, Saudi Iqama, Egyptian National ID, GCC ID, or passport of a host).

Extract the following details carefully:
1. "hostName": The full name of the ID holder in Arabic (quadruple name if available, e.g. "عبدالله محمد إبراهيم الشهري").
2. "hostBirthDate": Date of birth in YYYY-MM-DD or YYYY/MM/DD format (Gregorian or Hijri as written on the card).
3. "hostNationality": The nationality of the ID holder in Arabic (e.g. "سعودي", "مصري", "أردني", "سوداني", "يمني", etc.). If it is a Saudi National ID (بطاقة الهوية الوطنية السعودية), the nationality is "سعودي". If it is an Egyptian National ID (بطاقة الرقم القومي المصرية), the nationality is "مصري". If it is an Iqama (هوية مقيم), extract the specific nationality printed on the card in Arabic.
4. "idNumber": The national identity or Iqama number (usually 10 digits for Saudi IDs starting with 1 or 2, or 14 digits for Egyptian IDs). Remove any spaces or dashes.
5. "hostPhone": Any phone number written on the card if present, otherwise null.
6. "hostAddress": Any address, city or district written on the card if present.

Return strictly a JSON object with this structure:
{
  "hostName": "string",
  "hostBirthDate": "string",
  "hostNationality": "string",
  "idNumber": "string",
  "hostPhone": "string or null",
  "hostAddress": "string or null"
}
`;

  const rawJson = await callGeminiVision(prompt, fileOrUrl, apiKey);
  try {
    const parsed = JSON.parse(rawJson);
    return {
      hostName: parsed.hostName?.trim(),
      hostBirthDate: parsed.hostBirthDate?.trim(),
      hostNationality: parsed.hostNationality?.trim(),
      idNumber: parsed.idNumber?.trim(),
      hostPhone: parsed.hostPhone?.trim() || undefined,
      hostAddress: parsed.hostAddress?.trim() || undefined,
    };
  } catch (err) {
    console.error("Failed to parse Gemini Host ID JSON response:", rawJson, err);
    throw new Error("تعذر معالجة بيانات هوية المستضيف المستخرجة بالذكاء الاصطناعي.");
  }
}

// 7. Intelligent Flight Ticket Scanner
export async function scanFlightTicketWithGemini(
  fileOrUrl: File | Blob | string,
  apiKey?: string
): Promise<GeminiFlightTicketResult | null> {
  const prompt = `
You are an expert airline ticket, e-ticket, and flight itinerary analysis system.
Carefully examine the provided flight document (which contains outbound flight and/or return flight details).

Extract the following flight schedule details accurately:
1. "airline": Name of airline in Arabic if possible, or standard name (e.g. "السعودية", "مصر للطيران", "طيران ناس", "Saudia", "Flynas").
2. Outbound Leg (رحلة الذهاب إلى السعودية):
   - "flightNumber": Outbound flight number (e.g. "SV314", "MS665").
   - "departureDate": Outbound departure date in YYYY-MM-DD format (e.g. "2026-09-16").
   - "flightDepartureTime": Outbound departure takeoff time in 24-hour HH:MM format (e.g. "16:40").
   - "arrivalAirport": Destination airport in Saudi Arabia in Arabic. If it arrives in Madinah / Prince Mohammad Bin Abdulaziz, return "مطار المدينة". If Jeddah / King Abdulaziz, return "مطار جدة". If Riyadh, return "مطار الرياض".
   - "saudiArrivalTime": Scheduled landing / arrival time in Saudi Arabia in 24-hour HH:MM format (e.g. "18:35").
   - "airportArrivalTime": Passenger recommended airport arrival time before departure (e.g. 3 hours prior) in 24-hour HH:MM format (e.g. "13:40").
3. Return Leg (رحلة العودة من السعودية):
   - "returnFlightNumber": Return flight number (e.g. "SV317"). Look for the return flight, second sector, or incoming flight.
   - "returnDate": Return flight departure date in YYYY-MM-DD format (e.g. "2026-12-05").
   - "returnDepartureAirport": Saudi departure airport in Arabic (e.g. "مطار المدينة" or "مطار جدة").
   - "returnFlightDepartureTime": Scheduled return flight takeoff time from Saudi Arabia in 24-hour HH:MM format (e.g. "07:25").

Return strictly a valid JSON object matching this structure:
{
  "airline": "string or null",
  "flightNumber": "string or null",
  "departureDate": "YYYY-MM-DD or null",
  "flightDepartureTime": "HH:MM or null",
  "arrivalAirport": "string or null",
  "saudiArrivalTime": "HH:MM or null",
  "airportArrivalTime": "HH:MM or null",
  "returnFlightNumber": "string or null",
  "returnDate": "YYYY-MM-DD or null",
  "returnDepartureAirport": "string or null",
  "returnFlightDepartureTime": "HH:MM or null"
}
`;

  const rawJson = await callGeminiVision(prompt, fileOrUrl, apiKey);
  try {
    const parsed = JSON.parse(rawJson);

    // Normalize airport names to clean standard Arabic labels
    const normalizeAirport = (airport?: string) => {
      if (!airport) return undefined;
      const a = airport.trim();
      if (a.includes("المدينة") || a.includes("محمد بن عبد العزيز") || a.toLowerCase().includes("medina") || a.toLowerCase().includes("madinah") || a.toUpperCase().includes("MED")) {
        return "مطار المدينة";
      }
      if (a.includes("جدة") || a.includes("عبد العزيز") || a.toLowerCase().includes("jeddah") || a.toUpperCase().includes("JED")) {
        return "مطار جدة";
      }
      if (a.includes("الرياض") || a.includes("خالد") || a.toLowerCase().includes("riyadh") || a.toUpperCase().includes("RUH")) {
        return "مطار الرياض";
      }
      return a;
    };

    return {
      airline: parsed.airline?.trim() || undefined,
      flightNumber: parsed.flightNumber?.trim()?.toUpperCase() || undefined,
      departureDate: parsed.departureDate?.trim() || undefined,
      flightDepartureTime: parsed.flightDepartureTime?.trim() || undefined,
      arrivalAirport: normalizeAirport(parsed.arrivalAirport),
      saudiArrivalTime: parsed.saudiArrivalTime?.trim() || undefined,
      airportArrivalTime: parsed.airportArrivalTime?.trim() || undefined,
      returnFlightNumber: parsed.returnFlightNumber?.trim()?.toUpperCase() || undefined,
      returnDate: parsed.returnDate?.trim() || undefined,
      returnDepartureAirport: normalizeAirport(parsed.returnDepartureAirport),
      returnFlightDepartureTime: parsed.returnFlightDepartureTime?.trim() || undefined,
    };
  } catch (err) {
    console.error("Failed to parse Gemini Flight Ticket JSON response:", rawJson, err);
    throw new Error("تعذر معالجة بيانات تذكرة الطيران بالذكاء الاصطناعي.");
  }
}
