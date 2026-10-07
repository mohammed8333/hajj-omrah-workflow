/**
 * Cloudflare Worker: MOFA Saudi Visa Search Proxy (منصة التأشيرات - وزارة الخارجية)
 * Enables cross-origin search & automated visa retrieval from visa.mofa.gov.sa/visaservices/searchvisa
 */

const MOFA_SEARCH_URL = "https://visa.mofa.gov.sa/visaservices/searchvisa";
const MOFA_BASE_URL = "https://visa.mofa.gov.sa";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      // 1. Endpoint: Get Captcha & Session Token
      if (url.pathname === "/api/captcha" || (request.method === "POST" && (await isAction(request, "get_captcha")))) {
        return await handleGetCaptcha();
      }

      // 2. Endpoint: Search Visa
      if (url.pathname === "/api/search" || request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        return await handleSearchVisa(body);
      }

      return new Response(
        JSON.stringify({
          status: "online",
          service: "MOFA Visa Cloudflare Proxy",
          endpoints: ["/api/captcha", "/api/search"],
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message || "Internal Worker Error" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  },
};

async function isAction(request, actionName) {
  try {
    const clone = request.clone();
    const data = await clone.json();
    return data && data.action === actionName;
  } catch {
    return false;
  }
}

function extractCleanCookieHeader(response) {
  let rawCookies = [];
  if (typeof response.headers.getSetCookie === "function") {
    rawCookies = response.headers.getSetCookie();
  } else {
    const raw = response.headers.get("set-cookie") || "";
    rawCookies = raw.split(/,(?=[^;]+=[^;]+)/);
  }

  const cookieMap = new Map();
  for (const sc of rawCookies) {
    const parts = sc.split(";");
    const nameVal = parts[0]?.trim();
    if (nameVal && nameVal.includes("=")) {
      const eqIdx = nameVal.indexOf("=");
      const key = nameVal.slice(0, eqIdx).trim();
      const val = nameVal.slice(eqIdx + 1).trim();
      const lower = key.toLowerCase();
      if (
        key &&
        lower !== "expires" &&
        lower !== "path" &&
        lower !== "domain" &&
        lower !== "samesite" &&
        lower !== "httponly" &&
        lower !== "secure"
      ) {
        cookieMap.set(key, val);
      }
    }
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function handleGetCaptcha() {
  const initRes = await fetch(MOFA_SEARCH_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.9",
    },
  });

  const html = await initRes.text();
  const cleanCookie = extractCleanCookieHeader(initRes);

  // Extract __RequestVerificationToken
  const tokenMatch = html.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/i);
  const token = tokenMatch ? tokenMatch[1] : "";

  // Extract Captcha image URL
  const captchaMatch =
    html.match(/id=['"]imgCaptcha['"][^>]*src=['"]([^'"]+)['"]/i) ||
    html.match(/src=['"]([^'"]*GetRandomCaptchaImage[^'"]*)['"]/i) ||
    html.match(/src=['"]([^'"]+)['"][^>]*id=['"]imgCaptcha['"]/i);

  let captchaUrl = captchaMatch ? captchaMatch[1] : "";

  if (captchaUrl.startsWith("/")) {
    captchaUrl = MOFA_BASE_URL + captchaUrl;
  }

  let captchaBase64 = "";
  if (captchaUrl) {
    const imgRes = await fetch(captchaUrl, {
      headers: {
        Cookie: cleanCookie,
        Referer: MOFA_SEARCH_URL,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    const buffer = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    captchaBase64 = `data:${contentType};base64,${b64}`;
  }

  return new Response(
    JSON.stringify({
      success: true,
      token,
      cookie: cleanCookie,
      captchaImage: captchaBase64,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}

async function handleSearchVisa(data) {
  const { token, cookie, passportNo, fName, nationality, captcha } = data;

  if (!passportNo || !fName || !nationality || !captcha) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "يرجى تعبئة جميع الحقول المطلوبة (رقم الجواز، الاسم الأول، الجنسية، ورمز التحقق).",
      }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const formData = new URLSearchParams();
  formData.append("ReaderType", "1");
  formData.append("ddlFirstValue", "PassPortNo");
  formData.append("tbFirstValue", passportNo.trim().toUpperCase());
  formData.append("ddlSecondValue", "fName");
  formData.append("tbSecondValue", fName.trim());
  formData.append("NationalityId", nationality.trim().toUpperCase());
  formData.append("Captcha", captcha.trim());
  if (token) {
    formData.append("__RequestVerificationToken", token);
  }

  const res = await fetch(MOFA_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie || "",
      Origin: MOFA_BASE_URL,
      Referer: MOFA_SEARCH_URL,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    body: formData.toString(),
  });

  const resHtml = await res.text();

  // 1. Check for Captcha error
  if (
    resHtml.includes("رمز الصورة غير صحيح") ||
    resHtml.includes("الرجاء إدخال رمز الصورة") ||
    resHtml.includes("رمز التحقق غير صحيح")
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        errorType: "INVALID_CAPTCHA",
        error: "رمز الصورة (Captcha) غير صحيح، جاري إعادة المحاولة برمز جديد...",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // 2. Check for Not Found
  if (
    resHtml.includes("لم يتم العثور على اي نتائج") ||
    resHtml.includes("ResultNotFound") ||
    resHtml.includes("لاتوجد تأشيرة صادرة")
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        errorType: "NOT_FOUND",
        error: "لم يتم العثور على تأشيرة صادرة لهذا الجواز والاسم في منصة التأشيرات.",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // 3. Extract Visa Details
  // Typical 10-digit visa number: e.g. 600xxxxxxx or similar
  let visaNumber = "";
  const visaNoMatch = resHtml.match(/رقم التأشيرة[^0-9]*([0-9]{10})/i) ||
    resHtml.match(/Visa\s*No[^0-9]*([0-9]{10})/i) ||
    resHtml.match(/([0-9]{10})/);

  if (visaNoMatch) {
    visaNumber = visaNoMatch[1];
  }

  // Extract Dates if present
  let issueDate = "";
  let expiryDate = "";
  const issueMatch = resHtml.match(/تاريخ الإصدار[^0-9]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i);
  if (issueMatch) issueDate = issueMatch[1];

  const expiryMatch = resHtml.match(/صلاحية التأشيرة[^0-9]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i);
  if (expiryMatch) expiryDate = expiryMatch[1];

  // Return success with extracted visa info and full HTML printable document
  return new Response(
    JSON.stringify({
      success: true,
      visaNumber: visaNumber || undefined,
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
      visaHtml: resHtml,
      status: "Issued",
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}
