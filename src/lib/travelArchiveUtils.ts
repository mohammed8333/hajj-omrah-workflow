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
