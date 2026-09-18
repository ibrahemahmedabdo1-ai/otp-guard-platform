const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../utils/db");
const { lookupIp, getClientIp } = require("../utils/geo");

const router = express.Router();

// نقطة seed محمية بمفتاح سري - لإنشاء أول حساب أدمن وسبورت مرة واحدة بعد أول نشر
// (بديل لتشغيل npm run seed محليًا، مفيد لبيئات زي Vercel اللي مفيهاش Shell)
// استخدمها مرة واحدة بس، وبعدين امسح متغير SEED_SECRET من إعدادات البيئة
router.get("/system/seed", async (req, res) => {
  try {
    const provided = req.query.secret || req.headers["x-seed-secret"];
    if (!process.env.SEED_SECRET) {
      return res.status(403).json({ error: "SEED_SECRET غير مُعرّف في متغيرات البيئة" });
    }
    if (!provided || provided !== process.env.SEED_SECRET) {
      return res.status(401).json({ error: "مفتاح السر غير صحيح" });
    }

    const db = await readDb();
    const log = [];

    if (!db.users.find((u) => u.role === "admin")) {
      const passwordHash = await bcrypt.hash("Admin@12345", 10);
      db.users.push({
        id: uuidv4(),
        name: "Admin",
        email: "admin@otpprovider.com",
        passwordHash,
        role: "admin",
        country: "N/A",
        language: "ar",
        currency: "USD",
        balance: 0,
        createdAt: new Date().toISOString(),
      });
      log.push("تم إنشاء حساب الأدمن: admin@otpprovider.com / Admin@12345");
    } else {
      log.push("حساب الأدمن موجود بالفعل");
    }

    if (!db.users.find((u) => u.role === "support")) {
      const passwordHash = await bcrypt.hash("Support@12345", 10);
      db.users.push({
        id: uuidv4(),
        name: "Support Agent",
        email: "support@otpprovider.com",
        passwordHash,
        role: "support",
        country: "N/A",
        language: "ar",
        currency: "USD",
        balance: 0,
        createdAt: new Date().toISOString(),
      });
      log.push("تم إنشاء حساب السبورت: support@otpprovider.com / Support@12345");
    }

    await writeDb(db);
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: "فشل تنفيذ الـ seed", details: err.message });
  }
});

// يستخدمه الفرونت إند لتحديد الدولة/اللغة/العملة تلقائيًا من الـ IP
router.get("/geo", async (req, res) => {
  const geo = await lookupIp(getClientIp(req));
  res.json(geo);
});

// الباكدجات المعروضة للعامة (صفحة الهبوط)
router.get("/packages", async (req, res) => {
  const db = (await readDb());
  res.json(db.packages);
});

// نصوص لغة واحدة (يستخدمها i18n.js في الفرونت إند)
router.get("/languages/:lang", async (req, res) => {
  const db = (await readDb());
  const dict = db.languages[req.params.lang];
  if (!dict) return res.status(404).json({ error: "اللغة غير مدعومة" });
  res.json(dict);
});

// التسعير العام (صفحة /pricing.html)
router.get("/pricing", async (req, res) => {
  const db = (await readDb());
  res.json(db.pricingTiers);
});

module.exports = router;
