/**
 * أداة للتحقق من أرقام الهواتف وتطبيعها (سعودية / مصرية / دولية)
 * - أرقام المستضيفين: شرط أن تتكون من 10 أرقام وتبدأ بـ 05، وتبدأ بـ +966 متبوعة بالرقم بدون الصفر الأولي (+9665xxxxxxxx)
 * - أرقام المسافرين: شرط أن تتكون من 11 رقم وتبدأ بـ 010 أو 011 أو 012 أو 015، وتبدأ بـ +20 متبوعة بالرقم بدون الصفر الأولي (+201xxxxxxxxx)
 */

export interface NormalizedPhone {
  raw: string;
  cleanDigits: string;
  whatsappDigits: string;
  displayFormatted: string;
  country: "SA" | "EG" | "OTHER";
}

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  formatted: string;
  cleanDigits: string;
  whatsappDigits: string;
}

/**
 * التحقق من رقم المستضيف:
 * - يقبل الرقم سواء بدأ بـ 05 (10 أرقام) أو بدأ بـ +966 أو 00966 أو 966
 * - يتم تنسيقه دائماً ليبدأ بـ +966 متبوعاً بالرقم بدون الصفر الأولي (مثال: +9665xxxxxxxx)
 */
export function validateHostPhone(rawPhone?: string): PhoneValidationResult {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      isValid: false,
      error: "يرجى إدخال رقم المستضيف.",
      formatted: "",
      cleanDigits: "",
      whatsappDigits: "",
    };
  }

  const raw = rawPhone.trim();
  let digits = raw.replace(/\D/g, "");

  // إذا تم إدخال الرقم بمفتاح دولي +966 أو 00966 أو 966
  if (digits.startsWith("00966")) {
    digits = digits.substring(5);
  } else if (digits.startsWith("966")) {
    digits = digits.substring(3);
  }

  // إذا تم إدخال الرقم كـ 9 أرقام تبدأ بـ 5 (مثل 5xxxxxxxx أو بعد نزع 966)
  if (digits.startsWith("5") && digits.length === 9) {
    digits = "0" + digits;
  }

  // الشرط: 10 أرقام ويبدأ بـ 05
  if (!digits.startsWith("05") || digits.length !== 10) {
    return {
      isValid: false,
      error: "رقم المستضيف يجب أن يتكون من 10 أرقام ويبدأ بـ 05 (أو يبدأ بـ +966)",
      formatted: raw,
      cleanDigits: digits,
      whatsappDigits: digits,
    };
  }

  const withoutZero = digits.substring(1); // 5xxxxxxxx
  const formatted = `+966${withoutZero}`;
  const whatsappDigits = `966${withoutZero}`;

  return {
    isValid: true,
    formatted,
    cleanDigits: digits,
    whatsappDigits,
  };
}

/**
 * التحقق من رقم المسافر:
 * - يقبل الرقم سواء بدأ بـ 010 أو 011 أو 012 أو 015 (11 رقماً) أو بدأ بـ +20 أو 0020 أو 20
 * - يتم تنسيقه دائماً ليبدأ بـ +20 متبوعاً بالرقم بدون الصفر الأولي (مثال: +2010xxxxxxxx)
 */
export function validateTravelerPhone(rawPhone?: string): PhoneValidationResult {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      isValid: false,
      error: "يرجى إدخال رقم هاتف المسافر.",
      formatted: "",
      cleanDigits: "",
      whatsappDigits: "",
    };
  }

  const raw = rawPhone.trim();
  let digits = raw.replace(/\D/g, "");

  // إذا تم إدخال الرقم بمفتاح دولي +20 أو 0020 أو 20
  if (digits.startsWith("0020")) {
    digits = digits.substring(4);
  } else if (digits.startsWith("20")) {
    digits = digits.substring(2);
  }

  // إذا كان الرقم 10 أرقام ويبدأ بـ 10 أو 11 أو 12 أو 15 (مثل بعد نزع كود 20)
  if (
    digits.length === 10 &&
    (digits.startsWith("10") ||
      digits.startsWith("11") ||
      digits.startsWith("12") ||
      digits.startsWith("15"))
  ) {
    digits = "0" + digits;
  }

  // الشرط: 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015
  const isEgyptianMobile =
    digits.length === 11 &&
    (digits.startsWith("010") ||
      digits.startsWith("011") ||
      digits.startsWith("012") ||
      digits.startsWith("015"));

  if (!isEgyptianMobile) {
    return {
      isValid: false,
      error: "رقم المسافر يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015 (أو يبدأ بـ +20)",
      formatted: raw,
      cleanDigits: digits,
      whatsappDigits: digits,
    };
  }

  const withoutZero = digits.substring(1); // 1xxxxxxxxx
  const formatted = `+20${withoutZero}`;
  const whatsappDigits = `20${withoutZero}`;

  return {
    isValid: true,
    formatted,
    cleanDigits: digits,
    whatsappDigits,
  };
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
    const wa = "20" + digits.substring(1);
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+20" + digits.substring(1),
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
      cleanDigits: "0" + digits,
      whatsappDigits: wa,
      displayFormatted: "+20" + digits,
      country: "EG",
    };
  }

  // إذا كان الرقم المصري يبدأ بالفعل بكود 201
  if (digits.length === 12 && digits.startsWith("201")) {
    return {
      raw,
      cleanDigits: "0" + digits.substring(2),
      whatsappDigits: digits,
      displayFormatted: "+20" + digits.substring(2),
      country: "EG",
    };
  }

  // 2. فحص الرقم السعودي: يبدأ بـ 05 وبطول 10 أرقام
  if (digits.length === 10 && digits.startsWith("05")) {
    const wa = "966" + digits.substring(1);
    return {
      raw,
      cleanDigits: digits,
      whatsappDigits: wa,
      displayFormatted: "+966" + digits.substring(1),
      country: "SA",
    };
  }

  // إذا دخل الرقم السعودي بدون الصفر الأول (9 أرقام تبدأ بـ 5)
  if (digits.length === 9 && digits.startsWith("5")) {
    const wa = "966" + digits;
    return {
      raw,
      cleanDigits: "0" + digits,
      whatsappDigits: wa,
      displayFormatted: "+966" + digits,
      country: "SA",
    };
  }

  // إذا كان الرقم السعودي يبدأ بكود الدولة 9665
  if (digits.startsWith("9665") && digits.length >= 12) {
    return {
      raw,
      cleanDigits: "0" + digits.substring(3),
      whatsappDigits: digits,
      displayFormatted: "+966" + digits.substring(3),
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
      displayFormatted: "+966" + digits.substring(1),
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
