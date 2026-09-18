// نظام تعدد اللغات: يحدد اللغة تلقائيًا حسب الدولة (IP) أو يسمح للمستخدم بتغييرها يدويًا
const SUPPORTED_LANGS = ["ar", "en", "fr"];
const RTL_LANGS = ["ar"];

async function detectLanguage() {
  const saved = localStorage.getItem("lang");
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  try {
    const res = await fetch("/api/geo");
    const geo = await res.json();
    if (SUPPORTED_LANGS.includes(geo.language)) return geo.language;
  } catch (e) {}
  return "en";
}

async function loadLocale(lang) {
  const res = await fetch(`/api/languages/${lang}`);
  return res.json();
}

function applyTranslations(dict) {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.setAttribute("placeholder", dict[key]);
  });
}

async function initI18n() {
  const lang = await detectLanguage();
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  const dict = await loadLocale(lang);
  applyTranslations(dict);

  const selector = document.getElementById("langSelect");
  if (selector) {
    selector.value = lang;
    selector.addEventListener("change", () => {
      localStorage.setItem("lang", selector.value);
      location.reload();
    });
  }
  return dict;
}

document.addEventListener("DOMContentLoaded", initI18n);
