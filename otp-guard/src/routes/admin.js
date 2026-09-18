const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, defaultTestAllowance } = require("../utils/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const whatsapp = require("../utils/whatsapp");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---- إدارة المستخدمين (عملاء / سبورت) ----
router.get("/users", async (req, res) => {
  const db = (await readDb());
  res.json(db.users.map(publicUser));
});

// إنشاء مستخدم جديد (عميل / سبورت / أدمن) - الأدمن فقط يقدر يعمل ده
router.post("/users", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!["client", "support", "admin"].includes(role)) {
    return res.status(400).json({ error: "الدور يجب أن يكون client أو support أو admin" });
  }
  const db = (await readDb());
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: "الإيميل مستخدم بالفعل" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(), name, email, passwordHash, role,
    country: "N/A", language: "ar", currency: "USD", balance: 0,
    testAllowance: role === "client" ? defaultTestAllowance() : undefined,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  res.json(publicUser(user));
});

// حذف مستخدم (عميل / سبورت / أدمن)
router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "لا يمكنك حذف حسابك الحالي" });
  }
  const db = (await readDb());
  const exists = db.users.find(u => u.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "المستخدم غير موجود" });
  db.users = db.users.filter(u => u.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

// ضبط رسائل الاختبار المجانية للعميل لكل قناة (زيادة / نقصان / قفل)
router.post("/clients/:id/test-allowance", async (req, res) => {
  const { channel, remaining, locked } = req.body;
  const db = (await readDb());
  const user = db.users.find(u => u.id === req.params.id && u.role === "client");
  if (!user) return res.status(404).json({ error: "العميل غير موجود" });
  if (!user.testAllowance) user.testAllowance = defaultTestAllowance();
  if (!user.testAllowance[channel]) return res.status(400).json({ error: "قناة غير معروفة" });
  if (typeof remaining === "number") user.testAllowance[channel].remaining = Math.max(0, remaining);
  if (typeof locked === "boolean") user.testAllowance[channel].locked = locked;
  await writeDb(db);
  res.json(user.testAllowance);
});

// ---- خدمات العميل: تفعيل/تعطيل - مجاني/مدفوع ----
router.get("/clients/:id/services", async (req, res) => {
  const db = (await readDb());
  res.json(db.services.filter(s => s.clientId === req.params.id));
});

router.post("/clients/:id/services", async (req, res) => {
  const { name, channel, billing } = req.body; // billing: free | paid
  const db = (await readDb());
  const service = { id: uuidv4(), clientId: req.params.id, name, channel, billing: billing || "paid", status: "active", createdAt: new Date().toISOString() };
  db.services.push(service);
  await writeDb(db);
  res.json(service);
});

router.post("/services/:id/toggle", async (req, res) => {
  const db = (await readDb());
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: "الخدمة غير موجودة" });
  service.status = service.status === "active" ? "inactive" : "active";
  await writeDb(db);
  res.json(service);
});

router.post("/services/:id/billing", async (req, res) => {
  const { billing } = req.body; // free | paid
  const db = (await readDb());
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: "الخدمة غير موجودة" });
  service.billing = billing;
  await writeDb(db);
  res.json(service);
});

// ---- الباكدجات (CRUD) ----
router.get("/packages", async (req, res) => {
  const db = (await readDb());
  res.json(db.packages);
});

router.post("/packages", async (req, res) => {
  const db = (await readDb());
  const pkg = { id: uuidv4(), ...req.body };
  db.packages.push(pkg);
  await writeDb(db);
  res.json(pkg);
});

router.put("/packages/:id", async (req, res) => {
  const db = (await readDb());
  const pkg = db.packages.find(p => p.id === req.params.id);
  if (!pkg) return res.status(404).json({ error: "الباكدج غير موجود" });
  Object.assign(pkg, req.body);
  await writeDb(db);
  res.json(pkg);
});

router.delete("/packages/:id", async (req, res) => {
  const db = (await readDb());
  db.packages = db.packages.filter(p => p.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

// ---- قوالب OTP: اعتماد أو رفض تعديل السبورت ----
router.get("/templates", async (req, res) => {
  const db = (await readDb());
  res.json(db.otpTemplates);
});

router.post("/templates/:id/approve", async (req, res) => {
  const db = (await readDb());
  const tpl = db.otpTemplates.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "غير موجود" });
  if (tpl.pendingBody) tpl.body = tpl.pendingBody;
  tpl.pendingBody = null;
  tpl.status = "approved";
  await writeDb(db);
  res.json(tpl);
});

router.post("/templates/:id/reject", async (req, res) => {
  const db = (await readDb());
  const tpl = db.otpTemplates.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "غير موجود" });
  tpl.pendingBody = null;
  tpl.status = "approved";
  await writeDb(db);
  res.json(tpl);
});

// ---- ربط واتساب عبر QR ----
router.post("/whatsapp/connect", async (req, res) => {
  const result = await whatsapp.generateConnectQr();
  res.json(result);
});

router.post("/whatsapp/confirm", async (req, res) => {
  await whatsapp.confirmConnected();
  res.json({ connected: true });
});

router.post("/whatsapp/disconnect", async (req, res) => {
  await whatsapp.disconnect();
  res.json({ connected: false });
});

router.get("/settings", async (req, res) => {
  const db = (await readDb());
  res.json(db.settings);
});

