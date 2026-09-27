const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
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
let currentQrDataUrl = null;
let cachedGroups = [];

const AUTH_DIR = path.join(__dirname, "auth_info");
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function clearAuthDir() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        } catch {}
      }
      console.log("🧹 تم مسح ملفات الجلسة القديمة بنجاح.");
    }
  } catch (e) {
    console.warn("تعذر مسح مجلد الجلسة:", e.message);
  }
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

// Group Messages Store (in memory, up to 300 messages per group)
const groupMessageStore = new Map();
const MAX_MESSAGES_PER_GROUP = 300;

function storeGroupMessage(msg) {
  if (!msg || !msg.key) return;
  const groupJid = msg.key.remoteJid;
  if (!groupJid || !groupJid.endsWith("@g.us")) return;

  if (!groupMessageStore.has(groupJid)) {
    groupMessageStore.set(groupJid, []);
  }

  const list = groupMessageStore.get(groupJid);
  const msgId = msg.key.id;
  if (list.some((m) => m.key && m.key.id === msgId)) return;

  list.push(msg);
  if (list.length > MAX_MESSAGES_PER_GROUP) {
    list.shift();
  }
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
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr);
        } catch (err) {}
        console.log("\n=======================================================");
        console.log("📲 امسح كود QR التالي من تطبيق الواتساب للربط:");
        console.log("=======================================================\n");
        qrcode.generate(qr, { small: true });
        console.log("\n(أو افتح شاشة الأدمن لمعاينة كود QR)\n");
      }

      if (connection === "close") {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        console.log(`⚠️ اتصال الواتساب أُغلق (الرمز: ${statusCode}). تسجيل خروج: ${isLoggedOut}`);
        if (isLoggedOut) {
          console.log("🔄 تم تسجيل الخروج. جاري مسح الجلسة القديمة والبدء بكود QR جديد...");
          clearAuthDir();
          setTimeout(startWhatsAppSocket, 1500);
        } else {
          setTimeout(startWhatsAppSocket, 3000);
        }
      } else if (connection === "open") {
        isConnected = true;
        currentQr = null;
        currentQrDataUrl = null;
        console.log("\n✅ تم الاتصال بحساب الواتساب بنجاح! خادم الإرسال جاهز للعمل.");
        try {
          await refreshGroups();
        } catch (e) {
          // ignore
        }
      }
    });

    // Listen to incoming messages to buffer group chats
    sock.ev.on("messages.upsert", async ({ messages }) => {
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          storeGroupMessage(msg);
        }
      }
    });

    // Listen to synced history
    sock.ev.on("messaging-history.set", ({ messages }) => {
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          storeGroupMessage(msg);
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
    qrImage: currentQrDataUrl,
    groupsCount: cachedGroups.length,
    timestamp: new Date().toISOString(),
  });
});

