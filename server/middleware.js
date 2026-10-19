import { getClientIp, RateLimiter, safeEqual } from "./utils/security.js";

const sessionLimiter = new RateLimiter({ windowMs: 60_000, max: 120 });
const authLimiter = new RateLimiter({ windowMs: 15 * 60_000, max: 20 });
const aiLimiter = new RateLimiter({ windowMs: 60_000, max: 8 });
const geoLimiter = new RateLimiter({ windowMs: 60_000, max: 30 });

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' https://unpkg.com; connect-src 'self'; frame-ancestors 'none'"
  );
  next();
}

export function attachSession(db) {
  return (req, _res, next) => {
    const cookie = parseCookies(req.headers.cookie);
    const sid = cookie.ll_session;
    req.session = null;
    req.user = null;
    if (sid) {
      const row = db
        .prepare(
          `SELECT s.id, s.csrf_token, s.expires_at, u.id AS user_id, u.email, u.role, u.display_name, u.phone, u.avatar_url, u.email_verified, u.deletion_requested_at
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.id = ?`
        )
        .get(sid);
      if (row && row.expires_at > datetimeNow()) {
        req.session = row;
        req.user = {
          id: row.user_id,
          email: row.email,
          role: row.role,
          displayName: row.display_name,
          phone: row.phone,
          avatarUrl: row.avatar_url,
          emailVerified: Boolean(row.email_verified),
          deletionRequested: Boolean(row.deletion_requested_at)
        };
      }
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
    if (!roles.includes(req.user.role) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Esta conta não tem permissão para esta ação." });
    }
    next();
  };
}

export function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const token = req.headers["x-csrf-token"];
  if (!req.session || !token || !safeEqual(req.session.csrf_token, token)) {
    return res.status(403).json({ error: "Sessão inválida. Recarregue a página e tente de novo." });
  }
  next();
}

export function limitAuth(req, res, next) {
  if (!authLimiter.check(getClientIp(req))) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
  }
  next();
}

export function limitAi(req, res, next) {
  if (!aiLimiter.check(getClientIp(req))) {
    return res.status(429).json({ error: "O assistente está ocupado. Tente novamente em instantes." });
  }
  next();
}

export function limitGeo(req, res, next) {
  if (!geoLimiter.check(getClientIp(req))) {
    return res.status(429).json({ error: "Muitas buscas no mapa. Aguarde um momento." });
  }
  next();
}

export function limitGeneral(req, res, next) {
  if (!sessionLimiter.check(getClientIp(req))) {
    return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
  }
  next();
}

export function parseCookies(header = "") {
  const out = {};
  String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx > 0) out[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
    });
  return out;
}

export function datetimeNow() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function cookieHeader(name, value, { maxAge, path = "/", httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "SameSite=Lax"];
  if (httpOnly) parts.push("HttpOnly");
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}
