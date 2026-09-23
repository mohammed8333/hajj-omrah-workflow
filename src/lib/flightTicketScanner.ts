import { scanFlightTicketWithGemini, getGeminiApiKey } from "./geminiVision";

export interface ScannedFlightTicketData {
  departureDate?: string;
  returnDate?: string;
  flightDepartureTime?: string;
  airportArrivalTime?: string;
  airline?: string;
  flightNumber?: string;
  returnFlightNumber?: string;
  arrivalAirport?: string;
  saudiArrivalTime?: string;
  returnDepartureAirport?: string;
  returnFlightDepartureTime?: string;
  rawText?: string;
}

/**
 * Calculates recommended airport arrival time exactly 3 hours before flight departure.
 * Handles 24-hour time format (HH:MM) cleanly including midnight crossings.
 * e.g. "14:30" -> "11:30", "02:15" -> "23:15", "00:45" -> "21:45"
 */
export function calculateAirportArrivalTime(departureTime: string): string {
  if (!departureTime) return "";
  const match = departureTime.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return "";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  if (isNaN(hours)) return "";
  hours = (hours - 3 + 24) % 24;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

/**
 * Intelligent Flight Ticket Scanner
 * Uses Google Gemini Vision AI to extract dates, times, airline, and flight number.
 * Automatically enforces airport arrival time 3 hours prior to takeoff.
 */
export async function scanFlightTicket(
  fileOrUrl: File | Blob | string,
  onProgress?: (msg: string) => void,
  explicitApiKey?: string
): Promise<ScannedFlightTicketData | null> {
  const apiKey = (explicitApiKey || getGeminiApiKey() || "").trim();

  if (!apiKey) {
    throw new Error("لم يتم العثور على مفتاح Google Gemini API. يرجى إدخال مفتاح الـ API المجاني لتفعيل الفحص الذكي للتذاكر.");
  }

  try {
    onProgress?.("جاري فحص تذكرة الطيران بالذكاء الاصطناعي (Google Gemini)...");
    const geminiResult = await scanFlightTicketWithGemini(fileOrUrl, apiKey);
    if (geminiResult) {
      let arrivalTime = geminiResult.airportArrivalTime;
      if (geminiResult.flightDepartureTime) {
        arrivalTime = calculateAirportArrivalTime(geminiResult.flightDepartureTime);
      }

      return {
        departureDate: geminiResult.departureDate,
        returnDate: geminiResult.returnDate,
        flightDepartureTime: geminiResult.flightDepartureTime,
        airportArrivalTime: arrivalTime,
        airline: geminiResult.airline,
        flightNumber: geminiResult.flightNumber,
        returnFlightNumber: geminiResult.returnFlightNumber,
        arrivalAirport: geminiResult.arrivalAirport,
        saudiArrivalTime: geminiResult.saudiArrivalTime,
        returnDepartureAirport: geminiResult.returnDepartureAirport,
        returnFlightDepartureTime: geminiResult.returnFlightDepartureTime,
      };
    }
  } catch (err: unknown) {
    console.warn("Gemini flight ticket scan error:", err);
    const msg = err instanceof Error ? err.message : "فشل استخراج البيانات من التذكرة بالذكاء الاصطناعي";
    throw new Error(msg);
  }

  return null;
}
