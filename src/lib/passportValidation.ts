import { api } from "./api";

/**
 * Checks if a passport is expiring in less than 6 months (180 days)
 * relative to the travel departure date (or today).
 */
export function checkPassportValidity(
  expiryDateStr?: string,
  travelDateStr?: string
): {
  isInvalid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  message: string;
} {
  if (!expiryDateStr) {
    return {
      isInvalid: false,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 999,
      message: "",
    };
  }

  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) {
    return {
      isInvalid: true,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 0,
      message: "صيغة تاريخ انتهاء الجواز غير صالحة",
    };
  }

  // Reference date: Departure date if valid, else today
  let refDate = new Date();
  if (travelDateStr) {
    const tDate = new Date(travelDateStr);
    if (!isNaN(tDate.getTime())) {
      refDate = tDate;
    }
  }

  const diffTime = expiry.getTime() - refDate.getTime();
  const daysRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      isInvalid: true,
      isExpired: true,
      isExpiringSoon: true,
      daysRemaining,
      message: "جواز السفر منتهي الصلاحية! لن يتم قبوله في إصدار التأشيرات.",
    };
  }

  // Less than 6 months (approx 180 days)
  if (daysRemaining < 180) {
    const months = Math.floor(daysRemaining / 30);
    return {
      isInvalid: false,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      message: `تنبيه: صلاحية الجواز متبقٍ عليها أقل من 6 أشهر (${months} أشهر و ${daysRemaining % 30} يوماً). قد يُرفض في المطار أو التأشيرة.`,
    };
  }

  return {
    isInvalid: false,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining,
    message: "صلاحية الجواز سارية ومطابقة للمواصفات",
  };
}

/**
 * Searches across existing requests to check if a passport number or National ID already exists
 */
export async function findDuplicatePassportOrId(
  value: string,
  type: "passport" | "nationalId",
  excludeRequestId?: string
): Promise<{
  isDuplicate: boolean;
  requestNumber?: string;
  groupName?: string;
  matchedName?: string;
} | null> {
  const cleanVal = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleanVal || cleanVal.length < 5) return null;

  try {
    const allRequests = await api.requests.getAll();
    for (const r of allRequests) {
      if (excludeRequestId && r.id === excludeRequestId) continue;

      if (type === "nationalId") {
        if (
          r.hostNationalId &&
          r.hostNationalId.trim().toUpperCase().replace(/\s+/g, "") === cleanVal
        ) {
          return {
            isDuplicate: true,
            requestNumber: r.requestNumber,
            groupName: r.groupName,
            matchedName: r.hostName || "المستضيف",
          };
        }
      } else if (type === "passport") {
        if (r.travelersList && r.travelersList.length > 0) {
          for (const t of r.travelersList) {
            if (
              t.passportNumber &&
              t.passportNumber.trim().toUpperCase().replace(/\s+/g, "") === cleanVal
            ) {
              return {
                isDuplicate: true,
                requestNumber: r.requestNumber,
                groupName: r.groupName,
                matchedName: t.fullName,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not check duplicate:", err);
  }

  return null;
}
