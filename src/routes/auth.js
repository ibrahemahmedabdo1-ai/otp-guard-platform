const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, defaultTestAllowance } = require("../utils/db");
const { signToken } = require("../middleware/auth");
const { lookupIp, getClientIp } = require("../utils/geo");

const router = express.Router();

// التسجيل العام: عملاء فقط (السبورت والأدمن يُنشأون من لوحة الأدمن)
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "من فضلك أدخل الاسم والإيميل وكلمة المرور" });
  }
  const db = (await readDb());
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: "الإيميل مستخدم بالفعل" });
  }

  const geo = await lookupIp(getClientIp(req));
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    role: "client",
    country: geo.country,
    language: geo.language,
    currency: geo.currency,
    balance: 0,
    testAllowance: defaultTestAllowance(),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const db = (await readDb());
  const user = db.users.find(u => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

module.exports = router;
