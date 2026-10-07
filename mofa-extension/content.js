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
          // حفظها في الجلسة والمخزن المحلي لضمان عدم ضياعها
          sessionStorage.setItem("safa_mofa_context", JSON.stringify(ctx));
          localStorage.setItem("safa_mofa_last_context", JSON.stringify(ctx));
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

    // ثالثاً: فحص آخر مسافر تم طلبه من النظام
    if (!ctx) {
      try {
        const savedLast = localStorage.getItem("safa_mofa_last_context");
        if (savedLast) ctx = JSON.parse(savedLast);
      } catch (e) {}
    }

    return ctx;
  }

  let ctx = getContext();

  // 2. فحص هل الصفحة الحالية هي صفحة نتيجة تأشيرة صادرة فعلية (وليست نموذج استعلام)
  function detectVisaResult() {
    const href = window.location.href.toLowerCase();
    const bodyText = document.body ? document.body.innerText || "" : "";

    // استثناء صفحات الخطأ
    if (href.includes("handleexception") || href.includes("error")) {
      return null;
    }

    // هل الصفحة الحالية تحتوي على نموذج استعلام مفتوح لإدخال البيانات؟
    const hasSearchForm = !!(
      document.getElementById("tbFirstValue") ||
      document.getElementById("ddlFirstValue") ||
      document.getElementById("myform") ||
      document.getElementById("btnSubmit")
    );

    // الروابط المخصصة لعرض وطباعة التأشيرات الصادرة
    const isPrintedVisaUrl =
      href.includes("printedumrahvisa") ||
      href.includes("printvisa") ||
      href.includes("viewvisa") ||
      href.includes("umrahvisa");

    // استخراج رقم التأشيرة المكون من 9-12 رقماً والمرتبط بعبارة صريحة
    let visaNumber = "";
    const match1 = bodyText.match(/رقم التأشيرة[\s:：#]*([1-9]\d{8,11})/);
    const match2 = bodyText.match(/Visa\s*(?:No|Number)[\s:：#]*([1-9]\d{8,11})/i);

    if (match1) visaNumber = match1[1];
    else if (match2) visaNumber = match2[1];

    // مهم جداً: إذا كانت الصفحة تحتوي على حقول نموذج الاستعلام ولم نجد رقم تأشيرة صريح
    // فهذا نموذج استعلام ويجب إرجاع null حتى تظهر واجهة وأزرار تعبئة النموذج!
    if (hasSearchForm && !visaNumber) {
      return null;
    }

    // فحص كلمات دلالية مميزة لوثيقة التأشيرة الفعلية الصادرة
    const hasOfficialVisaKeywords =
      isPrintedVisaUrl ||
      visaNumber !== "" ||
      ((bodyText.includes("تاريخ انتهاء") ||
        bodyText.includes("صالحة لغاية") ||
        bodyText.includes("مدة الإقامة") ||
        bodyText.includes("صادرة اعتباراً من")) &&
        (bodyText.includes("تأشيرة") || bodyText.includes("Visa")));

    if (!hasOfficialVisaKeywords) {
      return null;
    }

    // إذا تم التأكد أنها صفحة تأشيرة ولكن لم نلتقط الرقم بالنمط أعلاه
    if (!visaNumber) {
      const matchGeneral = bodyText.match(/([1-9]\d{9})/);
      if (matchGeneral) visaNumber = matchGeneral[1];
    }

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
    const passport = (context.passport || "").trim();
    const firstName = (context.name || "").trim().split(/\s+/)[0] || "";
    const targetNat = (context.nationality || "EGY").trim().toUpperCase();

    // 0) معالجة نموذج صفحة استعلام التأشيرة الرسمية (/visaservices/searchvisa)
    const ddl1 = document.getElementById("ddlFirstValue");
    const tb1 = document.getElementById("tbFirstValue");
    const ddl2 = document.getElementById("ddlSecondValue");
    const tb2 = document.getElementById("tbSecondValue");
    const natIdSelect = document.getElementById("NationalityId");

    let matchedNatVal = "";
    let matchedNatText = "";

    // القيمة الأولى: رقم الجواز PassPortNo
    if (ddl1) {
      ddl1.value = "PassPortNo";
      ddl1.dispatchEvent(new Event("change", { bubbles: true }));
      ddl1.dispatchEvent(new Event("blur", { bubbles: true }));
      filledCount++;
    }

    if (tb1 && passport) {
      tb1.value = passport;
      tb1.dispatchEvent(new Event("input", { bubbles: true }));
      tb1.dispatchEvent(new Event("change", { bubbles: true }));
      tb1.dispatchEvent(new Event("blur", { bubbles: true }));
      tb1.style.borderColor = "#10b981";
      tb1.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.3)";
      filledCount++;
    }

    // القيمة الثانية: الاسم الأول fName
    if (ddl2) {
      ddl2.value = "fName";
      ddl2.dispatchEvent(new Event("change", { bubbles: true }));
      ddl2.dispatchEvent(new Event("blur", { bubbles: true }));
      filledCount++;
    }

    if (tb2 && firstName) {
      tb2.value = firstName;
      tb2.dispatchEvent(new Event("input", { bubbles: true }));
      tb2.dispatchEvent(new Event("change", { bubbles: true }));
      tb2.dispatchEvent(new Event("blur", { bubbles: true }));
      tb2.style.borderColor = "#10b981";
      tb2.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.3)";
      filledCount++;
    }

    // الجنسية
    if (natIdSelect) {
      for (const opt of natIdSelect.options) {
        const val = (opt.value || "").trim().toUpperCase();
        const txt = (opt.text || "").trim();
        if (
          val === targetNat ||
          (targetNat === "EGY" && (txt.includes("مصر") || val === "120" || val === "EGY")) ||
          (targetNat === "YEM" && (txt.includes("يمن") || val === "YEM")) ||
          (targetNat === "SDN" && (txt.includes("سودان") || val === "SDN")) ||
          (targetNat === "JOR" && (txt.includes("أردن") || txt.includes("اردن") || val === "JOR")) ||
          (targetNat === "SYR" && (txt.includes("سوري") || val === "SYR")) ||
          (targetNat === "IRQ" && (txt.includes("عراق") || val === "IRQ")) ||
          (targetNat === "SAU" && (txt.includes("سعودي") || val === "SAU")) ||
          txt.toUpperCase().includes(targetNat)
        ) {
          matchedNatVal = opt.value;
          matchedNatText = opt.text;
          natIdSelect.value = opt.value;
          natIdSelect.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
      }

      // تحديث مظهر Select2
      const select2Chosen = document.querySelector("#s2id_NationalityId .select2-chosen");
      if (select2Chosen && matchedNatText) {
        select2Chosen.innerText = matchedNatText;
      }
      filledCount++;
    }

    // حقن كود خفيف لتنفيذ أوامر jQuery / Select2 في نطاق الصفحة الأصلي
    try {
      const inlineCode = `
        (function() {
          try {
            var jq = window.jQuery || window.$;
            if (jq) {
              if (jq('#ddlFirstValue').length) jq('#ddlFirstValue').val('PassPortNo').trigger('change');
              if (jq('#tbFirstValue').length) jq('#tbFirstValue').val(${JSON.stringify(passport)}).trigger('input').trigger('change');
              if (jq('#ddlSecondValue').length) jq('#ddlSecondValue').val('fName').trigger('change');
              if (jq('#tbSecondValue').length) jq('#tbSecondValue').val(${JSON.stringify(firstName)}).trigger('input').trigger('change');
              if (jq('#NationalityId').length && ${JSON.stringify(matchedNatVal)}) {
                jq('#NationalityId').val(${JSON.stringify(matchedNatVal)}).trigger('change');
                if (typeof jq('#NationalityId').select2 === 'function') {
                  jq('#NationalityId').select2('val', ${JSON.stringify(matchedNatVal)});
                }
              }
            }
          } catch(e) {}
        })();
      `;
      const scriptEl = document.createElement("script");
      scriptEl.textContent = inlineCode;
      (document.head || document.documentElement).appendChild(scriptEl);
      scriptEl.remove();
    } catch (e) {}

    // التعامل مع النماذج الأخرى الممكنة (مثل الصفحة الرئيسية أو ksavisa.sa)
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

    const passportInputs = document.querySelectorAll(
      'input[name*="Passport" i], input[id*="Passport" i], input[name*="passportNo" i], input[placeholder*="جواز"]'
    );
    for (const inp of passportInputs) {
      if (inp.type !== "hidden" && inp.id !== "tbFirstValue") {
        inp.value = passport;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount++;
      }
    }

    if (firstName) {
      const nameInputs = document.querySelectorAll(
        'input[name*="FirstName" i], input[id*="FirstName" i], input[name*="FirstApplicantName" i], input[name*="fName" i], input[placeholder*="الاسم الأول"]'
      );
      for (const inp of nameInputs) {
        if (inp.type !== "hidden" && inp.id !== "tbSecondValue") {
          inp.value = firstName;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
        }
      }
    }

    // التركيز التلقائي على حقل الكابتشا
    const captchaInput =
      document.getElementById("Captcha") ||
      document.querySelector('input[name*="Captcha" i], input[id*="Captcha" i], input[name*="code" i], input[maxlength="6"]');
    if (captchaInput) {
      setTimeout(() => {
        captchaInput.focus();
        captchaInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
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
    } else {
      // --- حالة: صفحة إدخال البيانات أو صفحة البحث (/searchvisa) ---
      widget.innerHTML = `
        <div class="mofa-helper-header">
          <div class="mofa-helper-title">
            <span>🕋 نظام العمرة: مساعد التأشيرات</span>
            <span class="mofa-helper-badge">${context ? "بيانات جاهزة" : "استعلام"}</span>
          </div>
          <button id="mofa-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="mofa-helper-body">
          ${
            context
              ? `
              <div class="mofa-helper-info-row">
                <span class="mofa-helper-info-label">المسافر:</span>
                <span class="mofa-helper-info-value" style="font-family: inherit;">${context.name || "مسافر"}</span>
              </div>
              <div class="mofa-helper-info-row">
                <span class="mofa-helper-info-label">رقم الجواز:</span>
                <span class="mofa-helper-info-value">${context.passport}</span>
              </div>
              <div class="mofa-helper-info-row">
                <span class="mofa-helper-info-label">الجنسية:</span>
                <span class="mofa-helper-info-value">${context.nationality || "EGY"}</span>
              </div>

              <!-- الزر الرئيسي البارز لملء البيانات -->
              <button id="mofa-fill-action-btn" class="mofa-helper-btn" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; font-size: 14px; font-weight: bold; padding: 12px 14px; margin-top: 4px; margin-bottom: 2px; width: 100%; border-radius: 10px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);">
                <span style="font-size: 16px;">⚡</span>
                <span id="mofa-fill-action-text">ملء بيانات المسافر في النموذج الآن</span>
              </button>

              <div class="mofa-helper-alert mofa-helper-alert-info">
                <span>⚡ تم ملء الحقول تلقائياً. اكتب رمز التحقق (الكابتشا) ثم اضغط "بحث".</span>
              </div>
              `
              : `
              <div class="mofa-helper-alert" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;">
                <span>ℹ️ لم يتم تحديد بيانات مسافر في الرابط. افتح الاستعلام من زر (الاستعلام في الوزارة) في صفحة الطلب لملء البيانات تلقائياً.</span>
              </div>
              `
          }

          ${
            isExceptionPage
              ? `<a href="https://visa.mofa.gov.sa/visaservices/searchvisa" class="mofa-helper-btn" style="background:#0284c7;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;margin-top:6px;">
                  <span>🌐 الانتقال لصفحة استعلام التأشيرة</span>
                </a>`
              : ""
          }

          <div class="mofa-helper-actions" style="margin-top: 4px;">
            <button id="mofa-manual-capture-btn" class="mofa-helper-btn mofa-helper-btn-secondary" style="font-size: 12px; padding: 8px 12px;" title="حفظ هذه الصفحة الحالية كتأشيرة للمسافر">
              <span>💾 حفظ وربط هذه الصفحة كتأشيرة</span>
            </button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(widget);

    // إضافة الأحداث
    const closeBtn = document.getElementById("mofa-close-btn");
    if (closeBtn) closeBtn.onclick = () => widget.remove();

    const fillActionBtn = document.getElementById("mofa-fill-action-btn");
    if (fillActionBtn) {
      fillActionBtn.onclick = () => {
        tryAutoFillForm(context);
        const textSpan = document.getElementById("mofa-fill-action-text");
        if (textSpan) textSpan.innerText = "✓ تم ملء بيانات المسافر بنجاح!";
        fillActionBtn.style.background = "#059669";
        setTimeout(() => {
          if (textSpan) textSpan.innerText = "ملء بيانات المسافر في النموذج الآن";
          fillActionBtn.style.background = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)";
        }, 2200);
      };
    }

    const manualCaptureBtn = document.getElementById("mofa-manual-capture-btn");
    if (manualCaptureBtn) {
      manualCaptureBtn.onclick = () => {
        let detected = detectVisaResult();
        if (!detected) {
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

    // أ) الإرسال عبر window.opener (النافذة الرئيسية لنظام العمرة)
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

    // إغلاق النافذة بعد ثانيتين
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 2000);
  }

  // 6. تشغيل الفحص الأولي والتعبئة
  function checkAndInit() {
    ctx = getContext();
    const visaResult = detectVisaResult();
    if (visaResult && visaResult.isVisa) {
      console.log("🇸🇦 [MOFA Helper] Visa result detected:", visaResult.visaNumber);
      renderWidget(ctx, visaResult);
    } else {
      if (ctx) {
        tryAutoFillForm(ctx);
      }
      renderWidget(ctx, null);
    }
  }

  // تنفيذ فوري وعلى فترات لضمان عدم الكتابة فوق البيانات عند $(window).load
  setTimeout(checkAndInit, 400);
  setTimeout(() => {
    if (ctx && !detectVisaResult()) {
      tryAutoFillForm(ctx);
    }
  }, 1200);
  setTimeout(() => {
    if (ctx && !detectVisaResult()) {
      tryAutoFillForm(ctx);
    }
  }, 2500);

  // مراقبة الصفحة لأي تحديثات مثل ظهور التأشيرة بعد البحث
  let lastStateIsVisa = false;
  const observer = new MutationObserver(() => {
    const vResult = detectVisaResult();
    if (vResult && vResult.isVisa && !lastStateIsVisa) {
      lastStateIsVisa = true;
      renderWidget(ctx, vResult);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
