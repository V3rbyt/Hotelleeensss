import { clampText } from "../utils/validators.js";
import { datetimeNow } from "../middleware.js";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LocaLens/1.0 (turismo local; contato: localens@localhost)";

let lastNominatim = 0;

async function nominatimSearch(query) {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt,en" },
    signal: controller.signal
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error("Falha no serviço de geocodificação.");
  // Limit response size to 1MB
  const text = await response.text();
  if (text.length > 1048576) throw new Error("Resposta do mapa muito grande.");
  return JSON.parse(text);
}

export function registerMapRoutes(app, db) {
  app.get("/api/map/geocode", async (req, res) => {
    const q = clampText(req.query.q, 180);
    if (q.length < 3) return res.status(400).json({ error: "Digite pelo menos 3 caracteres para buscar no mapa." });
    const cached = db.prepare("SELECT payload, created_at FROM geocode_cache WHERE query = ?").get(q.toLowerCase());
    if (cached) {
      const age = Date.now() - new Date(cached.created_at.replace(" ", "T") + "Z").getTime();
      if (age < 6 * 3600 * 1000) {
        return res.json({ source: "cache", results: JSON.parse(cached.payload) });
      }
    }
    try {
      const raw = await nominatimSearch(q);
      const results = raw.map((item) => ({
        id: item.place_id,
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        type: item.type,
        category: item.category,
        address: item.address || {}
      }));
      db.prepare("INSERT OR REPLACE INTO geocode_cache (query, payload, created_at) VALUES (?, ?, ?)").run(
        q.toLowerCase(),
        JSON.stringify(results),
        datetimeNow()
      );
      res.json({ source: "nominatim", results });
    } catch {
      res.status(502).json({ error: "Não foi possível consultar o mapa agora. Tente novamente em instantes." });
    }
  });
}
