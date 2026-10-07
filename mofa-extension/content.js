/**
 * مساعد تأشيرات وزارة الخارجية السعودية (MOFA & KSA VISA Helper)
 * يقوم بتعبئة بيانات المسافر تلقائياً، والتقاط التأشيرة عند صدورها وربطها بنظام إدارة العمرة
 */

(function () {
  console.log("🇸🇦 [MOFA Helper] Extension loaded on:", window.location.href);

  // 1. استخراج أو استرجاع بيانات المسافر الحالية
  function getContext() {
    let ctx = null;

    // أولاً: فحص المعاملات الممررة في رابط الهاش (#)
    if (window.location.hash && window.location.hash.length > 1) {
      try {
        const hashStr = window.location.hash.substring(1);
        const params = new URLSearchParams(hashStr);
        if (params.get("passport") || params.get("travelerId")) {
          ctx = {
            passport: (params.get("passport") || "").trim(),
            name: decodeURIComponent(params.get("name") || "").trim(),
            nationality: (params.get("nat") || "").trim().toUpperCase(),
            travelerId: params.get("travelerId") || "",
            reqId: params.get("reqId") || "",
            autoCapture: params.get("auto") !== "0",
          };
          // حفظها في الجلسة حتى لو أعادت الصفحة التحميل أو تم الانتقال بين الصفحات
          sessionStorage.setItem("safa_mofa_context", JSON.stringify(ctx));
        }
      } catch (err) {
        console.warn("[MOFA Helper] Error parsing hash params:", err);
      }
    }

    // ثانياً: إذا لم تكن في الرابط (نتيجة إرسال النموذج POST/Reload)، نجلبها من الجلسة
    if (!ctx) {
      try {
        const saved = sessionStorage.getItem("safa_mofa_context");
        if (saved) ctx = JSON.parse(saved);
      } catch (e) {}
    }

    return ctx;
  }

  const ctx = getContext();

  // 2. فحص هل الصفحة الحالية هي صفحة نتيجة تأشيرة صادرة
  function detectVisaResult() {
    const href = window.location.href.toLowerCase();
    const bodyText = document.body ? document.body.innerText || "" : "";

    // استثناء صفحات الخطأ
    if (href.includes("handleexception") || href.includes("error")) {
      return null;
    }

    const isPrintedUmrahVisa =
      href.includes("printedumrahvisa") ||
      href.includes("printvisa") ||
      href.includes("umrahvisa");

    const hasVisaKeywords =
      isPrintedUmrahVisa ||
      bodyText.includes("رقم التأشيرة") ||
      (bodyText.includes("تأشيرة") &&
        (bodyText.includes("تاريخ انتهاء") ||
          bodyText.includes("صالحة لغاية") ||
          bodyText.includes("مدة الإقامة") ||
          bodyText.includes("صادرة اعتباراً من"))) ||
      bodyText.includes("Visa No");

    if (!hasVisaKeywords) return null;

    // استخراج رقم التأشيرة المكون عادة من 10 أرقام
    let visaNumber = "";
    const match1 = bodyText.match(/رقم التأشيرة[^\d]*(\d{10})/);
    const match2 = bodyText.match(/Visa No[^\d]*(\d{10})/i);
    const match3 = bodyText.match(/(\d{10})/);

    if (match1) visaNumber = match1[1];
    else if (match2) visaNumber = match2[1];
    else if (match3) visaNumber = match3[1];

    return {
      isVisa: true,
      visaNumber: visaNumber || "",
      html: document.documentElement.outerHTML,
    };
  }

  // 3. محاولة تعبئة حقول نموذج الاستعلام تلقائياً
  function tryAutoFillForm(context) {
    if (!context || !context.passport) return false;

    let filledCount = 0;

    // أ) تحديد خيار البحث (البحث برقم الجواز)
    const searchOptionSelect = document.querySelector(
      'select[name*="SearchOption"], select[id*="SearchOption"], select[id*="SearchType"], #SearchOption, #SearchingType'
    );
    if (searchOptionSelect) {
      for (const opt of searchOptionSelect.options) {
        if (
          opt.text.includes("جواز") ||
          opt.text.includes("Passport") ||
          opt.value === "2"
        ) {
          if (searchOptionSelect.value !== opt.value) {
            searchOptionSelect.value = opt.value;
            searchOptionSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
          break;
        }
      }
    }

    // ب) تعبئة رقم الجواز
    const passportInputs = document.querySelectorAll(
      'input[name*="Passport" i], input[id*="Passport" i], input[name*="passportNo" i], input[placeholder*="جواز"]'
    );
    for (const inp of passportInputs) {
      if (inp.type !== "hidden") {
        inp.value = context.passport;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount++;
      }
    }

    // ج) تعبئة الاسم الأول
    if (context.name) {
      const firstName = context.name.split(" ")[0].trim();
      const nameInputs = document.querySelectorAll(
        'input[name*="FirstName" i], input[id*="FirstName" i], input[name*="FirstApplicantName" i], input[name*="fName" i], input[placeholder*="الاسم الأول"]'
      );
      for (const inp of nameInputs) {
        if (inp.type !== "hidden") {
          inp.value = firstName;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
        }
      }
    }

    // د) اختيار الجنسية
    if (context.nationality) {
      const natSelects = document.querySelectorAll(
        'select[name*="Nationality" i], select[id*="Nationality" i], select[name*="nation" i]'
      );
      for (const sel of natSelects) {
        const natCode = context.nationality;
        for (const opt of sel.options) {
          if (
            opt.value.toUpperCase() === natCode ||
            (natCode === "YEM" && opt.text.includes("اليمن")) ||
            (natCode === "EGY" && opt.text.includes("مصر")) ||
            (natCode === "SDN" && opt.text.includes("السودان")) ||
            (natCode === "JOR" && opt.text.includes("الأردن")) ||
            (natCode === "SYR" && opt.text.includes("سوريا")) ||
            (natCode === "IRQ" && opt.text.includes("العراق"))
          ) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            filledCount++;
            break;
          }
        }
      }
    }

    // هـ) التركيز على حقل الكابتشا تلقائياً
    const captchaInput = document.querySelector(
      'input[name*="Captcha" i], input[id*="Captcha" i], input[name*="code" i], input[maxlength="6"]'
    );
    if (captchaInput) {
      setTimeout(() => {
        captchaInput.focus();
        captchaInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }

    return filledCount > 0;
  }

  // 4. إنشاء واجهة المساعد العائمة (Widget)
  function renderWidget(context, visaInfo) {
    let existing = document.getElementById("mofa-helper-widget");
    if (existing) existing.remove();

    const isExceptionPage = window.location.href.toLowerCase().includes("handleexception");

    const widget = document.createElement("div");
    widget.id = "mofa-helper-widget";

    if (visaInfo && visaInfo.isVisa) {
      // --- حالة: تم العثور على التأشيرة ---
      widget.innerHTML = `
        <div class="mofa-helper-header" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%);">
          <div class="mofa-helper-title">
            <span>🇸🇦 تم العثور على التأشيرة</span>
            <span class="mofa-helper-badge">جاهز للحفظ</span>
          </div>
          <button id="mofa-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="mofa-helper-body">
          <div class="mofa-helper-info-row" style="background: #ecfdf5; border-color: #a7f3d0;">
            <span class="mofa-helper-info-label" style="color: #065f46;">رقم التأشيرة:</span>
            <span class="mofa-helper-info-value" style="color: #064e3b; font-size: 15px; font-weight: bold;">${visaInfo.visaNumber || "مستخرجة من الصفحة"}</span>
          </div>
          ${
            context && context.name
              ? `<div class="mofa-helper-info-row">
                  <span class="mofa-helper-info-label">المسافر:</span>
                  <span class="mofa-helper-info-value" style="font-family: inherit;">${context.name}</span>
                </div>`
              : ""
          }
          <div class="mofa-helper-alert mofa-helper-alert-success">
            <span>✓ تم التقاط التأشيرة بنجاح. اضغط على الزر أدناه لربطها بالمعاملة فوراً.</span>
          </div>
          <div class="mofa-helper-actions">
            <button id="mofa-link-visa-btn" class="mofa-helper-btn mofa-helper-btn-capture">
              <span>💾 ربط وحفظ التأشيرة في النظام الآن</span>
            </button>
          </div>
        </div>
      `;
    } else if (context) {
      // --- حالة: صفحة إدخال البيانات أو صفحة أخرى ---
      widget.innerHTML = `
        <div class="mofa-helper-header">
          <div class="mofa-helper-title">
            <span>🕋 نظام العمرة: مساعد التأشيرات</span>
            <span class="mofa-helper-badge">${isExceptionPage ? "تنبيه" : "تعبئة آلية"}</span>
          </div>
          <button id="mofa-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="mofa-helper-body">
          <div class="mofa-helper-info-row">
            <span class="mofa-helper-info-label">المسافر:</span>
            <span class="mofa-helper-info-value" style="font-family: inherit;">${context.name || "مسافر"}</span>
          </div>
          <div class="mofa-helper-info-row">
            <span class="mofa-helper-info-label">رقم الجواز:</span>
            <span class="mofa-helper-info-value">${context.passport}</span>
          </div>

          ${
            isExceptionPage
              ? `<div class="mofa-helper-alert" style="background:#fffbeb;border-color:#fde68a;color:#92400e;">
                  <span>⚠️ الرابط السابق قديم بالوزارة. اضغط على الزر أدناه للانتقال لصفحة الاستعلام الرئيسية:</span>
                </div>`
              : `<div class="mofa-helper-alert mofa-helper-alert-info">
                  <span>⚡ تم تعبئة البيانات آلياً! إذا كنت في صفحة التأشيرة اضغط "حفظ الصفحة كتأشيرة".</span>
                </div>`
          }

          <div class="mofa-helper-actions">
            ${
              isExceptionPage
                ? `<a href="https://visa.mofa.gov.sa" class="mofa-helper-btn" style="background:#0284c7;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;margin-bottom:6px;">
                    <span>🌐 الانتقال لصفحة الاستعلام الرئيسية</span>
                  </a>`
                : `<button id="mofa-re-fill-btn" class="mofa-helper-btn mofa-helper-btn-secondary" style="margin-bottom:6px;" title="إعادة تعبئة البيانات">
                    <span>🔄 تعبئة الحقول تلقائياً</span>
                  </button>`
            }
            <button id="mofa-manual-capture-btn" class="mofa-helper-btn mofa-helper-btn-capture" title="حفظ هذه الصفحة الحالية كتأشيرة للمسافر">
              <span>💾 حفظ وربط هذه الصفحة كتأشيرة</span>
            </button>
          </div>
        </div>
      `;
    } else {
      return;
    }

    document.body.appendChild(widget);

    // إضافة الأحداث
    const closeBtn = document.getElementById("mofa-close-btn");
    if (closeBtn) closeBtn.onclick = () => widget.remove();

    const reFillBtn = document.getElementById("mofa-re-fill-btn");
    if (reFillBtn) {
      reFillBtn.onclick = () => {
        tryAutoFillForm(context);
        alert("تمت محاولة تعبئة الحقول بنجاح!");
      };
    }

    const manualCaptureBtn = document.getElementById("mofa-manual-capture-btn");
    if (manualCaptureBtn) {
      manualCaptureBtn.onclick = () => {
        let detected = detectVisaResult();
        if (!detected) {
          // استخراج أي رقم 10 أرقام في الصفحة أو سؤال المستخدم
          const match = document.body.innerText.match(/(\d{10})/);
          let promptNum = match ? match[1] : "";
          if (!promptNum) {
            promptNum = prompt("يرجى تأكيد رقم التأشيرة (أو اتركه فارغاً للحفظ كصفحة):", "") || "";
          }
          detected = {
            isVisa: true,
            visaNumber: promptNum,
            html: document.documentElement.outerHTML,
          };
        }
        sendVisaToSystem(context, detected);
      };
    }

    const linkVisaBtn = document.getElementById("mofa-link-visa-btn");
    if (linkVisaBtn) {
      linkVisaBtn.onclick = () => {
        sendVisaToSystem(context, visaInfo);
      };
    }
  }

  // 5. إرسال التأشيرة الملتقطة إلى النظام الرئيسي
  function sendVisaToSystem(context, visaInfo) {
    const payload = {
      source: "MOFA_VISA_EXTENSION",
      type: "VISA_CAPTURED",
      travelerId: context ? context.travelerId : "",
      reqId: context ? context.reqId : "",
      passportNumber: context ? context.passport : "",
      visaNumber: visaInfo ? visaInfo.visaNumber : "",
      visaHtml: visaInfo ? visaInfo.html : document.documentElement.outerHTML,
      timestamp: Date.now(),
    };

    let sent = false;

    // أ) الإرسال عبر window.opener (النافذة الرئيسية للنظام)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, "*");
        sent = true;
      } catch (err) {
        console.warn("[MOFA Helper] Could not postMessage to opener:", err);
      }
    }

    // ب) الحفظ في localStorage المحلي كنسخة احتياطية
    try {
      localStorage.setItem("mofa_last_captured_visa", JSON.stringify(payload));
    } catch (e) {}

    const linkBtn =
      document.getElementById("mofa-link-visa-btn") ||
      document.getElementById("mofa-manual-capture-btn");

    if (linkBtn) {
      linkBtn.innerHTML = "<span>✓ تم ربط التأشيرة بنجاح! جاري الإغلاق...</span>";
      linkBtn.style.background = "#059669";
    }

    // إغلاق النافذة المنبثقة بعد ثانيتين
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 2000);
  }

  // 6. تشغيل الفحص الأولي بعد تحميل الصفحة
  setTimeout(() => {
    const visaResult = detectVisaResult();
    if (visaResult && visaResult.isVisa) {
      console.log("🇸🇦 [MOFA Helper] Visa result detected:", visaResult.visaNumber);
      renderWidget(ctx, visaResult);
    } else if (ctx) {
      tryAutoFillForm(ctx);
      renderWidget(ctx, null);
    }
  }, 700);

  // إعادة الفحص عند أي تحديث في الصفحة (مثل AJAX)
  const observer = new MutationObserver(() => {
    const vResult = detectVisaResult();
    if (vResult && vResult.isVisa && !document.getElementById("mofa-link-visa-btn")) {
      renderWidget(ctx, vResult);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
