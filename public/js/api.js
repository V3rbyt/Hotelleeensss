const state = { user: null, csrf: null };

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (state.csrf && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) {
    headers["X-CSRF-Token"] = state.csrf;
  }
  const res = await fetch(path, { credentials: "same-origin", ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
}

export async function loadSession() {
  const data = await api("/api/session");
  state.user = data.user;
  state.csrf = data.csrfToken;
  return data;
}

export function getCSRFToken() {
  return state.csrf;
}

export function currentUser() {
  return state.user;
}

export function setReturnUrl() {
  sessionStorage.setItem("ll:return", location.pathname + location.search);
}

export function getBackHref(fallback) {
  const stored = sessionStorage.getItem("ll:return");
  const ref = document.referrer;
  try {
    if (ref) {
      const url = new URL(ref);
      if (url.origin === location.origin && !url.pathname.includes(location.pathname)) {
        return url.pathname + url.search || fallback;
      }
    }
  } catch {
    /* ignore */
  }
  if (stored && stored !== location.pathname + location.search) return stored;
  return fallback;
}

export function qs(form) {
  const params = new URLSearchParams(location.search);
  if (form) {
    const data = new FormData(form);
    for (const [k, v] of data.entries()) {
      if (v) params.set(k, String(v));
      else params.delete(k);
    }
  }
  return params;
}

export function fillFormFromQuery(form) {
  const params = new URLSearchParams(location.search);
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") el.checked = params.getAll(el.name).includes(el.value) || params.get(el.name) === "on";
    else if (params.has(el.name)) el.value = params.get(el.name);
  }
}

export function setupCSRF() {
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    const csrfInput = form.querySelector('input[name="_csrf"]');
    if (!csrfInput) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "_csrf";
      input.value = getCSRFToken() || "";
      form.appendChild(input);
    }
  });
}
