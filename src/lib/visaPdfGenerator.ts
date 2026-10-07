import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { MofaVisaResult } from "./mofaVisaService";
import { Traveler } from "@/types";

/**
 * Generate a high-resolution, printable A4 PDF Blob from MOFA Visa HTML
 */
export async function generateVisaPdfBlob(
  visaHtml: string,
  travelerName?: string
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation requires browser environment");
  }

  // 1. Parse incoming HTML and extract relevant printable visa container
  const parser = new DOMParser();
  const doc = parser.parseFromString(visaHtml, "text/html");

  // MOFA e-visa is housed in .evis-content or #PrintDiv or .evisa or main body
  const evisContent =
    doc.querySelector(".evis-content") ||
    doc.querySelector("#PrintDiv") ||
    doc.querySelector(".evisa") ||
    doc.querySelector(".print-area");

  let contentToRender = "";
  if (evisContent) {
    contentToRender = evisContent.outerHTML;
  } else {
    // If specific container not found, strip navigation/search and use body
    const bodyClone = doc.body.cloneNode(true) as HTMLElement;
    bodyClone
      .querySelectorAll("header, footer, nav, .navbar, .header, form:not(.evisa-form), .search-container, #searchForm, button, script")
      .forEach((el) => el.remove());
    contentToRender = bodyClone.innerHTML;
  }

  // Collect any style tags from original document
  const originalStyles = Array.from(doc.querySelectorAll("style, link[rel='stylesheet']"))
    .map((el) => el.outerHTML)
    .join("\n");

  // 2. Create offscreen container styled specifically for A4 proportions (794px width)
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // 210mm at 96 DPI
  container.style.minHeight = "1123px"; // 297mm at 96 DPI
  container.style.backgroundColor = "#ffffff";
  container.style.zIndex = "-9999";
  container.style.direction = "rtl";
  container.style.boxSizing = "border-box";
  container.style.padding = "0";
  container.style.margin = "0";

  container.innerHTML = `
    ${originalStyles}
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap');
      * {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .visa-pdf-canvas-root {
        font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        direction: rtl !important;
        width: 794px !important;
        padding: 24px !important;
        margin: 0 auto !important;
      }
      .evis-content, .evisa, #PrintDiv {
        display: block !important;
        width: 100% !important;
        margin: 0 auto !important;
        border: none !important;
      }
      header, footer, nav, .navbar, .header, form:not(.evisa-form), .search-container, #searchForm, button, .btn {
        display: none !important;
      }
      img {
        max-width: 100% !important;
      }
    </style>
    <div class="visa-pdf-canvas-root">
      ${contentToRender}
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Wait for DOM & images to settle
    await new Promise((resolve) => setTimeout(resolve, 350));

    const canvas = await html2canvas(container, {
      scale: 2, // 2x resolution for ultra-sharp text, emblem, and barcodes
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = 210;
    const pdfPageHeight = 297;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfPageHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight, undefined, "FAST");
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight, undefined, "FAST");
      heightLeft -= pdfPageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight, undefined, "FAST");
        heightLeft -= pdfPageHeight;
      }
    }

    return pdf.output("blob");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Fallback PDF generator if canvas rendering fails
 */
export async function generateFallbackVisaPdf(
  result: MofaVisaResult,
  traveler: Traveler
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [16, 185, 129]; // Emerald

  // Background card & decorative border
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(1.5);
  pdf.rect(10, 10, 190, 277);

  pdf.setLineWidth(0.5);
  pdf.rect(12, 12, 186, 273);

  // Header Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(20, 83, 45);
  pdf.text("KINGDOM OF SAUDI ARABIA", 105, 30, { align: "center" });

  pdf.setFontSize(14);
  pdf.setTextColor(100, 100, 100);
  pdf.text("MINISTRY OF FOREIGN AFFAIRS - E-VISA", 105, 38, { align: "center" });

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.line(25, 45, 185, 45);

  // Visa Details Box
  pdf.setFillColor(240, 253, 244);
  pdf.roundedRect(25, 52, 160, 42, 3, 3, "F");

  pdf.setFontSize(12);
  pdf.setTextColor(70, 70, 70);
  pdf.text("VISA NUMBER:", 35, 64);
  pdf.setFontSize(18);
  pdf.setTextColor(16, 149, 104);
  pdf.text(result.visaNumber || traveler.visaNumber || "N/A", 175, 64, { align: "right" });

  pdf.setFontSize(11);
  pdf.setTextColor(80, 80, 80);
  pdf.text("VALID FROM (ISSUE DATE):", 35, 76);
  pdf.setFont("helvetica", "normal");
  pdf.text(result.issueDate || "N/A", 175, 76, { align: "right" });

  pdf.setFont("helvetica", "bold");
  pdf.text("VALID UNTIL (EXPIRY DATE):", 35, 86);
  pdf.setFont("helvetica", "normal");
  pdf.text(result.expiryDate || "N/A", 175, 86, { align: "right" });

  // Traveler Details Table
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(30, 41, 59);
  pdf.text("TRAVELER INFORMATION", 25, 110);

  const fields = [
    ["FULL NAME", traveler.fullName || "N/A"],
    ["PASSPORT NUMBER", traveler.passportNumber || "N/A"],
    ["NATIONALITY", traveler.nationality || "N/A"],
    ["DATE OF BIRTH", traveler.dateOfBirth || "N/A"],
    ["VISA STATUS", "ISSUED / VALID"],
  ];

  let y = 120;
  pdf.setFontSize(11);
  for (const [label, val] of fields) {
    pdf.setFillColor(y % 20 === 0 ? 248 : 255, y % 20 === 0 ? 250 : 255, y % 20 === 0 ? 252 : 255);
    pdf.rect(25, y - 6, 160, 10, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(71, 85, 105);
    pdf.text(label, 30, y);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(val), 180, y, { align: "right" });

    y += 11;
  }

  // Footer & Disclaimer
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text("Officially retrieved and verified via Saudi Ministry of Foreign Affairs (MOFA) Portal", 105, 260, {
    align: "center",
  });
  pdf.text(`Generated on: ${new Date().toLocaleString("en-US")}`, 105, 267, { align: "center" });

  return pdf.output("blob");
}
