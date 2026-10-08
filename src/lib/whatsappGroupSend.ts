import { api } from "@/lib/api";

const BRIDGE_URL = "http://localhost:5055";
const STORAGE_KEY_GROUP = "safa_whatsapp_target_group";
const STORAGE_KEY_LINK = "safa_whatsapp_target_link";

export interface SendWhatsAppGroupPackageParams {
  nusukNumber: string;
  hasHosting: boolean;
  hostPhone?: string;
  contactPhone?: string;
  ticketDocId?: string;
  ticketDocUrl?: string;
  hostDocId?: string;
  hostDocUrl?: string;
  preOpenedWindow?: Window | null;
  customGroupLink?: string;
}

export function generateWhatsAppGroupMessageText(params: {
  nusukNumber: string;
  hasHosting: boolean;
  hostPhone?: string;
  contactPhone?: string;
}): string {
  const nusukNum = params.nusukNumber || "---";
  let text =
    "=============================\n" +
    "ارجو عمل اتفاقيه سكن طرفكم\n" +
    "+ ارسال طلب اعاشه طرفنا\n";
  if (params.hasHosting) {
    text += "+ ارسال طلب استضافه\n";
  }
  text += `للمجموعة التالية ${nusukNum}\n`;

  const hostContact = params.hostPhone || params.contactPhone;
  if (params.hasHosting && hostContact) {
    text += `\nرقم المستضيف:\n${hostContact}\n`;
  }
  text += "=============================";
  return text;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

const fetchDocBase64 = async (
  docId?: string,
  fallbackUrl?: string,
  defaultName: string = "document"
): Promise<{ base64: string; name: string } | null> => {
  if (!docId && !fallbackUrl) return null;
  try {
    let url = fallbackUrl;
    if (docId) {
      url = await api.documents.getStreamUrl(docId);
    }
    if (!url) return null;
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: reader.result as string,
          name: defaultName,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Doc to base64 conversion failed:", e);
    return null;
  }
};

const triggerDownload = async (
  docId?: string,
  fallbackUrl?: string,
  defaultFileName: string = "document.pdf"
) => {
  if (!docId && !fallbackUrl) return;
  try {
    let url = fallbackUrl;
    if (docId) {
      url = await api.documents.getStreamUrl(docId);
    }
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.warn("Download document failed:", e);
  }
};

export async function sendWhatsAppGroupPackage(
  params: SendWhatsAppGroupPackageParams
): Promise<{ success: boolean; bridgeSent: boolean; message: string; whatsappUrl: string }> {
  let groupLink =
    (params.customGroupLink !== undefined
      ? params.customGroupLink.trim()
      : (typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_LINK)
          : "")) || "";

  if (params.customGroupLink !== undefined && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_LINK, params.customGroupLink.trim());
  }

  const targetGroup =
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_GROUP)
      : "") || "";

  // 1. Copy formatted text to clipboard (guaranteed copy)
  const messageText = generateWhatsAppGroupMessageText(params);
  await copyToClipboard(messageText);

  // 2. Check if local Bridge is online (quick check with 500ms timeout)
  let bridgeConnected = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`${BRIDGE_URL}/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      bridgeConnected = Boolean(data.connected);
    }
  } catch {
    bridgeConnected = false;
  }

  if (bridgeConnected) {
    try {
      const ticketResult = await fetchDocBase64(
        params.ticketDocId,
        params.ticketDocUrl,
        "تذكرة_الطيران.pdf"
      );
      let hostResult = null;
      if (params.hasHosting) {
        hostResult = await fetchDocBase64(
          params.hostDocId,
          params.hostDocUrl,
          "هوية_المستضيف.jpg"
        );
      }

      const payload = {
        targetGroup: targetGroup.trim() || groupLink.trim(),
        groupLink: groupLink.trim() || undefined,
        nusukNumber: params.nusukNumber.trim(),
        hasHosting: Boolean(params.hasHosting),
        hostPhone: params.hostPhone || params.contactPhone || undefined,
        hostIdFileBase64: hostResult?.base64,
        hostIdFileName: hostResult?.name,
        ticketFileBase64: ticketResult?.base64,
        ticketFileName: ticketResult?.name,
      };

      const res = await fetch(`${BRIDGE_URL}/send-group-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const urlToOpen =
          groupLink.trim() || data.webVerifyUrl || "https://web.whatsapp.com";
        if (params.preOpenedWindow && !params.preOpenedWindow.closed) {
          params.preOpenedWindow.location.href = urlToOpen;
        } else {
          window.open(urlToOpen, "_blank");
        }
        return {
          success: true,
          bridgeSent: true,
          message: "تم إرسال حزمة المعاملة والمستندات لمجموعة الواتساب بنجاح 📲",
          whatsappUrl: urlToOpen,
        };
      }
    } catch (e) {
      console.warn("Bridge send failed, falling back to direct link:", e);
    }
  }

  // 3. Fallback: Download documents immediately
  if (params.ticketDocId || params.ticketDocUrl) {
    triggerDownload(params.ticketDocId, params.ticketDocUrl, "تذكرة_الطيران.pdf");
  }
  if (params.hasHosting && (params.hostDocId || params.hostDocUrl)) {
    setTimeout(() => {
      triggerDownload(params.hostDocId, params.hostDocUrl, "هوية_المستضيف.jpg");
    }, 200);
  }

  // 4. Construct WhatsApp URL:
  // If a group link was provided (e.g. https://chat.whatsapp.com/...), use it.
  // Otherwise, open WhatsApp Web with pre-filled message text.
  let targetUrl = groupLink.trim();
  if (!targetUrl) {
    targetUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  }

  if (params.preOpenedWindow && !params.preOpenedWindow.closed) {
    params.preOpenedWindow.location.href = targetUrl;
  } else {
    try {
      const opened = window.open(targetUrl, "_blank");
      if (!opened) {
        // In case popup was blocked, redirect current tab or fallback
        console.warn("Popup blocked by browser");
      }
    } catch (e) {
      console.warn("window.open failed:", e);
    }
  }

  return {
    success: true,
    bridgeSent: false,
    message: "تم نسخ رسالة المعاملة وتجهيزها وفتح الواتساب 📲",
    whatsappUrl: targetUrl,
  };
}

