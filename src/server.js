// نقطة الدخول للتشغيل المحلي فقط (Vercel بيستخدم api/index.js بدل ده)
const app = require("./app");
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 OTP Guard Platform running at http://localhost:${PORT}`);
});
