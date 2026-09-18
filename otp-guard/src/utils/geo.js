// تحديد الدولة/العملة/اللغة الافتراضية بناءً على الـ IP
// المزود المجاني ip-api.com (يمكن استبداله بأي مزود آخر عبر GEO_IP_PROVIDER في .env)

const COUNTRY_TO_LOCALE = {
  EG: { language: "ar", currency: "EGP" },
  SA: { language: "ar", currency: "SAR" },
  AE: { language: "ar", currency: "AED" },
  US: { language: "en", currency: "USD" },
  GB: { language: "en", currency: "USD" },
  FR: { language: "fr", currency: "EUR" },
  DE: { language: "en", currency: "EUR" }
};

async function lookupIp(ip) {
  try {
    const provider = process.env.GEO_IP_PROVIDER || "http://ip-api.com/json/";
    // لو IP محلي (تطوير) نرجع قيمة افتراضية بدل ما نستدعي الإنترنت
    if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127")) {
      return { country: "EG", countryCode: "EG", ...COUNTRY_TO_LOCALE.EG };
    }
    const res = await fetch(provider + ip);
    const data = await res.json();
    const cc = data.countryCode || "US";
    const locale = COUNTRY_TO_LOCALE[cc] || { language: "en", currency: "USD" };
    return { country: data.country || cc, countryCode: cc, ...locale };
  } catch (err) {
    return { country: "Unknown", countryCode: "US", language: "en", currency: "USD" };
  }
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || req.ip;
}

module.exports = { lookupIp, getClientIp, COUNTRY_TO_LOCALE };
