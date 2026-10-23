import { api, currentUser, loadSession, setReturnUrl } from "./api.js";
import { mountBack } from "./layout.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const params = new URLSearchParams(location.search);
const id = params.get("id");
const kind = document.body.dataset.kind;
const root = document.getElementById("detail-root");

const endpoints = { hotel: `/api/hotels/${id}`, guide: `/api/guides/${id}`, agency: `/api/agencies/${id}` };

function reviewsBlock(reviews) {
  const summary = reviews?.count
    ? `<p>Média ${reviews.average} · ${reviews.count} avaliação(ões) reais no cadastro.</p>`
    : `<p class="meta">Não há avaliações cadastradas neste sistema.</p>`;
  return `${summary}<div id="reviews-live" class="section-inner"></div>`;
}

function stars(value) {
  return "★".repeat(value) + "☆".repeat(5 - value);
}

async function mountReviews(entityId) {
  const box = document.getElementById("reviews-live");
  if (!box) return;
  const user = currentUser();
  const render = async () => {
    const data = await api(`/api/reviews?target_type=${kind}&target_id=${entityId}`);
    const list = data.reviews
      .map(
        (r) => `<article class="card"><div class="card-body">
          <p><strong>${stars(r.rating)}</strong> — ${esc(r.author)}</p>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
          <p class="meta">${esc(r.createdAt)}</p>
          ${user && r.authorId === user.id ? `<button type="button" class="btn btn-ghost" data-del="${r.id}">Excluir minha avaliação</button>` : ""}
        </div></article>`
      )
      .join("");
    const form = user
      ? `<form id="review-form" class="stack">
          <label>Nota
            <select name="rating" required>
              ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${data.mine?.rating === n ? " selected" : ""}>${stars(n)} (${n})</option>`).join("")}
            </select>
          </label>
          <label>Comentário (opcional)
            <textarea name="comment" maxlength="1200" rows="3">${esc(data.mine?.comment || "")}</textarea>
          </label>
          <button type="submit" class="btn">${data.mine ? "Atualizar minha avaliação" : "Avaliar"}</button>
          <p id="review-status" class="status" hidden></p>
        </form>`
      : `<p class="meta"><a href="/login.html">Faça login</a> para deixar uma avaliação.</p>`;
    box.innerHTML = `${list || ""}${form}`;
    const formEl = document.getElementById("review-form");
    if (formEl) {
      formEl.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const status = document.getElementById("review-status");
        status.hidden = false;
        status.textContent = "Enviando...";
        try {
          await api("/api/reviews", {
            method: "POST",
            body: {
              targetType: kind,
              targetId: Number(entityId),
              rating: Number(new FormData(formEl).get("rating")),
              comment: new FormData(formEl).get("comment")
            }
          });
          status.textContent = "Avaliação registrada.";
          await render();
        } catch (err) {
          status.textContent = err.message;
        }
      });
    }
    box.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/reviews/${btn.dataset.del}`, { method: "DELETE" });
          await render();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  };
  await render();
}

