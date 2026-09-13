/**
 * Google Gemini AI Vision Service for Intelligent Document Scanning
 * Supports Passports, National IDs (Saudi, Egyptian, etc.), Iqamas, and Flight Tickets.
 */

const GEMINI_API_KEY_STORAGE_KEY = "gemini_ai_api_key";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

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

// 2. Test API Key validity
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  if (!apiKey.trim()) {
    return { success: false, message: "يرجى إدخال مفتاح الـ API أولاً." };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey.trim()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Respond with the single word: OK" }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData?.error?.message || `خطأ رقم (${response.status}): المفتاح غير صالح أو الخدمة غير مفعلة`;
      return { success: false, message: msg };
    }

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        success: true,
        message: "تم الاتصال بنجاح بمحرك Google Gemini! المفتاح يعمل بشكل ممتاز وجاهز للاستخدام.",
      };
    }

    return { success: false, message: "استجابة غير متوقعة من خادم Gemini." };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : "فشل الاتصال بخادم Google Gemini.";
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

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
You are an expert Arabic National ID and Residency (Iqama) document inspection system.
Examine the provided image (which is a Saudi National ID, Saudi Iqama, Egyptian National ID, GCC ID, or passport of a host).

Extract the following details carefully:
1. "hostName": The full name of the ID holder in Arabic (quadruple name if available, e.g. "عبدالله محمد إبراهيم الشهري").
2. "hostBirthDate": Date of birth in YYYY-MM-DD or YYYY/MM/DD format (Gregorian or Hijri as written on the card).
3. "idNumber": The national identity or Iqama number (usually 10 digits for Saudi IDs starting with 1 or 2, or 14 digits for Egyptian IDs). Remove any spaces or dashes.
4. "hostPhone": Any phone number written on the card if present, otherwise null.
5. "hostAddress": Any address, city or district written on the card if present.

Return strictly a JSON object with this structure:
{
  "hostName": "string",
  "hostBirthDate": "string",
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
You are an expert airline ticket and boarding pass inspection system.
Examine the provided flight ticket, e-ticket receipt, or boarding pass.

Extract the following flight schedule details:
1. "departureDate": Departure date in YYYY-MM-DD format.
2. "returnDate": Return flight date in YYYY-MM-DD format (if a round trip, otherwise null).
3. "flightDepartureTime": Scheduled flight takeoff / departure time in 24-hour HH:MM format (e.g. "14:30" or "08:15").
4. "airportArrivalTime": Recommended airport arrival time (usually 3 hours before international departure) in 24-hour HH:MM format.
5. "airline": Name of the airline (e.g. "مصر للطيران", "الخطوط السعودية", "طيران ناس", "Flynas", "Saudia").
6. "flightNumber": Flight number (e.g. "SV123", "MS665").

Return strictly a JSON object with this structure:
{
  "departureDate": "YYYY-MM-DD or null",
  "returnDate": "YYYY-MM-DD or null",
  "flightDepartureTime": "HH:MM or null",
  "airportArrivalTime": "HH:MM or null",
  "airline": "string or null",
  "flightNumber": "string or null"
}
`;

  const rawJson = await callGeminiVision(prompt, fileOrUrl, apiKey);
  try {
    const parsed = JSON.parse(rawJson);
    return {
      departureDate: parsed.departureDate?.trim() || undefined,
      returnDate: parsed.returnDate?.trim() || undefined,
      flightDepartureTime: parsed.flightDepartureTime?.trim() || undefined,
      airportArrivalTime: parsed.airportArrivalTime?.trim() || undefined,
      airline: parsed.airline?.trim() || undefined,
      flightNumber: parsed.flightNumber?.trim() || undefined,
    };
  } catch (err) {
    console.error("Failed to parse Gemini Flight Ticket JSON response:", rawJson, err);
    throw new Error("تعذر معالجة بيانات تذكرة الطيران بالذكاء الاصطناعي.");
  }
}
