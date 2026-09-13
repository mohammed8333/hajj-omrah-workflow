import { createWorker } from "tesseract.js";
import { parseMrzLines } from "./mrzScanner";
import { scanHostIdWithGemini, getGeminiApiKey } from "./geminiVision";

export interface ScannedHostIdData {
  hostName?: string;
  hostBirthDate?: string;
  hostNationality?: string;
  idNumber?: string;
  rawText?: string;
}

// Convert Arabic-Indic numerals (٠-٩) to standard digits (0-9)
function normalizeDigits(text: string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return text.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
}

// Preprocess image for Arabic OCR (scale, grayscale, adaptive contrast)
async function preprocessIdImage(fileOrUrl: File | string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("تعذر تجهيز لوحة الرسم لمعالجة الصورة"));
        return;
      }

      // Optimal width for ID card OCR
      const targetWidth = 1400;
      const scale = targetWidth / img.width;
      const targetHeight = Math.floor(img.height * scale);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Grayscale & contrast enhancement
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Dynamic threshold for clear Arabic text separation
        const val = gray > 130 ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };

    img.onerror = () => reject(new Error("تعذر تحميل صورة هوية المستضيف"));

    if (typeof fileOrUrl === "string") {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("تعذر قراءة ملف الهوية"));
      reader.readAsDataURL(fileOrUrl);
    }
  });
}

// Parse extracted OCR text from Host ID / Iqama / Passport
export async function parseHostIdText(rawText: string): Promise<ScannedHostIdData> {
  if (!rawText) return {};

  const normalized = normalizeDigits(rawText);

  // 1. Check if document is a passport (MRZ TD3 detected)
  if (normalized.includes("P<") || (normalized.includes("<<") && normalized.includes("<"))) {
    try {
      const mrzData = await parseMrzLines(normalized);
      if (mrzData && mrzData.fullNameArabic) {
        return {
          hostName: mrzData.fullNameArabic,
          hostBirthDate: mrzData.dateOfBirth,
          hostNationality: mrzData.nationality,
          idNumber: mrzData.passportNumber,
          rawText,
        };
      }
    } catch {}
  }

  let hostName = "";
  let hostBirthDate = "";
  let idNumber = "";

  // 2. Extract Host Name (اسم المستضيف)
  // Pattern A: explicitly labeled with "الاسم", "اسم المقيم", "اسم صاحب الهوية", "الاسم الكامل", "Name"
  const nameLabelRegex = /(?:الاسم|الاسم\s*الكامل|اسم\s*المقيم|اسم\s*صاحب\s*الهوية|اسم\s*المستضيف|Name)[\s:]+([^\n\r\d:;,،]{3,60})/i;
  const nameLabelMatch = normalized.match(nameLabelRegex);

  if (nameLabelMatch && nameLabelMatch[1]) {
    let extracted = nameLabelMatch[1].trim();
    // Clean up unwanted label words that might leak into the line
    extracted = extracted
      .replace(/(?:الجنسية|المهنة|الديانة|مكان|رقم|تاريخ|الحالة|جهة|الاصدار|الانتهاء|هوية|مقيم|السعودية).*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (extracted.split(" ").length >= 2) {
      hostName = extracted;
    }
  }

  // Pattern B: Fallback - look for 3-4 consecutive Arabic name words on a dedicated line
  if (!hostName) {
    const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Ignore header/label lines
      if (
        line.includes("المملكة") ||
        line.includes("وزارة") ||
        line.includes("الداخلية") ||
        line.includes("الهوية") ||
        line.includes("مقيم") ||
        line.includes("الجوازات") ||
        line.includes("تاريخ") ||
        line.includes("رقم") ||
        /\d/.test(line)
      ) {
        continue;
      }
      // Must contain only Arabic letters and spaces, at least 2 words
      const cleanedLine = line.replace(/[^\u0600-\u06FF\s]/g, "").trim();
      const words = cleanedLine.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length >= 3 && words.length <= 6) {
        hostName = cleanedLine;
        break;
      }
    }
  }

  // 3. Extract Date of Birth (تاريخ الميلاد)
  // Pattern A: Labeled with "تاريخ الميلاد", "الميلاد", "تاريخ الولادة", "DOB", "Birth Date"
  const dobLabelRegex = /(?:تاريخ\s*الميلاد|الميلاد|تاريخ\s*الولادة|تاريخ\s*الازدياد|birth\s*date|dob)[\s:]*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i;
  const dobMatch = normalized.match(dobLabelRegex);

  if (dobMatch && dobMatch[1]) {
    hostBirthDate = dobMatch[1].replace(/[-.]/g, "/").trim();
  } else {
    // Pattern B: General Hijri (13xx or 14xx) or Gregorian (19xx or 20xx) date format
    const generalDateRegex = /\b((?:1[34][0-9]{2}|(?:19|20)[0-9]{2})[\/\-.][0-1]?[0-9][\/\-.][0-3]?[0-9])\b/;
    const genMatch = normalized.match(generalDateRegex);
    if (genMatch && genMatch[1]) {
      hostBirthDate = genMatch[1].replace(/[-.]/g, "/").trim();
    } else {
      // Reversed format: DD/MM/YYYY
      const reversedDateRegex = /\b([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.](?:1[34][0-9]{2}|(?:19|20)[0-9]{2}))\b/;
      const revMatch = normalized.match(reversedDateRegex);
      if (revMatch && revMatch[1]) {
        hostBirthDate = revMatch[1].replace(/[-.]/g, "/").trim();
      }
    }
  }

  // 4. Extract Saudi National ID or Iqama Number (10 digits starting with 1 or 2)
  const idRegex = /\b([12][0-9]{9})\b/;
  const idMatch = normalized.match(idRegex);
  if (idMatch && idMatch[1]) {
    idNumber = idMatch[1];
  }

  // 5. Extract Nationality (جنسية المستضيف)
  let hostNationality = "";
  if (normalized.includes("الهوية الوطنية") || normalized.includes("المملكة العربية السعودية")) {
    if (!normalized.includes("مقيم")) {
      hostNationality = "سعودي";
    }
  } else if (
    normalized.includes("جمهورية مصر العربية") ||
    normalized.includes("بطاقة تحقيق الشخصية") ||
    normalized.includes("الرقم القومي")
  ) {
    hostNationality = "مصري";
  }

  const natLabelRegex = /(?:الجنسية|Nationality)[\s:]+([^\n\r\d:;,،]{3,30})/i;
  const natMatch = normalized.match(natLabelRegex);
  if (natMatch && natMatch[1]) {
    const extractedNat = natMatch[1].trim();
    if (extractedNat.length >= 3) {
      hostNationality = extractedNat;
    }
  }

  return {
    hostName: hostName || undefined,
    hostBirthDate: hostBirthDate || undefined,
    hostNationality: hostNationality || undefined,
    idNumber: idNumber || undefined,
    rawText,
  };
}

