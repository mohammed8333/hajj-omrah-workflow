import { createWorker } from "tesseract.js";
import { scanPassportWithGemini, ensureGeminiApiKey } from "./geminiVision";

export interface ScannedPassportData {
  fullNameArabic: string;
  fullNameEnglish: string;
  passportNumber: string;
  nationality?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  sex?: string;
  rawMrz?: string[];
}

// 1. Comprehensive Arabic Name Dictionary (covers most common Arab/Egyptian names & variations)
const ARABIC_NAMES_DICT: Record<string, string> = {
  MOHAMED: "محمد",
  MOHAMMED: "محمد",
  MUHAMMAD: "محمد",
  MOHAMAD: "محمد",
  MAHMOUD: "محمود",
  MAHMOD: "محمود",
  AHMED: "أحمد",
  AHMAD: "أحمد",
  HAMED: "حامد",
  HAMDY: "حمدي",
  HAMDI: "حمدي",
  ALI: "علي",
  ALY: "علي",
  HASSAN: "حسن",
  HASAN: "حسن",
  HOSNY: "حسني",
  HOSNI: "حسني",
  HUSSEIN: "حسين",
  HUSEIN: "حسين",
  HOUSSEIN: "حسين",
  HUSSEINI: "الحسيني",
  IBRAHIM: "إبراهيم",
  EBRAHIM: "إبراهيم",
  KHALED: "خالد",
  KHALID: "خالد",
  OMAR: "عمر",
  OMER: "عمر",
  AMR: "عمرو",
  AMIR: "أمير",
  AMEER: "أمير",
  EMIR: "أمير",
  YOUSSEF: "يوسف",
  YOUSEF: "يوسف",
  JOSEPH: "يوسف",
  YOSRY: "يسري",
  YOSR: "يسر",
  MOSTAFA: "مصطفى",
  MUSTAFA: "مصطفى",
  OSAMA: "أسامة",
  OSSAMA: "أسامة",
  TAREK: "طارق",
  TARIQ: "طارق",
  WALID: "وليد",
  WALEED: "وليد",
  YASSER: "ياسر",
  YASIR: "ياسر",
  SAEED: "سعيد",
  SAID: "سعيد",
  SAYED: "سيد",
  ELSAYED: "السيد",
  ABDELRAHMAN: "عبد الرحمن",
  ABDALLAH: "عبد الله",
  ABDULLAH: "عبد الله",
  ABDELAZIZ: "عبد العزيز",
  ABDELFATTAH: "عبد الفتاح",
  ABDELHAMID: "عبد الحميد",
  ABDELKADER: "عبد القادر",
  ABDELMONEM: "عبد المنعم",
  ABDELWAHAB: "عبد الوهاب",
  ABDELGHAFFAR: "عبد الغفار",
  ABDELMALEK: "عبد الملك",
  ABDELRAZIK: "عبد الرازق",
  ABDELSALAM: "عبد السلام",
  ABDELSHAFY: "عبد الشافي",
  ABDELMEGUID: "عبد المجيد",
  ABDELGABAR: "عبد الجبار",
  ABDELBASET: "عبد الباسط",
  ABDELHALIM: "عبد الحليم",
  ABDELGHANY: "عبد الغني",
  ABDELMUTI: "عبد المعطي",
  ABDELNABY: "عبد النبي",
  ABDELSHAHID: "عبد الشهيد",
  AYMAN: "أيمن",
  ISMAIL: "إسماعيل",
  ESMAIL: "إسماعيل",
  MANSOUR: "منصور",
  SALAH: "صلاح",
  SALEH: "صالح",
  NABAL: "نبيل",
  NABIL: "نبيل",
  REDA: "رضا",
  RIDA: "رضا",
  ASHRAF: "أشرف",
  ATEF: "عاطف",
  ADEL: "عادل",
  NESMA: "نسمة",
  NESMAH: "نسمة",
  NISMA: "نسمة",
  NEMA: "نعمة",
  MOHAM: "محمد",
  ELBAHNASAWI: "البهنساوي",
  BAHNASAWI: "البهنساوي",
  ELBAHNASAWY: "البهنساوي",
  BAHNASAWY: "البهنساوي",
  ELBAHNASI: "البهنسي",
  BAHNASI: "البهنسي",
  ESSAM: "عصام",
  ISAM: "عصام",
  FAROUK: "فاروق",
  GAMAL: "جمال",
  JAMAL: "جمال",
  ANWAR: "أنوار",
  SAMIR: "سمير",
  SAMEH: "سامح",
  WAEL: "وائل",
  BASSEM: "باسم",
  BASSAM: "بسام",
  HATEM: "حاتم",
  HESHAM: "هشام",
  HISHAM: "هشام",
  SHERIF: "شريف",
  SHAREEF: "شريف",
  IHAB: "إيهاب",
  EHAB: "إيهاب",
  TAWFIQ: "توفيق",
  TAWFIK: "توفيق",
  RAMY: "رامي",
  RAMI: "رامي",
  SHADY: "شادي",
  SHADI: "شادي",
  KARIM: "كريم",
  KAREEM: "كريم",
  ZIAD: "زياد",
  ZEYAD: "زياد",
  SEIF: "سيف",
  SAYF: "سيف",
  ADAM: "آدم",
  MALEK: "مالك",
  RAYAN: "ريان",
  HAMZA: "حمزة",
  ANAS: "أنس",
  MOAZ: "معاذ",
  BILAL: "بلال",
  BELAL: "بلال",
  MOATAZ: "معتز",
  MOHANAD: "مهند",
  FADY: "فادي",
  FADI: "فادي",
  KAMEL: "كامل",
  MAGDY: "مجدي",
  MEDHAT: "مدحت",
  TALAAT: "طلعت",
  EZZAT: "عزت",
  RAAFAT: "رأفت",
  SHAABAN: "شعبان",
  RAMADAN: "رمضان",
  SHAWKY: "شوقي",
  SOBHY: "صبحي",
  METWALLY: "متولي",
  ELMASRY: "المصري",
  ELNAGAR: "النجار",
  ELSHERIF: "الشريف",
  ELKADY: "القاضي",
  ELBAZ: "الباز",
  ELDESOUKY: "الدسوقي",
  ELSHAMY: "الشامي",
  ELGHARIB: "الغريب",
  ELKAFRAWY: "الكفراوي",
  ELARABY: "العربي",
  ELSAWY: "الصاوي",
  ELHADDAD: "الحداد",
  ELMEHALAWY: "المحلاوي",
  FATMA: "فاطمة",
  FATIMA: "فاطمة",
  MARIAM: "مريم",
  MARYAM: "مريم",
  MONA: "منى",
  SARA: "سارة",
  SARAH: "سارة",
  NOUR: "نور",
  NOURA: "نورة",
  HODA: "هدى",
  NADA: "ندى",
  REEM: "ريم",
  SALMA: "سلمى",
  YASMINE: "ياسمين",
  YASMIN: "ياسمين",
  ZEINAB: "زينب",
  ZAINAB: "زينب",
  DINA: "دينا",
  SHIMAA: "شيماء",
  SHAYMAA: "شيماء",
  IMAN: "إيمان",
  EMAN: "إيمان",
  RANIA: "رانيا",
  DOAA: "دعاء",
  AYA: "آية",
  BASMA: "بسمة",
  MAI: "مي",
  MAYA: "مايا",
  HEBA: "هبة",
  MARWA: "مروة",
  ENGY: "إنجي",
  INGY: "إنجي",
  REHAM: "ريهام",
  MAHA: "مها",
  SAMAH: "سماح",
  NAGLAA: "نجلاء",
  SHAHIRA: "شهيرة",
  AMANY: "أماني",
  SOAD: "سعاد",
  SABAH: "صباح",
  HANAN: "حنان",
  MANAL: "منال",
  AMAL: "أمل",
  FERIAL: "فريال",
  LAILA: "ليلى",
  LAYLA: "ليلى",
  SAMIA: "سامية",
  NAHED: "ناهد",
  SANAA: "سناء",
};

