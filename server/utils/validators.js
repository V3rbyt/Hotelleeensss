const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

export function isEmail(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

export function passwordStrength(password) {
  const value = String(password || "");
  if (value.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "A senha deve combinar letras e números.";
  }
  return null;
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base) => {
    let sum = 0;
    for (let i = 0; i < base; i += 1) sum += Number(cpf[i]) * (base + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (length) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cnpj[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : fallback;
      } catch {
        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

export function clampText(value, max) {
  return String(value || "").trim().slice(0, max);
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseListParam(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseListParam);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const ACCOUNT_ROLES = ["traveler", "guide", "agency", "hotel"];
