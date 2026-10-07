/**
 * Official Saudi eVisa Template Assets
 * References static assets in /visa-assets/ with runtime base64 caching
 * for 100% offline, print, and html2canvas PDF reliability without bundling massive string literals.
 */

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    const loc = window.location;
    const path = loc.pathname;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    return loc.origin + (dir || "/");
  }
  return "./";
}

export const VISA_ASSETS = {
  ksaVisaHeader: `${getBaseUrl()}visa-assets/ksa_visa_header.png`,
  saudiEmblemHeader: `${getBaseUrl()}visa-assets/saudi_emblem_header.png`,
  checkmarksDivider: `${getBaseUrl()}visa-assets/checkmarks_divider.png`,
  umrahGuideBox: `${getBaseUrl()}visa-assets/umrah_guide_box.png`,
  watermarkPattern: `${getBaseUrl()}visa-assets/visa_background_pattern.png`,
};

let isPreloaded = false;

export async function preloadVisaAssets(): Promise<typeof VISA_ASSETS> {
  if (isPreloaded || typeof window === "undefined") {
    return VISA_ASSETS;
  }

  const toDataUrl = async (url: string): Promise<string> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || url);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  try {
    const [ksa, emblem, divider, umrah, watermark] = await Promise.all([
      toDataUrl(VISA_ASSETS.ksaVisaHeader),
      toDataUrl(VISA_ASSETS.saudiEmblemHeader),
      toDataUrl(VISA_ASSETS.checkmarksDivider),
      toDataUrl(VISA_ASSETS.umrahGuideBox),
      toDataUrl(VISA_ASSETS.watermarkPattern),
    ]);

    VISA_ASSETS.ksaVisaHeader = ksa;
    VISA_ASSETS.saudiEmblemHeader = emblem;
    VISA_ASSETS.checkmarksDivider = divider;
    VISA_ASSETS.umrahGuideBox = umrah;
    VISA_ASSETS.watermarkPattern = watermark;
    isPreloaded = true;
  } catch (err) {
    console.warn("Could not preload visa assets as DataURLs:", err);
  }

  return VISA_ASSETS;
}
