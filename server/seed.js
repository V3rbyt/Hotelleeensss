import bcrypt from "bcryptjs";
import { openDatabase } from "./db.js";

const db = openDatabase();

const exists = db.prepare("SELECT id FROM users WHERE email = ?").get("demo.guia@localens.invalid");
if (exists) {
  console.log("Dados de demonstração já existem.");
  process.exit(0);
}

const hash = bcrypt.hashSync("Demo1234", 12);

const guide = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, phone, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'guide', 'Ana Demo — guia de amostra', NULL, 1, datetime('now'), datetime('now'))`
  )
  .run("demo.guia@localens.invalid", hash);
const guideId = Number(guide.lastInsertRowid);
db.prepare("INSERT INTO account_settings (user_id, public_bio) VALUES (?, 1)").run(guideId);
db.prepare(
  `INSERT INTO guide_profiles (user_id, professional_name, bio, languages, specialties, regions, tour_types, services, qualifications, city, state, is_demo)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
).run(
  guideId,
  "Ana Demo",
  "Perfil de AMOSTRA para testar a interface. Não representa uma guia real nem credenciais verificadas.",
  JSON.stringify(["Português", "Inglês"]),
  JSON.stringify(["Gastronomia", "História"]),
  JSON.stringify(["Centro (amostra)"]),
  JSON.stringify(["Caminhada"]),
  JSON.stringify(["Passeio urbano de demonstração"]),
  "Nenhuma qualificação real cadastrada.",
  null,
  null
);

const agency = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'agency', 'Agência Demo LocaLens', 1, datetime('now'), datetime('now'))`
  )
  .run("demo.agencia@localens.invalid", hash);
const agencyId = Number(agency.lastInsertRowid);
db.prepare("INSERT INTO account_settings (user_id) VALUES (?)").run(agencyId);
db.prepare(
  `INSERT INTO agency_profiles (user_id, legal_name, trade_name, description, destinations, services, travel_types, is_demo)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
).run(
  agencyId,
  "Agência Demo Ltda (amostra)",
  "Agência Demo LocaLens",
  "Cadastro fictício apenas para testar listagens. Não é uma agência real.",
  JSON.stringify(["Destino de amostra"]),
  JSON.stringify(["Roteiros personalizados (amostra)"]),
  JSON.stringify(["Lazer"])
);

const hotelUser = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'hotel', 'Hotel Demo LocaLens', 1, datetime('now'), datetime('now'))`
  )
  .run("demo.hotel@localens.invalid", hash);
const hotelUserId = Number(hotelUser.lastInsertRowid);
db.prepare("INSERT INTO account_settings (user_id) VALUES (?)").run(hotelUserId);
const hotel = db
  .prepare(
    `INSERT INTO hotels (owner_user_id, name, description, city, category, amenities, accessibility, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  )
  .run(
    hotelUserId,
    "Hotel Demo LocaLens",
    "Estabelecimento de AMOSTRA para testar a página de detalhes. Não possui endereço, preço, avaliação nem disponibilidade reais.",
    null,
    "Amostra",
    JSON.stringify(["Wi-Fi (amostra)"]),
    JSON.stringify(["Informação de acessibilidade não verificada"])
  );
const hotelId = Number(hotel.lastInsertRowid);
db.prepare(
  `INSERT INTO hotel_events (hotel_id, title, description, location) VALUES (?, ?, ?, ?)`
).run(
  hotelId,
  "Evento de amostra no hotel",
  "Evento fictício vinculado ao hotel de demonstração. Não ocorre de verdade.",
  "Salão de amostra"
);

console.log("Demonstração criada. Contas (senha Demo1234):");
console.log("  demo.guia@localens.invalid");
console.log("  demo.agencia@localens.invalid");
console.log("  demo.hotel@localens.invalid");
console.log("Estes registros NÃO representam negócios reais.");
