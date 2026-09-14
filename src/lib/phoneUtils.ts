/**
 * أداة للتحقق من أرقام الهواتف وتطبيعها (سعودية / مصرية / دولية)
 * - الأرقام السعودية: تبدأ بـ 05 (10 أرقام) -> تصبح +9665xxxxxxxx
 * - الأرقام المصرية: تبدأ بـ 01 (010, 011, 012, 015) (11 رقم) -> تصبح +201xxxxxxxxx
 */

export interface NormalizedPhone {
  raw: string;
  cleanDigits: string;
  whatsappDigits: string;
  displayFormatted: string;
  country: "SA" | "EG" | "OTHER";
}

export function normalizePhone(rawPhone?: string): NormalizedPhone {
  if (!rawPhone) {
    return {
      raw: "",
      cleanDigits: "",
      whatsappDigits: "",
      displayFormatted: "",
      country: "OTHER",
    };
  }

  const raw = rawPhone.trim();
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // 1. فحص الرقم المصري: يبدأ بـ 010 أو 011 أو 012 أو 015 وبطول 11 رقم
  if (
    digits.length === 11 &&
    (digits.startsWith("010") ||
      digits.startsWith("011") ||
      digits.startsWith("012") ||
      digits.startsWith("015"))
  ) {
    const wa = "20" + digits.substring(1); // 201...
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+20 " + digits.substring(1),
      country: "EG",
    };
  }

  // إذا تم إدخال الرقم المصري بدون الصفر (10 أرقام تبدأ بـ 10, 11, 12, 15)
  if (
    digits.length === 10 &&
    (digits.startsWith("10") ||
      digits.startsWith("11") ||
      digits.startsWith("12") ||
      digits.startsWith("15"))
  ) {
    const wa = "20" + digits;
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+20 " + digits,
      country: "EG",
    };
  }

  // إذا كان الرقم المصري يبدأ بالفعل بكود 201
  if (digits.length === 12 && digits.startsWith("201")) {
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: digits,
      displayFormatted: "+20 " + digits.substring(2),
      country: "EG",
    };
  }

  // 2. فحص الرقم السعودي: يبدأ بـ 05 وبطول 10 أرقام
  if (digits.length === 10 && digits.startsWith("05")) {
    const wa = "966" + digits.substring(1); // 9665...
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+966 " + digits.substring(1),
      country: "SA",
    };
  }

  // إذا دخل الرقم السعودي بدون الصفر الأول (9 أرقام تبدأ بـ 5)
  if (digits.length === 9 && digits.startsWith("5")) {
    const wa = "966" + digits;
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+966 " + digits,
      country: "SA",
    };
  }

  // إذا كان الرقم السعودي يبدأ بكود الدولة 9665
  if (digits.startsWith("9665") && digits.length >= 12) {
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: digits,
      displayFormatted: "+966 " + digits.substring(3),
      country: "SA",
    };
  }

  // 3. حالة عامة: إذا كان يبدأ بصفر وبطول 10 أرقام، نعتبره سعودي
  if (digits.startsWith("0") && digits.length === 10) {
    const wa = "966" + digits.substring(1);
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+966 " + digits.substring(1),
      country: "SA",
    };
  }

  // افتراضي للأرقام الدولية الأخرى
  return {
    raw,
    cleanDigits: digits,
    whatsappDigits: digits,
    displayFormatted: digits ? (raw.startsWith("+") ? raw : `+${digits}`) : "",
    country: "OTHER",
  };
}

export function getWhatsAppUrl(phone: string, message?: string): string {
  const norm = normalizePhone(phone);
  if (!norm.whatsappDigits) return "";
  const textParam = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${norm.whatsappDigits}${textParam}`;
}

export function getTelUrl(phone: string): string {
  const norm = normalizePhone(phone);
  if (!norm.whatsappDigits) return "";
  return `tel:+${norm.whatsappDigits}`;
}
