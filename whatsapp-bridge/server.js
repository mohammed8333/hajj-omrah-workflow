const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
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

// State
let sock = null;
let isConnected = false;
let currentQr = null;
let cachedGroups = [];

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
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["HajjOmrahWorkflow", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        isConnected = false;
        console.log("\n=======================================================");
        console.log("📲 امسح كود QR التالي من تطبيق الواتساب للربط:");
        console.log("=======================================================\n");
        qrcode.generate(qr, { small: true });
        console.log("\n(أو افتح http://localhost:5055/status لمعاينة الحالة)\n");
      }

      if (connection === "close") {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ اتصال الواتساب أُغلق (الرمز: ${statusCode}). إعادة الاتصال: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(startWhatsAppSocket, 3000);
        } else {
          console.log("❌ تم تسجيل الخروج من الواتساب. يرجى إعادة التشغيل لمسح كود QR جديد.");
        }
      } else if (connection === "open") {
        isConnected = true;
        currentQr = null;
        console.log("\n✅ تم الاتصال بحساب الواتساب بنجاح! خادم الإرسال جاهز للعمل.");
        try {
          await refreshGroups();
        } catch (e) {
          // ignore
        }
      }
    });
  } catch (err) {
    console.error("فشل بدء اتصال الواتساب:", err);
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
    }));
    return cachedGroups;
  } catch (e) {
    console.warn("تعذر جلب المجموعات:", e?.message);
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
        console.warn("Invite link resolution:", e?.message);
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
    groupsCount: cachedGroups.length,
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

// 3. Send Group Package
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
      return res.status(404).json({
        error:
          "تعذر العثور على المجموعة المحددة. يرجى التأكد من كتابة اسم المجموعة بدقة أو وضع رابطها.",
      });
    }

    console.log(`\n🚀 بدء إرسال حزمة المعاملة (نسك: ${nusukNumber}) إلى المجموعة: ${groupJid}...`);
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

    console.log(`✅ اكتمل إرسال حزمة المعاملة بنجاح (${sentResults.length} رسائل) إلى: ${groupJid}`);

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
    console.error("خطأ أثناء إرسال حزمة المجموعة:", err);
    res.status(500).json({
      error: err.message || "حدث خطأ غير متوقع أثناء إرسال الرسائل إلى مجموعة الواتساب",
    });
  }
});

// Start Server & WhatsApp Socket
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(`🚀 خادم WhatsApp Bridge يعمل بنجاح على: http://localhost:${PORT}`);
  console.log("=======================================================");
  startWhatsAppSocket();
});