/**
 * Scan Host ID image and automatically extract:
 * 1. Host Name (اسم المستضيف)
 * 2. Date of Birth (تاريخ الميلاد)
 * 3. Nationality (جنسية المستضيف)
 * 4. National ID / Iqama Number (رقم الهوية / الإقامة)
 */
export async function scanHostId(
  fileOrUrl: File | string,
  onProgress?: (step: string) => void
): Promise<ScannedHostIdData | null> {
  // 1. Try Google Gemini Vision AI if API key is configured
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    try {
      onProgress?.("جاري الفحص الذكي للهوية عبر Google Gemini Vision AI...");
      const geminiResult = await scanHostIdWithGemini(fileOrUrl, geminiKey);
      if (
        geminiResult &&
        (geminiResult.hostName ||
          geminiResult.hostBirthDate ||
          geminiResult.hostNationality ||
          geminiResult.idNumber)
      ) {
        return {
          hostName: geminiResult.hostName,
          hostBirthDate: geminiResult.hostBirthDate,
          hostNationality: geminiResult.hostNationality,
          idNumber: geminiResult.idNumber,
          rawText: "Gemini Vision AI extraction",
        };
      }
    } catch (geminiErr) {
      console.warn("Gemini vision host ID scan failed, falling back to local OCR:", geminiErr);
    }
  }

  // 2. Fallback to local Tesseract OCR
  let worker: any = null;
  try {
    onProgress?.("جاري تجهيز صورة هوية المستضيف...");
    const canvas = await preprocessIdImage(fileOrUrl);

    onProgress?.("جاري قراءة النصوص والبيانات العربية من الهوية...");
    worker = await createWorker(["ara", "eng"]);

    const ret = await worker.recognize(canvas);
    const text = ret?.data?.text || "";

    onProgress?.("جاري استخراج اسم المستضيف وتاريخ الميلاد...");
    const parsed = await parseHostIdText(text);
    return parsed;
  } catch (err) {
    console.warn("Host ID OCR scan failed:", err);
    return null;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}
