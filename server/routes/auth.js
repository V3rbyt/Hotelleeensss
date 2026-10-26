import bcrypt from "bcryptjs";
import {
  ACCOUNT_ROLES,
  clampText,
  isEmail,
  isValidCnpj,
  isValidCpf,
  parseJsonArray,
  passwordStrength
} from "../utils/validators.js";
import { hashDocument, last4, randomToken, sha256 } from "../utils/security.js";
import { getClientIp } from "../utils/security.js";
import { cookieHeader, datetimeNow } from "../middleware.js";
import { nowPlusHours, parseJson } from "../db.js";
import { sendResetEmail, sendVerifyEmail, smtpConfigured } from "../utils/mailer.js";

function respondTokenFallback(res, payload, token, sendFn, to) {
  if (!smtpConfigured()) {
    return res.json({ ...payload, configured: false, devToken: token });
  }
  sendFn(to, token).catch((err) => {
    console.error("Falha ao enviar e-mail:", err.message);
  });
  return res.json({ ...payload, configured: true, sent: true });
}

const SESSION_MS = 7 * 24 * 3600;

function publicUser(user, settings) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified),
    deletionRequested: Boolean(user.deletion_requested_at),
    settings: settings || null
  };
}

function createSession(db, req, res, userId) {
  const id = randomToken(24);
  const csrf = randomToken(24);
  db.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, csrf, getClientIp(req), clampText(req.headers["user-agent"], 300), nowPlusHours(24 * 7));
  res.setHeader("Set-Cookie", cookieHeader("ll_session", id, { maxAge: SESSION_MS }));
  return csrf;
}

function getSettings(db, userId) {
  return (
    db.prepare("SELECT * FROM account_settings WHERE user_id = ?").get(userId) || {
      public_phone: 0,
      public_email: 0,
      public_bio: 1,
      notify_email: 1,
      notify_product: 0,
      locale: "pt-BR"
    }
  );
}

