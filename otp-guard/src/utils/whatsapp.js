// ربط واتساب عبر QR — Stub جاهز للاستبدال بمكتبة whatsapp-web.js الحقيقية
// في وضع الإنتاج: ثبّت "whatsapp-web.js" و استبدل generateConnectQr بمنطق حقيقي
// يصدر QR فعلي من واتساب ويستمع لحدث "ready" ليضبط settings.whatsappConnected = true

const QRCode = require("qrcode");
const { readDb, writeDb } = require("./db");
const { v4: uuidv4 } = require("uuid");

async function generateConnectQr() {
  const sessionToken = uuidv4();
  // في التطبيق الحقيقي هذا يكون QR صادر من WhatsApp Web وليس نص عشوائي
  const qrDataUrl = await QRCode.toDataURL(`otp-guard-session:${sessionToken}`);

  const db = await readDb();
  db.settings.whatsappQr = qrDataUrl;
  db.settings.whatsappConnected = false;
  await writeDb(db);

  return { qr: qrDataUrl, sessionToken };
}

async function confirmConnected() {
  // في التطبيق الحقيقي يُستدعى تلقائيًا من حدث "ready" الخاص بمكتبة whatsapp-web.js
  const db = await readDb();
  db.settings.whatsappConnected = true;
  db.settings.whatsappQr = null;
  await writeDb(db);
  return true;
}

async function disconnect() {
  const db = await readDb();
  db.settings.whatsappConnected = false;
  db.settings.whatsappQr = null;
  await writeDb(db);
  return true;
}

module.exports = { generateConnectQr, confirmConnected, disconnect };
