import { loadSession, currentUser, api, getBackHref, setupCSRF } from "./api.js";

const gearSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10L5.6 18.4"/></svg>`;
const assistantIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

function brandMarkup(compact = false) {
  return `
    <img class="brand-mark" src="/assets/logo-mark.svg" alt="Hotel Localslens">
    <span class="brand-word${compact ? " brand-word-sm" : ""}" aria-hidden="true">
      <span class="brand-line1">Hotel</span>
      <span class="brand-line2"><span class="b-locals">Locals</span><span class="b-lens">lens</span></span>
    </span>`;
}

function navKeyFromPath(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/index" || p.endsWith("/index.html")) return "home";
  if (p.includes("hotel")) return "hoteis";
  if (p.includes("guia")) return "guias";
  if (p.includes("agencia")) return "agencias";
  if (p.includes("mapa")) return "mapa";
  return null;
}

function actionsMarkup(user) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeIcon = isDark
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.41 1.41m12.72 12.72 1.41 1.41M1 12h2m18 0h2M4.22 19.78l1.41-1.41M18.36 5.64l1.41-1.41"></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  return `
    <button type="button" id="themeToggle" class="theme-toggle-btn" aria-label="Alternar modo claro e escuro" title="Alternar tema">${themeIcon}</button>
    ${
      user
        ? `<a class="settings-trigger" href="/configuracoes.html" aria-label="Configurações da conta">${gearSvg}<span class="settings-label">Configurações</span></a><span class="meta user-name">${user.displayName}</span><button class="btn-ghost" id="logout-btn" type="button">Sair</button>`
        : `<a class="btn-ghost btn-outline" href="/login.html">Entrar</a><a class="btn-primary" href="/cadastro.html">Cadastrar</a>`
    }`;
}

function initThemeToggle(header) {
  const toggleBtn = header.querySelector("#themeToggle");
  if (!toggleBtn) return;
  toggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("localslens_theme", newTheme);

    // Update icon for all theme toggles in document
    const allToggles = document.querySelectorAll("#themeToggle");
    allToggles.forEach(btn => {
      btn.innerHTML = (newTheme === "dark")
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.41 1.41m12.72 12.72 1.41 1.41M1 12h2m18 0h2M4.22 19.78l1.41-1.41M18.36 5.64l1.41-1.41"></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    });
  });
}

export async function mountChrome() {
  // 1) Menu renderizado IMEDIATAMENTE como visitante — nada de esperar a rede.
  const page = document.body.dataset.page || navKeyFromPath(location.pathname);
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <a class="brand" href="/index.html" aria-label="Hotel Localslens — página inicial">${brandMarkup()}</a>
    <nav class="nav-main" id="nav-main" aria-label="Navegação principal">
      <a href="/index.html" data-nav="home">Início</a>
      <a href="/hoteis.html" data-nav="hoteis">Hotéis</a>
      <a href="/guias.html" data-nav="guias">Guias Turísticos</a>
      <a href="/agencias.html" data-nav="agencias">Agências</a>
      <a href="/mapa.html" data-nav="mapa">Mapa Interativo</a>
    </nav>
    <div class="header-actions">
      ${actionsMarkup(null)}
      <button class="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav-main">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;
  document.body.prepend(header);
  initThemeToggle(header);
  const active = header.querySelector(`[data-nav="${page}"]`) || header.querySelector(`[data-nav="${navKeyFromPath(location.pathname)}"]`);
  if (active) active.classList.add("active");

  const toggle = header.querySelector(".menu-toggle");
  const nav = header.querySelector(".nav-main");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) nav.classList.remove("open");
  });

  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 4);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  bindLogout(header);
  mountFooter();

  // 2) Depois, em segundo plano, detecta a sessão e troca os botões se estiver logado.
  try {
    await loadSession();
    setupCSRF();
    const user = currentUser();
    if (user) {
      header.querySelector(".header-actions").innerHTML =
        `${actionsMarkup(user)}<button class="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav-main"><span></span><span></span><span></span></button>`;
      const t2 = header.querySelector(".menu-toggle");
      t2.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        t2.setAttribute("aria-expanded", String(open));
      });
      initThemeToggle(header);
      bindLogout(header);
    }
  } catch (err) {
    console.warn("Sessão indisponível, mantendo menu de visitante:", err.message);
  }
}


function bindLogout(header) {
  const logout = header.querySelector("#logout-btn");
  if (!logout || logout.dataset.bound) return;
  logout.dataset.bound = "1";
  logout.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/";
  });
}

function mountFooter() {
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/index.html" aria-label="Hotel Localslens">${brandMarkup(true)}</a>
      <p>Descubra hotéis, guias turísticos, agências e mapas — com a lente de quem vive o lugar.</p>
    </div>
    <nav class="footer-links" aria-label="Links rápidos">
      <h3>Navegação</h3>
      <a href="/index.html">Início</a>
      <a href="/hoteis.html">Hotéis</a>
      <a href="/guias.html">Guias Turísticos</a>
      <a href="/agencias.html">Agências</a>
      <a href="/mapa.html">Mapa Interativo</a>
    </nav>
    <nav class="footer-links" aria-label="Links institucionais">
      <h3>Institucional</h3>
      <a href="/termos.html">Termos de uso</a>
      <a href="/privacidade.html">Privacidade</a>
      <a href="/recuperar.html">Recuperar acesso</a>
      <a href="/configuracoes.html">Configurações</a>
    </nav>
    <div class="footer-note">
      <p>Endereços e atrações: &copy; OpenStreetMap / Nominatim.</p>
      <p>© ${new Date().getFullYear()} Hotel Localslens</p>
    </div>
  </div>`;
  document.body.append(footer);
  mountAssistant();
}

