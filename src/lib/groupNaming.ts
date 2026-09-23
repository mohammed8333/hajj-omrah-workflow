/**
 * Group Naming Utilities for Hajj & Umrah Workflow
 * Generates official airline/GDS style group names (e.g. "OHD7oct26dec")
 */

const MONTH_CODES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
];

/**
 * Parses date string safely (handles YYYY-MM-DD, YYYY/MM/DD, etc.)
 */
function parseDateParts(dateStr?: string): { day: number; month: number } | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (!isNaN(day) && !isNaN(month) && month >= 0 && month < 12) {
      return { day, month };
    }
  }

  // Fallback to standard Date object
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.getMonth() };
}

/**
 * Converts a date to "7oct" format (Day without leading zero + 3-letter English month)
 * e.g. "2026-10-07" -> "7oct", "2026-12-26" -> "26dec"
 */
export function formatFlightDateCode(dateStr?: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  const monthCode = MONTH_CODES[parts.month];
  if (!monthCode) return "";
  return `${parts.day}${monthCode}`;
}

/**
 * Resolves the 3-letter uppercase Sender Code:
 * 1. Explicit senderCode on user (e.g. "OHD", "SAF", "RAH").
 * 2. If missing, extracts first 3 English letters from username / fullName.
 * 3. Fallback default is "OHD".
 */
export function resolveSenderCode(
  user?: { senderCode?: string; fullName?: string; username?: string } | null,
  fallback = "OHD"
): string {
  if (user?.senderCode && user.senderCode.trim()) {
    return user.senderCode.trim().toUpperCase();
  }

  const searchTarget = `${user?.username || ""} ${user?.fullName || ""}`;
  const enLetters = searchTarget.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (enLetters.length >= 3) {
    return enLetters.slice(0, 3);
  }

  return fallback;
}

/**
 * Generates the official standardized group name.
 * e.g. OHD + 2026-10-07 + 2026-12-26 -> "OHD7oct26dec"
 */
export function formatOfficialGroupName(
  senderCode: string,
  departureDate?: string,
  returnDate?: string
): string {
  const code = (senderCode || "OHD").trim().toUpperCase();
  const dep = formatFlightDateCode(departureDate);
  const ret = formatFlightDateCode(returnDate);

  if (dep && ret) {
    return `${code}${dep}${ret}`;
  }
  if (dep) {
    return `${code}${dep}`;
  }
  return code;
}