function renderHotel(h) {
  const imgs = h.images || [];
  return `
    <div data-back="/hoteis.html"></div>
    ${h.isDemo ? `<p class="badge">Cadastro de demonstração — não é um hotel real</p>` : ""}
    <div class="detail-hero">
      <div class="gallery">
        <div class="gallery-main">${imgs[0] ? `<img id="main-photo" src="${esc(imgs[0].url)}" alt="">` : `<div class="card-media">Sem fotos cadastradas</div>`}</div>
        <div class="thumbs">${imgs.map((img, i) => `<button type="button" data-src="${esc(img.url)}"><img src="${esc(img.url)}" alt=""></button>`).join("")}</div>
      </div>
      <aside class="panel">
        <h1>${esc(h.name)}</h1>
        <p class="meta">${[h.address, h.neighborhood, h.city, h.state].filter(Boolean).join(" · ") || "Endereço não informado"}</p>
        <p class="meta">${h.category ? `Categoria: ${esc(h.category)}` : "Categoria não informada"}</p>
        <p class="meta">${h.priceMin != null ? `Preço cadastrado: ${h.priceMin}${h.priceMax != null ? " – " + h.priceMax : ""}` : "Nenhum preço cadastrado"}</p>
        <p>${h.phone ? esc(h.phone) : "Telefone público não informado"}</p>
        ${h.website ? `<p><a href="${esc(h.website)}" rel="noopener noreferrer">Site oficial</a></p>` : ""}
      </aside>
    </div>
    <nav class="subnav">
      <a href="#visao">Visão geral</a>
      <a href="#fotos">Fotos</a>
      <a href="#comodidades">Comodidades</a>
      <a href="#localizacao">Localização</a>
      <a href="#avaliacoes">Avaliações</a>
      <a href="#eventos">Eventos</a>
      <a href="#contato">Contato</a>
    </nav>
    <section id="visao" class="section"><h2>Visão geral</h2><p>${esc(h.description) || "Sem descrição cadastrada."}</p></section>
    <section id="fotos" class="section"><h2>Fotos</h2>${imgs.length ? imgs.map((i) => `<img src="${esc(i.url)}" alt="${esc(i.alt || "")}" style="max-width:320px;margin:8px 8px 0 0">`).join("") : "<p>Nenhuma foto enviada.</p>"}</section>
    <section id="comodidades" class="section"><h2>Comodidades</h2><p>${(h.amenities || []).map(esc).join(", ") || "Não cadastradas"}</p><p>Acessibilidade: ${(h.accessibility || []).map(esc).join(", ") || "Não cadastrada"}</p></section>
    <section id="localizacao" class="section"><h2>Localização</h2>
      ${h.lat != null && h.lng != null ? `<div id="hotel-map" style="height:280px;border-radius:16px"></div>` : "<p>Não há coordenadas cadastradas. O mapa não inventa localizações.</p>"}
    </section>
    <section id="avaliacoes" class="section"><h2>Avaliações</h2>${reviewsBlock(h.reviews)}</section>
    <section id="eventos" class="section"><h2>Eventos relacionados a este hotel</h2>
      ${(h.events || []).length ? h.events.map((ev) => `<article class="card"><div class="card-body"><h3>${esc(ev.title)}</h3><p>${esc(ev.description || "")}</p><p class="meta">${esc(ev.starts_at || "")} ${esc(ev.location || "")}</p></div></article>`).join("") : "<p>Nenhum evento cadastrado para este hotel.</p>"}
    </section>
    <section id="contato" class="section"><h2>Contato</h2><p>${esc(h.phone || "Não informado")}</p><p>${esc(h.publicEmail || "")}</p></section>
  `;
}

function renderGuide(g) {
  return `
    <div data-back="/guias.html"></div>
    ${g.isDemo ? `<p class="badge">Perfil de demonstração</p>` : ""}
    <div class="detail-hero">
      <div class="gallery-main">${g.images?.[0] ? `<img src="${esc(g.images[0].url)}" alt="">` : g.avatarUrl ? `<img src="${esc(g.avatarUrl)}" alt="">` : `<div class="card-media">${esc(g.professionalName).slice(0,1)}</div>`}</div>
      <aside class="panel">
        <h1>${esc(g.professionalName)}</h1>
        <p class="meta">${[g.city, g.state, ...(g.regions || [])].filter(Boolean).join(" · ") || "Região não informada"}</p>
        <p>Idiomas: ${(g.languages || []).map(esc).join(", ") || "Não informados"}</p>
        <p>Especialidades: ${(g.specialties || []).map(esc).join(", ") || "Não informadas"}</p>
        <p>${g.priceMin != null ? `Faixa cadastrada: ${g.priceMin}${g.priceMax != null ? " – " + g.priceMax : ""}` : "Faixa de preço não cadastrada"}</p>
      </aside>
    </div>
    <section class="section"><h2>Biografia</h2><p>${esc(g.bio) || "Sem biografia pública."}</p></section>
    <section class="section"><h2>Qualificações declaradas</h2><p>${esc(g.qualifications) || "Não informadas. Declarações do guia não foram verificadas oficialmente."}</p></section>
    <section class="section"><h2>Passeios e serviços</h2><p>${(g.tourTypes || []).map(esc).join(", ")}</p><p>${(g.services || []).map(esc).join(", ") || "Não informados"}</p></section>
    <section class="section"><h2>Contato público</h2><p>${esc(g.phone || "Telefone oculto")}</p><p>${esc(g.email || "E-mail oculto")}</p></section>
    <section class="section"><h2>Avaliações</h2>${reviewsBlock(g.reviews)}</section>
  `;
}

