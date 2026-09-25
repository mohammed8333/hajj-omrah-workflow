const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 5055;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static frontend files
const PUBLIC_DIR = path.join(__dirname, "public");
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
app.use(express.static(PUBLIC_DIR));

// State
let sock = null;
let isConnected = false;
let currentQr = null;
let currentQrDataUrl = null;
let cachedGroups = [];
let connectedUser = null;
const recentLogs = [];

function addLog(type, message) {
  const item = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    time: new Date().toLocaleTimeString("ar-EG"),
    timestamp: Date.now(),
    type, // 'info' | 'success' | 'warn' | 'error'
    message,
  };
  recentLogs.unshift(item);
  if (recentLogs.length > 80) recentLogs.pop();
  console.log(`[${item.time}] [${type.toUpperCase()}] ${message}`);
}

const AUTH_DIR = path.join(__dirname, "auth_info");
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Utility delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: parse Base64 data URL
function parseBase64Data(dataUrl) {
  if (!dataUrl) return null;
  if (!dataUrl.includes(";base64,")) {
    return {
      buffer: Buffer.from(dataUrl, "base64"),
      mimetype: "application/octet-stream",
    };
  }
  const parts = dataUrl.split(";base64,");
  const mimetype = parts[0].replace("data:", "");
  const buffer = Buffer.from(parts[1], "base64");
  return { buffer, mimetype };
}

// Initialize WhatsApp Socket
async function startWhatsAppSocket() {
  try {
    addLog("info", "جاري تهيئة خادم واتساب (Baileys)...");
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["مسار الحج والعمرة", "Chrome", "2.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        isConnected = false;
        connectedUser = null;
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, {
            width: 340,
            margin: 2,
            color: {
              dark: "#065f46",
              light: "#ffffff",
            },
          });
        } catch (e) {
          console.error("QR Code generation error:", e);
        }

        addLog("warn", "تم إصدار كود QR جديد وبانتظار المسح من تطبيق الواتساب.");
        console.log("\n=======================================================");
        console.log("📲 كود QR متاح الآن على شاشة الويب: http://localhost:5055");
        console.log("=======================================================\n");
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === "close") {
        isConnected = false;
        connectedUser = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        addLog(
          "warn",
          `انقطع اتصال الواتساب (الرمز: ${statusCode || "غير معروف"}). إعادة المحاولة: ${
            shouldReconnect ? "نعم" : "لا (تم تسجيل الخروج)"
          }`
        );

        if (shouldReconnect) {
          setTimeout(startWhatsAppSocket, 3000);
        } else {
          addLog("error", "تم تسجيل الخروج من جلسة الواتساب. يلزم مسح كود QR جديد.");
          currentQr = null;
          currentQrDataUrl = null;
        }
      } else if (connection === "open") {
        isConnected = true;
        currentQr = null;
        currentQrDataUrl = null;

        // Parse user profile
        try {
          const rawId = sock?.user?.id || "";
          const phone = rawId.split("@")[0].split(":")[0];
          connectedUser = {
            id: rawId,
            phone: phone ? `+${phone}` : "غير معروف",
            name: sock?.user?.name || "حساب الواتساب المرتبط",
          };
        } catch (e) {
          connectedUser = { id: "", phone: "متصل", name: "حساب الواتساب" };
        }

        addLog("success", `✅ تم الاتصال بحساب الواتساب بنجاح! (${connectedUser.phone})`);
        try {
          await refreshGroups();
        } catch (e) {
          // ignore
        }
      }
    });
  } catch (err) {
    addLog("error", `فشل بدء اتصال الواتساب: ${err.message}`);
    setTimeout(startWhatsAppSocket, 5000);
  }
}

