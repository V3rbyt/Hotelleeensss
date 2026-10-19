PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('traveler', 'guide', 'agency', 'hotel', 'admin')),
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at TEXT,
  privacy_accepted_at TEXT,
  deletion_requested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_pii (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cpf_hash TEXT UNIQUE,
  cnpj_hash TEXT UNIQUE,
  document_last4 TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'change_email')),
  token_hash TEXT NOT NULL,
  extra TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  granted INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_phone INTEGER NOT NULL DEFAULT 0,
  public_email INTEGER NOT NULL DEFAULT 0,
  public_bio INTEGER NOT NULL DEFAULT 1,
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_product INTEGER NOT NULL DEFAULT 0,
  locale TEXT NOT NULL DEFAULT 'pt-BR'
);

CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  lat REAL,
  lng REAL,
  category TEXT,
  price_min REAL,
  price_max REAL,
  amenities TEXT NOT NULL DEFAULT '[]',
  accessibility TEXT NOT NULL DEFAULT '[]',
  website TEXT,
  phone TEXT,
  public_email TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotel_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hotel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT,
  ends_at TEXT,
  location TEXT
);

CREATE TABLE IF NOT EXISTS guide_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  professional_name TEXT NOT NULL,
  bio TEXT,
  languages TEXT NOT NULL DEFAULT '[]',
  specialties TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  tour_types TEXT NOT NULL DEFAULT '[]',
  services TEXT NOT NULL DEFAULT '[]',
  qualifications TEXT,
  price_min REAL,
  price_max REAL,
  city TEXT,
  state TEXT,
  lat REAL,
  lng REAL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guide_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agency_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  lat REAL,
  lng REAL,
  destinations TEXT NOT NULL DEFAULT '[]',
  services TEXT NOT NULL DEFAULT '[]',
  travel_types TEXT NOT NULL DEFAULT '[]',
  website TEXT,
  social TEXT NOT NULL DEFAULT '{}',
  professional_registry TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agency_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('hotel', 'guide', 'agency')),
  target_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
