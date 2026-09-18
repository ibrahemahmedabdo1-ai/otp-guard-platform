const user = guardRole("admin");
let currentClientId = null;

document.getElementById("userName").textContent = user ? `${user.name} (أدمن)` : "";

document.querySelectorAll(".sidebar a[data-tab]").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".sidebar a[data-tab]").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll("main > section").forEach(s => s.style.display = "none");
    document.getElementById(`tab-${link.dataset.tab}`).style.display = "block";
    document.getElementById("pageTitle").textContent = link.textContent.trim();

    if (link.dataset.tab === "packages") loadPackages();
    if (link.dataset.tab === "pricing") loadPricing();
    if (link.dataset.tab === "templates") loadTemplates();
    if (link.dataset.tab === "settings") loadSettingsCheck();
    if (link.dataset.tab === "languages") loadLanguages();
    if (link.dataset.tab === "team") loadStaff();
    if (link.dataset.tab === "tickets") loadAllTickets();
    if (link.dataset.tab === "health") detectSystemErrors();
  });
});

// ---- العملاء والخدمات ----
async function loadClients() {
  const users = await apiFetch("/admin/users");
  const clients = users.filter(u => u.role === "client");
  document.getElementById("clientsBody").innerHTML = clients.map(c => `
    <tr>
      <td>${c.name}</td><td>${c.email}</td><td>${c.balance}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewClientServices('${c.id}','${c.name.replace(/'/g, "")}')">إدارة الخدمات</button></td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${c.id}')">حذف</button></td>
    </tr>
  `).join("");
}

async function deleteUser(id) {
  if (!confirm("تأكيد حذف هذا المستخدم نهائيًا؟")) return;
  try {
    await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
    loadClients();
    loadStaff();
  } catch (e) {
    alert(e.message);
  }
}

async function viewClientServices(id, name) {
  currentClientId = id;
  document.getElementById("clientServicesBox").style.display = "block";
  document.getElementById("csClientName").textContent = name;
  const services = await apiFetch(`/admin/clients/${id}/services`);
  renderServices(services);
  const users = await apiFetch("/admin/users");
  const client = users.find(u => u.id === id);
  renderAllowanceControls(client?.testAllowance || {});
}

function renderAllowanceControls(allowance) {
  const labels = { whatsapp: "واتساب", sms: "SMS", email: "إيميل" };
  document.getElementById("allowanceControls").innerHTML = Object.entries(allowance).map(([ch, a]) => `
    <div class="toggle-row">
      <span>${labels[ch] || ch}</span>
      <span style="display:flex;align-items:center;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="adjustAllowance('${ch}', -1)">−</button>
        <strong>${a.remaining}</strong>
        <button class="btn btn-outline btn-sm" onclick="adjustAllowance('${ch}', 1)">+</button>
        <button class="btn ${a.locked ? "btn-primary" : "btn-danger"} btn-sm" onclick="toggleAllowanceLock('${ch}', ${!a.locked})">${a.locked ? "فتح" : "قفل"}</button>
      </span>
    </div>
  `).join("");
}

async function adjustAllowance(channel, delta) {
  const users = await apiFetch("/admin/users");
  const client = users.find(u => u.id === currentClientId);
  const current = client.testAllowance[channel].remaining;
  const allowance = await apiFetch(`/admin/clients/${currentClientId}/test-allowance`, {
    method: "POST", body: JSON.stringify({ channel, remaining: current + delta })
  });
  renderAllowanceControls(allowance);
}

async function toggleAllowanceLock(channel, locked) {
  const allowance = await apiFetch(`/admin/clients/${currentClientId}/test-allowance`, {
    method: "POST", body: JSON.stringify({ channel, locked })
  });
  renderAllowanceControls(allowance);
}

function renderServices(services) {
  document.getElementById("servicesBody").innerHTML = services.map(s => `
    <tr>
      <td>${s.name}</td><td>${s.channel}</td>
      <td><span class="badge badge-${s.status}">${s.status}</span></td>
      <td>${s.billing}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="toggleService('${s.id}')">${s.status === "active" ? "تعطيل" : "تفعيل"}</button>
        <button class="btn btn-outline btn-sm" onclick="toggleBilling('${s.id}','${s.billing === "free" ? "paid" : "free"}')">${s.billing === "free" ? "اجعله مدفوع" : "اجعله مجاني"}</button>
      </td>
    </tr>
  `).join("") || "<tr><td colspan=\"5\" style=\"color:var(--muted)\">لا توجد خدمات بعد</td></tr>";
}

async function addService() {
  const name = document.getElementById("newServiceName").value;
  const channel = document.getElementById("newServiceChannel").value;
  const billing = document.getElementById("newServiceBilling").value;
  if (!name || !currentClientId) return alert("اختر عميل واسم خدمة");
  await apiFetch(`/admin/clients/${currentClientId}/services`, { method: "POST", body: JSON.stringify({ name, channel, billing }) });
  document.getElementById("newServiceName").value = "";
  viewClientServices(currentClientId, document.getElementById("csClientName").textContent);
}

