import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const schemaPath = path.join(__dirname, "schema.sql");

export function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "localens.db"));
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  return db;
}

export function nowPlusHours(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
}

export function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
