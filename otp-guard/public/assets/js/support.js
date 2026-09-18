const user = guardRole("support");
let currentClientId = null;
let currentTicketId = null;

document.getElementById("userName").textContent = user ? `${user.name} (سبورت)` : "";

document.querySelectorAll(".sidebar a[data-tab]").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".sidebar a[data-tab]").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll("main > section").forEach(s => s.style.display = "none");
    document.getElementById(`tab-${link.dataset.tab}`).style.display = "block";
    document.getElementById("pageTitle").textContent = link.textContent.trim();
    if (link.dataset.tab === "tickets") loadTickets();
    if (link.dataset.tab === "adminchat") loadAdminChat();
  });
});

async function loadClients() {
  const clients = await apiFetch("/support/clients");
  document.getElementById("clientsBody").innerHTML = clients.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.email}</td>
      <td>${c.country || "-"}</td>
      <td>${c.balance}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewClient('${c.id}')">عرض</button></td>
    </tr>
  `).join("");
}

async function viewClient(id) {
  currentClientId = id;
  const data = await apiFetch(`/support/clients/${id}`);
  document.getElementById("clientProfile").style.display = "block";
  document.getElementById("cpName").textContent = data.client.name;
  document.getElementById("cpEmail").textContent = `${data.client.email} — الرصيد: ${data.client.balance} — الدولة: ${data.client.country}`;
  document.getElementById("issuesBox").innerHTML = "";

  document.getElementById("cpServices").innerHTML = data.services.map(s => `
    <tr><td>${s.name}</td><td>${s.channel}</td>
    <td><span class="badge badge-${s.status}">${s.status}</span></td>
    <td>${s.billing}</td></tr>
  `).join("") || "<tr><td colspan=\"4\" style=\"color:var(--muted)\">لا توجد خدمات</td></tr>";

  document.getElementById("cpVerifications").innerHTML = data.verifications.slice(0, 20).map(v => `
    <tr><td>${v.channel}</td><td>${v.recipient}</td>
    <td><span class="badge badge-${v.status}">${v.status}</span></td></tr>
  `).join("") || "<tr><td colspan=\"3\" style=\"color:var(--muted)\">لا يوجد سجل</td></tr>";
}

async function detectErrors() {
  if (!currentClientId) return;
  const data = await apiFetch(`/support/clients/${currentClientId}/detect-errors`);
  document.getElementById("issuesBox").innerHTML = `
    <h4>الأعطال المكتشفة:</h4>
    ${data.issues.map(i => `<div class="issue ${i.severity}">${i.title}</div>`).join("")}
    <p style="font-size:12px;color:var(--muted);margin-top:8px;">
      💡 السبورت لا يمكنه تعديل بيانات العميل مباشرة — فقط تواصل معه عبر التذاكر أو أبلغ الأدمن.
    </p>
  `;
}

async function loadTickets() {
  const tickets = await apiFetch("/support/tickets");
  document.getElementById("ticketsList").innerHTML = tickets.map(t => `
    <div class="card" style="margin-bottom:8px;cursor:pointer;padding:12px;" onclick="openTicket('${t.id}')">
      <div style="font-size:13px;font-weight:600;">${t.subject}</div>
      <span class="badge badge-${t.status}">${t.status}</span>
    </div>
  `).join("") || "<p style=\"color:var(--muted);font-size:13px;\">لا توجد تذاكر</p>";
}

async function openTicket(id) {
  currentTicketId = id;
  await apiFetch(`/support/tickets/${id}/claim`, { method: "POST" });
  const messages = await apiFetch(`/support/tickets/${id}/messages`);
  renderMessages(messages);
}

function renderMessages(messages) {
  document.getElementById("chatMessages").innerHTML = messages.map(m => `
    <div class="msg ${m.senderRole === "support" ? "mine" : "theirs"}">
      ${m.message ? m.message : ""}
      ${m.fileUrl ? `<br><a href="${m.fileUrl}" target="_blank" style="text-decoration:underline;">📎 مرفق</a>` : ""}
    </div>
  `).join("");
}

async function sendTicketMessage() {
  if (!currentTicketId) return alert("اختر تذكرة أولاً");
  const text = document.getElementById("chatText").value;
  const fileInput = document.getElementById("chatFile");
  const formData = new FormData();
  formData.append("message", text);
  if (fileInput.files[0]) formData.append("file", fileInput.files[0]);

  await apiFetch(`/support/tickets/${currentTicketId}/messages`, { method: "POST", body: formData });
  document.getElementById("chatText").value = "";
  fileInput.value = "";
  openTicket(currentTicketId);
}

async function resolveTicket() {
  if (!currentTicketId) return;
  await apiFetch(`/support/tickets/${currentTicketId}/resolve`, { method: "POST" });
  loadTickets();
}

async function loadAdminChat() {
  const messages = await apiFetch("/support/admin-chat");
  document.getElementById("adminChatMessages").innerHTML = messages.map(m => `
    <div class="msg ${m.senderRole === "support" ? "mine" : "theirs"}">${m.message}</div>
  `).join("");
}

async function sendAdminMessage() {
  const text = document.getElementById("adminChatText").value;
  if (!text) return;
  await apiFetch("/support/admin-chat", { method: "POST", body: JSON.stringify({ message: text }) });
  document.getElementById("adminChatText").value = "";
  loadAdminChat();
}

loadClients();