async function toggleService(id) {
  await apiFetch(`/admin/services/${id}/toggle`, { method: "POST" });
  viewClientServices(currentClientId, document.getElementById("csClientName").textContent);
}

async function toggleBilling(id, billing) {
  await apiFetch(`/admin/services/${id}/billing`, { method: "POST", body: JSON.stringify({ billing }) });
  viewClientServices(currentClientId, document.getElementById("csClientName").textContent);
}

// ---- الباكدجات ----
async function loadPackages() {
  const packages = await apiFetch("/admin/packages");
  const labels = { whatsapp: "واتساب", sms: "SMS", email: "إيميل", bundle: "مجمع" };
  document.getElementById("packagesGrid").innerHTML = packages.map(p => `
    <div class="card">
      <span class="badge badge-pending">${labels[p.channel] || p.channel || "-"}</span>
      <h3>${p.name}</h3>
      <p style="color:var(--muted)">${p.description}</p>
      <div class="stat">${p.price} ${p.currency || "USD"}</div>
      <button class="btn btn-danger btn-sm" style="margin-top:10px;" onclick="deletePackage('${p.id}')">حذف</button>
    </div>
  `).join("");
}

async function addPackage() {
  const name = document.getElementById("pkgName").value;
  const channel = document.getElementById("pkgChannel").value;
  const credits = Number(document.getElementById("pkgCredits").value || 0);
  const price = Number(document.getElementById("pkgPrice").value || 0);
  const description = document.getElementById("pkgDesc").value;
  if (!name) return alert("أدخل اسم الباكدج");
  await apiFetch("/admin/packages", { method: "POST", body: JSON.stringify({ name, channel, credits, price, description, currency: "USD" }) });
  document.getElementById("pkgName").value = "";
  document.getElementById("pkgCredits").value = "";
  document.getElementById("pkgPrice").value = "";
  document.getElementById("pkgDesc").value = "";
  loadPackages();
}

async function deletePackage(id) {
  if (!confirm("تأكيد حذف الباكدج؟")) return;
  await apiFetch(`/admin/packages/${id}`, { method: "DELETE" });
  loadPackages();
}

// ---- التسعير ----
async function loadPricing() {
  const pricing = await apiFetch("/admin/pricing");
  const labels = { whatsapp: "واتساب", sms: "SMS", email: "إيميل", bundle: "مجمع" };
  document.getElementById("pricingBox").innerHTML = Object.entries(pricing).map(([channel, tiers]) => `
    <div class="card" style="margin-bottom:16px;">
      <h4>${labels[channel] || channel}</h4>
      <table>
        <thead><tr><th>الكمية</th><th>السعر</th><th></th></tr></thead>
        <tbody>
          ${tiers.map((t, i) => `
            <tr><td>${t.qty}</td><td>${t.price}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deletePricingTier('${channel}', ${i})">حذف</button></td></tr>
          `).join("")}
        </tbody>
      </table>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <input id="pt-qty-${channel}" type="number" placeholder="الكمية" style="width:100px;padding:8px;border-radius:8px;border:1px solid var(--border);">
        <input id="pt-price-${channel}" type="number" step="0.01" placeholder="السعر" style="width:100px;padding:8px;border-radius:8px;border:1px solid var(--border);">
        <button class="btn btn-primary btn-sm" onclick="addPricingTier('${channel}')">+ إضافة</button>
      </div>
    </div>
  `).join("");
}

async function addPricingTier(channel) {
  const qty = document.getElementById(`pt-qty-${channel}`).value;
  const price = document.getElementById(`pt-price-${channel}`).value;
  if (!qty || !price) return alert("أدخل الكمية والسعر");
  await apiFetch(`/admin/pricing/${channel}`, { method: "POST", body: JSON.stringify({ qty, price }) });
  loadPricing();
}

async function deletePricingTier(channel, index) {
  await apiFetch(`/admin/pricing/${channel}/${index}`, { method: "DELETE" });
  loadPricing();
}

// ---- قوالب OTP ----
async function loadTemplates() {
  const templates = await apiFetch("/admin/templates");
  document.getElementById("templatesBox").innerHTML = templates.map(t => `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;">
        <strong>${t.channel}</strong>
        <span class="badge badge-${t.status}">${t.status}</span>
      </div>
      <p style="font-size:13px;">${t.body}</p>
      ${t.pendingBody ? `
        <div style="background:#FFFBEB;padding:10px;border-radius:8px;font-size:13px;margin-top:8px;">
          <strong>تعديل مقترح من السبورت:</strong><br>${t.pendingBody}<br><br>
          <button class="btn btn-primary btn-sm" onclick="approveTemplate('${t.id}')">اعتماد</button>
          <button class="btn btn-outline btn-sm" onclick="rejectTemplate('${t.id}')">رفض</button>
        </div>` : ""}
    </div>
  `).join("");
}

