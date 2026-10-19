import bcrypt from "bcryptjs";
import { clampText, isEmail, passwordStrength } from "../utils/validators.js";
import { randomToken, sha256 } from "../utils/security.js";
import { requireAuth, datetimeNow } from "../middleware.js";
import { nowPlusHours } from "../db.js";
import { getSettings, publicUser } from "./auth.js";

export function registerSettingsRoutes(app, db) {
  app.get("/api/me", requireAuth, (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    const guide = db.prepare("SELECT * FROM guide_profiles WHERE user_id = ?").get(req.user.id);
    const agency = db.prepare("SELECT * FROM agency_profiles WHERE user_id = ?").get(req.user.id);
    const hotel = db.prepare("SELECT * FROM hotels WHERE owner_user_id = ?").get(req.user.id);
    const pii = db.prepare("SELECT document_last4 FROM user_pii WHERE user_id = ?").get(req.user.id);
    res.json({
      user: publicUser(user, getSettings(db, user.id)),
      documentLast4: pii?.document_last4 || null,
      guide,
      agency,
      hotel
    });
  });

  app.put("/api/me/profile", requireAuth, (req, res) => {
    const b = req.body || {};
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    db.prepare(
      `UPDATE users SET display_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(clampText(b.displayName || user.display_name, 120), clampText(b.phone, 30) || null, req.user.id);
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({ user: publicUser(updated, getSettings(db, updated.id)) });
  });

  app.put("/api/me/settings", requireAuth, (req, res) => {
    const b = req.body || {};
    const current = getSettings(db, req.user.id);
    db.prepare(
      `INSERT INTO account_settings (user_id, public_phone, public_email, public_bio, notify_email, notify_product, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         public_phone=excluded.public_phone,
         public_email=excluded.public_email,
         public_bio=excluded.public_bio,
         notify_email=excluded.notify_email,
         notify_product=excluded.notify_product,
         locale=excluded.locale`
    ).run(
      req.user.id,
      b.publicPhone ? 1 : 0,
      b.publicEmail ? 1 : 0,
      b.publicBio === false ? 0 : 1,
      b.notifyEmail === false ? 0 : 1,
      b.notifyProduct ? 1 : 0,
      clampText(b.locale || current.locale || "pt-BR", 12)
    );
    if (typeof b.marketingConsent === "boolean") {
      db.prepare("INSERT INTO consents (user_id, key, granted) VALUES (?, 'marketing', ?)").run(
        req.user.id,
        b.marketingConsent ? 1 : 0
      );
    }
    res.json({ settings: getSettings(db, req.user.id) });
  });

  app.post("/api/me/email", requireAuth, (req, res) => {
    const email = clampText(req.body?.email, 180).toLowerCase();
    const password = req.body?.password || "";
    if (!isEmail(email)) return res.status(400).json({ error: "Informe um e-mail válido." });
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }
    if (db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, req.user.id)) {
      return res.status(409).json({ error: "Este e-mail já está em uso." });
    }
    const token = randomToken();
    db.prepare(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, extra, expires_at) VALUES (?, 'change_email', ?, ?, ?)`
    ).run(req.user.id, sha256(token), email, nowPlusHours(24));
    res.json({
      ok: true,
      message: "Confirme o novo e-mail para concluir a alteração.",
      configured: Boolean(process.env.SMTP_HOST),
      devToken: process.env.SMTP_HOST ? undefined : token
    });
  });

  app.post("/api/me/email/confirm", requireAuth, (req, res) => {
    const row = db
      .prepare(
        `SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'change_email' AND used_at IS NULL AND user_id = ?`
      )
      .get(sha256(req.body?.token || ""), req.user.id);
    if (!row || row.expires_at < datetimeNow()) {
      return res.status(400).json({ error: "Confirmação inválida ou expirada." });
    }
    db.prepare("UPDATE users SET email = ?, email_verified = 0, updated_at = datetime('now') WHERE id = ?").run(
      row.extra,
      req.user.id
    );
    db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });

  app.post("/api/me/password", requireAuth, (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!bcrypt.compareSync(req.body?.currentPassword || "", user.password_hash)) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }
    const pwdError = passwordStrength(req.body?.newPassword);
    if (pwdError) return res.status(400).json({ error: pwdError });
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      bcrypt.hashSync(req.body.newPassword, 12),
      req.user.id
    );
    res.json({ ok: true, message: "Senha atualizada." });
  });

  app.post("/api/me/lgpd", requireAuth, (req, res) => {
    const type = req.body?.requestType;
    if (!["access", "correction", "deletion"].includes(type)) {
      return res.status(400).json({ error: "Tipo de solicitação LGPD inválido." });
    }
    db.prepare("INSERT INTO lgpd_requests (user_id, request_type, details) VALUES (?, ?, ?)").run(
      req.user.id,
      type,
      clampText(req.body?.details, 2000) || null
    );
    if (type === "deletion") {
      db.prepare("UPDATE users SET deletion_requested_at = datetime('now') WHERE id = ?").run(req.user.id);
    }
    if (type === "access") {
      const user = db.prepare("SELECT id, email, role, display_name, phone, created_at FROM users WHERE id = ?").get(
        req.user.id
      );
      const settings = getSettings(db, req.user.id);
      const consents = db.prepare("SELECT key, granted, created_at FROM consents WHERE user_id = ?").all(req.user.id);
      return res.json({
        ok: true,
        message: "Cópia dos dados pessoais disponíveis na conta.",
        data: { user, settings, consents }
      });
    }
    res.json({
      ok: true,
      message: "Solicitação registrada. A exclusão ou correção será processada pela equipe responsável."
    });
  });
}