// Common Country Codes mapping
const COUNTRY_CODES: Record<string, string> = {
  EGY: "مصر",
  SAU: "المملكة العربية السعودية",
  JOR: "الأردن",
  SYR: "سوريا",
  LBN: "لبنان",
  IRQ: "العراق",
  YEM: "اليمن",
  KWT: "الكويت",
  ARE: "الإمارات",
  QAT: "قطر",
  BHR: "البحرين",
  OMN: "عمان",
  SDN: "السودان",
  LBY: "ليبيا",
  TUN: "تونس",
  DZA: "الجزائر",
  MAR: "المغرب",
  PSE: "فلسطين",
  TUR: "تركيا",
};

// Clean Arabic text from non-Arabic letters or HTML entities
function cleanArabicName(name: string): string {
  return name
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 2. Phonetic Transliteration Fallback for unlisted names
function transliterateWordToArabicLocally(word: string): string {
  let w = word.toUpperCase().trim();
  if (ARABIC_NAMES_DICT[w]) {
    return ARABIC_NAMES_DICT[w];
  }

  // Check compound names with EL / AL
  if (w.startsWith("EL") && w.length > 2) {
    const rest = w.substring(2);
    return "ال" + (ARABIC_NAMES_DICT[rest] || transliterateWordToArabicLocally(rest));
  }
  if (w.startsWith("AL") && w.length > 2) {
    const rest = w.substring(2);
    return "ال" + (ARABIC_NAMES_DICT[rest] || transliterateWordToArabicLocally(rest));
  }
  if (w.startsWith("ABD") && w.length > 3) {
    const rest = w.substring(3);
    return "عبد " + (ARABIC_NAMES_DICT[rest] || transliterateWordToArabicLocally(rest));
  }

  // Phonetic letter mapping replacement
  let res = w
    .replace(/KHOURY/g, "خوري")
    .replace(/KHALIL/g, "خليل")
    .replace(/KHALAF/g, "خلف")
    .replace(/SH/g, "ش")
    .replace(/KH/g, "خ")
    .replace(/TH/g, "ث")
    .replace(/DH/g, "ذ")
    .replace(/GH/g, "غ")
    .replace(/PH/g, "ف")
    .replace(/CH/g, "تش")
    .replace(/OU/g, "و")
    .replace(/EE/g, "ي")
    .replace(/OO/g, "و")
    .replace(/AA/g, "ا")
    .replace(/B/g, "ب")
    .replace(/T/g, "ت")
    .replace(/J/g, "ج")
    .replace(/H/g, "ح")
    .replace(/D/g, "د")
    .replace(/R/g, "ر")
    .replace(/Z/g, "ز")
    .replace(/S/g, "س")
    .replace(/F/g, "ف")
    .replace(/Q/g, "ق")
    .replace(/K/g, "ك")
    .replace(/L/g, "ل")
    .replace(/M/g, "م")
    .replace(/N/g, "ن")
    .replace(/W/g, "و")
    .replace(/Y/g, "ي")
    .replace(/A/g, "ا")
    .replace(/E/g, "ي")
    .replace(/I/g, "ي")
    .replace(/O/g, "و")
    .replace(/U/g, "و")
    .replace(/V/g, "ف")
    .replace(/P/g, "ب")
    .replace(/G/g, "ج")
    .replace(/X/g, "كس");

  return res;
}

export function translateEnglishNameToArabicLocally(englishName: string): string {
  if (!englishName) return "";

  const parts = englishName
    .replace(/[^A-Za-z\s-]/g, "")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);

  const arabicParts = parts.map((part) => transliterateWordToArabicLocally(part));
  return arabicParts.join(" ");
}

