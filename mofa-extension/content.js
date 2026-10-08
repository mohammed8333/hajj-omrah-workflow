/**
 * مساعد استعلام تأشيرات وزارة الخارجية بالذكاء الاصطناعي (MOFA AI Visa Assistant)
 * مدعوم بنموذج Google Gemini Vision لحل الكابتشا آلياً وتعبئة واستخراج التأشيرة الرسمية
 */

(function () {
  console.log("🇸🇦 [MOFA AI] Extension loaded on:", window.location.href);

  // مفتاح Gemini الافتراضي
  const DEFAULT_GEMINI_KEY = atob("QVEuQWI4Uk42TDE3RFJMbFRsSlNLMlNKOUxsMGE5Um9ENUQ5cXgwX2RKa3BLOHBwRlB1c1E=");
  const GEMINI_MODEL = "gemini-3.6-flash";

  let ctx = null;
  let isSolvingCaptcha = false;
  let lastSolvedCaptcha = "";

  // 1. استخراج بيانات المسافر من رابط الهاش (#) أو التخزين المؤقت
  function getContext() {
    let current = null;
    if (window.location.hash && window.location.hash.length > 1) {
      try {
        const hashStr = window.location.hash.substring(1);
        const params = new URLSearchParams(hashStr);
        if (params.get("passport") || params.get("travelerId")) {
          current = {
            passport: (params.get("passport") || "").trim(),
            name: decodeURIComponent(params.get("name") || "").trim(),
            nationality: (params.get("nat") || "EGY").trim().toUpperCase(),
            travelerId: params.get("travelerId") || "",
            reqId: params.get("reqId") || "",
            autoSubmit: params.get("auto") === "1",
          };
          sessionStorage.setItem("safa_mofa_context", JSON.stringify(current));
          localStorage.setItem("safa_mofa_last_context", JSON.stringify(current));
        }
      } catch (e) {}
    }

    if (!current) {
      try {
        const saved = sessionStorage.getItem("safa_mofa_context");
        if (saved) current = JSON.parse(saved);
      } catch (e) {}
    }

    if (!current) {
      try {
        const savedLast = localStorage.getItem("safa_mofa_last_context");
        if (savedLast) current = JSON.parse(savedLast);
      } catch (e) {}
    }

    return current;
  }

  // 2. إزالة أي رسائل خطأ للجنسية
  function purgeNationalityError() {
    try {
      const errs = document.querySelectorAll(
        'label[for="NationalityId"], #NationalityId-error, .col-md-3 label.error, span[data-valmsg-for="NationalityId"]'
      );
      errs.forEach((el) => {
        el.style.setProperty("display", "none", "important");
        el.textContent = "";
        el.remove();
      });

      const natContainer = document.getElementById("select2-NationalityId-container");
      if (natContainer) {
        const parentCol = natContainer.closest(".col-md-3") || natContainer.closest(".form-group") || natContainer.parentElement;
        if (parentCol) {
          parentCol.querySelectorAll("*").forEach((el) => {
            if (
              el !== natContainer &&
              !el.classList.contains("select2-selection__rendered") &&
              el.textContent &&
              el.textContent.includes("حقل إجباري")
            ) {
              el.style.setProperty("display", "none", "important");
              el.textContent = "";
              el.remove();
            }
          });
        }
      }

      const natSelect = document.getElementById("NationalityId");
      if (natSelect) {
        natSelect.classList.remove("error");
        natSelect.classList.add("valid");
        natSelect.setAttribute("aria-invalid", "false");
      }
    } catch (e) {}
  }

  // 3. ملء بيانات المسافر في صفحة الاستعلام مباشرة عبر الـ DOM بدون حقن script (تجنباً لـ CSP)
  function applyFormFill(context) {
    if (!context) return false;

    const passport = (context.passport || "").trim();
    const firstName = (context.name || "").trim().split(/\s+/)[0] || "";
    const targetNat = (context.nationality || "EGY").trim().toUpperCase();

    const ddl1 = document.getElementById("ddlFirstValue");
    const tb1 = document.getElementById("tbFirstValue");
    const ddl2 = document.getElementById("ddlSecondValue");
    const tb2 = document.getElementById("tbSecondValue");
    const natSelect = document.getElementById("NationalityId");
    const natContainer = document.getElementById("select2-NationalityId-container");

    if (ddl1) {
      ddl1.value = "PassPortNo";
      ddl1.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (tb1 && passport) {
      tb1.value = passport;
      tb1.setAttribute("value", passport);
      tb1.classList.remove("error");
      tb1.classList.add("valid");
      tb1.setAttribute("aria-invalid", "false");
      tb1.dispatchEvent(new Event("input", { bubbles: true }));
      tb1.dispatchEvent(new Event("change", { bubbles: true }));
      tb1.style.borderColor = "#10b981";
      tb1.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.3)";
    }

    if (ddl2) {
      ddl2.value = "fName";
      ddl2.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (tb2 && firstName) {
      tb2.value = firstName;
      tb2.setAttribute("value", firstName);
      tb2.classList.remove("error");
      tb2.classList.add("valid");
      tb2.setAttribute("aria-invalid", "false");
      tb2.dispatchEvent(new Event("input", { bubbles: true }));
      tb2.dispatchEvent(new Event("change", { bubbles: true }));
      tb2.style.borderColor = "#10b981";
      tb2.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.3)";
    }

    if (natSelect) {
      natSelect.value = targetNat === "EGY" ? "EGY" : targetNat;
      Array.from(natSelect.options).forEach((opt) => {
        if (opt.value === targetNat) {
          opt.selected = true;
          opt.setAttribute("selected", "selected");
        } else {
          opt.selected = false;
          opt.removeAttribute("selected");
        }
      });
      natSelect.classList.remove("error");
      natSelect.classList.add("valid");
      natSelect.setAttribute("aria-invalid", "false");
      natSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (natContainer) {
      natContainer.setAttribute("title", "مصر");
      natContainer.setAttribute("aria-readonly", "true");
      natContainer.innerHTML = '<span class="select2-selection__clear" title="قم بإزالة كل العناصر">×</span>مصر';
    }

    purgeNationalityError();
    return true;
  }

  // فحص دقيق وشامل لما إذا كانت الكابتشا موجودة وظاهرة في الصفحة
  function getCaptchaElements() {
    const input = document.querySelector(
      "#Captcha, #txtCaptcha, input[name='Captcha'], input[name*='captcha' i]"
    );
    const img = document.querySelector(
      "#imgCaptcha, #CaptchaImage, img[src*='Captcha'], img[src*='captcha'], [id*='captcha' i] img"
    );

    const isVisible = (el) => {
      if (!el) return false;
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
      } catch (e) {
        return true;
      }
    };

    const hasInput = input && isVisible(input);
    const hasImg = img && isVisible(img);

    return {
      exists: !!(hasInput || hasImg),
      input: hasInput ? input : null,
      img: hasImg ? img : (img || null),
    };
  }

  // الضغط على زر الاستعلام المعتمد
  function submitSearchForm() {
    if (ctx) applyFormFill(ctx);
    const submitBtn = document.querySelector(
      "#btnSubmit, input[type='submit'], button[type='submit'], #btnSearch, .btn-submit"
    );
    if (submitBtn) {
      console.log("🇸🇦 [MOFA AI] Submitting search form via button click:", submitBtn);
      submitBtn.click();
    } else {
      const form = document.querySelector("form");
      if (form) {
        console.log("🇸🇦 [MOFA AI] Submitting search form directly...");
        form.submit();
      }
    }
  }

  // 4. معالجة الكابتشا بذكاء (التحقق من وجودها أولاً: لو مش موجودة يكمل علطول، ولو موجودة يحلها ويكمل)
  async function solveCaptchaWithAi() {
    const captchaInfo = getCaptchaElements();

    // حالة: لا توجد كابتشا في الصفحة نهائياً -> إكمال فوري!
    if (!captchaInfo.exists) {
      console.log("🇸🇦 [MOFA AI] No captcha required/visible on this page. Proceeding directly...");
      updateWidgetCaptchaStatus("✓ لا توجد كابتشا مطلوبة - تم التجاوز بنجاح", "#059669");
      const digitsRow = document.getElementById("mofa-captcha-digits-row");
      if (digitsRow) digitsRow.style.display = "none";

      if (ctx && ctx.autoSubmit) {
        setTimeout(submitSearchForm, 400);
      }
      return;
    }

    if (isSolvingCaptcha) return;

    const captchaImg = captchaInfo.img;
    if (!captchaImg) {
      updateWidgetCaptchaStatus("⚠️ الكابتشا مطلوبة ولكن لم تظهر صورتها بعد", "#d97706");
      return;
    }

    if (!captchaImg.complete || captchaImg.naturalWidth === 0) {
      captchaImg.onload = () => solveCaptchaWithAi();
      setTimeout(solveCaptchaWithAi, 600);
      return;
    }

    isSolvingCaptcha = true;
    updateWidgetCaptchaStatus("جاري قراءة الكابتشا بواسطة Gemini AI...", "#0284c7");

    try {
      // تحويل الصورة إلى base64
      const canvas = document.createElement("canvas");
      canvas.width = captchaImg.naturalWidth || 200;
      canvas.height = captchaImg.naturalHeight || 80;
      const cctx = canvas.getContext("2d");
      cctx.drawImage(captchaImg, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.split(",")[1];

      const apiKey = localStorage.getItem("mofa_gemini_key") || DEFAULT_GEMINI_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: "اقرأ الأرقام الموجودة في هذه الصورة فقط. أرجع الأرقام كإجابة نهائية بدون أي نصوص إضافية أو مسافات."
              },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: base64Data
                }
              }
            ]
          }
        ]
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const digitsOnly = rawText.replace(/\D/g, "").trim();

      if (digitsOnly && digitsOnly.length >= 4) {
        console.log("🇸🇦 [MOFA AI] Captcha solved by Gemini:", digitsOnly);
        lastSolvedCaptcha = digitsOnly;

        const pageCaptchaInput =
          captchaInfo.input ||
          document.querySelector("#Captcha, input[name='Captcha'], input[name*='captcha' i]");

        if (pageCaptchaInput) {
          pageCaptchaInput.value = digitsOnly;
          pageCaptchaInput.dispatchEvent(new Event("input", { bubbles: true }));
          pageCaptchaInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        updateWidgetCaptchaStatus(`✓ نجح الذكاء الاصطناعي: ${digitsOnly}`, "#059669", digitsOnly);

        // إذا كان الاستعلام التلقائي مفعلاً، يتم الضغط على استعلام فوراً
        if (ctx && ctx.autoSubmit) {
          setTimeout(() => {
            console.log("🇸🇦 [MOFA AI] Auto-submitting search with solved captcha...");
            submitSearchForm();
          }, 500);
        }
      } else {
        updateWidgetCaptchaStatus("⚠️ تعذر التعرف بدقة، انقر لإعادة المحاولة", "#d97706");
      }
    } catch (err) {
      console.warn("🇸🇦 [MOFA AI] Error solving captcha with AI:", err);
      updateWidgetCaptchaStatus("خطأ في الاتصال بالذكاء الاصطناعي", "#dc2626");
    } finally {
      isSolvingCaptcha = false;
    }
  }

  function updateWidgetCaptchaStatus(text, color, digits) {
    const statusEl = document.getElementById("mofa-ai-captcha-status");
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.style.color = color || "#059669";
    }
    const valEl = document.getElementById("mofa-ai-captcha-val");
    if (valEl && digits) {
      valEl.textContent = digits;
    }
    const widgetInput = document.getElementById("mofa-ai-captcha-input");
    if (widgetInput && digits) {
      widgetInput.value = digits;
    }
  }

  // 5. فحص ما إذا كانت الصفحة هي صفحة النتيجة (ظهور التأشيرة)
  function detectVisaResult() {
    const text = document.body ? document.body.innerText : "";
    const isVisa =
      document.querySelector(".evisa-container, .responsive-container, [id*='VisaContainer']") !== null ||
      (text.includes("رقم التأشيرة") && (text.includes("تاريخ الإصدار") || text.includes("صلاحية التأشيرة")));

    if (!isVisa) return null;

    let visaNumber = "";
    const match = text.match(/رقم التأشيرة\s*[:：]?\s*(\d{8,12})/);
    if (match) visaNumber = match[1];
    else {
      const match2 = text.match(/(\d{10})/);
      if (match2) visaNumber = match2[1];
    }

    return {
      isVisa: true,
      visaNumber: visaNumber,
      html: getCleanVisaHtml(),
    };
  }

  // 6. تجهيز كود التأشيرة النظيف مع تلوين التحذير بالأحمر تماماً كما في visa.py
  function getCleanVisaHtml() {
    try {
      // تطبيق التعديل السحري على الصفحة الحالية لتلوين "غير مصرح بالحج" بالأحمر
      applyPagePrintDecorations();

      const clone = document.documentElement.cloneNode(true);
      const selectorsToRemove = [
        "#mofa-ai-widget",
        ".page-header",
        ".page-head",
        ".page-header-top",
        ".page-header-menu",
        ".pre-footer",
        ".page-footer",
        ".cookiealert",
        ".banner-beta",
        ".hidden-print",
        ".scroll-to-top",
        "script",
        "noscript",
      ];
      selectorsToRemove.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });

      return "<!DOCTYPE html>\n" + clone.outerHTML;
    } catch (e) {
      return document.documentElement.outerHTML;
    }
  }

  // 7. تحسين وتنسيق التأشيرة للطباعة (مطابق تماماً لـ visa.py)
  function applyPagePrintDecorations() {
    try {
      // 1. إخفاء إشعارات الكوكيز والنسخة التجريبية
      document.querySelectorAll("div, header").forEach((el) => {
        const txt = el.innerText || "";
        if ((txt.includes("ملفات الارتباط") || txt.includes("النسخة التجريبية")) && txt.length < 300) {
          el.style.display = "none";
        }
      });

      // 2. تلوين سطر التحذير "غير مصرح بالحج" بالأحمر إجبارياً
      document.querySelectorAll("span, div, p, td, font").forEach((el) => {
        const txt = el.innerText || "";
        if (txt.includes("غير مصرح بالحج") || txt.includes("Not permitted for Hajj")) {
          el.style.setProperty("color", "#ff0000", "important");
          el.style.setProperty("font-weight", "bold", "important");
        }
      });
    } catch (e) {}
  }

  // 8. إنشاء واجهة المساعد العائم
  function renderWidget(context, visaInfo) {
    let existing = document.getElementById("mofa-ai-widget");
    if (existing) existing.remove();

    const widget = document.createElement("div");
    widget.id = "mofa-ai-widget";

    if (visaInfo && visaInfo.isVisa) {
      // --- حالة: تم العثور على التأشيرة ---
      applyPagePrintDecorations();

      widget.innerHTML = `
        <div class="mofa-header">
          <div class="mofa-header-title">
            <span>🇸🇦 تم استخراج التأشيرة بنجاح</span>
            <span class="mofa-badge">جاهز</span>
          </div>
          <button id="mofa-close-btn" class="mofa-close-btn">✕</button>
        </div>
        <div class="mofa-body">
          <div class="mofa-info-card" style="background:#ecfdf5; border-color:#a7f3d0;">
            <div class="mofa-info-row">
              <span class="mofa-info-label" style="color:#065f46;">رقم التأشيرة:</span>
              <span class="mofa-info-value" style="color:#064e3b; font-size:16px; font-family:monospace;">${visaInfo.visaNumber || "مستخرج"}</span>
            </div>
            ${context && context.name ? `
              <div class="mofa-info-row">
                <span class="mofa-info-label">المسافر:</span>
                <span class="mofa-info-value">${context.name}</span>
              </div>
            ` : ""}
          </div>

          <button id="mofa-save-system-btn" class="mofa-btn mofa-btn-capture">
            <span>💾 ربط وحفظ التأشيرة في النظام فوراً</span>
          </button>

          <button id="mofa-print-pdf-btn" class="mofa-btn mofa-btn-print">
            <span>🖨️ طباعة التأشيرة كـ PDF رسمي (ملون)</span>
          </button>
        </div>
      `;

      document.body.appendChild(widget);

      document.getElementById("mofa-close-btn").onclick = () => widget.remove();
      document.getElementById("mofa-print-pdf-btn").onclick = () => triggerDownloadPdf(context, visaInfo);
      document.getElementById("mofa-save-system-btn").onclick = () => sendVisaToSystem(context, visaInfo);

    } else {
      // --- حالة: صفحة إدخال البيانات ---
      const passportVal = context ? context.passport : "";
      const nameVal = context ? context.name : "";
      const firstNameVal = nameVal ? nameVal.split(" ")[0].trim() : "";

      widget.innerHTML = `
        <div class="mofa-header">
          <div class="mofa-header-title">
            <span>🕋 مساعد التأشيرات الذكي (AI)</span>
            <span class="mofa-badge">Gemini</span>
          </div>
          <button id="mofa-close-btn" class="mofa-close-btn">✕</button>
        </div>
        <div class="mofa-body">
          <div class="mofa-info-card">
            <div class="mofa-info-row">
              <span class="mofa-info-label">رقم الجواز:</span>
              <span class="mofa-info-value" style="font-family:monospace;">${passportVal || "غير محدد"}</span>
            </div>
            <div class="mofa-info-row">
              <span class="mofa-info-label">الاسم الأول:</span>
              <span class="mofa-info-value">${firstNameVal || nameVal || "غير محدد"}</span>
            </div>
            <div class="mofa-info-row">
              <span class="mofa-info-label">الجنسية:</span>
              <span class="mofa-info-value" style="color:#0284c7;">مصر (EGY)</span>
            </div>
          </div>

          <!-- بطاقة الكابتشا الذكية -->
          <div class="mofa-captcha-box" id="mofa-captcha-container">
            <div class="mofa-captcha-status" id="mofa-ai-captcha-status" style="color:#0284c7;">
              <span>🔍 جاري فحص وجود الكابتشا...</span>
            </div>
            <div class="mofa-captcha-display" id="mofa-captcha-digits-row">
              <span style="font-size:12px; color:#64748b; font-weight:600;">رمز الكابتشا:</span>
              <span id="mofa-ai-captcha-val" class="mofa-captcha-val">${lastSolvedCaptcha || "------"}</span>
              <button id="mofa-retry-ai-btn" type="button" style="background:#e2e8f0; border:none; border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer;" title="إعادة المحاولة">
                🔄 إعادة القراءة
              </button>
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button id="mofa-fill-again-btn" class="mofa-btn mofa-btn-secondary" style="flex:1;">
              <span>⚡ تعبئة الحقول</span>
            </button>
            <button id="mofa-submit-search-btn" class="mofa-btn mofa-btn-primary" style="flex:1.5;">
              <span>🔍 استعلام الآن</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(widget);

      document.getElementById("mofa-close-btn").onclick = () => widget.remove();

      document.getElementById("mofa-fill-again-btn").onclick = () => {
        applyFormFill(context);
        solveCaptchaWithAi();
      };

      document.getElementById("mofa-retry-ai-btn").onclick = () => {
        const refreshBtn = document.querySelector("#btnRefreshCaptcha, [id*='RefreshCaptcha' i], .btn-refresh-captcha");
        if (refreshBtn) refreshBtn.click();
        setTimeout(solveCaptchaWithAi, 600);
      };

      document.getElementById("mofa-submit-search-btn").onclick = () => {
        applyFormFill(context);
        const submitBtn = document.getElementById("btnSubmit");
        if (submitBtn) submitBtn.click();
      };
    }
  }

  function downloadBase64Pdf(base64Data, fileName) {
    const linkSource = `data:application/pdf;base64,${base64Data}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = linkSource;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  function triggerDownloadPdf(context, visaInfo) {
    applyPagePrintDecorations();
    const btn = document.getElementById("mofa-print-pdf-btn");
    if (btn) btn.innerHTML = "<span>⏳ جاري إعداد PDF...</span>";

    try {
      chrome.runtime.sendMessage({ action: "GENERATE_PDF" }, (response) => {
        if (btn) btn.innerHTML = "<span>🖨️ طباعة / حفظ PDF</span>";
        if (response && response.success && response.base64Pdf) {
          const pNum = (context && context.passport) || (visaInfo && visaInfo.visaNumber) || "visa";
          downloadBase64Pdf(response.base64Pdf, `Visa_${pNum}.pdf`);
        } else {
          window.print();
        }
      });
    } catch (e) {
      if (btn) btn.innerHTML = "<span>🖨️ طباعة / حفظ PDF</span>";
      window.print();
    }
  }

  // 9. إرسال التأشيرة الملتقطة للنافذة الرئيسية (النظام) كملف PDF رسمي
  async function sendVisaToSystem(context, visaInfo) {
    const saveBtn = document.getElementById("mofa-save-system-btn");
    if (saveBtn) {
      saveBtn.innerHTML = "<span>⏳ جاري توليد ملف الـ PDF وحفظه بالنظام...</span>";
      saveBtn.style.background = "#0284c7";
    }

    applyPagePrintDecorations();

    // نطلب توليد PDF رسمي عالي الدقة عبر الـ Service Worker (CDP Page.printToPDF)
    let pdfBase64 = null;
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "GENERATE_PDF" }, (res) => resolve(res));
      });
      if (response && response.success && response.base64Pdf) {
        pdfBase64 = response.base64Pdf;
      }
    } catch (e) {
      console.warn("[MOFA AI] CDP PDF generation failed:", e);
    }

    const payload = {
      source: "MOFA_VISA_EXTENSION",
      type: "VISA_CAPTURED",
      travelerId: context ? context.travelerId : "",
      reqId: context ? context.reqId : "",
      passportNumber: context ? context.passport : "",
      visaNumber: visaInfo ? visaInfo.visaNumber : "",
      visaPdfBase64: pdfBase64, // ملف الـ PDF الرسمي عالي الدقة
      visaHtml: visaInfo ? visaInfo.html : getCleanVisaHtml(),
      timestamp: Date.now(),
    };

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, "*");
      } catch (err) {}
    }

    try {
      localStorage.setItem("mofa_last_captured_visa", JSON.stringify(payload));
    } catch (e) {}

    if (saveBtn) {
      saveBtn.innerHTML = "<span>✓ تم ربط ملف التأشيرة (PDF) بنجاح بالمعاملة!</span>";
      saveBtn.style.background = "#059669";
    }

    setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 1500);
  }

  // 10. بدء التشغيل التلقائي
  function init() {
    ctx = getContext();
    const visaResult = detectVisaResult();

    if (visaResult && visaResult.isVisa) {
      renderWidget(ctx, visaResult);
    } else {
      if (ctx) {
        applyFormFill(ctx);
      }
      renderWidget(ctx, null);

      // فحص الكابتشا الذكي:
      // إذا لم تكن موجودة نهائياً يتم الاستعلام مباشرة فوراً
      // وإذا كانت موجودة يتم قراءتها بالذكاء الاصطناعي وكتابتها ثم الاستعلام
      setTimeout(() => {
        const captchaInfo = getCaptchaElements();
        if (!captchaInfo.exists) {
          console.log("🇸🇦 [MOFA AI] No captcha required/visible on this page. Auto-submitting directly...");
          updateWidgetCaptchaStatus("✓ لا توجد كابتشا مطلوبة - استعلام فوري", "#059669");
          const digitsRow = document.getElementById("mofa-captcha-digits-row");
          if (digitsRow) digitsRow.style.display = "none";

          if (ctx && ctx.autoSubmit) {
            setTimeout(submitSearchForm, 400);
          }
        } else {
          solveCaptchaWithAi();
        }
      }, 700);
    }
  }

  setTimeout(init, 300);

  // مراقبة تحديث الصفحة أو ظهور التأشيرة بعد الاستعلام
  let lastWasVisa = false;
  const observer = new MutationObserver(() => {
    purgeNationalityError();
    const vResult = detectVisaResult();
    if (vResult && vResult.isVisa && !lastWasVisa) {
      lastWasVisa = true;
      renderWidget(ctx, vResult);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
