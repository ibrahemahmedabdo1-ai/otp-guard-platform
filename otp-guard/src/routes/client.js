const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../utils/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendOtp } = require("../utils/sms");

const router = express.Router();
router.use(requireAuth, requireRole("client"));

const upload = multer({ dest: path.join(__dirname, "..", "..", "public", "uploads") });

// بيانات لوحة العميل
router.get("/me", async (req, res) => {
  const db = (await readDb());
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

// الباكدجات + شراء باكدج (شحن رصيد)
router.get("/packages", async (req, res) => {
  const db = (await readDb());
  res.json(db.packages);
});

router.post("/packages/:id/buy", async (req, res) => {
  const db = (await readDb());
  const pkg = db.packages.find(p => p.id === req.params.id);
  if (!pkg) return res.status(404).json({ error: "الباكدج غير موجود" });

  const user = db.users.find(u => u.id === req.user.id);
  user.balance += pkg.credits;
  db.clientPackages.push({ id: uuidv4(), clientId: user.id, packageId: pkg.id, createdAt: new Date().toISOString() });
  await writeDb(db);
  res.json({ balance: user.balance });
});

// خدمات العميل (تفعيل/تعطيل يتم من الأدمن فقط - هنا عرض فقط)
router.get("/services", async (req, res) => {
  const db = (await readDb());
  res.json(db.services.filter(s => s.clientId === req.user.id));
});

// عرض عدد رسائل الاختبار المتبقية لكل قناة (يتحكم فيها الأدمن)
router.get("/test-allowance", async (req, res) => {
  const db = (await readDb());
  const user = db.users.find(u => u.id === req.user.id);
  res.json(user.testAllowance || {});
});

// زر الاختبار: يرسل OTP تجريبي عبر القناة المطلوبة (يستهلك من رصيد رسائل الاختبار المجانية، وليس الرصيد المدفوع)
router.post("/test", async (req, res) => {
  const { channel, recipient } = req.body; // channel: whatsapp | sms | email
  if (!channel || !recipient) return res.status(400).json({ error: "حدد القناة والمستلم" });

  const db = (await readDb());
  const user = db.users.find(u => u.id === req.user.id);

  const allowance = (user.testAllowance || {})[channel];
  if (!allowance) return res.status(400).json({ error: "قناة غير مدعومة" });
  if (allowance.locked) return res.status(403).json({ error: "تم إيقاف الاختبار على هذه القناة من الأدمن" });
  if (allowance.remaining <= 0) return res.status(402).json({ error: "انتهت رسائل الاختبار المجانية على هذه القناة، تواصل مع الدعم" });

  const template = db.otpTemplates.find(t => t.channel === channel && t.status === "approved") || db.otpTemplates[0];
  const result = await sendOtp(channel, recipient, template.body);

  allowance.remaining -= 1;
  const record = {
    id: uuidv4(),
    clientId: user.id,
    channel,
    recipient,
    status: result.ok ? "delivered" : (result.simulated ? "simulated" : "failed"),
    createdAt: new Date().toISOString()
  };
  db.verifications.push(record);
  await writeDb(db);

  res.json({ result, testAllowance: user.testAllowance, record });
});

// قائمة "مين من عملائي استلم" (سجل التحقق)
router.get("/customers", async (req, res) => {
  const db = (await readDb());
  const list = db.verifications.filter(v => v.clientId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// ---- التذاكر / شات السبورت ----
router.get("/tickets", async (req, res) => {
  const db = (await readDb());
  const tickets = db.tickets.filter(t => t.clientId === req.user.id);
  res.json(tickets);
});

router.post("/tickets", async (req, res) => {
  const { subject } = req.body;
  const db = (await readDb());
  const ticket = { id: uuidv4(), clientId: req.user.id, supportId: null, subject: subject || "طلب دعم", status: "open", createdAt: new Date().toISOString() };
  db.tickets.push(ticket);
  await writeDb(db);
  res.json(ticket);
});

router.get("/tickets/:id/messages", async (req, res) => {
  const db = (await readDb());
  const ticket = db.tickets.find(t => t.id === req.params.id && t.clientId === req.user.id);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
  res.json(db.ticketMessages.filter(m => m.ticketId === ticket.id));
});

router.post("/tickets/:id/messages", upload.single("file"), async (req, res) => {
  const db = (await readDb());
  const ticket = db.tickets.find(t => t.id === req.params.id && t.clientId === req.user.id);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });

  const msg = {
    id: uuidv4(),
    ticketId: ticket.id,
    senderId: req.user.id,
    senderRole: "client",
    message: req.body.message || "",
    fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };
  db.ticketMessages.push(msg);
  await writeDb(db);
  res.json(msg);
});

module.exports = router;