/**
 * Highly accurate translation of English names to Arabic using:
 * 1. Google Translate API (clients5.google.com/translate_a/t with CORS support)
 * 2. Fallback to Google Input Tools transliteration API
 * 3. Fallback to MyMemory translation API
 * 4. Fallback to local dictionary + phonetic transliteration
 */
export async function translateEnglishNameToArabic(
  englishName: string
): Promise<string> {
  if (!englishName) return "";

  const cleaned = englishName
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  // 1. Primary: Google Translate (Chrome client endpoint with CORS support)
  try {
    const googleUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=ar&q=${encodeURIComponent(
      cleaned
    )}`;
    const res = await fetch(googleUrl, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      let translated = "";
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "string") {
        translated = data[0].trim();
      } else if (typeof data === "string") {
        translated = data.trim();
      }
      if (translated && !/^[A-Za-z\s]+$/.test(translated)) {
        return cleanArabicName(translated);
      }
    }
  } catch (err) {
    console.warn("Google Translate client5 failed, trying fallback:", err);
  }

  // 2. Fallback: Google Input Tools Transliteration API
  try {
    const gitUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(
      cleaned
    )}&itc=ar-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
    const res = await fetch(gitUrl, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.[0]) {
        const translated = data[1][0][1][0].trim();
        if (translated && !/^[A-Za-z\s]+$/.test(translated)) {
          return cleanArabicName(translated);
        }
      }
    }
  } catch (err) {
    console.warn("Google Input Tools transliteration failed, trying MyMemory:", err);
  }

  // 3. Fallback: MyMemory Translation API
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      cleaned
    )}&langpair=en|ar`;
    const res = await fetch(myMemoryUrl, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText?.trim();
      if (translated && !/^[A-Za-z\s]+$/.test(translated)) {
        return cleanArabicName(translated);
      }
    }
  } catch (err) {
    console.warn("MyMemory translation failed, falling back to local engine:", err);
  }

  // 4. Fallback: Local Dictionary + Transliteration
  return cleanArabicName(translateEnglishNameToArabicLocally(cleaned));
}

