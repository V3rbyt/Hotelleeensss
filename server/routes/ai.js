import Groq from "groq-sdk";
import { clampText } from "../utils/validators.js";
import { parseJson } from "../db.js";

const MAX_MESSAGE = 1200;
const MAX_HISTORY = 8;

function catalogSnapshot(db) {
  const hotels = db.prepare("SELECT id, name, city, neighborhood, category, price_min, price_max, amenities, description FROM hotels").all();
  const guides = db
    .prepare("SELECT user_id AS id, professional_name, city, languages, specialties, regions, tour_types, services, price_min, price_max FROM guide_profiles")
    .all();
  const agencies = db
    .prepare("SELECT user_id AS id, trade_name, city, destinations, services, travel_types, description FROM agency_profiles")
    .all();
  return {
    hotels: hotels.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      neighborhood: h.neighborhood,
      category: h.category,
      priceMin: h.price_min,
      priceMax: h.price_max,
      amenities: parseJson(h.amenities, []),
      summary: clampText(h.description, 220)
    })),
    guides: guides.map((g) => ({
      id: g.id,
      name: g.professional_name,
      city: g.city,
      languages: parseJson(g.languages, []),
      specialties: parseJson(g.specialties, []),
      regions: parseJson(g.regions, []),
      tourTypes: parseJson(g.tour_types, []),
      services: parseJson(g.services, []),
      priceMin: g.price_min,
      priceMax: g.price_max
    })),
    agencies: agencies.map((a) => ({
      id: a.id,
      name: a.trade_name,
      city: a.city,
      destinations: parseJson(a.destinations, []),
      services: parseJson(a.services, []),
      travelTypes: parseJson(a.travel_types, []),
      summary: clampText(a.description, 220)
    }))
  };
}

export function registerAiRoutes(app, db) {
  app.post("/api/ai/chat", async (req, res) => {
    const message = clampText(req.body?.message, MAX_MESSAGE);
    if (message.length < 2) return res.status(400).json({ error: "Escreva uma pergunta para o assistente." });
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: "O assistente ainda não está configurado. Defina GROQ_API_KEY no arquivo .env do servidor."
      });
    }
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-MAX_HISTORY) : [];
    const catalog = catalogSnapshot(db);
    const system = `Você é o assistente de turismo da LocaLens, plataforma brasileira para hotéis, guias e agências.
Regras:
- Responda em português do Brasil, de forma objetiva.
- Use SOMENTE o catálogo JSON abaixo para citar hotéis, guias ou agências cadastrados.
- Nunca invente nomes, endereços, preços, avaliações, disponibilidade, CNPJ, CPF ou credenciais.
- Se não houver cadastro correspondente, diga isso claramente e sugira usar a busca ou o mapa (OpenStreetMap/Nominatim) para lugares reais.
- Você pode explicar como a plataforma funciona: cadastro, filtros, mapa, configurações e páginas de detalhes.
- Sugira filtros (cidade, preço cadastrado, comodidades, idiomas) apenas com base no catálogo.
- Não peça nem repita dados pessoais sensíveis.
Catálogo atual:
${JSON.stringify(catalog)}`;

    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: "system", content: system },
          ...history
            .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .map((m) => ({ role: m.role, content: clampText(m.content, MAX_MESSAGE) })),
          { role: "user", content: message }
        ]
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (!text) return res.status(502).json({ error: "O assistente retornou uma resposta vazia." });
      res.json({ reply: text, model });
    } catch (err) {
      const status = err?.status === 401 ? 502 : 502;
      res.status(status).json({
        error: "Não foi possível falar com o assistente agora. Verifique GROQ_API_KEY e GROQ_MODEL."
      });
    }
  });
}
