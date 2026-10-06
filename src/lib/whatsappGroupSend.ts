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
): Promise<{ success: boolean; bridgeSent: boolean; message: string }> {
  const groupLink =
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_LINK)
      : "") || "";
  const targetGroup =
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_GROUP)
      : "") || "";

  // 1. Copy formatted text to clipboard
  const messageText = generateWhatsAppGroupMessageText(params);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(messageText);
    }
  } catch (err) {
    console.warn("Clipboard copy failed:", err);
  }

  // 2. Check if local Bridge is online
  let bridgeConnected = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
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
        window.open(urlToOpen, "_blank");
        return {
          success: true,
          bridgeSent: true,
          message: "تم إرسال حزمة المعاملة والمستندات لمجموعة الواتساب بنجاح 📲",
        };
      }
    } catch (e) {
      console.warn("Bridge send failed, falling back to manual:", e);
    }
  }

  // Fallback: Download documents and open WhatsApp link or Web
  if (params.ticketDocId || params.ticketDocUrl) {
    triggerDownload(params.ticketDocId, params.ticketDocUrl, "تذكرة_الطيران.pdf");
  }
  if (params.hasHosting && (params.hostDocId || params.hostDocUrl)) {
    setTimeout(() => {
      triggerDownload(params.hostDocId, params.hostDocUrl, "هوية_المستضيف.jpg");
    }, 300);
  }

  setTimeout(() => {
    const url = groupLink.trim() || "https://web.whatsapp.com";
    window.open(url, "_blank");
  }, 600);

  return {
    success: true,
    bridgeSent: false,
    message: "تم نسخ رسالة المعاملة وجاري فتح الواتساب 📲",
  };
}