router.post("/settings", async (req, res) => {
  const db = (await readDb());
  Object.assign(db.settings, req.body);
  await writeDb(db);
  res.json(db.settings);
});

// ---- تذاكر (رؤية شاملة) ----
router.get("/tickets", async (req, res) => {
  const db = (await readDb());
  res.json(db.tickets);
});

// ---- شات السبورت <-> الأدمن ----
router.get("/admin-chat/:supportId", async (req, res) => {
  const db = (await readDb());
  res.json(db.adminChats.filter(m => m.supportId === req.params.supportId));
});

router.post("/admin-chat/:supportId", async (req, res) => {
  const db = (await readDb());
  const msg = { id: uuidv4(), supportId: req.params.supportId, senderRole: "admin", message: req.body.message || "", fileUrl: null, createdAt: new Date().toISOString() };
  db.adminChats.push(msg);
  await writeDb(db);
  res.json(msg);
});

// ---- إدارة لغات الموقع (٣ لغات) - مخزّنة في قاعدة البيانات مباشرة (تعمل على Vercel) ----
router.get("/languages", async (req, res) => {
  const db = (await readDb());
  res.json(db.languages);
});

router.put("/languages/:lang", async (req, res) => {
  const db = (await readDb());
  if (!db.languages[req.params.lang]) return res.status(404).json({ error: "اللغة غير موجودة" });
  db.languages[req.params.lang] = req.body;
  await writeDb(db);
  res.json({ ok: true });
});

// ---- التسعير: سعر الرسالة الواحدة / 10 / 100 ... لكل قناة على حدة + عروض مجمعة ----
router.get("/pricing", async (req, res) => {
  const db = (await readDb());
  res.json(db.pricingTiers);
});

router.post("/pricing/:channel", async (req, res) => {
  const { qty, price } = req.body;
  const db = (await readDb());
  if (!db.pricingTiers[req.params.channel]) db.pricingTiers[req.params.channel] = [];
  db.pricingTiers[req.params.channel].push({ qty: Number(qty), price: Number(price) });
  db.pricingTiers[req.params.channel].sort((a, b) => a.qty - b.qty);
  await writeDb(db);
  res.json(db.pricingTiers[req.params.channel]);
});

router.delete("/pricing/:channel/:index", async (req, res) => {
  const db = (await readDb());
  const list = db.pricingTiers[req.params.channel];
  if (!list) return res.status(404).json({ error: "القناة غير موجودة" });
  list.splice(Number(req.params.index), 1);
  await writeDb(db);
  res.json(list);
});

// ---- اكتشاف الأخطاء على مستوى النظام كله (وليس عميل واحد فقط) ----
router.get("/detect-errors", async (req, res) => {
  const db = (await readDb());
  const issues = [];

  const clientsWithoutBalance = db.users.filter(u => u.role === "client" && u.balance <= 0).length;
  if (clientsWithoutBalance > 0) {
    issues.push({ code: "CLIENTS_NO_BALANCE", title: `${clientsWithoutBalance} عميل بدون رصيد كافٍ`, severity: "medium" });
  }

  const inactiveServices = db.services.filter(s => s.status === "inactive").length;
  if (inactiveServices > 0) {
    issues.push({ code: "INACTIVE_SERVICES", title: `${inactiveServices} خدمة معطّلة حاليًا لدى العملاء`, severity: "medium" });
  }

  if (!db.settings.whatsappConnected) {
    issues.push({ code: "WHATSAPP_DISCONNECTED", title: "رقم واتساب غير مربوط بالمنصة حاليًا", severity: "high", fix: "reconnect-whatsapp" });
  }

  const pendingTemplates = db.otpTemplates.filter(t => t.status === "pending").length;
  if (pendingTemplates > 0) {
    issues.push({ code: "PENDING_TEMPLATES", title: `${pendingTemplates} قالب رسالة بانتظار موافقتك`, severity: "medium", fix: "approve-all-templates" });
  }

  const openTicketsNoSupport = db.tickets.filter(t => t.status === "open" && !t.supportId).length;
  if (openTicketsNoSupport > 0) {
    issues.push({ code: "UNASSIGNED_TICKETS", title: `${openTicketsNoSupport} تذكرة مفتوحة لم يتم تعيين سبورت لها`, severity: "medium" });
  }

  if (issues.length === 0) {
    issues.push({ code: "OK", title: "لا توجد مشاكل ظاهرة في النظام حاليًا", severity: "info" });
  }
  res.json({ issues });
});

// إصلاحات سريعة بضغطة زر
router.post("/fix/:action", async (req, res) => {
  const db = (await readDb());
  if (req.params.action === "approve-all-templates") {
    db.otpTemplates.forEach(t => {
      if (t.status === "pending" && t.pendingBody) t.body = t.pendingBody;
      t.pendingBody = null;
      t.status = "approved";
    });
    await writeDb(db);
    return res.json({ ok: true, message: "تم اعتماد كل القوالب المعلّقة" });
  }
  if (req.params.action === "reconnect-whatsapp") {
    const result = await whatsapp.generateConnectQr();
    return res.json({ ok: true, message: "تم توليد QR جديد لإعادة ربط واتساب", ...result });
  }
  res.status(400).json({ error: "إجراء إصلاح غير معروف" });
});

module.exports = router;
