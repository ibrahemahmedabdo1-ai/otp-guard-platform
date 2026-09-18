const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../utils/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("support"));

const upload = multer({ dest: path.join(__dirname, "..", "..", "public", "uploads") });

// قائمة العملاء (قراءة فقط)
router.get("/clients", async (req, res) => {
  const db = (await readDb());
  const clients = db.users.filter(u => u.role === "client").map(publicUser);
  res.json(clients);
});

// بروفايل عميل كامل - قراءة فقط، لا تعديل مسموح هنا نهائيًا
router.get("/clients/:id", async (req, res) => {
  const db = (await readDb());
  const client = db.users.find(u => u.id === req.params.id && u.role === "client");
  if (!client) return res.status(404).json({ error: "العميل غير موجود" });

  const services = db.services.filter(s => s.clientId === client.id);
  const verifications = db.verifications.filter(v => v.clientId === client.id);
  res.json({ client: publicUser(client), services, verifications });
});

// زر "اكتشاف الأخطاء": فحص تلقائي لأشهر مشاكل ربط العميل
router.get("/clients/:id/detect-errors", async (req, res) => {
  const db = (await readDb());
  const client = db.users.find(u => u.id === req.params.id && u.role === "client");
  if (!client) return res.status(404).json({ error: "العميل غير موجود" });

  const services = db.services.filter(s => s.clientId === client.id);
  const verifications = db.verifications.filter(v => v.clientId === client.id);
  const failed = verifications.filter(v => v.status === "failed" || v.status === "simulated");

  const issues = [];
  if (services.length === 0) {
    issues.push({ code: "NO_SERVICE", title: "لا يوجد أي خدمة مفعّلة لهذا العميل", severity: "high" });
  }
  if (services.some(s => s.status === "inactive")) {
    issues.push({ code: "SERVICE_DISABLED", title: "توجد خدمة معطّلة من الأدمن قد تحتاج تفعيل", severity: "medium" });
  }
  if (client.balance <= 0) {
    issues.push({ code: "NO_BALANCE", title: "رصيد العميل صفر - لن يستطيع إرسال أي تحقق", severity: "high" });
  }
  if (failed.length > 0) {
    issues.push({ code: "FAILED_DELIVERIES", title: `${failed.length} محاولة تحقق فشلت أو لم تُرسل فعليًا (تحقق من إعدادات القناة)`, severity: "medium" });
  }
  if (issues.length === 0) {
    issues.push({ code: "OK", title: "لا توجد مشاكل ظاهرة في حساب هذا العميل", severity: "info" });
  }
  res.json({ issues });
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---- شات مع العميل (عبر التذاكر) ----
router.get("/tickets", async (req, res) => {
  const db = (await readDb());
  res.json(db.tickets);
});

router.post("/tickets/:id/claim", async (req, res) => {
  const db = (await readDb());
  const ticket = db.tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
  ticket.supportId = req.user.id;
  await writeDb(db);
  res.json(ticket);
});

router.get("/tickets/:id/messages", async (req, res) => {
  const db = (await readDb());
  res.json(db.ticketMessages.filter(m => m.ticketId === req.params.id));
});

router.post("/tickets/:id/messages", upload.single("file"), async (req, res) => {
  const db = (await readDb());
  const ticket = db.tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });

  const msg = {
    id: uuidv4(),
    ticketId: ticket.id,
    senderId: req.user.id,
    senderRole: "support",
    message: req.body.message || "",
    fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };
  db.ticketMessages.push(msg);
  await writeDb(db);
  res.json(msg);
});

router.post("/tickets/:id/resolve", async (req, res) => {
  const db = (await readDb());
  const ticket = db.tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
  ticket.status = "closed";
  await writeDb(db);
  res.json(ticket);
});

// ---- شات مع الأدمن ----
router.get("/admin-chat", async (req, res) => {
  const db = (await readDb());
  res.json(db.adminChats.filter(m => m.supportId === req.user.id));
});

router.post("/admin-chat", async (req, res) => {
  const db = (await readDb());
  const msg = {
    id: uuidv4(),
    supportId: req.user.id,
    senderRole: "support",
    message: req.body.message || "",
    fileUrl: null,
    createdAt: new Date().toISOString()
  };
  db.adminChats.push(msg);
  await writeDb(db);
  res.json(msg);
});

// اقتراح تعديل قالب رسالة OTP - يحتاج موافقة الأدمن
router.post("/templates/:id/suggest", async (req, res) => {
  const db = (await readDb());
  const tpl = db.otpTemplates.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "القالب غير موجود" });
  tpl.pendingBody = req.body.body;
  tpl.status = "pending";
  tpl.editedBy = req.user.id;
  await writeDb(db);
  res.json(tpl);
});

module.exports = router;
