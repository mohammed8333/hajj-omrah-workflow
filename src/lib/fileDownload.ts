/**
 * Reliable cross-origin and mobile-safe file downloader.
 * 
 * In modern web browsers (Chrome, Safari, iOS, Android), the HTML5 `download`
 * attribute on <a> tags is completely ignored for cross-origin URLs (e.g. Supabase Storage bucket URLs).
 * 
 * This helper fetches the file as a Blob and creates a same-origin Object URL,
 * ensuring the native download dialog appears with the exact desired filename.
 * If fetch is blocked by strict environment policies, it falls back to opening in a new tab.
 */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  if (!url) return;

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Keep object URL alive long enough for mobile browsers to finish saving
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 15000);
  } catch (err) {
    console.warn("Direct blob download failed, falling back to window.open:", err);
    const fallbackLink = document.createElement("a");
    fallbackLink.href = url;
    fallbackLink.target = "_blank";
    fallbackLink.rel = "noopener noreferrer";
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  }
}
