/**
 * Travel Archive Category Helper
 * 
 * Rules:
 * 1. If departureDate (or travelDate) has passed (< today):
 *    - diffDays <= 30 => "ARCHIVED_RECENT" (الأرشيف الحديث: خلال 30 يوم)
 *    - diffDays > 30  => "ARCHIVED_OLD"    (الأرشيف القديم: أكثر من 30 يوم)
 * 2. If departureDate hasn't passed (today or future) or is unset:
 *    - If status === "Archived" => "ARCHIVED_RECENT"
 *    - Otherwise => "ACTIVE"
 */

export type TravelArchiveCategory = "ACTIVE" | "ARCHIVED_RECENT" | "ARCHIVED_OLD";

export function getTravelArchiveCategory(req: {
  departureDate?: string;
  travelDate?: string;
  status?: string;
}): TravelArchiveCategory {
  const dateStr = (req.departureDate || req.travelDate)?.split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dateStr) {
    const parts = dateStr.trim().split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const depDate = new Date(y, m - 1, d);
        depDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - depDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          // Travel date has passed!
          return diffDays <= 30 ? "ARCHIVED_RECENT" : "ARCHIVED_OLD";
        }
      }
    }
  }

  // Not passed (today, future, or no departure date set)
  if (req.status === "Archived") {
    return "ARCHIVED_RECENT";
  }

  return "ACTIVE";
}

/**
 * Helper to parse a date string (YYYY-MM-DD or ISO) to milliseconds timestamp.
 * Invalid or empty dates return Number.MAX_SAFE_INTEGER so they sort to the end.
 */
export function parseDateToTime(dateStr?: string): number {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return Number.MAX_SAFE_INTEGER;
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d).getTime();
    }
  }
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

/**
 * Helper to parse departure time to minutes from midnight (0..1439).
 * Supports "12:00", "13:30", "02:15 PM", "02:15 م", "08:00 ص", etc.
 * Invalid or empty times return Number.MAX_SAFE_INTEGER so they sort after specified times.
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || timeStr === "-" || timeStr.trim() === "") return Number.MAX_SAFE_INTEGER;
  const clean = timeStr.trim();
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (/pm|م/i.test(clean) && hours < 12) hours += 12;
    if (/am|ص/i.test(clean) && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Sort transactions by:
 * 1. Departure date (earliest to latest: الأقرب فالأبعد).
 * 2. If same departure date: Departure time (12:00, then 13:00, then 14:00, etc.).
 * 3. Fallback: newest createdAt first.
 */
export function compareRequestsByDeparture(
  a: { departureDate?: string; travelDate?: string; flightDepartureTime?: string; createdAt?: string },
  b: { departureDate?: string; travelDate?: string; flightDepartureTime?: string; createdAt?: string }
): number {
  const dateA = parseDateToTime(a.departureDate || a.travelDate);
  const dateB = parseDateToTime(b.departureDate || b.travelDate);

  if (dateA !== dateB) {
    return dateA - dateB;
  }

  // Same departure date -> Sort by flight departure time (earliest to latest)
  const timeA = parseTimeToMinutes(a.flightDepartureTime);
  const timeB = parseTimeToMinutes(b.flightDepartureTime);

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // Fallback: Newest createdAt first if available
  const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return createdB - createdA;
}
