/**
 * Code 39 Barcode SVG Generator
 * Used in official Saudi MOFA e-visa documents for Visa No. and Application No.
 */

const CODE39_MAP: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  A: "110101001011",
  B: "101101001011",
  C: "110110100101",
  D: "101011001011",
  E: "110101100101",
  F: "101101100101",
  G: "101010011011",
  H: "110101001101",
  I: "101101001101",
  J: "101011001101",
  K: "110101010011",
  L: "101101010011",
  M: "110110101001",
  N: "101011010011",
  O: "110101101001",
  P: "101101101001",
  Q: "101010110011",
  R: "110101011001",
  S: "101101011001",
  T: "101011011001",
  U: "110010101011",
  V: "100110101011",
  W: "110011010101",
  X: "100101101011",
  Y: "110010110101",
  Z: "100110110101",
  "-": "100101011011",
  ".": "110010101101",
  " ": "100110101101",
  "*": "100101101101",
};

export function generateCode39Svg(text: string, height: number = 24): string {
  if (!text) return "";
  const clean = text.toUpperCase().replace(/[^0-9A-Z\-\. ]/g, "");
  const fullText = `*${clean}*`;
  let binary = "";
  for (const char of fullText) {
    const pattern = CODE39_MAP[char] || CODE39_MAP[" "];
    binary += pattern + "0";
  }

  let rects = "";
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      rects += `<rect x="${i}" y="0" width="1" height="${height}" fill="#000000"/>`;
    }
  }

  // Exact authentic width matching MOFA's proportion (approx 145px)
  const svgWidth = 145;

  return `<svg viewBox="0 0 ${binary.length} ${height}" width="${svgWidth}" height="${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">${rects}</svg>`;
}