function renderAgency(a) {
  return `
    <div data-back="/agencias.html"></div>
    ${a.isDemo ? `<p class="badge">Perfil de demonstração</p>` : ""}
    <div class="detail-hero">
      <div class="gallery-main">${a.logoUrl ? `<img src="${esc(a.logoUrl)}" alt="">` : `<div class="card-media">${esc(a.tradeName).slice(0,1)}</div>`}</div>
      <aside class="panel">
        <h1>${esc(a.tradeName)}</h1>
        <p class="meta">${esc(a.legalName)}</p>
        <p>${[a.address, a.city, a.state].filter(Boolean).join(" · ") || "Endereço comercial não publicado"}</p>
        ${a.website ? `<p><a href="${esc(a.website)}" rel="noopener noreferrer">${esc(a.website)}</a></p>` : ""}
        ${a.professionalRegistry ? `<p>Registro informado: ${esc(a.professionalRegistry)}</p>` : ""}
      </aside>
    </div>
    <section class="section"><h2>Sobre</h2><p>${esc(a.description) || "Sem descrição."}</p></section>
    <section class="section"><h2>Destinos</h2><p>${(a.destinations || []).map(esc).join(", ") || "Não informados"}</p></section>
    <section class="section"><h2>Serviços</h2><p>${(a.services || []).map(esc).join(", ") || "Não informados"}</p><p>${(a.travelTypes || []).map(esc).join(", ")}</p></section>
    <section class="section"><h2>Galeria</h2>${(a.images || []).map((i) => `<img src="${esc(i.url)}" alt="" style="max-width:240px">`).join("") || "<p>Sem fotos.</p>"}</section>
    <section class="section"><h2>Contato comercial público</h2><p>${esc(a.phone || "Oculto")}</p><p>${esc(a.email || "Oculto")}</p></section>
    <section class="section"><h2>Avaliações</h2>${reviewsBlock(a.reviews)}</section>
  `;
}

async function init() {
  if (!id) {
    root.innerHTML = `<p class="status">Registro não informado.</p>`;
    return;
  }
  root.innerHTML = `<p class="status">Carregando...</p>`;
  try {
    await loadSession();
    const data = await api(endpoints[kind]);
    root.innerHTML = kind === "hotel" ? renderHotel(data) : kind === "guide" ? renderGuide(data) : renderAgency(data);
    mountBack(kind === "hotel" ? "/hoteis.html" : kind === "guide" ? "/guias.html" : "/agencias.html");
    await mountReviews(data.id);
    root.querySelectorAll("[data-src]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const main = document.getElementById("main-photo");
        if (main) main.src = btn.dataset.src;
      });
    });
    if (kind === "hotel" && data.lat != null && data.lng != null && window.L) {
      const map = L.map("hotel-map").setView([data.lat, data.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OSM" }).addTo(map);
      L.marker([data.lat, data.lng]).addTo(map);
    }
  } catch (err) {
    root.innerHTML = `<p class="status">${esc(err.message)}</p>`;
  }
}

init();
setReturnUrl();
