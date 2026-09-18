// إرسال OTP عبر قنوات متعددة: SMS (Twilio أو IMS/بوابة محلية)، واتساب، إيميل
// كل دالة هنا هي "Adapter" — فعّلها بوضع المفاتيح في .env

async function sendViaTwilioSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    return { ok: false, simulated: true, message: "Twilio SMS غير مفعل بعد — ضع المفاتيح في .env" };
  }
  const twilio = require("twilio")(sid, token);
  const msg = await twilio.messages.create({ to, from, body });
  return { ok: true, sid: msg.sid };
}

async function sendViaTwilioWhatsapp(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    return { ok: false, simulated: true, message: "Twilio WhatsApp غير مفعل بعد — ضع المفاتيح في .env" };
  }
  const twilio = require("twilio")(sid, token);
  const msg = await twilio.messages.create({ to: `whatsapp:${to}`, from, body });
  return { ok: true, sid: msg.sid };
}

async function sendViaImsSms(to, body) {
  const url = process.env.IMS_API_URL;
  const key = process.env.IMS_API_KEY;
  if (!url || !key) {
    return { ok: false, simulated: true, message: "بوابة IMS/SMS المحلية غير مفعلة — ضع IMS_API_URL و IMS_API_KEY في .env" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ to, message: body, sender: process.env.IMS_SENDER_NAME || "OTPGuard" })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function sendViaEmail(to, subject, body) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { ok: false, simulated: true, message: "SMTP غير مفعل بعد — ضع بيانات SMTP في .env" };
  }
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text: body });
  return { ok: true, messageId: info.messageId };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtp(channel, recipient, templateBody) {
  const code = generateOtpCode();
  const body = (templateBody || "كود التحقق الخاص بك هو {{code}}").replace("{{code}}", code);

  let result;
  if (channel === "whatsapp") {
    result = await sendViaTwilioWhatsapp(recipient, body);
  } else if (channel === "sms") {
    // جرب Twilio الأول، ولو مش متفعل جرب IMS
    result = await sendViaTwilioSms(recipient, body);
    if (!result.ok && result.simulated) {
      result = await sendViaImsSms(recipient, body);
    }
  } else if (channel === "email") {
    result = await sendViaEmail(recipient, "رمز التحقق الخاص بك", body);
  } else {
    result = { ok: false, message: "قناة غير مدعومة" };
  }
  return { ...result, code, channel, recipient };
}

module.exports = { sendOtp, generateOtpCode };
