import { api } from "./api.js";

const map = L.map("map").setView([-14.235, -51.9253], 4);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const markers = L.layerGroup().addTo(map);
const form = document.getElementById("map-search");
const suggest = document.getElementById("map-suggest");
const status = document.getElementById("map-status");
const resetBtn = document.getElementById("map-reset");
let timer;

function popupHtml(item, extra = "") {
  return `<strong>${item.label || item.name}</strong><br>${extra}`;
}

async function loadEntities() {
  const data = await api("/api/map/entities");
  data.markers.forEach((m) => {
    const href = m.type === "hotel" ? `/hotel.html?id=${m.id}` : m.type === "guide" ? `/guia.html?id=${m.id}` : `/agencia.html?id=${m.id}`;
    L.marker([m.lat, m.lng])
      .addTo(markers)
      .bindPopup(`${popupHtml(m, m.city || "")}<br><a href="${href}">Ver detalhes</a>`);
  });
}

async function search(q) {
  status.textContent = "Buscando endereços e lugares...";
  suggest.innerHTML = "";
  try {
    const data = await api(`/api/map/geocode?q=${encodeURIComponent(q)}`);
    if (!data.results.length) {
      status.textContent = "Nenhum lugar encontrado para esta busca.";
      return;
    }
    status.textContent = `${data.results.length} sugestão(ões)`;
    const bounds = [];
    data.results.forEach((item, idx) => {
      const marker = L.marker([item.lat, item.lng]).addTo(markers).bindPopup(popupHtml(item, item.type || ""));
      bounds.push([item.lat, item.lng]);
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        map.setView([item.lat, item.lng], 16);
        marker.openPopup();
      });
      li.append(btn);
      suggest.append(li);
      if (idx === 0) {
        map.setView([item.lat, item.lng], 15);
        marker.openPopup();
      }
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24] });
  } catch (err) {
    status.textContent = err.message;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = form.q.value.trim();
  if (q.length < 3) {
    status.textContent = "Digite pelo menos 3 caracteres (rua, bairro, hotel, atração...).";
    return;
  }
  search(q);
});

form.q.addEventListener("input", () => {
  clearTimeout(timer);
  const q = form.q.value.trim();
  if (q.length < 3) return;
  timer = setTimeout(() => search(q), 700);
});

resetBtn.addEventListener("click", () => {
  markers.clearLayers();
  suggest.innerHTML = "";
  status.textContent = "Visualização inicial do Brasil.";
  map.setView([-14.235, -51.9253], 4);
  loadEntities().catch(() => {});
});

loadEntities().catch(() => {
  status.textContent = "Nenhum cadastro com coordenadas reais para exibir.";
});
