import { api, setReturnUrl, fillFormFromQuery } from "./api.js";

function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function card(item) {
  const title = esc(item.name || item.professionalName || item.tradeName);
  const href =
    item.type === "hotel" ? `/hotel.html?id=${item.id}` : item.type === "guide" ? `/guia.html?id=${item.id}` : `/agencia.html?id=${item.id}`;
  const img = item.images?.[0]?.url || item.avatarUrl || item.logoUrl;
  const bits = [
    item.city,
    item.neighborhood,
    (item.languages || []).slice(0, 3).join(", "),
    (item.specialties || []).slice(0, 2).join(", "),
    (item.destinations || []).slice(0, 2).join(", ")
  ].filter(Boolean);
  const demo = item.isDemo ? `<span class="badge">Demonstração</span>` : "";
  const rating =
    item.reviews?.count > 0 ? `${item.reviews.average} (${item.reviews.count})` : "Sem avaliações cadastradas";
  return `<article class="card">
    <a href="${href}" class="js-open">
      <div class="card-media">${img ? `<img src="${img}" alt="">` : title.slice(0, 1)}</div>
      <div class="card-body">
        <h3>${title} ${demo}</h3>
        <p class="meta">${bits.join(" · ") || "Localização não informada"}</p>
        <p class="meta">${item.description || item.bio || ""}</p>
        <p class="meta">${rating}</p>
      </div>
    </a>
  </article>`;
}

export async function bindListing({ type, formId, resultsId, statusId }) {
  const form = document.getElementById(formId);
  const results = document.getElementById(resultsId);
  const status = document.getElementById(statusId);
  fillFormFromQuery(form);

  async function run() {
    status.textContent = "Carregando...";
    results.innerHTML = "";
    const params = new URLSearchParams(new FormData(form));
    params.set("types", type);
    const qs = params.toString();
    history.replaceState(null, "", `${location.pathname}?${qs}`);
    try {
      const data = await api(`/api/search?${qs}`);
      if (!data.results.length) {
        status.textContent = "Nenhum resultado com estes filtros. Cadastros só aparecem se existirem no banco.";
        return;
      }
      status.textContent = `${data.total} resultado(s)`;
      results.innerHTML = data.results.map(card).join("");
      results.querySelectorAll(".js-open").forEach((a) => a.addEventListener("click", setReturnUrl));
      document.getElementById("load-more")?.remove();
      if (data.total > data.page * data.pageSize) {
        const more = document.createElement("button");
        more.id = "load-more";
        more.className = "btn-ghost";
        more.textContent = "Carregar mais";
        more.addEventListener("click", async () => {
          params.set("page", String(data.page + 1));
          const extra = await api(`/api/search?${params}`);
          results.insertAdjacentHTML("beforeend", extra.results.map(card).join(""));
        });
        results.after(more);
      }
    } catch (err) {
      status.textContent = err.message;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  form.querySelector("[data-clear]")?.addEventListener("click", () => {
    form.reset();
    history.replaceState(null, "", location.pathname);
    run();
  });
  run();
}