export function registerAuthRoutes(app, db) {
  app.get("/api/session", (req, res) => {
    if (!req.user) return res.json({ user: null, csrfToken: null });
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({
      user: publicUser(user, getSettings(db, user.id)),
      csrfToken: req.session.csrf_token
    });
  });

  app.post("/api/auth/register", (req, res) => {
    const body = req.body || {};
    const role = body.role;
    if (!ACCOUNT_ROLES.includes(role)) {
      return res.status(400).json({ error: "Selecione um tipo de conta válido." });
    }
    const email = clampText(body.email, 180).toLowerCase();
    const password = body.password;
    if (!isEmail(email)) return res.status(400).json({ error: "Informe um e-mail válido." });
    const pwdError = passwordStrength(password);
    if (pwdError) return res.status(400).json({ error: pwdError });
    if (!body.acceptTerms || !body.acceptPrivacy) {
      return res.status(400).json({ error: "É necessário aceitar os termos e a política de privacidade." });
    }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    }

    let displayName = clampText(body.displayName || body.professionalName || body.tradeName || body.hotelName, 120);
    if (!displayName) return res.status(400).json({ error: "Informe o nome da conta." });
    if (role === "agency" && (!body.legalName || !body.tradeName)) {
      return res.status(400).json({ error: "Informe razão social e nome fantasia." });
    }
    if (role === "hotel" && !clampText(body.hotelName || displayName, 160)) {
      return res.status(400).json({ error: "Informe o nome do estabelecimento." });
    }

    let cpfHash = null;
    let cnpjHash = null;
    let docLast4 = null;
    if (role === "guide" && !body.cpf) {
      return res.status(400).json({ error: "Guia turístico deve informar CPF." });
    }
    if (role === "traveler" || role === "guide") {
      if (body.cpf) {
        if (!isValidCpf(body.cpf)) {
          return res.status(400).json({
            error: "CPF inválido. A validação confere apenas o formato e os dígitos verificadores, não a identidade do titular."
          });
        }
        cpfHash = hashDocument(body.cpf);
        docLast4 = last4(body.cpf);
        if (db.prepare("SELECT user_id FROM user_pii WHERE cpf_hash = ?").get(cpfHash)) {
          return res.status(409).json({ error: "Já existe uma conta com este CPF." });
        }
      }
    }
    if (role === "agency" || role === "hotel") {
      if (!isValidCnpj(body.cnpj)) {
        return res.status(400).json({
          error: "CNPJ inválido. A validação confere apenas o formato e os dígitos verificadores, não a regularidade da empresa."
        });
      }
      cnpjHash = hashDocument(body.cnpj);
      docLast4 = last4(body.cnpj);
      if (db.prepare("SELECT user_id FROM user_pii WHERE cnpj_hash = ?").get(cnpjHash)) {
        return res.status(409).json({ error: "Já existe uma conta com este CNPJ." });
      }
    }

    const hash = bcrypt.hashSync(password, 12);
    const info = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, display_name, phone, terms_accepted_at, privacy_accepted_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(email, hash, role, displayName, clampText(body.phone, 30) || null);
    const userId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO user_pii (user_id, cpf_hash, cnpj_hash, document_last4) VALUES (?, ?, ?, ?)").run(
      userId,
      cpfHash,
      cnpjHash,
      docLast4
    );
    db.prepare("INSERT INTO account_settings (user_id) VALUES (?)").run(userId);
    db.prepare("INSERT INTO consents (user_id, key, granted) VALUES (?, 'terms', 1), (?, 'privacy', 1)").run(
      userId,
      userId
    );

    if (role === "guide") {
      db.prepare(
        `INSERT INTO guide_profiles (user_id, professional_name, bio, languages, specialties, regions, tour_types, services, qualifications, city, state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        clampText(body.professionalName || displayName, 120),
        clampText(body.bio, 4000) || null,
        JSON.stringify(parseJsonArray(body.languages)),
        JSON.stringify(parseJsonArray(body.specialties)),
        JSON.stringify(parseJsonArray(body.regions)),
        JSON.stringify(parseJsonArray(body.tourTypes)),
        JSON.stringify(parseJsonArray(body.services)),
        clampText(body.qualifications, 2000) || null,
        clampText(body.city, 80) || null,
        clampText(body.state, 40) || null
      );
    }
    if (role === "agency") {
      if (!body.legalName || !body.tradeName) {
        return res.status(400).json({ error: "Informe razão social e nome fantasia." });
      }
      db.prepare(
        `INSERT INTO agency_profiles (user_id, legal_name, trade_name, description, address, city, state, destinations, services, travel_types, website, professional_registry)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        clampText(body.legalName, 160),
        clampText(body.tradeName, 160),
        clampText(body.description, 4000) || null,
        clampText(body.address, 200) || null,
        clampText(body.city, 80) || null,
        clampText(body.state, 40) || null,
        JSON.stringify(parseJsonArray(body.destinations)),
        JSON.stringify(parseJsonArray(body.services)),
        JSON.stringify(parseJsonArray(body.travelTypes)),
        clampText(body.website, 200) || null,
        clampText(body.professionalRegistry, 80) || null
      );
    }
    if (role === "hotel") {
      db.prepare(
        `INSERT INTO hotels (owner_user_id, name, description, address, neighborhood, city, state, category, amenities, accessibility, website, phone, public_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        clampText(body.hotelName || displayName, 160),
        clampText(body.description, 4000) || null,
        clampText(body.address, 200) || null,
        clampText(body.neighborhood, 80) || null,
        clampText(body.city, 80) || null,
        clampText(body.state, 40) || null,
        clampText(body.category, 80) || null,
        JSON.stringify(parseJsonArray(body.amenities)),
        JSON.stringify(parseJsonArray(body.accessibility)),
        clampText(body.website, 200) || null,
        clampText(body.phone, 30) || null,
        clampText(body.publicEmail, 180) || null
      );
    }

    const verifyToken = randomToken();
    db.prepare(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, 'verify_email', ?, ?)`
    ).run(userId, sha256(verifyToken), nowPlusHours(48));

    const csrf = createSession(db, req, res, userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const mailSent = smtpConfigured();
    if (mailSent) sendVerifyEmail(email, verifyToken).catch((err) => console.error("Falha ao enviar verificação:", err.message));
    res.status(201).json({
      user: publicUser(user, getSettings(db, userId)),
      csrfToken: csrf,
      emailVerification: {
        required: true,
        configured: mailSent,
        message: mailSent
          ? "Enviamos um link de verificação para o seu e-mail."
          : "A verificação de e-mail está pronta, mas o SMTP ainda não foi configurado.",
        devToken: mailSent ? undefined : verifyToken
      }
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const email = clampText(req.body?.email, 180).toLowerCase();
    const password = req.body?.password || "";
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
    const csrf = createSession(db, req, res, user.id);
    res.json({ user: publicUser(user, getSettings(db, user.id)), csrfToken: csrf });
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.session) db.prepare("DELETE FROM sessions WHERE id = ?").run(req.session.id);
    res.setHeader("Set-Cookie", cookieHeader("ll_session", "", { maxAge: 0 }));
    res.json({ ok: true });
  });

  app.post("/api/auth/forgot", (req, res) => {
    const email = clampText(req.body?.email, 180).toLowerCase();
    const generic = {
      ok: true,
      message: "Se o e-mail estiver cadastrado, geramos um link de recuperação."
    };
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.json(generic);
    const token = randomToken();
    db.prepare(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, 'reset_password', ?, ?)`
    ).run(user.id, sha256(token), nowPlusHours(2));
    respondTokenFallback(
      res,
      generic,
      token,
      sendResetEmail,
      email
    );
  });

  app.post("/api/auth/reset", (req, res) => {
    const token = req.body?.token;
    const pwdError = passwordStrength(req.body?.password);
    if (!token) return res.status(400).json({ error: "Informe o código de recuperação." });
    if (pwdError) return res.status(400).json({ error: pwdError });
    const row = db
      .prepare(
        `SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'reset_password' AND used_at IS NULL`
      )
      .get(sha256(token));
    if (!row || row.expires_at < datetimeNow()) {
      return res.status(400).json({ error: "Este link de recuperação é inválido ou expirou." });
    }
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      bcrypt.hashSync(req.body.password, 12),
      row.user_id
    );
    db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
    res.json({ ok: true, message: "Senha atualizada. Faça login novamente." });
  });

  app.post("/api/auth/verify-email", (req, res) => {
    const token = req.body?.token;
    const row = db
      .prepare(`SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'verify_email' AND used_at IS NULL`)
      .get(sha256(token || ""));
    if (!row || row.expires_at < datetimeNow()) {
      return res.status(400).json({ error: "Token de verificação inválido ou expirado." });
    }
    db.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").run(row.user_id);
    db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });

  app.get("/api/auth/sessions", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
    const rows = db
      .prepare(
        `SELECT id, ip, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC`
      )
      .all(req.user.id);
    res.json({
      sessions: rows.map((row) => ({
        id: row.id,
        current: req.session?.id === row.id,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      }))
    });
  });

  app.delete("/api/auth/sessions/:id", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
    db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ ok: true });
  });
}

export { getSettings, publicUser, parseJson };
