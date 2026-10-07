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
import { extractVisaData, renderOfficialVisaHtml } from "./officialVisaTemplate";
import { Traveler } from "@/types";

/**
 * Triggers native browser print formatted specifically for A4 Single-Page official e-visa slip.
 * Renders the exact official Ministry of Foreign Affairs (KSA VISA) design requested by user.
 * Automatically prompts "Save as PDF" / "حفظ بتنسيق PDF".
 */
export async function printVisaDocument(
  visaHtml: string,
  traveler?: Traveler | string,
  title?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const travelerObj: Traveler | undefined =
    typeof traveler === "object" ? traveler : undefined;
  const travelerName =
    typeof traveler === "string" ? traveler : traveler?.fullName;

  let htmlToPrint = "";
  try {
    const visaData = await extractVisaData(visaHtml, travelerObj);
    if (travelerName && !visaData.fullName) {
      visaData.fullName = travelerName;
    }
    htmlToPrint = renderOfficialVisaHtml(visaData);
  } catch (err) {
    console.warn("Could not generate official visa template, using clean HTML fallback:", err);
    htmlToPrint = extractCleanVisaHtml(visaHtml);
  }

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

  frameDoc.open();
  frameDoc.write(htmlToPrint);
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
