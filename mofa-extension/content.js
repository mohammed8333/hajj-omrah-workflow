/**
 * مساعد تأشيرات وزارة الخارجية السعودية (MOFA & KSA VISA Helper)
 * يقوم بتعبئة بيانات المسافر تلقائياً، قراءة وعرض الكابتشا، والتقاط التأشيرة عند صدورها
 */

(function () {
  console.log("🇸🇦 [MOFA Helper] Extension loaded on:", window.location.href);

  // حقن نمط CSS لمنع ظهور أي رسائل خطأ للجنسية نهائياً
  try {
    const hideNatErrorStyle = document.createElement("style");
    hideNatErrorStyle.id = "mofa-hide-nat-error-css";
    hideNatErrorStyle.textContent = `
      label[for="NationalityId"],
      label#NationalityId-error,
      #NationalityId-error,
      label.error[for="NationalityId"],
      .col-md-3 label.error,
      span[data-valmsg-for="NationalityId"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        font-size: 0 !important;
        line-height: 0 !important;
        position: absolute !important;
        left: -9999px !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(hideNatErrorStyle);
  } catch (e) {}

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
            nationality: (params.get("nat") || "EGY").trim().toUpperCase(),
            travelerId: params.get("travelerId") || "",
            reqId: params.get("reqId") || "",
            autoCapture: params.get("auto") !== "0",
          };
          sessionStorage.setItem("safa_mofa_context", JSON.stringify(ctx));
          localStorage.setItem("safa_mofa_last_context", JSON.stringify(ctx));
        }
      } catch (err) {
        console.warn("[MOFA Helper] Error parsing hash params:", err);
      }
    }

    // ثانياً: إذا لم تكن في الرابط، نجلبها من الجلسة
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

    // إذا كانت الصفحة تحتوي على حقول نموذج الاستعلام ولم نجد رقم تأشيرة صريح
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

    if (!visaNumber) {
      const matchGeneral = bodyText.match(/([1-9]\d{9})/);
      if (matchGeneral) visaNumber = matchGeneral[1];
    }

    return {
      isVisa: true,
      visaNumber: visaNumber || "",
      html: getCleanVisaHtml(),
    };
  }

  // دالة استخراج وثيقة التأشيرة النقية بدون عناصر موقع الوزارة (الهيدر، الفوتر، القوائم الجانبية)
  function getCleanVisaHtml() {
    try {
      const clone = document.documentElement.cloneNode(true);

      const selectorsToRemove = [
        "#mofa-helper-widget",
        ".page-header",
        ".page-head",
        ".page-header-top",
        ".page-header-menu",
        ".page-header-menu-mobile",
        ".page-sub-header",
        ".page-logo",
        ".hor-menu",
        ".header-login",
        ".header-lang",
        ".banner-beta",
        ".hidden-print",
        "#msg",
        ".pre-footer",
        ".page-footer",
        ".footer-logo",
        ".cookiealert",
        ".page-loader",
        "#dvLoader",
        ".scroll-to-top",
        "#dlgAlert",
        "#dlgMessage",
        ".dropdown-menu",
        ".modal",
        "script",
        "noscript"
      ];

      selectorsToRemove.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });

      clone.querySelectorAll("div, footer, section, nav").forEach((el) => {
        const txt = el.innerText || el.textContent || "";
        if (
          (txt.includes("خريطة الموقع") ||
            txt.includes("خدمات الزوار") ||
            txt.includes("مواقع مهمة") ||
            txt.includes("الدعم الفني")) &&
          !el.querySelector(".evisa-container, .responsive-container")
        ) {
          el.remove();
        }
      });

      const cleanStyle = document.createElement("style");
      cleanStyle.textContent = `
        @page {
          size: A4 portrait;
          margin: 0;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          min-height: 100vh !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
        }
        .page-container, .page-content, .page-content-inner {
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          background: transparent !important;
        }
        .responsive-container {
          margin: 0 auto !important;
          box-shadow: none !important;
          width: 100% !important;
          max-width: 21cm !important;
        }
        .banner-beta, .hidden-print, .page-header, .pre-footer, .page-footer, #mofa-helper-widget {
          display: none !important;
        }
        @media print {
          body {
            zoom: 1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .responsive-container {
            width: 100% !important;
            margin: 0 !important;
          }
        }
      `;
      clone.querySelector("head")?.appendChild(cleanStyle);

      return "<!DOCTYPE html>\\n" + clone.outerHTML;
    } catch (e) {
      console.warn("[MOFA Helper] Could not clean visa HTML:", e);
      return document.documentElement.outerHTML;
    }
  }

  // 3. قارئ الكابتشا الذكي (Canvas OCR) لأرقام التحقق
  function generateDigitTemplates() {
    const templates = {};
    for (let d = 0; d <= 9; d++) {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 50;
      const tctx = c.getContext("2d", { willReadFrequently: true });
      tctx.fillStyle = "#000";
      tctx.fillRect(0, 0, 40, 50);
      tctx.fillStyle = "#fff";
      tctx.font = "bold 38px Arial, Tahoma, sans-serif";
      tctx.textBaseline = "top";
      tctx.fillText(String(d), 4, 4);

      const id = tctx.getImageData(0, 0, 40, 50).data;
      let minX = 40, maxX = 0, minY = 50, maxY = 0;
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 40; x++) {
          if (id[(y * 40 + x) * 4] > 128) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const tW = Math.max(1, maxX - minX + 1);
      const tH = Math.max(1, maxY - minY + 1);
      const sc = document.createElement("canvas");
      sc.width = 20;
      sc.height = 28;
      const sctx = sc.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(c, minX, minY, tW, tH, 0, 0, 20, 28);
      const sdata = sctx.getImageData(0, 0, 20, 28).data;
      const norm = new Uint8Array(20 * 28);
      for (let i = 0; i < 20 * 28; i++) {
        norm[i] = sdata[i * 4] > 100 ? 1 : 0;
      }
      templates[d] = norm;
    }
    return templates;
  }

  let cachedTemplates = null;

  function ocrMofaCaptcha(imgElement, callback) {
    if (!imgElement) return;

    function processImg() {
      try {
        const W = imgElement.naturalWidth || 200;
        const H = imgElement.naturalHeight || 100;

        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const octx = canvas.getContext("2d", { willReadFrequently: true });
        octx.drawImage(imgElement, 0, 0, W, H);

        const imgData = octx.getImageData(0, 0, W, H);
        const data = imgData.data;

        // 1. فلترة الألوان وعزل أرقام الكابتشا
        const mask = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const colorDiff = maxC - minC;
            const brightness = (r + g + b) / 3;

            if ((colorDiff > 40 || brightness < 135) && brightness < 225) {
              mask[y * W + x] = 1;
            }
          }
        }

        // 2. إزالة النقاط المشوشة والخطوط الرفيعة
        const cleaned = new Uint8Array(W * H);
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            if (mask[y * W + x]) {
              let count = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (mask[(y + dy) * W + (x + dx)]) count++;
                }
              }
              if (count >= 3) {
                cleaned[y * W + x] = 1;
              }
            }
          }
        }

        // 3. تجميع مكونات الأرقام
        const visited = new Uint8Array(W * H);
        const components = [];

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (cleaned[idx] && !visited[idx]) {
              const queue = [idx];
              visited[idx] = 1;
              const pixels = [];
              let minX = x, maxX = x, minY = y, maxY = y;

              let head = 0;
              while (head < queue.length) {
                const curr = queue[head++];
                pixels.push(curr);
                const cx = curr % W;
                const cy = Math.floor(curr / W);

                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                const nb = [
                  cy > 0 ? (cy - 1) * W + cx : -1,
                  cy < H - 1 ? (cy + 1) * W + cx : -1,
                  cx > 0 ? cy * W + (cx - 1) : -1,
                  cx < W - 1 ? cy * W + (cx + 1) : -1
                ];

                for (const n of nb) {
                  if (n >= 0 && cleaned[n] && !visited[n]) {
                    visited[n] = 1;
                    queue.push(n);
                  }
                }
              }

              if (pixels.length >= 40) {
                components.push({
                  minX, maxX, minY, maxY,
                  width: maxX - minX + 1,
                  height: maxY - minY + 1,
                  pixels
                });
              }
            }
          }
        }

        components.sort((a, b) => a.minX - b.minX);

        // تقسيم المكونات الملتصقة إذا كان العرض كبيراً
        const finalComps = [];
        for (const c of components) {
          if (c.width > 38 && c.width < 75) {
            const mid = c.minX + Math.floor(c.width / 2);
            const p1 = c.pixels.filter(p => (p % W) <= mid);
            const p2 = c.pixels.filter(p => (p % W) > mid);
            if (p1.length >= 25) {
              let mx1 = W, xx1 = 0, my1 = H, xy1 = 0;
              for (const p of p1) {
                const px = p % W, py = Math.floor(p / W);
                if (px < mx1) mx1 = px; if (px > xx1) xx1 = px;
                if (py < my1) my1 = py; if (py > xy1) xy1 = py;
              }
              finalComps.push({ minX: mx1, maxX: xx1, minY: my1, maxY: xy1, width: xx1 - mx1 + 1, height: xy1 - my1 + 1, pixels: p1 });
            }
            if (p2.length >= 25) {
              let mx2 = W, xx2 = 0, my2 = H, xy2 = 0;
              for (const p of p2) {
                const px = p % W, py = Math.floor(p / W);
                if (px < mx2) mx2 = px; if (px > xx2) xx2 = px;
                if (py < my2) my2 = py; if (py > xy2) xy2 = py;
              }
              finalComps.push({ minX: mx2, maxX: xx2, minY: my2, maxY: xy2, width: xx2 - mx2 + 1, height: xy2 - my2 + 1, pixels: p2 });
            }
          } else {
            finalComps.push(c);
          }
        }

        if (!cachedTemplates) {
          cachedTemplates = generateDigitTemplates();
        }

        let recognized = "";
        for (const comp of finalComps) {
          if (recognized.length >= 6) break;
          if (comp.width < 5 || comp.height < 14) continue;

          // تسطيح المكون إلى 20x28
          const cCanv = document.createElement("canvas");
          cCanv.width = comp.width;
          cCanv.height = comp.height;
          const ccCtx = cCanv.getContext("2d", { willReadFrequently: true });
          const id = ccCtx.createImageData(comp.width, comp.height);
          for (const p of comp.pixels) {
            const px = (p % W) - comp.minX;
            const py = Math.floor(p / W) - comp.minY;
            if (px >= 0 && px < comp.width && py >= 0 && py < comp.height) {
              const pi = (py * comp.width + px) * 4;
              id.data[pi] = 255;
              id.data[pi + 1] = 255;
              id.data[pi + 2] = 255;
              id.data[pi + 3] = 255;
            }
          }
          ccCtx.putImageData(id, 0, 0);

          const sCanv = document.createElement("canvas");
          sCanv.width = 20;
          sCanv.height = 28;
          const sCtx = sCanv.getContext("2d", { willReadFrequently: true });
          sCtx.drawImage(cCanv, 0, 0, comp.width, comp.height, 0, 0, 20, 28);
          const sdata = sCtx.getImageData(0, 0, 20, 28).data;
          const norm = new Uint8Array(20 * 28);
          for (let i = 0; i < 20 * 28; i++) {
            norm[i] = sdata[i * 4] > 100 ? 1 : 0;
          }

          let bestDigit = "";
          let bestScore = -1;
          for (let d = 0; d <= 9; d++) {
            const tmpl = cachedTemplates[d];
            let intersection = 0, union = 0;
            for (let i = 0; i < 20 * 28; i++) {
              const p1 = norm[i], p2 = tmpl[i];
              if (p1 && p2) intersection++;
              if (p1 || p2) union++;
            }
            const iou = union > 0 ? intersection / union : 0;
            if (iou > bestScore) {
              bestScore = iou;
              bestDigit = String(d);
            }
          }

          if (bestDigit !== "" && bestScore >= 0.3) {
            recognized += bestDigit;
          }
        }

        if (callback) callback(recognized);
      } catch (e) {
        console.warn("[MOFA Helper] OCR execution warning:", e);
        if (callback) callback("");
      }
    }

    if (imgElement.complete && imgElement.naturalWidth > 0) {
      processImg();
    } else {
      imgElement.addEventListener("load", processImg, { once: true });
    }
  }

  // دوال جلب ومزامنة الكابتشا بمرونة
  function getPageCaptchaImg() {
    return document.querySelector("#imgCaptcha, img[src*='Captcha'], img[src*='captcha'], #CaptchaImage");
  }

  function getPageCaptchaInput() {
    return document.querySelector("#Captcha, input[name='Captcha'], input[name*='captcha' i]");
  }

  function syncCaptchaImage() {
    const pageCaptchaImg = getPageCaptchaImg();
    const widgetCaptchaImg = document.getElementById("mofa-widget-captcha-img");
    const captchaInputWidget = document.getElementById("mofa-widget-captcha-input");
    const pageCaptchaInput = getPageCaptchaInput();

    if (pageCaptchaImg && widgetCaptchaImg) {
      const src = pageCaptchaImg.getAttribute("src") || pageCaptchaImg.src;
      if (src && widgetCaptchaImg.src !== src) {
        widgetCaptchaImg.src = src;
      }

      const runOcr = () => {
        ocrMofaCaptcha(pageCaptchaImg, (text) => {
          if (text && text.length >= 4) {
            console.log("🇸🇦 [MOFA Helper] OCR recognized captcha:", text);
            if (captchaInputWidget && !captchaInputWidget.value) captchaInputWidget.value = text;
            if (pageCaptchaInput && !pageCaptchaInput.value) {
              pageCaptchaInput.value = text;
              pageCaptchaInput.dispatchEvent(new Event("input", { bubbles: true }));
              pageCaptchaInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      };

      if (pageCaptchaImg.complete && pageCaptchaImg.naturalWidth > 0) {
        runOcr();
      } else {
        pageCaptchaImg.addEventListener("load", runOcr, { once: true });
      }
    }
  }

  // دالة متقدمة لحذف وإخفاء أي أثر لتنبيه "حقل إجباري" للجنسية
  function purgeNationalityError() {
    try {
      // 1. حذف عناصر أخطاء التحقق الصريحة للجنسية من DOM
      const errs = document.querySelectorAll(
        'label[for="NationalityId"], #NationalityId-error, .col-md-3 label.error, span[data-valmsg-for="NationalityId"]'
      );
      errs.forEach((el) => {
        el.style.setProperty("display", "none", "important");
        el.textContent = "";
        el.remove();
      });

      // 2. فحص أي عنصر يحمل نص "حقل إجباري" داخل عمود الجنسية
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

      // 3. تأكيد فئة valid على قائمة الجنسية
      const natSelect = document.getElementById("NationalityId");
      if (natSelect) {
        natSelect.classList.remove("error");
        natSelect.classList.add("valid");
        natSelect.setAttribute("aria-invalid", "false");
      }
    } catch (e) {}
  }

  // 4. تعبئة الحقول الأساسية وتثبيتها ضد محاولات المسح
  function applyFormFill(context) {
    if (!context) return false;

    const passport = (context.passport || "").trim();
    const firstName = (context.name || "").trim().split(/\s+/)[0] || "";
    const targetNat = (context.nationality || "EGY").trim().toUpperCase();

    // أ) تعيين قيم القوائم المنسدلة والحقول مباشرة
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

    // تحديث مظهر Select2 v4 إلى "مصر"
    if (natContainer) {
      natContainer.setAttribute("title", "مصر");
      natContainer.setAttribute("aria-readonly", "true");
      natContainer.innerHTML = '<span class="select2-selection__clear" title="قم بإزالة كل العناصر">×</span>مصر';
    }

    purgeNationalityError();

    purgeNationalityError();
    return true;
  }

  // آلية حماية: إعادة التأكيد على القيم إذا حاولت نصوص الصفحة مسحها عند window.load
  let guardCount = 0;
  const fillGuardTimer = setInterval(() => {
    guardCount++;
    if (guardCount > 40) {
      clearInterval(fillGuardTimer);
      return;
    }
    const tb1 = document.getElementById("tbFirstValue");
    const ddl1 = document.getElementById("ddlFirstValue");
    const natSelect = document.getElementById("NationalityId");
    const natCont = document.getElementById("select2-NationalityId-container");

    if (ctx && ctx.passport) {
      if ((tb1 && tb1.value === "") || (ddl1 && ddl1.value !== "PassPortNo") || (natSelect && natSelect.value !== "EGY")) {
        applyFormFill(ctx);
      }
    }

    purgeNationalityError();
    syncCaptchaImage();

    if (natCont && !natCont.textContent.includes("مصر")) {
      natCont.setAttribute("title", "مصر");
      natCont.setAttribute("aria-readonly", "true");
      natCont.innerHTML = '<span class="select2-selection__clear" title="قم بإزالة كل العناصر">×</span>مصر';
    }
  }, 300);

  // 5. إنشاء واجهة المساعد العائمة (Widget)
  function renderWidget(context, visaInfo) {
    let existing = document.getElementById("mofa-helper-widget");
    if (existing) existing.remove();

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
                  <span class="mofa-helper-info-value">${context.name}</span>
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
      // --- حالة: صفحة إدخال البيانات والاستعلام (/searchvisa) ---
      const passportVal = context ? context.passport : "";
      const nameVal = context ? context.name : "";
      const firstNameVal = nameVal ? nameVal.split(" ")[0].trim() : "";

      widget.innerHTML = `
        <div class="mofa-helper-header">
          <div class="mofa-helper-title">
            <span>🕋 منصة التأشيرات: تعبئة واستعلام</span>
            <span class="mofa-helper-badge">الوزارة</span>
          </div>
          <button id="mofa-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="mofa-helper-body">
          <!-- بيانات المسافر -->
          <div class="mofa-helper-info-row">
            <span class="mofa-helper-info-label">رقم الجواز:</span>
            <span class="mofa-helper-info-value" style="font-family: monospace; font-size: 14px;">${passportVal || "غير محدد"}</span>
          </div>
          <div class="mofa-helper-info-row">
            <span class="mofa-helper-info-label">الاسم الأول:</span>
            <span class="mofa-helper-info-value">${firstNameVal || nameVal || "غير محدد"}</span>
          </div>
          <div class="mofa-helper-info-row">
            <span class="mofa-helper-info-label">الجنسية:</span>
            <span class="mofa-helper-info-value" style="color: #0284c7;">مصر (EGY)</span>
          </div>

          <!-- زر ملء البيانات الأساسي -->
          <button id="mofa-fill-action-btn" class="mofa-helper-btn" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; font-size: 14px; font-weight: bold; padding: 11px 14px; border-radius: 10px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);">
            <span style="font-size: 16px;">⚡</span>
            <span id="mofa-fill-btn-text">ملء بيانات المسافر في النموذج الآن</span>
          </button>

          <!-- كارت الكابتشا وقراءتها -->
          <div class="mofa-captcha-card">
            <div class="mofa-captcha-header">
              <span>🔒 رمز الصورة (الكابتشا):</span>
              <button id="mofa-refresh-captcha-btn" type="button" style="background: #e2e8f0; border: none; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer; color: #1e293b; display: flex; align-items: center; gap: 4px;">
                <span>🔄 تحديث الرمز</span>
              </button>
            </div>

            <div class="mofa-captcha-row">
              <div class="mofa-captcha-img-wrapper" id="mofa-captcha-img-wrapper" title="انقر لتحديث الصورة">
                <img id="mofa-widget-captcha-img" src="" alt="Captcha" />
              </div>
              <input type="text" id="mofa-widget-captcha-input" class="mofa-captcha-input" maxlength="6" placeholder="الأرقام" autocomplete="off" />
            </div>

            <div style="display: flex; gap: 6px; margin-top: 2px;">
              <button id="mofa-ocr-btn" type="button" class="mofa-helper-btn" style="background: #475569; color: #fff; font-size: 12px; padding: 8px 10px;">
                <span>✨ قراءة الرمز تلقائياً (OCR)</span>
              </button>
              <button id="mofa-submit-search-btn" type="button" class="mofa-helper-btn mofa-helper-btn-primary" style="padding: 8px 16px;">
                <span>🔍 استعلام الآن</span>
              </button>
            </div>
          </div>

          <!-- زر الحفظ اليدوي للطوارئ -->
          <div class="mofa-helper-actions">
            <button id="mofa-manual-capture-btn" class="mofa-helper-btn mofa-helper-btn-secondary" style="font-size: 12px; padding: 7px 10px;" title="حفظ هذه الصفحة الحالية كتأشيرة للمسافر">
              <span>💾 حفظ الصفحة كتأشيرة</span>
            </button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(widget);

    // إضافة الأحداث
    const closeBtn = document.getElementById("mofa-close-btn");
    if (closeBtn) closeBtn.onclick = () => widget.remove();

    // 1. زر ملء البيانات
    const fillBtn = document.getElementById("mofa-fill-action-btn");
    if (fillBtn) {
      fillBtn.onclick = () => {
        applyFormFill(context);
        const textSpan = document.getElementById("mofa-fill-btn-text");
        if (textSpan) textSpan.innerText = "✓ تم ملء بيانات المسافر بنجاح!";
        fillBtn.style.background = "#059669";
        setTimeout(() => {
          if (textSpan) textSpan.innerText = "ملء بيانات المسافر في النموذج الآن";
          fillBtn.style.background = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)";
        }, 2200);

        // التركيز على حقل الكابتشا
        const capInput = document.getElementById("mofa-widget-captcha-input");
        if (capInput) capInput.focus();
      };
    }

    // 2. مزامنة صورة الكابتشا
    syncCaptchaImage();
    setTimeout(syncCaptchaImage, 500);
    setTimeout(syncCaptchaImage, 1200);

    const pageCaptchaImg = getPageCaptchaImg();
    if (pageCaptchaImg) {
      pageCaptchaImg.addEventListener("load", syncCaptchaImage);
    }

    // 3. تحديث الكابتشا عند النقر
    const refreshBtn = document.getElementById("mofa-refresh-captcha-btn");
    const imgWrapper = document.getElementById("mofa-captcha-img-wrapper");
    const doRefresh = () => {
      const pageRefreshBtn = document.querySelector("#btnRefreshCaptcha, [id*='RefreshCaptcha' i], .btn-refresh-captcha");
      const pImg = getPageCaptchaImg();
      if (pageRefreshBtn) {
        pageRefreshBtn.click();
      } else if (pImg) {
        pImg.src = "/Base/GetRandomCaptchaImage/" + Math.floor(Math.random() * 1000000000);
      }
      setTimeout(syncCaptchaImage, 350);
      setTimeout(syncCaptchaImage, 1000);
    };

    if (refreshBtn) refreshBtn.onclick = doRefresh;
    if (imgWrapper) imgWrapper.onclick = doRefresh;

    // 4. مزامنة الكتابة في الكابتشا إلى حقل الوزارة
    const captchaInputWidget = document.getElementById("mofa-widget-captcha-input");
    if (captchaInputWidget) {
      captchaInputWidget.oninput = () => {
        const pageCaptchaInput = getPageCaptchaInput();
        if (pageCaptchaInput) {
          pageCaptchaInput.value = captchaInputWidget.value;
          pageCaptchaInput.dispatchEvent(new Event("input", { bubbles: true }));
          pageCaptchaInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };

      // الضغط على Enter في الكابتشا يقوم بالإرسال
      captchaInputWidget.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const submitBtn = document.getElementById("btnSubmit");
          if (submitBtn) submitBtn.click();
        }
      };
    }

    // 5. زر OCR اليدوي
    const ocrBtn = document.getElementById("mofa-ocr-btn");
    if (ocrBtn) {
      ocrBtn.onclick = () => {
        const pImg = getPageCaptchaImg();
        if (pImg) {
          ocrMofaCaptcha(pImg, (text) => {
            if (text) {
              const capInputW = document.getElementById("mofa-widget-captcha-input");
              const pInput = getPageCaptchaInput();
              if (capInputW) capInputW.value = text;
              if (pInput) {
                pInput.value = text;
                pInput.dispatchEvent(new Event("input", { bubbles: true }));
                pInput.dispatchEvent(new Event("change", { bubbles: true }));
              }
              alert("تمت قراءة الرمز: " + text);
            } else {
              alert("تعذر قراءة الرمز تلقائياً، يرجى كتابته يدوياً من الصورة.");
            }
          });
        }
      };
    }

    // 6. زر استعلام الآن
    const submitSearchBtn = document.getElementById("mofa-submit-search-btn");
    if (submitSearchBtn) {
      submitSearchBtn.onclick = () => {
        applyFormFill(context);
        purgeNationalityError();
        const submitBtn = document.getElementById("btnSubmit");
        if (submitBtn) submitBtn.click();
      };
    }

    // 7. زر ربط التأشيرة وحفظها
    const linkVisaBtn = document.getElementById("mofa-link-visa-btn");
    if (linkVisaBtn) {
      linkVisaBtn.onclick = () => sendVisaToSystem(context, visaInfo);
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
            html: getCleanVisaHtml(),
          };
        }
        sendVisaToSystem(context, detected);
      };
    }
  }

  // 6. إرسال التأشيرة الملتقطة إلى النظام الرئيسي
  function sendVisaToSystem(context, visaInfo) {
    const payload = {
      source: "MOFA_VISA_EXTENSION",
      type: "VISA_CAPTURED",
      travelerId: context ? context.travelerId : "",
      reqId: context ? context.reqId : "",
      passportNumber: context ? context.passport : "",
      visaNumber: visaInfo ? visaInfo.visaNumber : "",
      visaHtml: (visaInfo && visaInfo.html) ? visaInfo.html : getCleanVisaHtml(),
      timestamp: Date.now(),
    };

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, "*");
      } catch (err) {
        console.warn("[MOFA Helper] Could not postMessage to opener:", err);
      }
    }

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

    setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 2000);
  }

  // 7. بدء التشغيل التلقائي
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
    }
  }

  setTimeout(init, 300);
  setTimeout(() => {
    if (ctx && !detectVisaResult()) {
      applyFormFill(ctx);
    }
  }, 1200);

  // مراقبة تحديث الصفحة (ظهور التأشيرة بعد الضغط على استعلام وإزالة أخطاء الجنسية ومزامنة الكابتشا)
  let lastWasVisa = false;
  const observer = new MutationObserver(() => {
    purgeNationalityError();
    syncCaptchaImage();
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
