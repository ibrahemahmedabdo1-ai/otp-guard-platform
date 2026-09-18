// طبقة تخزين موحّدة:
// - لو DATABASE_URL موجود في .env (مثل رابط Neon.tech) → التخزين يكون في جدول Postgres واحد بعمود JSONB.
//   هذا يشتغل على Vercel لأن التخزين خارجي وليس على القرص المحلي (Vercel serverless ما بيحتفظش بالملفات).
// - لو مفيش DATABASE_URL (تشغيل محلي بدون قاعدة بيانات) → التخزين يكون في ملف data/db.json كـ fallback.
//
// كل الدوال async الآن، فلازم تستخدم: const db = await readDb();  ... await writeDb(db);

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "db.json");

const DEFAULT_DATA = {
  users: [],
  // الباكدجات: كل باكدج له channel محدد: whatsapp | sms | email | bundle (مجمع)
  packages: [
    { id: "pkg_wa_basic", name: "WhatsApp Basic", channel: "whatsapp", credits: 1000, price: 10, currency: "USD", description: "1000 رسالة تحقق واتساب" },
    { id: "pkg_sms_basic", name: "SMS Basic", channel: "sms", credits: 1000, price: 15, currency: "USD", description: "1000 رسالة تحقق SMS" },
    { id: "pkg_email_basic", name: "Email Basic", channel: "email", credits: 1000, price: 5, currency: "USD", description: "1000 رسالة تحقق إيميل" },
    { id: "pkg_bundle_pro", name: "Bundle Pro", channel: "bundle", credits: 5000, price: 40, currency: "USD", description: "5000 عملية تحقق موزعة على كل القنوات" }
  ],
  clientPackages: [],
  services: [],
  verifications: [],
  tickets: [],
  ticketMessages: [],
  adminChats: [],
  otpTemplates: [
    { id: "tpl_wa", channel: "whatsapp", body: "كود التحقق الخاص بك هو {{code}} صالح لمدة 5 دقائق", status: "approved", editedBy: null, pendingBody: null },
    { id: "tpl_sms", channel: "sms", body: "كود التحقق: {{code}}", status: "approved", editedBy: null, pendingBody: null },
    { id: "tpl_email", channel: "email", body: "كود التحقق الخاص بك هو {{code}}", status: "approved", editedBy: null, pendingBody: null }
  ],
  // تسعير لكل رسالة منفردة / 10 / 100 ... لكل قناة على حدة + عروض مجمعة (تُعرض في صفحة /pricing.html)
  pricingTiers: {
    whatsapp: [
      { qty: 1, price: 0.05 }, { qty: 10, price: 0.45 }, { qty: 100, price: 4.0 }, { qty: 1000, price: 35 }
    ],
    sms: [
      { qty: 1, price: 0.07 }, { qty: 10, price: 0.6 }, { qty: 100, price: 5.5 }, { qty: 1000, price: 48 }
    ],
    email: [
      { qty: 1, price: 0.02 }, { qty: 10, price: 0.18 }, { qty: 100, price: 1.6 }, { qty: 1000, price: 14 }
    ],
    bundle: [
      { qty: 10, price: 1.0 }, { qty: 100, price: 9.0 }, { qty: 1000, price: 80 }
    ]
  },
  settings: {
    whatsappConnected: false,
    whatsappQr: null,
    smsProvider: "twilio",
    exchangeRates: { USD: 1, EGP: 49, SAR: 3.75, AED: 3.67, EUR: 0.92 }
  },
  // ٣ لغات للموقع — مخزنة هنا (وليس كملفات) عشان تشتغل على Vercel/serverless بدون مشاكل كتابة على القرص
  languages: {
    ar: {
      brand: "OTP Guard", nav_login: "تسجيل الدخول", nav_register: "حساب جديد",
      landing_title: "تحقق من عملائك بثقة عبر واتساب، إيميل أو SMS",
      landing_subtitle: "منصة واحدة تربط شركتك بعملائها للتحقق الفوري من الهوية ورقم الهاتف",
      cta_start: "ابدأ الآن مجانًا", login_title: "تسجيل الدخول", register_title: "إنشاء حساب جديد",
      email: "البريد الإلكتروني", password: "كلمة المرور", name: "الاسم", submit: "دخول",
      submit_register: "تسجيل", dashboard: "لوحة التحكم", balance: "الرصيد", packages: "الباكدجات",
      buy: "شراء", test_button: "اختبار إرسال", customers: "عملاؤك", support_chat: "الدردشة مع الدعم",
      logout: "تسجيل خروج", language: "اللغة", pricing_title: "الأسعار"
    },
    en: {
      brand: "OTP Guard", nav_login: "Login", nav_register: "Sign Up",
      landing_title: "Verify your customers confidently via WhatsApp, Email or SMS",
      landing_subtitle: "One platform connecting your company to your customers for instant verification",
      cta_start: "Start Free Now", login_title: "Login", register_title: "Create New Account",
      email: "Email", password: "Password", name: "Name", submit: "Login",
      submit_register: "Register", dashboard: "Dashboard", balance: "Balance", packages: "Packages",
      buy: "Buy", test_button: "Send Test", customers: "Your Customers", support_chat: "Support Chat",
      logout: "Logout", language: "Language", pricing_title: "Pricing"
    },
    fr: {
      brand: "OTP Guard", nav_login: "Connexion", nav_register: "Inscription",
      landing_title: "Verifiez vos clients en toute confiance via WhatsApp, Email ou SMS",
      landing_subtitle: "Une seule plateforme reliant votre entreprise a vos clients",
      cta_start: "Commencer Gratuitement", login_title: "Connexion", register_title: "Creer un compte",
      email: "Email", password: "Mot de passe", name: "Nom", submit: "Connexion",
      submit_register: "S inscrire", dashboard: "Tableau de bord", balance: "Solde", packages: "Offres",
      buy: "Acheter", test_button: "Envoyer un test", customers: "Vos clients", support_chat: "Chat Support",
      logout: "Deconnexion", language: "Langue", pricing_title: "Tarifs"
    }
  }
};