async function approveTemplate(id) {
  await apiFetch(`/admin/templates/${id}/approve`, { method: "POST" });
  loadTemplates();
}
async function rejectTemplate(id) {
  await apiFetch(`/admin/templates/${id}/reject`, { method: "POST" });
  loadTemplates();
}

// ---- واتساب QR ----
async function connectWhatsapp() {
  const data = await apiFetch("/admin/whatsapp/connect", { method: "POST" });
  document.getElementById("qrBox").innerHTML = `<img src="${data.qr}" alt="QR">`;
  document.getElementById("waStatus").innerHTML = `<span class="badge badge-pending">بانتظار المسح</span>`;
}

// ---- إعدادات الربط (فحص حالة القنوات) ----
async function loadSettingsCheck() {
  // ملاحظة: القيم الفعلية تُقرأ من متغيرات البيئة في السيرفر، هنا عرض توضيحي فقط
  document.getElementById("chk-twilio-sms").innerHTML = `<span class="badge badge-pending">أضف TWILIO_ACCOUNT_SID و TWILIO_AUTH_TOKEN في .env</span>`;
  document.getElementById("chk-twilio-wa").innerHTML = `<span class="badge badge-pending">أضف TWILIO_WHATSAPP_FROM في .env</span>`;
  document.getElementById("chk-ims").innerHTML = `<span class="badge badge-pending">أضف IMS_API_URL و IMS_API_KEY في .env</span>`;
  document.getElementById("chk-smtp").innerHTML = `<span class="badge badge-pending">أضف بيانات SMTP في .env</span>`;
}

// ---- اللغات ----
async function loadLanguages() {
  const langs = await apiFetch("/admin/languages");
  const box = document.getElementById("languagesBox");
  box.innerHTML = Object.keys(langs).map(lang => `
    <div class="card" style="margin-bottom:14px;">
      <h4>${lang.toUpperCase()}</h4>
      <textarea id="lang-${lang}" rows="8" style="width:100%;font-family:monospace;font-size:12px;">${JSON.stringify(langs[lang], null, 2)}</textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="saveLanguage('${lang}')">حفظ</button>
    </div>
  `).join("");
}

async function saveLanguage(lang) {
  try {
    const value = JSON.parse(document.getElementById(`lang-${lang}`).value);
    await apiFetch(`/admin/languages/${lang}`, { method: "PUT", body: JSON.stringify(value) });
    alert("تم الحفظ بنجاح");
  } catch (e) {
    alert("خطأ في تنسيق JSON: " + e.message);
  }
}

// ---- المستخدمون (عملاء / سبورت / أدمن) ----
async function loadStaff() {
  const users = await apiFetch("/admin/users");
  document.getElementById("staffBody").innerHTML = users.map(s => `
    <tr>
      <td>${s.name}</td><td>${s.email}</td><td>${s.role}</td>
      <td>${s.id === user.id ? "" : `<button class="btn btn-danger btn-sm" onclick="deleteUser('${s.id}')">حذف</button>`}</td>
    </tr>
  `).join("");
}

async function addStaff() {
  const name = document.getElementById("staffName").value;
  const email = document.getElementById("staffEmail").value;
  const password = document.getElementById("staffPassword").value;
  const role = document.getElementById("staffRole").value;
  if (!name || !email || !password) return alert("أكمل كل الحقول");
  await apiFetch("/admin/users", { method: "POST", body: JSON.stringify({ name, email, password, role }) });
  document.getElementById("staffName").value = "";
  document.getElementById("staffEmail").value = "";
  document.getElementById("staffPassword").value = "";
  loadStaff();
  loadClients();
}

// ---- كل التذاكر ----
async function loadAllTickets() {
  const tickets = await apiFetch("/admin/tickets");
  document.getElementById("allTicketsBody").innerHTML = tickets.map(t => `
    <tr><td>${t.subject}</td><td><span class="badge badge-${t.status}">${t.status}</span></td><td>${new Date(t.createdAt).toLocaleString()}</td></tr>
  `).join("") || "<tr><td colspan=\"3\" style=\"color:var(--muted)\">لا توجد تذاكر</td></tr>";
}

// ---- اكتشاف الأخطاء وإصلاحها على مستوى النظام ----
async function detectSystemErrors() {
  const data = await apiFetch("/admin/detect-errors");
  document.getElementById("systemIssuesBox").innerHTML = data.issues.map(i => `
    <div class="issue ${i.severity}">
      ${i.title}
      ${i.fix ? `<button class="btn btn-primary btn-sm" style="margin-inline-start:10px;" onclick="fixSystemIssue('${i.fix}')">إصلاح الآن</button>` : ""}
    </div>
  `).join("");
}

async function fixSystemIssue(action) {
  const data = await apiFetch(`/admin/fix/${action}`, { method: "POST" });
  if (data.qr) {
    alert("تم توليد QR جديد لربط واتساب — افتح تبويب ربط واتساب لمسحه");
  } else {
    alert(data.message || "تم الإصلاح");
  }
  detectSystemErrors();
}

loadClients();