// Helper to preprocess image canvas for MRZ detection
async function preprocessPassportImage(
  fileOrUrl: File | string
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context is not available"));
        return;
      }

      // We only need the bottom 35% of the passport where MRZ is printed
      const cropHeightRatio = 0.35;
      const cropY = Math.floor(img.height * (1 - cropHeightRatio));
      const cropHeight = img.height - cropY;

      // Scale to optimal width for OCR (around 1200px)
      const targetWidth = 1200;
      const scale = targetWidth / img.width;
      const targetHeight = Math.floor(cropHeight * scale);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw cropped bottom region
      ctx.drawImage(
        img,
        0,
        cropY,
        img.width,
        cropHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Apply Grayscale & High Contrast for OCR
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Binarization threshold around 125
        const val = gray > 125 ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };

    img.onerror = () => reject(new Error("تعذر تحميل صورة جواز السفر"));

    if (typeof fileOrUrl === "string") {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("تعذر قراءة ملف الجواز"));
      reader.readAsDataURL(fileOrUrl);
    }
  });
}

// 3. Scan & Parse MRZ from Passport
export async function scanPassportMRZ(
  fileOrUrl: File | string,
  onProgress?: (step: string) => void
): Promise<ScannedPassportData | null> {
  // 1. Try Google Gemini Vision AI if API key is configured
  const geminiKey = await ensureGeminiApiKey();
  if (geminiKey) {
    try {
      onProgress?.("جاري الفحص الذكي عبر Google Gemini Vision AI...");
      const geminiResult = await scanPassportWithGemini(fileOrUrl, geminiKey);
      if (
        geminiResult &&
        (geminiResult.fullNameArabic ||
          geminiResult.fullNameEnglish ||
          geminiResult.passportNumber)
      ) {
        return {
          fullNameArabic: geminiResult.fullNameArabic || "",
          fullNameEnglish: geminiResult.fullNameEnglish || "",
          passportNumber: geminiResult.passportNumber || "",
          nationality: geminiResult.nationality || "",
          dateOfBirth: geminiResult.dateOfBirth || "",
          expiryDate: geminiResult.expiryDate || "",
          sex: geminiResult.sex || "",
          rawMrz: [],
        };
      }
    } catch (geminiErr) {
      console.warn("Gemini vision passport scan failed, falling back to local OCR:", geminiErr);
    }
  }

  // 2. Fallback to local Tesseract OCR
  let worker: any = null;
  try {
    onProgress?.("جاري تجهيز الصورة وفحص منطقة الـ MRZ...");
    const canvas = await preprocessPassportImage(fileOrUrl);

    onProgress?.("جاري التعرف على الرموز المشفرة للجواز...");
    worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6", // Assume uniform block of text
    });

    const ret = await worker.recognize(canvas);
    const text = ret?.data?.text || "";

    onProgress?.("جاري تحليل بيانات الجواز وترجمة الاسم عبر Google Translate...");
    const parsed = await parseMrzLines(text);
    return parsed;
  } catch (err) {
    console.warn("MRZ scanning failed:", err);
    return null;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}

