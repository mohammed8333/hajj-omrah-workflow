import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { MofaVisaResult } from "./mofaVisaService";
import { Traveler } from "@/types";
import { extractCleanVisaHtml } from "./visaPrintHelper";
import { extractVisaData, renderOfficialVisaHtml } from "./officialVisaTemplate";

/**
 * Generate a high-resolution, printable A4 PDF Blob from MOFA Visa HTML
 * Guaranteed to fit strictly on 1 single page in the official Ministry of Foreign Affairs (KSA VISA) layout.
 */
export async function generateVisaPdfBlob(
  visaHtml: string,
  traveler?: Traveler | string
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation requires browser environment");
  }

  const travelerObj: Traveler | undefined =
    typeof traveler === "object" ? traveler : undefined;
  const travelerName =
    typeof traveler === "string" ? traveler : traveler?.fullName;

  // Render the exact official eVisa template matching official design
  let fullOfficialHtml = "";
  try {
    const visaData = await extractVisaData(visaHtml, travelerObj);
    if (travelerName && !visaData.fullName) {
      visaData.fullName = travelerName;
    }
    fullOfficialHtml = renderOfficialVisaHtml(visaData);
  } catch (err) {
    console.warn("Could not generate structured official visa, using clean HTML fallback:", err);
    fullOfficialHtml = extractCleanVisaHtml(visaHtml);
  }

  // 2. Create offscreen iframe styled specifically for A4 proportions (794px width)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "794px"; // 210mm at 96 DPI
  iframe.style.height = "1123px"; // 297mm at 96 DPI
  iframe.style.border = "none";
  iframe.style.backgroundColor = "#ffffff";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error("Unable to access iframe document");
    }

    doc.open();
    doc.write(fullOfficialHtml);
    doc.close();

    // Wait for all images and fonts to finish loading in iframe
    const images = Array.from(doc.images);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 1500);
        });
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    const targetEl =
      (doc.querySelector(".page-container") as HTMLElement) || doc.body;

    const canvas = await html2canvas(targetEl, {
      scale: 2, // 2x resolution for ultra-sharp text, emblem, and barcodes
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Draw single-page PDF full bleed (0, 0, 210, 297) matching exact A4 dimensions
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

    return pdf.output("blob");
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
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
