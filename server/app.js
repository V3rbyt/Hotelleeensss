import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  attachSession,
  limitAi,
  limitAuth,
  limitGeneral,
  limitGeo,
  requireAuth,
  requireCsrf,
  requireRole,
  securityHeaders
} from "./middleware.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerMapRoutes } from "./routes/map.js";
import { registerAiRoutes } from "./routes/ai.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { clampText } from "./utils/validators.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(limitGeneral);
  app.use(express.json({ limit: "200kb" }));
  app.use(attachSession(db));
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const open = [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/forgot",
      "POST /api/auth/reset",
      "POST /api/auth/verify-email"
    ];
    if (open.includes(`${req.method} ${req.path}`)) return next();
    return requireCsrf(req, res, next);
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Hotel Lens", version: "1.0.0" }));

  app.post("/api/auth/register", limitAuth);
  app.post("/api/auth/login", limitAuth);
  app.post("/api/auth/forgot", limitAuth);
  app.get("/api/map/geocode", limitGeo);
  app.post("/api/ai/chat", limitAi);

  registerAuthRoutes(app, db);
  registerCatalogRoutes(app, db);
  registerSettingsRoutes(app, db);
  registerMapRoutes(app, db);
  registerAiRoutes(app, db);
  registerUploadRoutes(app, db);

  app.post("/api/me/hotel/events", requireAuth, requireRole("hotel"), (req, res) => {
    const hotel = db.prepare("SELECT * FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    if (!hotel) return res.status(404).json({ error: "Hotel não encontrado." });
    const title = clampText(req.body?.title, 160);
    if (!title) return res.status(400).json({ error: "Informe o título do evento." });
    const info = db
      .prepare(
        `INSERT INTO hotel_events (hotel_id, title, description, starts_at, ends_at, location) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        hotel.id,
        title,
        clampText(req.body?.description, 2000) || null,
        clampText(req.body?.startsAt, 40) || null,
        clampText(req.body?.endsAt, 40) || null,
        clampText(req.body?.location, 160) || null
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  const ownerHotelEvents = (req, res) => {
    const hotel = db.prepare("SELECT id FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    if (!hotel) {
      res.status(404).json({ error: "Hotel não encontrado." });
      return null;
    }
    return hotel;
  };

  app.get("/api/me/hotel/events", requireAuth, requireRole("hotel"), (req, res) => {
    const hotel = ownerHotelEvents(req, res);
    if (!hotel) return;
    const rows = db
      .prepare("SELECT id, title, description, starts_at, ends_at, location FROM hotel_events WHERE hotel_id = ? ORDER BY starts_at DESC")
      .all(hotel.id);
    res.json({ events: rows });
  });

  app.put("/api/me/hotel/events/:id", requireAuth, requireRole("hotel"), (req, res) => {
    const hotel = ownerHotelEvents(req, res);
    if (!hotel) return;
    const existing = db.prepare("SELECT id FROM hotel_events WHERE id = ? AND hotel_id = ?").get(req.params.id, hotel.id);
    if (!existing) return res.status(404).json({ error: "Evento não encontrado." });
    const title = clampText(req.body?.title, 160);
    if (!title) return res.status(400).json({ error: "Informe o título do evento." });
    db.prepare(
      `UPDATE hotel_events SET title = ?, description = ?, starts_at = ?, ends_at = ?, location = ? WHERE id = ?`
    ).run(
      title,
      clampText(req.body?.description, 2000) || null,
      clampText(req.body?.startsAt, 40) || null,
      clampText(req.body?.endsAt, 40) || null,
      clampText(req.body?.location, 160) || null,
      existing.id
    );
    res.json({ ok: true });
  });

  app.delete("/api/me/hotel/events/:id", requireAuth, requireRole("hotel"), (req, res) => {
    const hotel = ownerHotelEvents(req, res);
    if (!hotel) return;
    const info = db.prepare("DELETE FROM hotel_events WHERE id = ? AND hotel_id = ?").run(req.params.id, hotel.id);
    if (!info.changes) return res.status(404).json({ error: "Evento não encontrado." });
    res.json({ ok: true });
  });

  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Rota não encontrada." });
    next();
  });
  app.use((err, _req, res, _next) => {
    if (err.status === 400 || err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Requisição inválida." });
    }
    console.error(err);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  });
  return app;
}
