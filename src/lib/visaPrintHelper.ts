/**
 * MOFA Visa Print & PDF Helper
 * Formats Saudi MOFA e-visa for clean, official 1-page A4 printing
 * Strips all site banners, modals, errors, and footers.
 */

/**
 * Extracts and sanitizes the pure e-visa content from raw MOFA response HTML
 */
export function extractCleanVisaHtml(fullHtml: string): string {
  if (typeof window === "undefined") return fullHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");

  // 1. Remove all modals, system alerts, and error dialogs (e.g. dlgMessage, "Modal title")
  doc
    .querySelectorAll(
      `.modal, 
       #dlgMessage, 
       #msg, 
       .banner-beta, 
       .modal-backdrop, 
       .modal-dialog, 
       .modal-content, 
       .note.note-bordered, 
       .alert,
       [id*="modal" i],
       [class*="modal" i]`
    )
    .forEach((el) => el.remove());

  // 2. Remove site headers, navigation bars, breadcrumbs, titles
  doc
    .querySelectorAll(
      `header, 
       .page-header, 
       .page-header-top, 
       .page-header-menu, 
       .page-head, 
       .page-breadcrumb, 
       .page-title, 
       nav, 
       .navbar, 
       .top-menu, 
       .hor-menu, 
       .menu-toggler`
    )
    .forEach((el) => el.remove());

  // 3. Remove search forms, submit buttons, captcha widgets
  doc
    .querySelectorAll(
      `form#myform, 
       form:not(.evisa-form), 
       .search-container, 
       #searchForm, 
       .form-actions, 
       button, 
       .btn, 
       .btndiv, 
       input, 
       select, 
       .input-group-addon, 
       #btnRefreshCaptcha, 
       #btnSubmit`
    )
    .forEach((el) => el.remove());

  // 4. Remove site footers, sitemaps, copyright text
  doc
    .querySelectorAll(
      `footer, 
       .page-footer, 
       .page-prefooter, 
       .pre-footer, 
       .footer-social, 
       .copyrights, 
       .scroll-to-top, 
       .cookiealert`
    )
    .forEach((el) => el.remove());

  // 5. Remove any leftover blocks containing sitemap or footer text
  doc.querySelectorAll("div, p, span, ul, section").forEach((el) => {
    const txt = (el.textContent || "").trim();
    if (
      txt.includes("خريطة الموقع") ||
      txt.includes("سياسة الخصوصية") ||
      txt.includes("جميع الحقوق محفوظة") ||
      txt.includes("عفوا حدث خطأ") ||
      txt.includes("Modal title")
    ) {
      if (el.children.length <= 4 && txt.length < 400) {
        el.remove();
      }
    }
  });

  // 6. Remove tracking scripts, iframes, and noscript tags
  doc.querySelectorAll("script, iframe, noscript").forEach((el) => el.remove());

  // 7. Extract the targeted e-visa slip container
  const visaEl =
    doc.querySelector(".evis-content") ||
    doc.querySelector("#dvToPrint") ||
    doc.querySelector(".page-print") ||
    doc.querySelector("#PrintDiv") ||
    doc.querySelector(".evisa") ||
    doc.querySelector(".portlet-body");

  if (visaEl) {
    return visaEl.outerHTML;
  }

  // Fallback: search for container holding visa table markers
  const elements = Array.from(doc.body.querySelectorAll("div, table, section"));
  const found = elements.find((el) => {
    const text = el.textContent || "";
    return (
      (text.includes("رقم التأشيرة") || text.includes("Visa No")) &&
      (text.includes("المملكة العربية السعودية") || text.includes("KINGDOM OF SAUDI ARABIA"))
    );
  });

  return found ? found.outerHTML : doc.body.innerHTML;
}

/**
 * Triggers native browser print formatted specifically for A4 Single-Page e-visa slip.
 * Automatically prompts "Save as PDF" / "حفظ بتنسيق PDF".
 */
export function printVisaDocument(visaHtml: string, title?: string): void {
  if (typeof window === "undefined") return;

  const cleanContent = extractCleanVisaHtml(visaHtml);

  // Create isolated hidden iframe for printing
  const iframe = document.createElement("iframe");
  iframe.id = "mofa-visa-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!frameDoc) {
    console.error("Could not access print iframe document");
    return;
  }

  const docTitle = title
    ? `تأشيرة_${title.replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, "_")}`
    : "تأشيرة_رسمية_وزارة_الخارجية";

  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap">
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    @media print {
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print, header, footer, .modal, .banner-beta, nav, #msg, #dlgMessage {
        display: none !important;
      }
      .page-break-avoid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background-color: #ffffff;
      color: #000000;
      font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 0;
      width: 100%;
    }
    .visa-print-wrapper {
      width: 100%;
      max-width: 195mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      background: #ffffff;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .evis-content, #dvToPrint, .page-print, .evisa, .portlet-body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      display: block !important;
      border: none !important;
      background: transparent !important;
    }
    /* Hide all junk */
    header, footer, nav, .navbar, .page-header, .page-footer, .pre-footer, 
    .banner-beta, .modal, #dlgMessage, #msg, form, button, .btn {
      display: none !important;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
      image-rendering: -webkit-optimize-contrast;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    /* Compact row styling to ensure single-page fit */
    .row, .form-group {
      margin-bottom: 4px !important;
    }
  </style>
</head>
<body>
  <div class="visa-print-wrapper">
    ${cleanContent}
  </div>
</body>
</html>`);
  frameDoc.close();

  // Give images & fonts 450ms to settle then trigger browser print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn("Direct iframe print failed, trying window fallback:", e);
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(frameDoc.documentElement.outerHTML);
        win.document.close();
        win.focus();
        win.print();
      }
    } finally {
      // Remove iframe after sufficient window time
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    }
  }, 450);
}

/**
 * Print an existing PDF document URL via iframe
 */
export function printPdfDocumentUrl(pdfUrl: string): void {
  if (typeof window === "undefined" || !pdfUrl) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  iframe.src = pdfUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Could not print PDF iframe directly, opening in new tab:", err);
        window.open(pdfUrl, "_blank");
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 60000);
      }
    }, 400);
  };
}
