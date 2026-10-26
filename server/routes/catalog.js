import { clampText, parseJsonArray, parseListParam, toNumber } from "../utils/validators.js";
import { parseJson } from "../db.js";
import { requireAuth, requireRole } from "../middleware.js";

function avgRating(db, type, id) {
  const row = db
    .prepare(
      `SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS count FROM reviews WHERE target_type = ? AND target_id = ?`
    )
    .get(type, id);
  if (!row || !row.count) return { average: null, count: 0 };
  return { average: row.avg, count: row.count };
}

function hotelPublic(db, row) {
  const images = db.prepare("SELECT id, url, alt FROM hotel_images WHERE hotel_id = ? ORDER BY sort_order, id").all(row.id);
  const events = db
    .prepare("SELECT id, title, description, starts_at, ends_at, location FROM hotel_events WHERE hotel_id = ? ORDER BY starts_at")
    .all(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    category: row.category,
    priceMin: row.price_min,
    priceMax: row.price_max,
    amenities: parseJson(row.amenities, []),
    accessibility: parseJson(row.accessibility, []),
    website: row.website,
    phone: row.phone,
    publicEmail: row.public_email,
    isDemo: Boolean(row.is_demo),
    images,
    events,
    reviews: avgRating(db, "hotel", row.id)
  };
}

function guidePublic(db, row, settings) {
  const images = db.prepare("SELECT id, url, alt FROM guide_images WHERE user_id = ? ORDER BY sort_order, id").all(row.user_id);
  return {
    id: row.user_id,
    professionalName: row.professional_name,
    bio: settings?.public_bio === 0 ? null : row.bio,
    languages: parseJson(row.languages, []),
    specialties: parseJson(row.specialties, []),
    regions: parseJson(row.regions, []),
    tourTypes: parseJson(row.tour_types, []),
    services: parseJson(row.services, []),
    qualifications: row.qualifications,
    priceMin: row.price_min,
    priceMax: row.price_max,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    avatarUrl: row.avatar_url,
    phone: settings?.public_phone ? row.phone : null,
    email: settings?.public_email ? row.email : null,
    isDemo: Boolean(row.is_demo),
    images,
    reviews: avgRating(db, "guide", row.user_id)
  };
}

function agencyPublic(db, row, settings) {
  const images = db.prepare("SELECT id, url, alt FROM agency_images WHERE user_id = ? ORDER BY sort_order, id").all(row.user_id);
  return {
    id: row.user_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    description: row.description,
    address: row.address,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    destinations: parseJson(row.destinations, []),
    services: parseJson(row.services, []),
    travelTypes: parseJson(row.travel_types, []),
    website: row.website,
    social: parseJson(row.social, {}),
    professionalRegistry: row.professional_registry,
    logoUrl: row.avatar_url,
    phone: settings?.public_phone ? row.phone : null,
    email: settings?.public_email ? row.email : null,
    isDemo: Boolean(row.is_demo),
    images,
    reviews: avgRating(db, "agency", row.user_id)
  };
}

function like(value) {
  return `%${String(value || "").replaceAll("%", "").replaceAll("_", "")}%`;
}