// Reset session & clear auth
app.post("/reset-session", async (req, res) => {
  try {
    console.log("🔄 طلب إعادة ضبط جلسة الواتساب ومسح المفاتيح القديمة...");
    isConnected = false;
    currentQr = null;
    currentQrDataUrl = null;
    if (sock) {
      try {
        sock.end();
      } catch (err) {}
      sock = null;
    }
    clearAuthDir();
    setTimeout(startWhatsAppSocket, 1000);
    res.json({ success: true, message: "تمت إعادة ضبط الجلسة، جاري توليد كود QR جديد" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

// --- Helper Functions for Phone & Passport Extraction ---

function extractPhoneNumbers(text) {
  if (!text || typeof text !== "string") return [];
  const easternDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let normalized = text.replace(/[٠-٩]/g, (w) => easternDigits.indexOf(w).toString());
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");

  const results = new Set();

  // Egyptian phones: 010, 011, 012, 015
  const egRegex = /(?:(?:\+|00)?20)?0?1[0125]\d{8}\b/g;
  let match;
  while ((match = egRegex.exec(normalized)) !== null) {
    let clean = match[0].replace(/^[+0]+/, "");
    if (!clean.startsWith("20")) clean = "20" + clean;
    results.add("+" + clean);
  }

  // Saudi phones: 05...
  const saRegex = /(?:(?:\+|00)?966)?0?5\d{8}\b/g;
  while ((match = saRegex.exec(normalized)) !== null) {
    let clean = match[0].replace(/^[+0]+/, "");
    if (!clean.startsWith("966")) clean = "966" + clean;
    results.add("+" + clean);
  }

  // General international phones: 9 to 15 digits
  const genRegex = /(?:\+|00)\d{9,14}\b/g;
  while ((match = genRegex.exec(normalized)) !== null) {
    let clean = match[0].replace(/^[+0]+/, "");
    results.add("+" + clean);
  }

  return Array.from(results);
}

function getMessageImage(msg) {
  if (!msg || !msg.message) return null;
  const m = msg.message;
  return (
    m.imageMessage ||
    m.viewOnceMessage?.message?.imageMessage ||
    m.viewOnceMessageV2?.message?.imageMessage ||
    (m.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.startsWith("image/")
      ? m.documentWithCaptionMessage.message.documentMessage
      : null) ||
    (m.documentMessage?.mimetype?.startsWith("image/") ? m.documentMessage : null)
  );
}

function getMessageText(msg) {
  if (!msg || !msg.message) return "";
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ""
  );
}

function getQuotedMessageStanzaId(msg) {
  if (!msg || !msg.message) return null;
  const m = msg.message;
  const context =
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.documentMessage?.contextInfo ||
    m.documentWithCaptionMessage?.message?.documentMessage?.contextInfo;
  return context?.stanzaId || null;
}

async function downloadImageAsBase64(msg) {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: pino({ level: "silent" }),
        reuploadRequest: sock?.updateMediaMessage,
      }
    );
    if (!buffer) return null;
    const imgObj = getMessageImage(msg);
    const mimetype = imgObj?.mimetype || "image/jpeg";
    return `data:${mimetype};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.warn("فشل تنزيل صورة الميديا:", err.message);
    return null;
  }
}

async function scanAndPairGroupMessages(groupJid, limit = 100) {
  const allMsgs = groupMessageStore.get(groupJid) || [];
  const msgs = allMsgs.slice(-limit);

  const images = [];
  const textPhones = [];

  for (const m of msgs) {
    const timestamp = Number(m.messageTimestamp || Date.now() / 1000);
    const sender = m.key?.participant || m.participant || m.key?.remoteJid || "";
    const pushName = m.pushName || "";
    const msgId = m.key?.id;

    const img = getMessageImage(m);
    const text = getMessageText(m);
    const phones = extractPhoneNumbers(text);
    const quotedStanzaId = getQuotedMessageStanzaId(m);

    if (img) {
      images.push({
        id: msgId,
        rawMsg: m,
        sender,
        pushName,
        timestamp,
        caption: text,
        phonesInCaption: phones,
        quotedStanzaId,
      });
    }

    if (phones.length > 0) {
      textPhones.push({
        id: msgId,
        sender,
        pushName,
        timestamp,
        text,
        phones,
        quotedStanzaId,
      });
    }
  }

  const pairs = [];
  const usedImageIds = new Set();
  const usedPhoneIds = new Set();

  // 1. Direct Caption: Image has phone in caption
  for (const img of images) {
    if (img.phonesInCaption.length > 0) {
      const imgBase64 = await downloadImageAsBase64(img.rawMsg);
      if (imgBase64) {
        pairs.push({
          id: `pair_${img.id}`,
          sender: img.sender,
          senderName: img.pushName,
          timestamp: img.timestamp,
          phoneNumber: img.phonesInCaption[0],
          additionalPhones: img.phonesInCaption.slice(1),
          imageBase64: imgBase64,
          matchedBy: "caption",
          details: "تم التقاط الرقم مباشرة من وصف صورة الجواز",
        });
        usedImageIds.add(img.id);
      }
    }
  }

  // 2. Reply / Quoted: Text replied to image OR image replied to text
  for (const img of images) {
    if (usedImageIds.has(img.id)) continue;

    const replyingPhone = textPhones.find(
      (tp) => !usedPhoneIds.has(tp.id) && tp.quotedStanzaId === img.id
    );
    if (replyingPhone) {
      const imgBase64 = await downloadImageAsBase64(img.rawMsg);
      if (imgBase64) {
        pairs.push({
          id: `pair_${img.id}_${replyingPhone.id}`,
          sender: replyingPhone.sender || img.sender,
          senderName: replyingPhone.pushName || img.pushName,
          timestamp: Math.max(img.timestamp, replyingPhone.timestamp),
          phoneNumber: replyingPhone.phones[0],
          additionalPhones: replyingPhone.phones.slice(1),
          imageBase64: imgBase64,
          matchedBy: "reply",
          details: "تم ربط الرقم بالرد المباشر (Reply) على صورة الجواز",
        });
        usedImageIds.add(img.id);
        usedPhoneIds.add(replyingPhone.id);
        continue;
      }
    }

    if (img.quotedStanzaId) {
      const quotedPhone = textPhones.find(
        (tp) => !usedPhoneIds.has(tp.id) && tp.id === img.quotedStanzaId
      );
      if (quotedPhone) {
        const imgBase64 = await downloadImageAsBase64(img.rawMsg);
        if (imgBase64) {
          pairs.push({
            id: `pair_${img.id}_${quotedPhone.id}`,
            sender: img.sender,
            senderName: img.pushName,
            timestamp: Math.max(img.timestamp, quotedPhone.timestamp),
            phoneNumber: quotedPhone.phones[0],
            additionalPhones: quotedPhone.phones.slice(1),
            imageBase64: imgBase64,
            matchedBy: "reply",
            details: "تم ربط صورة الجواز كاقتباس لرسالة رقم التليفون",
          });
          usedImageIds.add(img.id);
          usedPhoneIds.add(quotedPhone.id);
          continue;
        }
      }
    }
  }

  // 3. Proximity / Same Sender within 15 minutes window (any order: photo first or phone first)
  for (const img of images) {
    if (usedImageIds.has(img.id)) continue;

    let bestPhone = null;
    let minDiff = Infinity;

    for (const tp of textPhones) {
      if (usedPhoneIds.has(tp.id)) continue;
      if (tp.sender === img.sender) {
        const timeDiff = Math.abs(tp.timestamp - img.timestamp);
        if (timeDiff <= 900 && timeDiff < minDiff) {
          minDiff = timeDiff;
          bestPhone = tp;
        }
      }
    }

    if (bestPhone) {
      const imgBase64 = await downloadImageAsBase64(img.rawMsg);
      if (imgBase64) {
        const timeText =
          bestPhone.timestamp >= img.timestamp
            ? `أُرسل الرقم بعد الجواز بـ ${Math.round(minDiff)} ثانية`
            : `أُرسل الجواز بعد الرقم بـ ${Math.round(minDiff)} ثانية`;

        pairs.push({
          id: `pair_${img.id}_${bestPhone.id}`,
          sender: img.sender,
          senderName: img.pushName || bestPhone.pushName,
          timestamp: Math.max(img.timestamp, bestPhone.timestamp),
          phoneNumber: bestPhone.phones[0],
          additionalPhones: bestPhone.phones.slice(1),
          imageBase64: imgBase64,
          matchedBy: "proximity",
          details: `ربط ذكي لنفس المرسل (${timeText})`,
        });
        usedImageIds.add(img.id);
        usedPhoneIds.add(bestPhone.id);
      }
    }
  }

  // 4. Unpaired images (e.g. passport arrived but phone is pending)
  for (const img of images) {
    if (usedImageIds.has(img.id)) continue;
    const imgBase64 = await downloadImageAsBase64(img.rawMsg);
    if (imgBase64) {
      pairs.push({
        id: `pair_${img.id}_unpaired`,
        sender: img.sender,
        senderName: img.pushName,
        timestamp: img.timestamp,
        phoneNumber: "",
        additionalPhones: [],
        imageBase64: imgBase64,
        matchedBy: "unpaired",
        details: "جواز سفر في انتظار إرسال رقم التليفون أو كتابته يدوياً",
      });
      usedImageIds.add(img.id);
    }
  }

  pairs.sort((a, b) => b.timestamp - a.timestamp);
  return pairs;
}

// 4. Scan Group for Passports & Phone Numbers
app.post("/scan-group-phones", async (req, res) => {
  try {
    if (!sock || !isConnected) {
      return res.status(503).json({
        error: "خدمة الواتساب غير متصلة حالياً. يرجى مسح كود QR أولاً.",
      });
    }

    const { targetGroup, groupLink, limit = 100 } = req.body;
    let groupJid = await resolveGroupJid(targetGroup || groupLink);

    if (!groupJid && targetGroup && targetGroup.includes("@g.us")) {
      groupJid = targetGroup;
    }

    if (!groupJid) {
      return res.status(404).json({
        error: "تعذر العثور على المجموعة المحددة في الواتساب.",
      });
    }

    console.log(`\n🔍 فحص رسائل المجموعة (${groupJid}) لجلب صور الجوازات وأرقام الهواتف...`);
    const pairs = await scanAndPairGroupMessages(groupJid, Number(limit) || 100);

    res.json({
      success: true,
      groupJid,
      count: pairs.length,
      pairs,
    });
  } catch (err) {
    console.error("خطأ أثناء فحص أرقام المجموعة:", err);
    res.status(500).json({
      error: err.message || "حدث خطأ أثناء فحص أرقام الهواتف والجوازات من المجموعة",
    });
  }
});

// 5. Test / Simulation endpoint: add mock passport + phone for Admin testing
app.post("/simulate-incoming-passport", (req, res) => {
  try {
    const { targetGroup, phoneNumber, imageBase64, senderName } = req.body;
    if (!phoneNumber || !imageBase64) {
      return res.status(400).json({ error: "رقم الهاتف وصورة الجواز مطلوبان للتجربة" });
    }

    const simPair = {
      id: `sim_${Date.now()}`,
      sender: "simulated_user",
      senderName: senderName || "مرسل تجريبي",
      timestamp: Math.floor(Date.now() / 1000),
      phoneNumber,
      additionalPhones: [],
      imageBase64,
      matchedBy: "simulation",
      details: "إدخال تجريبي لاختبار الربط والاعتماد",
    };

    res.json({
      success: true,
      pair: simPair,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server & WhatsApp Socket
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(`🚀 خادم WhatsApp Bridge يعمل بنجاح على: http://localhost:${PORT}`);
  console.log("=======================================================");
  startWhatsAppSocket();
});
