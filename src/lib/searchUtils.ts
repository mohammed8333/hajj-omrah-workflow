import { GroupRequestSummary, TravelerSummaryItem } from "@/types";

/**
 * Normalizes Arabic text by unifying alefs, ya/alef maksura, ta marbuta/ha,
 * and stripping Arabic diacritics (tashkeel) and tatweel.
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return "";
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // Diacritics (fatha, damma, kasra, sukun, shadda, tanween)
    .replace(/[أإآٱ]/g, "ا") // Alef variants
    .replace(/ة/g, "ه") // Ta marbuta to ha
    .replace(/ى/g, "ي") // Alef maksura to ya
    .replace(/ـ/g, "") // Tatweel / kashida
    .replace(/\s+/g, " "); // Collapse multiple spaces
}

/**
 * Checks if a specific traveler item matches the given search term
 */
export function isTravelerMatch(t: TravelerSummaryItem, rawTerm: string): boolean {
  if (!rawTerm || !rawTerm.trim()) return false;
  const term = rawTerm.trim().toLowerCase();
  const normTerm = normalizeArabicText(term);

  // Match full name
  if (t.fullName) {
    const normName = normalizeArabicText(t.fullName);
    if (t.fullName.toLowerCase().includes(term) || normName.includes(normTerm)) {
      return true;
    }
  }

  // Match passport number
  if (t.passportNumber) {
    const rawPass = t.passportNumber.toLowerCase();
    const cleanPass = rawPass.replace(/[^a-z0-9]/gi, "");
    const cleanTerm = term.replace(/[^a-z0-9]/gi, "");

    if (rawPass.includes(term) || (cleanTerm.length >= 2 && cleanPass.includes(cleanTerm))) {
      return true;
    }
  }

  // Match affiliation (التبعية / المندوب)
  if (t.affiliation) {
    const normAff = normalizeArabicText(t.affiliation);
    if (t.affiliation.toLowerCase().includes(term) || normAff.includes(normTerm)) {
      return true;
    }
  }

  // Match traveler notes
  if (t.notes) {
    const normNotes = normalizeArabicText(t.notes);
    if (t.notes.toLowerCase().includes(term) || normNotes.includes(normTerm)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns all travelers in a group request whose name or passport number matches the search term
 */
export function getMatchingTravelers(
  r: GroupRequestSummary,
  rawTerm: string
): TravelerSummaryItem[] {
  if (!rawTerm || !rawTerm.trim() || !r.travelersList || r.travelersList.length === 0) {
    return [];
  }
  return r.travelersList.filter((t) => isTravelerMatch(t, rawTerm));
}

/**
 * Evaluates whether a group request matches the search query across all relevant fields:
 * - Group name
 * - Request number
 * - Any traveler inside the request (name or passport number)
 * - Nusuk group number
 * - Host name / Host phone / Host national ID
 * - Sender name / Sender code
 * - Contact phone
 * - Flight numbers
 */
export function matchesRequestSearch(r: GroupRequestSummary, rawTerm: string): boolean {
  if (!rawTerm || !rawTerm.trim()) return true;

  const term = rawTerm.trim().toLowerCase();
  const normTerm = normalizeArabicText(term);
  const cleanDigits = term.replace(/[^0-9]/g, "");

  // 1. Check all travelers inside the transaction
  if (r.travelersList && r.travelersList.length > 0) {
    const hasMatchingTraveler = r.travelersList.some((t) => isTravelerMatch(t, rawTerm));
    if (hasMatchingTraveler) return true;
  }

  // 2. Group Name
  if (r.groupName) {
    if (
      r.groupName.toLowerCase().includes(term) ||
      normalizeArabicText(r.groupName).includes(normTerm)
    ) {
      return true;
    }
  }

  // 3. Request Number
  if (r.requestNumber && r.requestNumber.toLowerCase().includes(term)) {
    return true;
  }

  // 4. Nusuk Group Number
  if (r.nusukGroupNumber) {
    if (
      r.nusukGroupNumber.toLowerCase().includes(term) ||
      (cleanDigits.length >= 3 && r.nusukGroupNumber.includes(cleanDigits))
    ) {
      return true;
    }
  }

  // 5. Host Information (Name, Phone, National ID)
  if (r.hostName) {
    if (
      r.hostName.toLowerCase().includes(term) ||
      normalizeArabicText(r.hostName).includes(normTerm)
    ) {
      return true;
    }
  }
  if (r.hostPhone && (r.hostPhone.includes(term) || (cleanDigits && r.hostPhone.includes(cleanDigits)))) {
    return true;
  }
  if (r.hostNationalId && (r.hostNationalId.includes(term) || (cleanDigits && r.hostNationalId.includes(cleanDigits)))) {
    return true;
  }

  // 6. Sender Information (Name, Code)
  if (r.senderName) {
    if (
      r.senderName.toLowerCase().includes(term) ||
      normalizeArabicText(r.senderName).includes(normTerm)
    ) {
      return true;
    }
  }
  if (r.senderCode && r.senderCode.toLowerCase().includes(term)) {
    return true;
  }

  // 7. Contact Phone
  if (r.contactPhone && (r.contactPhone.includes(term) || (cleanDigits && r.contactPhone.includes(cleanDigits)))) {
    return true;
  }

  // 8. Flight Numbers & Destination
  if (r.flightNumber && r.flightNumber.toLowerCase().includes(term)) {
    return true;
  }
  if (r.returnFlightNumber && r.returnFlightNumber.toLowerCase().includes(term)) {
    return true;
  }
  if (r.destination && normalizeArabicText(r.destination).includes(normTerm)) {
    return true;
  }

  return false;
}
