import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Project Supabase Cloud Credentials (Default for all devices)
export const DEFAULT_SUPABASE_URL = "https://gutebfeczxaoeahoczde.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_i9oPqPbwmt4ZhL8NlGUHFQ__EmaD2-p";

const STORAGE_KEY_URL = "supabase_url";
const STORAGE_KEY_ANON_KEY = "supabase_anon_key";
const STORAGE_KEY_FORCE_LOCAL = "supabase_force_local";

let cachedClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } {
  // If user explicitly chose to force local/offline mode on this device
  if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY_FORCE_LOCAL) === "true") {
    return { url: "", anonKey: "" };
  }

  let url = "";
  let anonKey = "";

  if (typeof window !== "undefined") {
    url = localStorage.getItem(STORAGE_KEY_URL) || "";
    anonKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || "";
  }

  // Fallback to build-time environment variables
  if (!url && typeof import.meta !== "undefined" && import.meta.env) {
    url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  }
  if (!anonKey && typeof import.meta !== "undefined" && import.meta.env) {
    anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
  }

  // Default project credentials so any device connects automatically!
  if (!url) {
    url = DEFAULT_SUPABASE_URL;
  }
  if (!anonKey) {
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith("http"));
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey || !url.startsWith("http")) {
    return null;
  }

  if (cachedClient && currentUrl === url && currentKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    currentUrl = url;
    currentKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

export function setSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON_KEY, anonKey.trim());
    localStorage.removeItem(STORAGE_KEY_FORCE_LOCAL);
  }
  cachedClient = null;
  currentUrl = null;
  currentKey = null;
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON_KEY);
    localStorage.setItem(STORAGE_KEY_FORCE_LOCAL, "true");
  }
  cachedClient = null;
  currentUrl = null;
  currentKey = null;
}

export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string }> {
  const url = customUrl !== undefined ? customUrl.trim() : getSupabaseConfig().url;
  const key = customKey !== undefined ? customKey.trim() : getSupabaseConfig().anonKey;

  if (!url || !key || !url.startsWith("http")) {
    return {
      success: false,
      message: "يرجى التأكد من إدخال رابط المشروع (Project URL) ومفتاح الـ Anon Key بشكل صحيح.",
    };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await client.from("app_users").select("id").limit(1);

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return {
          success: false,
          message:
            "الاتصال بالسيرفر ناجح، ولكن الجداول غير موجودة بعد! يرجى تشغيل سكربت supabase_schema.sql في الـ SQL Editor لإنشاء الجداول.",
        };
      }
      return {
        success: false,
        message: `تعذر الاتصال بقاعدة البيانات: ${error.message}`,
      };
    }

    return {
      success: true,
      message: "تم الاتصال بسحابة Supabase بنجاح 🟢! قاعدة البيانات جاهزة للعمل.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع في الاتصال";
    return {
      success: false,
      message: `فشل الاتصال: ${msg}`,
    };
  }
}