// 4. Parse 2 lines of TD3 MRZ (Passport)
export async function parseMrzLines(ocrText: string): Promise<ScannedPassportData | null> {
  if (!ocrText) return null;

  // Split into lines and filter those looking like MRZ
  const rawLines = ocrText
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, ""))
    .filter((l) => l.length >= 25 && l.includes("<"));

  // Find candidate line 1 (starts with P) and candidate line 2
  let line1 = "";
  let line2 = "";

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith("P") && !line1) {
      line1 = line;
      if (rawLines[i + 1]) {
        line2 = rawLines[i + 1];
      }
      break;
    }
  }

  // Fallback: take last two lines with plenty of '<'
  if (!line1 && rawLines.length >= 2) {
    line1 = rawLines[rawLines.length - 2];
    line2 = rawLines[rawLines.length - 1];
  }

  if (!line1) return null;

  // Normalize line lengths (TD3 format is 44 characters)
  line1 = line1.padEnd(44, "<").substring(0, 44);
  line2 = (line2 || "").padEnd(44, "<").substring(0, 44);

  // Parse Line 1: Type (2), Issuing Country (3), Name (39)
  const issuingCountry = line1.substring(2, 5).replace(/</g, "");
  const nameSection = line1.substring(5);
  const nameParts = nameSection.split("<<");
  const surname = (nameParts[0] || "").replace(/</g, " ").trim();
  const givenNames = (nameParts[1] || "").replace(/</g, " ").trim();

  const fullNameEnglish = `${givenNames} ${surname}`.replace(/\s+/g, " ").trim();

  // Parse Line 2: Passport Number (0..9), Nationality (10..13), DOB (13..19), Sex (20), Expiry (21..27)
  let passportNumber = "";
  let nationality = "";
  let dateOfBirth = "";
  let sex = "";
  let expiryDate = "";

  if (line2.length >= 20) {
    passportNumber = line2.substring(0, 9).replace(/</g, "").trim();
    const natCode = line2.substring(10, 13).replace(/</g, "").trim();
    nationality = COUNTRY_CODES[natCode] || natCode;

    // DOB YYMMDD
    const dobRaw = line2.substring(13, 19);
    if (/^\d{6}$/.test(dobRaw)) {
      const yy = parseInt(dobRaw.substring(0, 2), 10);
      const mm = dobRaw.substring(2, 4);
      const dd = dobRaw.substring(4, 6);
      const fullYear = yy > 40 ? 1900 + yy : 2000 + yy;
      dateOfBirth = `${fullYear}-${mm}-${dd}`;
    }

    // Sex
    sex = line2.substring(20, 21);
    if (sex === "M") sex = "ذكر";
    else if (sex === "F") sex = "أنثى";
    else sex = "";

    // Expiry YYMMDD
    const expRaw = line2.substring(21, 27);
    if (/^\d{6}$/.test(expRaw)) {
      const yy = parseInt(expRaw.substring(0, 2), 10);
      const mm = expRaw.substring(2, 4);
      const dd = expRaw.substring(4, 6);
      expiryDate = `20${yy}-${mm}-${dd}`;
    }
  }

  // Convert English Name to Arabic via Google Translate
  const fullNameArabic = await translateEnglishNameToArabic(fullNameEnglish);

  return {
    fullNameArabic,
    fullNameEnglish,
    passportNumber,
    nationality,
    dateOfBirth,
    expiryDate,
    sex,
    rawMrz: [line1, line2],
  };
}
