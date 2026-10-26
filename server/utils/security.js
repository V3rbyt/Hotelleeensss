import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return sha256(`localens-doc:${digits}`);
}

export function last4(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-4) || null;
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map();
    // Periodic cleanup every 5 minutes
    this._cleanupInterval = setInterval(() => this.prune(), 5 * 60 * 1000);
    this._cleanupInterval.unref();
  }

  check(key) {
    const now = Date.now();
    const entry = this.hits.get(key) || { count: 0, start: now };
    if (now - entry.start > this.windowMs) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count += 1;
    }
    this.hits.set(key, entry);
    return entry.count <= this.max;
  }

  prune() {
    const now = Date.now();
    for (const [key, entry] of this.hits.entries()) {
      if (now - entry.start > this.windowMs) {
        this.hits.delete(key);
      }
    }
  }
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
