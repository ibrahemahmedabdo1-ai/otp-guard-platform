// سكريبت تجهيز أول حساب أدمن + بيانات تجريبية
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("./db");

async function seed() {
  const db = await readDb();

  if (!db.users.find(u => u.role === "admin")) {
    const passwordHash = await bcrypt.hash("Admin@12345", 10);
    db.users.push({
      id: uuidv4(),
      name: "Admin",
      email: "admin@otpguard.com",
      passwordHash,
      role: "admin",
      country: "N/A",
      language: "ar",
      currency: "USD",
      balance: 0,
      createdAt: new Date().toISOString()
    });
    console.log("تم إنشاء حساب أدمن: admin@otpguard.com / Admin@12345");
  }

  if (!db.users.find(u => u.role === "support")) {
    const passwordHash = await bcrypt.hash("Support@12345", 10);
    db.users.push({
      id: uuidv4(),
      name: "Support Agent",
      email: "support@otpguard.com",
      passwordHash,
      role: "support",
      country: "N/A",
      language: "ar",
      currency: "USD",
      balance: 0,
      createdAt: new Date().toISOString()
    });
    console.log("تم إنشاء حساب سبورت: support@otpguard.com / Support@12345");
  }

  await writeDb(db);
  console.log("تم تجهيز قاعدة البيانات بنجاح.");
  process.exit(0);
}

seed().catch(err => {
  console.error("فشل تجهيز قاعدة البيانات:", err);
  process.exit(1);
});
