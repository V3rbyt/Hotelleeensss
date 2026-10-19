import { loadSession, currentUser, api, getBackHref } from "./api.js";

const gearSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10L5.6 18.4"/></svg>`;

export async function mountChrome() {
  await loadSession();
  const user = currentUser();
  const page = document.body.dataset.page;
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <a class="settings-trigger" href="${user ? "/configuracoes.html" : "/login.html"}" aria-label="Configurações da conta">${gearSvg}</a>
    <a class="brand" href="/">
      <img class="brand-mark" src="/assets/logo-mark.svg" alt="">
      <img src="/assets/logo.svg" alt="LocaLens">
    </a>
    <nav class="nav-main" id="nav-main">
      <a href="/" data-nav="home">Início</a>
      <a href="/hoteis.html" data-nav="hoteis">Hotéis</a>
      <a href="/guias.html" data-nav="guias">Guias</a>
      <a href="/agencias.html" data-nav="agencias">Agências</a>
      <a href="/mapa.html" data-nav="mapa">Mapa</a>
    </nav>
    <div class="header-actions">
      ${
        user
          ? `<span class="meta">${user.displayName}</span><button class="btn-ghost" id="logout-btn" type="button">Sair</button>`
          : `<a class="btn-ghost" href="/login.html">Entrar</a><a class="btn-primary" href="/cadastro.html">Cadastrar</a>`
      }
      <button class="menu-toggle" type="button" aria-label="Abrir menu">☰</button>
    </div>
  `;
  document.body.prepend(header);
  const active = header.querySelector(`[data-nav="${page}"]`);
  if (active) active.classList.add("active");
  header.querySelector(".menu-toggle").addEventListener("click", () => {
    header.querySelector(".nav-main").classList.toggle("open");
  });
  const logout = header.querySelector("#logout-btn");
  if (logout) {
    logout.addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" });
      location.href = "/";
    });
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap footer-grid">
    <div><strong>LocaLens</strong><p>Descubra lugares, hotéis, guias e agências. A paleta e a logo atuais são provisórias: a identidade original não estava no workspace.</p></div>
    <div><a href="/privacidade.html">Privacidade</a><br><a href="/termos.html">Termos</a></div>
    <div>Mapas: OpenStreetMap / Nominatim</div>
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
      <div style="padding:12px 14px;font-weight:800;color:#0b3d3a">Assistente LocaLens</div>
      <div class="assistant-log" id="assistant-log"></div>
      <form class="assistant-form" id="assistant-form">
        <input name="message" maxlength="1200" placeholder="Pergunte sobre hotéis, guias ou a plataforma" required>
        <button class="btn-primary" type="submit">Enviar</button>
      </form>
    </div>
    <button class="assistant-toggle" type="button" aria-label="Abrir assistente">AI</button>
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
