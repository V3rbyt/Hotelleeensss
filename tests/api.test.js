import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(__dirname, "../server/schema.sql"), "utf8");

let db;
let server;
let base;

before(async () => {
  db = new DatabaseSync(":memory:");
  db.exec(schema);
  const app = createApp(db);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

test("health", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.ok, true);
});

test("cadastro viajante, duplicidade e login", async () => {
  const body = {
    role: "traveler",
    email: "viajante@example.com",
    password: "Senha123",
    displayName: "Maria Viajante",
    acceptTerms: true,
    acceptPrivacy: true
  };
  const created = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(created.status, 201);
  const dup = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(dup.status, 409);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password })
  });
  assert.equal(login.ok, true);
  const cookie = login.headers.getSetCookie?.()[0] || login.headers.get("set-cookie");
  const session = await fetch(`${base}/api/session`, { headers: { Cookie: cookie } });
  const data = await session.json();
  assert.equal(data.user.email, body.email);

  const steal = await fetch(`${base}/api/me/guide`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRF-Token": data.csrfToken },
    body: JSON.stringify({ professionalName: "Hack" })
  });
  assert.equal(steal.status, 403);
});

test("busca vazia não inventa hotéis", async () => {
  const res = await fetch(`${base}/api/search?q=belo+horizonte&types=hotel`);
  const data = await res.json();
  assert.equal(data.total, 0);
  assert.deepEqual(data.results, []);
});

test("CNPJ inválido recusado", async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "agency",
      email: "ag@example.com",
      password: "Senha123",
      legalName: "X",
      tradeName: "Y",
      cnpj: "00.000.000/0000-00",
      acceptTerms: true,
      acceptPrivacy: true
    })
  });
  assert.equal(res.status, 400);
});
