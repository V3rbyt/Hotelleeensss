import bcrypt from "bcryptjs";
import { openDatabase } from "./db.js";
import { hashDocument, last4 } from "./utils/security.js";

const db = openDatabase();

const exists = db.prepare("SELECT id FROM users WHERE email = ?").get("demo.guia@hotellens.invalid");
if (exists) {
  console.log("Dados de demonstração já existem.");
  process.exit(0);
}

const hash = bcrypt.hashSync("Demo1234", 12);

// Demo guide CPF (valid format: 123.456.789-09 -> 12345678909, valid check digits)
const demoCpf = "12345678909";
const cpfHash = hashDocument(demoCpf);
const cpfLast4 = last4(demoCpf);

const guide = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, phone, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'guide', 'Ana Demo — guia de amostra', NULL, 1, datetime('now'), datetime('now'))`
  )
  .run("demo.guia@hotellens.invalid", hash);
const guideId = Number(guide.lastInsertRowid);
db.prepare("INSERT INTO user_pii (user_id, cpf_hash, document_last4) VALUES (?, ?, ?)").run(guideId, cpfHash, cpfLast4);
db.prepare("INSERT INTO account_settings (user_id, public_bio) VALUES (?, 1)").run(guideId);
db.prepare(
  `INSERT INTO guide_profiles (user_id, professional_name, bio, languages, specialties, regions, tour_types, services, qualifications, city, state, lat, lng, is_demo)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
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
  "Belo Horizonte",
  "MG",
  -19.9167,
  -43.9345
);

const agency = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'agency', 'Agência Demo Hotel Lens', 1, datetime('now'), datetime('now'))`
  )
  .run("demo.agencia@hotellens.invalid", hash);
const agencyId = Number(agency.lastInsertRowid);
db.prepare("INSERT INTO account_settings (user_id) VALUES (?)").run(agencyId);
db.prepare(
  `INSERT INTO agency_profiles (user_id, legal_name, trade_name, description, city, state, lat, lng, destinations, services, travel_types, is_demo)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
).run(
  agencyId,
  "Agência Demo Ltda (amostra)",
  "Agência Demo Hotel Lens",
  "Cadastro fictício apenas para testar listagens. Não é uma agência real.",
  "Belo Horizonte",
  "MG",
  -19.9167,
  -43.9345,
  JSON.stringify(["Destino de amostra"]),
  JSON.stringify(["Roteiros personalizados (amostra)"]),
  JSON.stringify(["Lazer"])
);

const hotelUser = db
  .prepare(
    `INSERT INTO users (email, password_hash, role, display_name, email_verified, terms_accepted_at, privacy_accepted_at)
     VALUES (?, ?, 'hotel', 'Hotel Demo Hotel Lens', 1, datetime('now'), datetime('now'))`
  )
  .run("demo.hotel@hotellens.invalid", hash);
const hotelUserId = Number(hotelUser.lastInsertRowid);
db.prepare("INSERT INTO account_settings (user_id) VALUES (?)").run(hotelUserId);
const hotel = db
  .prepare(
    `INSERT INTO hotels (owner_user_id, name, description, address, neighborhood, city, state, lat, lng, category, amenities, accessibility, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  )
  .run(
    hotelUserId,
    "Hotel Demo Hotel Lens",
    "Estabelecimento de AMOSTRA para testar a página de detalhes. Não possui preço, avaliação nem disponibilidade reais.",
    "Rua de Amostra, 123",
    "Centro",
    "Belo Horizonte",
    "MG",
    -19.9167,
    -43.9345,
    "Amostra",
    JSON.stringify(["Wi-Fi (amostra)"]),
    JSON.stringify(["Informação de acessibilidade não verificada"])
  );
const hotelId = Number(hotel.lastInsertRowid);
db.prepare(
  `INSERT INTO hotel_images (hotel_id, url, alt) VALUES (?, ?, ?)`
).run(hotelId, "/assets/logo-mark.svg", "Imagem de amostra");
db.prepare(
  `INSERT INTO hotel_events (hotel_id, title, description, location) VALUES (?, ?, ?, ?)`
).run(
  hotelId,
  "Evento de amostra no hotel",
  "Evento fictício vinculado ao hotel de demonstração. Não ocorre de verdade.",
  "Salão de amostra"
);

console.log("Demonstração criada. Contas (senha Demo1234):");
console.log("  demo.guia@hotellens.invalid");
console.log("  demo.agencia@hotellens.invalid");
console.log("  demo.hotel@hotellens.invalid");
console.log("Estes registros NÃO representam negócios reais.");