export function registerCatalogRoutes(app, db) {
  app.get("/api/search", (req, res) => {
    const q = clampText(req.query.q, 120);
    const types = parseListParam(req.query.types);
    const wanted = types.length ? types : ["hotel", "guide", "agency"];
    const city = clampText(req.query.city, 80);
    const sort = clampText(req.query.sort, 30) || "relevance";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(24, Math.max(6, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;
    const results = [];

    if (wanted.includes("hotel")) {
      let sql = "SELECT * FROM hotels WHERE 1=1";
      const params = [];
      if (q) {
        sql += " AND (name LIKE ? OR city LIKE ? OR neighborhood LIKE ? OR address LIKE ? OR description LIKE ?)";
        params.push(like(q), like(q), like(q), like(q), like(q));
      }
      if (city) {
        sql += " AND (city LIKE ? OR neighborhood LIKE ?)";
        params.push(like(city), like(city));
      }
      const category = clampText(req.query.category, 80);
      if (category) {
        sql += " AND category = ?";
        params.push(category);
      }
      const priceMin = toNumber(req.query.priceMin);
      const priceMax = toNumber(req.query.priceMax);
      if (priceMin != null) {
        sql += " AND (price_min IS NULL OR price_min >= ? OR price_max >= ?)";
        params.push(priceMin, priceMin);
      }
      if (priceMax != null) {
        sql += " AND (price_max IS NULL OR price_max <= ? OR price_min <= ?)";
        params.push(priceMax, priceMax);
      }
      const amenities = parseListParam(req.query.amenities);
      amenities.forEach((item) => {
        sql += " AND amenities LIKE ?";
        params.push(like(item));
      });
      const accessibility = parseListParam(req.query.accessibility);
      accessibility.forEach((item) => {
        sql += " AND accessibility LIKE ?";
        params.push(like(item));
      });
      const poi = clampText(req.query.poi, 80);
      if (poi) {
        sql += " AND (description LIKE ? OR neighborhood LIKE ? OR address LIKE ?)";
        params.push(like(poi), like(poi), like(poi));
      }
      db.prepare(sql)
        .all(...params)
        .forEach((row) => results.push({ type: "hotel", ...hotelPublic(db, row) }));
    }

    if (wanted.includes("guide")) {
      let sql = `SELECT g.*, u.avatar_url, u.phone, u.email FROM guide_profiles g JOIN users u ON u.id = g.user_id WHERE 1=1`;
      const params = [];
      if (q) {
        sql += " AND (g.professional_name LIKE ? OR g.bio LIKE ? OR g.regions LIKE ? OR g.specialties LIKE ?)";
        params.push(like(q), like(q), like(q), like(q));
      }
      const region = clampText(req.query.region, 80);
      if (region || city) {
        sql += " AND (g.regions LIKE ? OR g.city LIKE ?)";
        params.push(like(region || city), like(region || city));
      }
      parseListParam(req.query.languages).forEach((item) => {
        sql += " AND g.languages LIKE ?";
        params.push(like(item));
      });
      parseListParam(req.query.specialties).forEach((item) => {
        sql += " AND g.specialties LIKE ?";
        params.push(like(item));
      });
      parseListParam(req.query.tourTypes).forEach((item) => {
        sql += " AND g.tour_types LIKE ?";
        params.push(like(item));
      });
      const gMin = toNumber(req.query.guidePriceMin);
      const gMax = toNumber(req.query.guidePriceMax);
      if (gMin != null) {
        sql += " AND (g.price_min IS NULL OR g.price_min >= ?)";
        params.push(gMin);
      }
      if (gMax != null) {
        sql += " AND (g.price_max IS NULL OR g.price_max <= ?)";
        params.push(gMax);
      }
      db.prepare(sql)
        .all(...params)
        .forEach((row) => {
          const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(row.user_id);
          results.push({ type: "guide", ...guidePublic(db, row, settings) });
        });
    }

    if (wanted.includes("agency")) {
      let sql = `SELECT a.*, u.avatar_url, u.phone, u.email FROM agency_profiles a JOIN users u ON u.id = a.user_id WHERE 1=1`;
      const params = [];
      if (q) {
        sql += " AND (a.trade_name LIKE ? OR a.legal_name LIKE ? OR a.description LIKE ? OR a.destinations LIKE ?)";
        params.push(like(q), like(q), like(q), like(q));
      }
      if (city) {
        sql += " AND (a.city LIKE ? OR a.address LIKE ?)";
        params.push(like(city), like(city));
      }
      parseListParam(req.query.destinations).forEach((item) => {
        sql += " AND a.destinations LIKE ?";
        params.push(like(item));
      });
      parseListParam(req.query.services).forEach((item) => {
        sql += " AND a.services LIKE ?";
        params.push(like(item));
      });
      parseListParam(req.query.travelTypes).forEach((item) => {
        sql += " AND a.travel_types LIKE ?";
        params.push(like(item));
      });
      db.prepare(sql)
        .all(...params)
        .forEach((row) => {
          const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(row.user_id);
          results.push({ type: "agency", ...agencyPublic(db, row, settings) });
        });
    }

    results.sort((a, b) => {
      if (sort === "name") {
        const an = a.name || a.professionalName || a.tradeName || "";
        const bn = b.name || b.professionalName || b.tradeName || "";
        return an.localeCompare(bn, "pt-BR");
      }
      if (sort === "price") {
        return (a.priceMin ?? 9e9) - (b.priceMin ?? 9e9);
      }
      if (sort === "rating") {
        return (b.reviews?.average || 0) - (a.reviews?.average || 0);
      }
      return 0;
    });

    const totalPages = Math.ceil(results.length / limit) || 1;

    res.json({
      total: results.length,
      page,
      pageSize: limit,
      totalPages,
      results: results.slice(offset, offset + limit)
    });
  });

  app.get("/api/hotels/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM hotels WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Hotel não encontrado." });
    res.json(hotelPublic(db, row));
  });

  app.get("/api/guides/:id", (req, res) => {
    const row = db
      .prepare(
        `SELECT g.*, u.avatar_url, u.phone, u.email FROM guide_profiles g JOIN users u ON u.id = g.user_id WHERE g.user_id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Guia não encontrado." });
    const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(row.user_id);
    res.json(guidePublic(db, row, settings));
  });

  app.get("/api/agencies/:id", (req, res) => {
    const row = db
      .prepare(
        `SELECT a.*, u.avatar_url, u.phone, u.email FROM agency_profiles a JOIN users u ON u.id = a.user_id WHERE a.user_id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Agência não encontrada." });
    const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(row.user_id);
    res.json(agencyPublic(db, row, settings));
  });

  app.get("/api/me/hotel", requireAuth, requireRole("hotel"), (req, res) => {
    const row = db.prepare("SELECT * FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum hotel vinculado a esta conta." });
    res.json(hotelPublic(db, row));
  });

  app.put("/api/me/hotel", requireAuth, requireRole("hotel"), (req, res) => {
    const row = db.prepare("SELECT * FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum hotel vinculado a esta conta." });
    const b = req.body || {};
    db.prepare(
      `UPDATE hotels SET name=?, description=?, address=?, neighborhood=?, city=?, state=?, lat=?, lng=?, category=?, price_min=?, price_max=?, amenities=?, accessibility=?, website=?, phone=?, public_email=?, updated_at=datetime('now') WHERE id=? AND owner_user_id=?`
    ).run(
      clampText(b.name || row.name, 160),
      clampText(b.description, 4000) || null,
      clampText(b.address, 200) || null,
      clampText(b.neighborhood, 80) || null,
      clampText(b.city, 80) || null,
      clampText(b.state, 40) || null,
      toNumber(b.lat),
      toNumber(b.lng),
      clampText(b.category, 80) || null,
      toNumber(b.priceMin),
      toNumber(b.priceMax),
      JSON.stringify(parseJsonArray(b.amenities, parseJson(row.amenities, []))),
      JSON.stringify(parseJsonArray(b.accessibility, parseJson(row.accessibility, []))),
      clampText(b.website, 200) || null,
      clampText(b.phone, 30) || null,
      clampText(b.publicEmail, 180) || null,
      row.id,
      req.user.id
    );
    const updated = db.prepare("SELECT * FROM hotels WHERE id = ?").get(row.id);
    res.json(hotelPublic(db, updated));
  });

  app.put("/api/me/guide", requireAuth, requireRole("guide"), (req, res) => {
    const current = db.prepare("SELECT * FROM guide_profiles WHERE user_id = ?").get(req.user.id);
    if (!current) return res.status(404).json({ error: "Perfil de guia não encontrado." });
    const b = req.body || {};
    db.prepare(
      `UPDATE guide_profiles SET professional_name=?, bio=?, languages=?, specialties=?, regions=?, tour_types=?, services=?, qualifications=?, price_min=?, price_max=?, city=?, state=?, lat=?, lng=?, updated_at=datetime('now') WHERE user_id=?`
    ).run(
      clampText(b.professionalName || current.professional_name, 120),
      clampText(b.bio, 4000) || null,
      JSON.stringify(parseJsonArray(b.languages, parseJson(current.languages, []))),
      JSON.stringify(parseJsonArray(b.specialties, parseJson(current.specialties, []))),
      JSON.stringify(parseJsonArray(b.regions, parseJson(current.regions, []))),
      JSON.stringify(parseJsonArray(b.tourTypes, parseJson(current.tour_types, []))),
      JSON.stringify(parseJsonArray(b.services, parseJson(current.services, []))),
      clampText(b.qualifications, 2000) || null,
      toNumber(b.priceMin),
      toNumber(b.priceMax),
      clampText(b.city, 80) || null,
      clampText(b.state, 40) || null,
      toNumber(b.lat),
      toNumber(b.lng),
      req.user.id
    );
    db.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(
      clampText(b.professionalName || current.professional_name, 120),
      req.user.id
    );
    const row = db
      .prepare(
        `SELECT g.*, u.avatar_url, u.phone, u.email FROM guide_profiles g JOIN users u ON u.id = g.user_id WHERE g.user_id = ?`
      )
      .get(req.user.id);
    const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(req.user.id);
    res.json(guidePublic(db, row, settings));
  });

  app.put("/api/me/agency", requireAuth, requireRole("agency"), (req, res) => {
    const current = db.prepare("SELECT * FROM agency_profiles WHERE user_id = ?").get(req.user.id);
    if (!current) return res.status(404).json({ error: "Perfil de agência não encontrado." });
    const b = req.body || {};
    db.prepare(
      `UPDATE agency_profiles SET legal_name=?, trade_name=?, description=?, address=?, city=?, state=?, lat=?, lng=?, destinations=?, services=?, travel_types=?, website=?, social=?, professional_registry=?, updated_at=datetime('now') WHERE user_id=?`
    ).run(
      clampText(b.legalName || current.legal_name, 160),
      clampText(b.tradeName || current.trade_name, 160),
      clampText(b.description, 4000) || null,
      clampText(b.address, 200) || null,
      clampText(b.city, 80) || null,
      clampText(b.state, 40) || null,
      toNumber(b.lat),
      toNumber(b.lng),
      JSON.stringify(parseJsonArray(b.destinations, parseJson(current.destinations, []))),
      JSON.stringify(parseJsonArray(b.services, parseJson(current.services, []))),
      JSON.stringify(parseJsonArray(b.travelTypes, parseJson(current.travel_types, []))),
      clampText(b.website, 200) || null,
      JSON.stringify(b.social && typeof b.social === "object" ? b.social : parseJson(current.social, {})),
      clampText(b.professionalRegistry, 80) || null,
      req.user.id
    );
    db.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(
      clampText(b.tradeName || current.trade_name, 160),
      req.user.id
    );
    const row = db
      .prepare(
        `SELECT a.*, u.avatar_url, u.phone, u.email FROM agency_profiles a JOIN users u ON u.id = a.user_id WHERE a.user_id = ?`
      )
      .get(req.user.id);
    const settings = db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(req.user.id);
    res.json(agencyPublic(db, row, settings));
  });

  app.get("/api/filters/options", (_req, res) => {
    const hotels = db.prepare("SELECT amenities, accessibility, category, city FROM hotels").all();
    const guides = db.prepare("SELECT languages, specialties, tour_types, regions FROM guide_profiles").all();
    const agencies = db.prepare("SELECT destinations, services, travel_types, city FROM agency_profiles").all();
    const unique = (lists) => [...new Set(lists.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.json({
      hotelCategories: unique(hotels.map((h) => h.category)),
      hotelCities: unique(hotels.map((h) => h.city)),
      amenities: unique(hotels.map((h) => parseJson(h.amenities, []))),
      accessibility: unique(hotels.map((h) => parseJson(h.accessibility, []))),
      languages: unique(guides.map((g) => parseJson(g.languages, []))),
      specialties: unique(guides.map((g) => parseJson(g.specialties, []))),
      tourTypes: unique(guides.map((g) => parseJson(g.tour_types, []))),
      regions: unique(guides.map((g) => parseJson(g.regions, []))),
      destinations: unique(agencies.map((a) => parseJson(a.destinations, []))),
      agencyServices: unique(agencies.map((a) => parseJson(a.services, []))),
      travelTypes: unique(agencies.map((a) => parseJson(a.travel_types, [])))
    });
  });

  app.get("/api/map/entities", (_req, res) => {
    const hotels = db
      .prepare("SELECT id, name, city, lat, lng FROM hotels WHERE lat IS NOT NULL AND lng IS NOT NULL")
      .all()
      .map((row) => ({ type: "hotel", ...row }));
    const guides = db
      .prepare(
        "SELECT user_id AS id, professional_name AS name, city, lat, lng FROM guide_profiles WHERE lat IS NOT NULL AND lng IS NOT NULL"
      )
      .all()
      .map((row) => ({ type: "guide", ...row }));
    const agencies = db
      .prepare(
        "SELECT user_id AS id, trade_name AS name, city, lat, lng FROM agency_profiles WHERE lat IS NOT NULL AND lng IS NOT NULL"
      )
      .all()
      .map((row) => ({ type: "agency", ...row }));
    res.json({ markers: [...hotels, ...guides, ...agencies] });
  });

  const REVIEW_TARGETS = {
    hotel: (db, id) => db.prepare("SELECT id FROM hotels WHERE id = ?").get(id),
    guide: (db, id) => db.prepare("SELECT user_id AS id FROM guide_profiles WHERE user_id = ?").get(id),
    agency: (db, id) => db.prepare("SELECT user_id AS id FROM agency_profiles WHERE user_id = ?").get(id)
  };

  app.get("/api/reviews", (req, res) => {
    const type = req.query.target_type;
    const id = Number(req.query.target_id);
    if (!REVIEW_TARGETS[type] || !Number.isInteger(id)) {
      return res.status(400).json({ error: "Destino de avaliação inválido." });
    }
    const rows = db
      .prepare(
        `SELECT r.id, r.author_id AS authorId, r.rating, r.comment, r.created_at AS createdAt, u.display_name AS author
         FROM reviews r JOIN users u ON u.id = r.author_id
         WHERE r.target_type = ? AND r.target_id = ?
         ORDER BY r.created_at DESC LIMIT 100`
      )
      .all(type, id);
    res.json({
      reviews: rows,
      mine: req.user ? rows.find((r) => r.authorId === req.user.id) || null : null
    });
  });

  app.post("/api/reviews", requireAuth, (req, res) => {
    const type = req.body?.targetType;
    const id = Number(req.body?.targetId);
    const rating = Number(req.body?.rating);
    if (!REVIEW_TARGETS[type] || !Number.isInteger(id) || !REVIEW_TARGETS[type](db, id)) {
      return res.status(404).json({ error: "Destino da avaliação não encontrado." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "A nota deve ser um número entre 1 e 5." });
    }
    const comment = clampText(req.body?.comment, 1200) || null;
    const existing = db
      .prepare("SELECT id FROM reviews WHERE author_id = ? AND target_type = ? AND target_id = ?")
      .get(req.user.id, type, id);
    if (existing) {
      db.prepare("UPDATE reviews SET rating = ?, comment = ?, created_at = datetime('now') WHERE id = ?").run(
        rating,
        comment,
        existing.id
      );
      return res.json({ id: existing.id, updated: true });
    }
    const info = db
      .prepare("INSERT INTO reviews (author_id, target_type, target_id, rating, comment) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, type, id, rating, comment);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.delete("/api/reviews/:id", requireAuth, (req, res) => {
    const info = db.prepare("DELETE FROM reviews WHERE id = ? AND author_id = ?").run(req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: "Avaliação não encontrada." });
    res.json({ ok: true });
  });
}