export function mountBack(fallback) {
  const slot = document.querySelector("[data-back]");
  if (!slot) return;
  const href = getBackHref(fallback || slot.dataset.back || "/");
  slot.innerHTML = `<a class="btn-back" href="${href}">← Voltar</a>`;
}

function mountAssistant() {
  const root = document.createElement("div");
  root.className = "assistant";
  root.innerHTML = `
    <div class="assistant-panel hidden" id="assistant-panel">
      <div class="assistant-head">Assistente Hotel Localslens</div>
      <div class="assistant-log" id="assistant-log"></div>
      <form class="assistant-form" id="assistant-form">
        <input name="message" maxlength="1200" placeholder="Pergunte sobre hotéis, guias ou a plataforma" required>
        <button class="btn-primary" type="submit">Enviar</button>
      </form>
    </div>
    <button class="assistant-toggle" type="button" aria-label="Abrir assistente" title="Assistente IA">${assistantIcon}</button>
  `;
  document.body.append(root);
  const panel = root.querySelector("#assistant-panel");
  const log = root.querySelector("#assistant-log");
  const history = [];
  root.querySelector(".assistant-toggle").addEventListener("click", () => panel.classList.toggle("hidden"));
  root.querySelector("#assistant-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.target.message;
    const message = input.value.trim();
    if (!message) return;
    log.insertAdjacentHTML("beforeend", `<div class="bubble user"></div>`);
    log.lastChild.textContent = message;
    input.value = "";
    const loading = document.createElement("div");
    loading.className = "bubble bot";
    loading.textContent = "Consultando o catálogo...";
    log.append(loading);
    try {
      const data = await api("/api/ai/chat", { method: "POST", body: { message, history } });
      loading.textContent = data.reply;
      history.push({ role: "user", content: message }, { role: "assistant", content: data.reply });
    } catch (err) {
      loading.textContent = err.message;
    }
    log.scrollTop = log.scrollHeight;
  });
}

export function showAlert(el, message, type = "error") {
  if (!el) return;
  el.className = `alert ${type}`;
  el.textContent = message;
  el.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  mountChrome().then(() => mountBack());
});
