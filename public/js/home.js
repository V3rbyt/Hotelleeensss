import { api, setReturnUrl } from "./api.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const form = document.getElementById("home-search");
const status = document.getElementById("home-status");
const results = document.getElementById("home-results");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const q = data.get("q") || "";
  const types = [...form.querySelectorAll("[name=types]:checked")].map((el) => el.value).join(",") || "hotel,guide,agency";
  status.textContent = "Buscando no cadastro...";
  results.innerHTML = "";
  try {
    const res = await api(`/api/search?q=${encodeURIComponent(q)}&types=${encodeURIComponent(types)}`);
    if (!res.results.length) {
      status.textContent = "Nada encontrado no cadastro da Hotel Lens. Use o mapa para buscar endereços reais no OpenStreetMap.";
      return;
    }
    status.textContent = `${res.total} resultado(s) cadastrados`;
    results.innerHTML = res.results
      .map((item) => {
        const href =
          item.type === "hotel"
            ? `/hotel.html?id=${item.id}`
            : item.type === "guide"
              ? `/guia.html?id=${item.id}`
              : `/agencia.html?id=${item.id}`;
        const name = esc(item.name || item.professionalName || item.tradeName);
        const city = esc(item.city || item.type);
        return `<article class="card"><a class="js-open" href="${href}"><div class="card-body"><h3>${name}${item.isDemo ? ' <span class="badge">Demonstração</span>' : ""}</h3><p class="meta">${city}</p></div></a></article>`;
      })
      .join("");
    results.querySelectorAll(".js-open").forEach((a) => a.addEventListener("click", setReturnUrl));
  } catch (err) {
    status.textContent = err.message;
  }
});
