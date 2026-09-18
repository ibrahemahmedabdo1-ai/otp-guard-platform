// دوال مشتركة: استدعاء الـ API + إدارة تسجيل الدخول
const API_BASE = "/api";

function getToken() { return localStorage.getItem("token"); }
function getUser() { try { return JSON.parse(localStorage.getItem("user")); } catch (e) { return null; } }

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "/login.html";
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data;
}

// حماية صفحات الداشبورد: تأكد من تسجيل الدخول والدور الصحيح
function guardRole(requiredRole) {
  const user = getUser();
  if (!getToken() || !user) { location.href = "/login.html"; return null; }
  if (requiredRole && user.role !== requiredRole) { location.href = "/login.html"; return null; }
  return user;
}

function redirectByRole(role) {
  if (role === "client") location.href = "/client/dashboard.html";
  else if (role === "support") location.href = "/support/dashboard.html";
  else if (role === "admin") location.href = "/admin/dashboard.html";
  else location.href = "/";
}