// Fetch list of groups
async function refreshGroups() {
  if (!sock || !isConnected) return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    cachedGroups = Object.values(groups).map((g) => ({
      id: g.id,
      subject: g.subject || "مجموعة بدون اسم",
      participantsCount: g.participants?.length || 0,
      creation: g.creation ? new Date(g.creation * 1000).toLocaleDateString("ar-SA") : null,
      desc: g.desc ? g.desc.toString() : "",
    }));
    addLog("info", `تم تحديث قائمة المجموعات (${cachedGroups.length} مجموعة مسجلة).`);
    return cachedGroups;
  } catch (e) {
    addLog("warn", `تعذر جلب المجموعات: ${e?.message}`);
    return cachedGroups;
  }
}

// Resolve Group JID from input (JID, Link, or Name)
async function resolveGroupJid(targetInput) {
  if (!targetInput) return null;
  const cleanInput = targetInput.trim();

  // If directly a JID
  if (cleanInput.endsWith("@g.us")) {
    return cleanInput;
  }

  // If invite link
  if (cleanInput.includes("chat.whatsapp.com/")) {
    const code = cleanInput.split("chat.whatsapp.com/")[1]?.split(/[\s?&#]/)[0];
    if (code) {
      try {
        const info = await sock.groupGetInviteInfo(code);
        if (info?.id) {
          return `${info.id}@g.us`;
        }
      } catch (e) {
        addLog("warn", `تعذر استخراج بيانات رابط الدعوة: ${e?.message}`);
      }
    }
  }

  // Match by subject / name
  if (cachedGroups.length === 0) {
    await refreshGroups();
  }
  const found = cachedGroups.find(
    (g) => g.subject.toLowerCase() === cleanInput.toLowerCase() || g.id === cleanInput
  );
  if (found) return found.id;

  // Fuzzy match
  const partial = cachedGroups.find((g) =>
    g.subject.toLowerCase().includes(cleanInput.toLowerCase())
  );
  if (partial) return partial.id;

  return null;
}

// --- API Endpoints ---

// 1. Status Check
app.get("/status", async (req, res) => {
  res.json({
    online: true,
    connected: isConnected,
    hasQr: Boolean(currentQr),
    qrRaw: currentQr,
    qrDataUrl: currentQrDataUrl,
    groupsCount: cachedGroups.length,
    user: connectedUser,
    logs: recentLogs.slice(0, 30),
    timestamp: new Date().toISOString(),
  });
});

// 2. Groups List
app.get("/groups", async (req, res) => {
  if (!isConnected) {
    return res.status(400).json({ error: "الواتساب غير متصل حالياً" });
  }
  const groups = await refreshGroups();
  res.json({ groups });
});

// 3. Refresh Groups (POST)
app.post("/groups/refresh", async (req, res) => {
  if (!isConnected) {
    return res.status(400).json({ error: "الواتساب غير متصل حالياً" });
  }
  const groups = await refreshGroups();
  res.json({ success: true, count: groups.length, groups });
});

// 4. Test Message Sender
app.post("/send-test", async (req, res) => {
  try {
    if (!sock || !isConnected) {
      return res.status(503).json({ error: "الواتساب غير متصل حالياً. تأكد من مسح كود QR أولاً." });
    }
    const { target, message } = req.body;
    if (!target || !message) {
      return res.status(400).json({ error: "يرجى تحديد الوجهة (رقم هاتف أو مجموعة) ونص الرسالة" });
    }

    let targetJid = null;
    if (target.includes("@g.us") || target.includes("@s.whatsapp.net")) {
      targetJid = target;
    } else if (target.includes("chat.whatsapp.com/")) {
      targetJid = await resolveGroupJid(target);
    } else {
      const cleanPhone = target.replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 8) {
        targetJid = `${cleanPhone}@s.whatsapp.net`;
      } else {
        targetJid = await resolveGroupJid(target);
      }
    }

    if (!targetJid) {
      return res.status(404).json({ error: "تعذر العثور على الرقم أو المجموعة المحددة" });
    }

    addLog("info", `إرسال رسالة تجريبية إلى: ${targetJid}`);
    const result = await sock.sendMessage(targetJid, { text: message });
    addLog("success", `تم إرسال الرسالة التجريبية بنجاح ✓ (${result?.key?.id || "OK"})`);

    res.json({
      success: true,
      message: "تم إرسال الرسالة التجريبية بنجاح ✓",
      id: result?.key?.id,
      targetJid,
    });
  } catch (err) {
    addLog("error", `فشل الإرسال التجريبي: ${err.message}`);
    res.status(500).json({ error: err.message || "فشل إرسال الرسالة" });
  }
});

// 5. Send Group Package
app.post("/send-group-package", async (req, res) => {
  try {
    if (!sock || !isConnected) {
      return res.status(503).json({
        error: "خدمة الواتساب غير متصلة حالياً. تأكد من مسح كود QR في شاشة السيرفر.",
      });
    }

    const {
      targetGroup,
      groupLink,
      nusukNumber,
      hasHosting,
      hostPhone,
      hostIdFileBase64,
      hostIdFileName,
      ticketFileBase64,
      ticketFileName,
    } = req.body;

    if (!nusukNumber) {
      return res.status(400).json({ error: "رقم نسك مطلوب لإرسال المعاملة" });
    }

    // Resolve target group JID
    let groupJid = await resolveGroupJid(targetGroup || groupLink);

    // Fallback: if user passed JID in targetGroup or groupLink
    if (!groupJid && targetGroup && targetGroup.includes("@g.us")) {
      groupJid = targetGroup;
    }

    if (!groupJid) {
      addLog("error", `تعذر العثور على المجموعة: "${targetGroup || groupLink}"`);
      return res.status(404).json({
        error:
          "تعذر العثور على المجموعة المحددة. يرجى التأكد من كتابة اسم المجموعة بدقة أو وضع رابطها.",
      });
    }

    addLog("info", `🚀 بدء إرسال حزمة المعاملة (نسك: ${nusukNumber}) إلى المجموعة: ${groupJid}...`);
    const sentResults = [];

    // Message 1: الفاصل العلوي
    const m1 = await sock.sendMessage(groupJid, { text: "=============================" });
    sentResults.push({ step: 1, type: "header", id: m1?.key?.id });
    await sleep(600);

    // Message 2: رسالة الطلب
    let requestText =
      "ارجو عمل اتفاقيه سكن طرفكم\n" +
      "+ ارسال طلب اعاشه طرفنا\n";

    if (hasHosting) {
      requestText += "+ ارسال طلب استضافه\n";
    }

    requestText += `للمجموعة التالية ${nusukNumber}`;

    const m2 = await sock.sendMessage(groupJid, { text: requestText });
    sentResults.push({ step: 2, type: "request_text", id: m2?.key?.id });
    await sleep(700);

    // Message 3: هوية المستضيف (فقط في حال وجود استضافة)
    if (hasHosting && hostIdFileBase64) {
      const parsedHost = parseBase64Data(hostIdFileBase64);
      if (parsedHost) {
        const isImage = parsedHost.mimetype.startsWith("image/");
        let m3;
        if (isImage) {
          m3 = await sock.sendMessage(groupJid, {
            image: parsedHost.buffer,
            caption: "هوية المستضيف",
            mimetype: parsedHost.mimetype,
          });
        } else {
          m3 = await sock.sendMessage(groupJid, {
            document: parsedHost.buffer,
            fileName: hostIdFileName || "هوية المستضيف.pdf",
            mimetype: parsedHost.mimetype,
          });
        }
        sentResults.push({ step: 3, type: "host_id", id: m3?.key?.id });
        await sleep(700);
      }
    }

    // Message 4: تذكرة الطيران المشتركة
    if (ticketFileBase64) {
      const parsedTicket = parseBase64Data(ticketFileBase64);
      if (parsedTicket) {
        const isImage = parsedTicket.mimetype.startsWith("image/");
        let m4;
        if (isImage) {
          m4 = await sock.sendMessage(groupJid, {
            image: parsedTicket.buffer,
            caption: "تذكرة الطيران",
            mimetype: parsedTicket.mimetype,
          });
        } else {
          m4 = await sock.sendMessage(groupJid, {
            document: parsedTicket.buffer,
            fileName: ticketFileName || "تذكرة الطيران.pdf",
            mimetype: parsedTicket.mimetype,
          });
        }
        sentResults.push({ step: 4, type: "ticket", id: m4?.key?.id });
        await sleep(700);
      }
    }

    // Message 5: رقم هاتف المستضيف (فقط في حال وجود استضافة)
    if (hasHosting && hostPhone && hostPhone.trim()) {
      let formattedPhone = hostPhone.trim();
      if (!formattedPhone.startsWith("+") && formattedPhone.startsWith("05")) {
        formattedPhone = "+966" + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith("+") && formattedPhone.startsWith("5")) {
        formattedPhone = "+966" + formattedPhone;
      }
      const m5 = await sock.sendMessage(groupJid, { text: formattedPhone });
      sentResults.push({ step: 5, type: "host_phone", id: m5?.key?.id });
      await sleep(600);
    }

    // Message 6: الفاصل الختامي
    const m6 = await sock.sendMessage(groupJid, { text: "=============================" });
    sentResults.push({ step: 6, type: "footer", id: m6?.key?.id });

    addLog("success", `✅ اكتمل إرسال حزمة المعاملة بنجاح (${sentResults.length} رسائل) إلى: ${groupJid}`);

    // Return success with web URL to verify
    const webVerifyUrl = groupLink || `https://web.whatsapp.com`;

    res.json({
      success: true,
      message: `تم إرسال حزمة المعاملة (${sentResults.length} رسائل) بنجاح إلى المجموعة!`,
      sentCount: sentResults.length,
      groupJid,
      webVerifyUrl,
    });
  } catch (err) {
    addLog("error", `خطأ أثناء إرسال حزمة المجموعة: ${err.message}`);
    res.status(500).json({
      error: err.message || "حدث خطأ غير متوقع أثناء إرسال الرسائل إلى مجموعة الواتساب",
    });
  }
});

// 6. Logout & Clear Credentials
app.post("/logout", async (req, res) => {
  try {
    addLog("warn", "طلب تسجيل الخروج وحذف بيانات الجلسة بالكامل...");
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {}
      try {
        sock.end();
      } catch (e) {}
    }

    isConnected = false;
    currentQr = null;
    currentQrDataUrl = null;
    connectedUser = null;
    cachedGroups = [];

    // Clear auth_info files
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        } catch (e) {}
      }
    }

    addLog("info", "تم حذف بيانات الجلسة، جاري إعادة تشغيل السيرفر لتوليد كود QR جديد...");
    setTimeout(startWhatsAppSocket, 1500);

    res.json({ success: true, message: "تم تسجيل الخروج بنجاح وجاري إعداد كود QR جديد" });
  } catch (err) {
    addLog("error", `فشل تسجيل الخروج: ${err.message}`);
    res.status(500).json({ error: err.message || "فشل تسجيل الخروج" });
  }
});

// 7. Reconnect Socket
app.post("/reconnect", async (req, res) => {
  try {
    addLog("info", "إعادة تشغيل اتصال الواتساب يدوياً...");
    if (sock) {
      try {
        sock.end();
      } catch (e) {}
    }
    setTimeout(startWhatsAppSocket, 1000);
    res.json({ success: true, message: "جاري إعادة الاتصال..." });
  } catch (err) {
    res.status(500).json({ error: err.message || "فشل إعادة الاتصال" });
  }
});

// 8. Recent Logs
app.get("/logs", (req, res) => {
  res.json({ logs: recentLogs });
});

// 9. Clear Logs
app.delete("/logs", (req, res) => {
  recentLogs.length = 0;
  res.json({ success: true, message: "تم مسح سجل الأحداث" });
});

// Fallback: serve index.html for root or SPA
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start Server & WhatsApp Socket
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(`🚀 خادم WhatsApp Bridge يعمل بنجاح على: http://localhost:${PORT}`);
  console.log(`💻 لوحة التحكم مدمجة ومتاحة على: http://localhost:${PORT}`);
  console.log("=======================================================");
  startWhatsAppSocket();
});
