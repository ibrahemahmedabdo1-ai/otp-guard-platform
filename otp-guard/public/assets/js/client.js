const user = guardRole("client");
let currentTicketId = null;

document.getElementById("userName").textContent = user ? `${user.name} (عميل)` : "";

// تبديل التابات
document.querySelectorAll(".sidebar a[data-tab]").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".sidebar a[data-tab]").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll("main > section").forEach(s => s.style.display = "none");
    document.getElementById(`tab-${link.dataset.tab}`).style.display = "block";
    document.getElementById("pageTitle").textContent = link.textContent.trim();
    if (link.dataset.tab === "customers") loadCustomers();
    if (link.dataset.tab === "support") loadTickets();
    if (link.dataset.tab === "test") loadAllowance();
  });
});

async function loadAllowance() {
  const allowance = await apiFetch("/client/test-allowance");
  const labels = { whatsapp: "واتساب", sms: "SMS", email: "إيميل" };
  document.getElementById("allowanceBox").innerHTML = Object.entries(allowance).map(([ch, a]) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>${labels[ch] || ch}</span>
      <span>${a.locked ? "🔒 موقوف من الأدمن" : `متبقي ${a.remaining} رسالة اختبار مجانية`}</span>
    </div>
  `).join("");
}

async function loadOverview() {
  const me = await apiFetch("/client/me");
  document.getElementById("statBalance").textContent = me.balance;
  document.getElementById("statCountry").textContent = me.country || "-";
  const customers = await apiFetch("/client/customers");
  document.getElementById("statVerifications").textContent = customers.length;
}

async function loadPackages() {
  const packages = await apiFetch("/client/packages");
  const labels = { whatsapp: "واتساب", sms: "SMS", email: "إيميل", bundle: "باكدج مجمع" };
  document.getElementById("packagesGrid").innerHTML = packages.map(p => `
    <div class="card">
      <span class="badge badge-pending">${labels[p.channel] || p.channel || ""}</span>
      <h3>${p.name}</h3>
      <p style="color:var(--muted)">${p.description}</p>
      <div class="stat">${p.price} ${p.currency}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="buyPackage('${p.id}')">شراء</button>
    </div>
  `).join("");
}

async function buyPackage(id) {
  await apiFetch(`/client/packages/${id}/buy`, { method: "POST" });
  alert("تم شحن الرصيد بنجاح");
  loadOverview();
}

async function sendTest() {
  const channel = document.getElementById("testChannel").value;
  const recipient = document.getElementById("testRecipient").value;
  const resultBox = document.getElementById("testResult");
  if (!recipient) return alert("أدخل المستلم أولاً");
  resultBox.textContent = "جارٍ الإرسال...";
  try {
    const data = await apiFetch("/client/test", { method: "POST", body: JSON.stringify({ channel, recipient }) });
    resultBox.innerHTML = data.result.ok
      ? `✅ تم الإرسال بنجاح.`
      : `⚠️ محاكاة إرسال (القناة غير مفعّلة بعد بمفاتيح حقيقية): ${data.result.message || ""}`;
    loadAllowance();
  } catch (e) {
    resultBox.textContent = "❌ " + e.message;
  }
}

async function loadCustomers() {
  const list = await apiFetch("/client/customers");
  document.getElementById("customersBody").innerHTML = list.map(v => `
    <tr>
      <td>${v.channel}</td>
      <td>${v.recipient}</td>
      <td><span class="badge badge-${v.status}">${v.status}</span></td>
      <td>${new Date(v.createdAt).toLocaleString()}</td>
    </tr>
  `).join("") || "<tr><td colspan=\"4\" style=\"text-align:center;color:var(--muted)\">لا توجد بيانات بعد</td></tr>";
}

async function loadTickets() {
  const tickets = await apiFetch("/client/tickets");
  document.getElementById("ticketsList").innerHTML = tickets.map(t => `
    <div class="card" style="margin-bottom:8px;cursor:pointer;padding:12px;" onclick="openTicket('${t.id}')">
      <div style="font-size:13px;font-weight:600;">${t.subject}</div>
      <span class="badge badge-${t.status}">${t.status}</span>
    </div>
  `).join("") || "<p style=\"color:var(--muted);font-size:13px;\">لا توجد تذاكر بعد</p>";
  if (tickets.length && !currentTicketId) openTicket(tickets[0].id);
}

async function newTicket() {
  const subject = prompt("موضوع التذكرة:");
  if (!subject) return;
  const ticket = await apiFetch("/client/tickets", { method: "POST", body: JSON.stringify({ subject }) });
  await loadTickets();
  openTicket(ticket.id);
}

async function openTicket(id) {
  currentTicketId = id;
  const messages = await apiFetch(`/client/tickets/${id}/messages`);
  renderMessages(messages);
}

function renderMessages(messages) {
  document.getElementById("chatMessages").innerHTML = messages.map(m => `
    <div class="msg ${m.senderRole === "client" ? "mine" : "theirs"}">
      ${m.message ? m.message : ""}
      ${m.fileUrl ? `<br><a href="${m.fileUrl}" target="_blank" style="text-decoration:underline;">📎 مرفق</a>` : ""}
    </div>
  `).join("");
}

async function sendMessage() {
  if (!currentTicketId) return alert("افتح تذكرة أولاً");
  const text = document.getElementById("chatText").value;
  const fileInput = document.getElementById("chatFile");
  const formData = new FormData();
  formData.append("message", text);
  if (fileInput.files[0]) formData.append("file", fileInput.files[0]);

  await apiFetch(`/client/tickets/${currentTicketId}/messages`, { method: "POST", body: formData });
  document.getElementById("chatText").value = "";
  fileInput.value = "";
  openTicket(currentTicketId);
}

loadOverview();
loadPackages();
