import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    cb(null, `${req.user.id}-${Date.now()}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error("Envie uma imagem JPG, PNG ou WEBP."));
    cb(null, true);
  }
});

function handleMulter(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Falha no envio do arquivo." });
    next();
  });
}

export function registerUploadRoutes(app, db) {
  app.post("/api/uploads/avatar", requireAuth, handleMulter, (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const url = `/uploads/${req.file.filename}`;
    db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?").run(url, req.user.id);
    res.json({ url });
  });

  app.post("/api/uploads/hotel", requireAuth, requireRole("hotel"), handleMulter, (req, res) => {
    const hotel = db.prepare("SELECT * FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    if (!hotel) return res.status(404).json({ error: "Hotel não encontrado." });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const url = `/uploads/${req.file.filename}`;
    db.prepare("INSERT INTO hotel_images (hotel_id, url, alt) VALUES (?, ?, ?)").run(
      hotel.id,
      url,
      req.body?.alt || hotel.name
    );
    res.json({ url });
  });

  app.post("/api/uploads/guide", requireAuth, requireRole("guide"), handleMulter, (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const url = `/uploads/${req.file.filename}`;
    db.prepare("INSERT INTO guide_images (user_id, url, alt) VALUES (?, ?, ?)").run(req.user.id, url, req.body?.alt || "");
    res.json({ url });
  });

  app.post("/api/uploads/agency", requireAuth, requireRole("agency"), handleMulter, (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const url = `/uploads/${req.file.filename}`;
    db.prepare("INSERT INTO agency_images (user_id, url, alt) VALUES (?, ?, ?)").run(req.user.id, url, req.body?.alt || "");
    res.json({ url });
  });
}