function defaultTestAllowance() {
  return {
    whatsapp: { remaining: 3, locked: false },
    sms: { remaining: 3, locked: false },
    email: { remaining: 3, locked: false }
  };
}

// ---------------- Postgres (Neon) backend ----------------
let pool = null;
let tableReadyPromise = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureTable() {
  const p = getPool();
  await p.query(`CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL)`);
  const { rows } = await p.query("SELECT data FROM app_state WHERE id = 1");
  if (rows.length === 0) {
    await p.query("INSERT INTO app_state (id, data) VALUES (1, $1)", [JSON.stringify(DEFAULT_DATA)]);
  }
}

async function readDbPg() {
  if (!tableReadyPromise) tableReadyPromise = ensureTable();
  await tableReadyPromise;
  const p = getPool();
  const { rows } = await p.query("SELECT data FROM app_state WHERE id = 1");
  return rows[0].data;
}

async function writeDbPg(data) {
  if (!tableReadyPromise) tableReadyPromise = ensureTable();
  await tableReadyPromise;
  const p = getPool();
  await p.query("UPDATE app_state SET data = $1 WHERE id = 1", [JSON.stringify(data)]);
}

// ---------------- Local JSON file backend (fallback للتطوير المحلي بدون قاعدة بيانات) ----------------
function ensureLocalFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

async function readDbLocal() {
  ensureLocalFile();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

async function writeDbLocal(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---------------- الواجهة الموحدة ----------------
async function readDb() {
  return getPool() ? readDbPg() : readDbLocal();
}

async function writeDb(data) {
  return getPool() ? writeDbPg(data) : writeDbLocal(data);
}

module.exports = { readDb, writeDb, DB_PATH, defaultTestAllowance, DEFAULT_DATA };
