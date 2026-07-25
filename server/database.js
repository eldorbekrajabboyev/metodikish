const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

let db = null;

function nowSql() {
  return `datetime('now', '+5 hours')`;
}

async function initDatabase() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  if (dbUrl) {
    db = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
    // Verify connection
    try {
      await db.execute('SELECT 1');
      console.log('📦 Database initialized (Turso)');
    } catch (err) {
      console.error('❌ Turso connection failed:', err.message);
      process.exit(1);
    }
  } else {
    if (process.env.NODE_ENV === 'production' || process.env.FLY_APP_NAME) {
      console.error('❌ FATAL: TURSO_DATABASE_URL not set in production! SQLite fallback disabled for data safety.');
      console.error('   Run: fly secrets set TURSO_DATABASE_URL=<your-turso-url> TURSO_AUTH_TOKEN=<your-token>');
      process.exit(1);
    }
    console.warn('⚠️  WARNING: Using local SQLite — NOT suitable for production!');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    db = createClient({ url: `file:${path.join(uploadsDir, 'local.db')}` });
  }

  // === D2 FIX: All CREATE TABLE first, then ALTER TABLE ===

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      referred_by INTEGER,
      referral_balance INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', '+5 hours'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', '+5 hours'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      order_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      address TEXT NOT NULL,
      school TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      topic TEXT,
      status TEXT DEFAULT 'pending_payment',
      total_price INTEGER NOT NULL,
      payment_receipt TEXT,
      document_file TEXT,
      admin_note TEXT,
      receipt_uploaded_at TEXT,
      ready_at TEXT,
      school_type TEXT,
      language_surcharge INTEGER DEFAULT 0,
      geographic_level TEXT DEFAULT 'maktab',
      geographic_surcharge INTEGER DEFAULT 0,
      promo_code_id INTEGER,
      promo_discount INTEGER DEFAULT 0,
      referral_discount INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', '+5 hours')),
      updated_at TEXT DEFAULT (datetime('now', '+5 hours')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS order_images (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', '+5 hours')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payment_cards (
      id INTEGER PRIMARY KEY,
      card_number TEXT NOT NULL,
      card_holder TEXT NOT NULL,
      bank_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', '+5 hours'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', '+5 hours'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
      text TEXT NOT NULL,
      author_name TEXT,
      region TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', '+5 hours')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL,
      source_name TEXT,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', '+5 hours'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS promo_code_usage (
      id INTEGER PRIMARY KEY,
      promo_code_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      status TEXT DEFAULT 'reserved',
      used_at TEXT DEFAULT (datetime('now', '+5 hours')),
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // === D2 FIX: ALTER TABLE migrations (all tables already exist above) ===
  try { await db.execute("ALTER TABLE orders ADD COLUMN receipt_uploaded_at TEXT"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN ready_at TEXT"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN school_type TEXT"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN language_surcharge INTEGER DEFAULT 0"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN geographic_level TEXT DEFAULT 'maktab'"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN geographic_surcharge INTEGER DEFAULT 0"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN promo_code_id INTEGER"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN promo_discount INTEGER DEFAULT 0"); } catch (e) {}
  try { await db.execute("ALTER TABLE promo_code_usage ADD COLUMN status TEXT DEFAULT 'reserved'"); } catch (e) {}
  try { await db.execute("ALTER TABLE users ADD COLUMN referred_by INTEGER"); } catch (e) {}
  try { await db.execute("ALTER TABLE users ADD COLUMN referral_balance INTEGER DEFAULT 0"); } catch (e) {}
  try { await db.execute("ALTER TABLE orders ADD COLUMN referral_discount INTEGER DEFAULT 0"); } catch (e) {}

  // === D4 FIX: Migrate channels from pipe-delimited to JSON ===
  try {
    const row = (await db.execute("SELECT value FROM settings WHERE key = 'channels'")).rows[0];
    if (row && row.value && row.value.startsWith('|')) {
      const parts = row.value.split('|').filter(c => c.trim());
      const channels = [];
      for (let i = 0; i < parts.length; i += 3) {
        channels.push({ name: parts[i], link: parts[i + 1] || '', updated_at: parts[i + 2] || '' });
      }
      await db.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ['channels', JSON.stringify(channels), new Date().toISOString()]);
    }
  } catch (e) {}

  // Seed default data
  const serviceCount = (await db.execute('SELECT COUNT(*) as count FROM services')).rows[0].count;
  if (serviceCount === 0) {
    await db.execute("INSERT INTO services (name, description, price) VALUES (?, ?, ?)",
      ["Metodik Qo'llanma", "Batafsil metodik qo'llanma hujjati", 250000]);
    await db.execute("INSERT INTO services (name, description, price) VALUES (?, ?, ?)",
      ["Metodik Tavsiya", "Metodik tavsiya hujjati", 200000]);
  }

  const cardCount = (await db.execute('SELECT COUNT(*) as count FROM payment_cards')).rows[0].count;
  if (cardCount === 0) {
    await db.execute("INSERT INTO payment_cards (card_number, card_holder, bank_name, is_active) VALUES (?, ?, ?, ?)",
      ['**** **** **** 0000', 'Admin', 'Bank', 0]);
  }

  const settingsCount = (await db.execute('SELECT COUNT(*) as count FROM settings')).rows[0].count;
  if (settingsCount === 0) {
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      ["admin_chat_id", ""]);
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      ["payment_instructions", "Kartaga pul o'tkazing va chekni yuklang."]);
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      ["min_prep_time_hours", "6"]);
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      ["channels", "[]"]);
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      ["referral_discount_amount", "0"]);
  }
  await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
    ["referral_discount_amount", "0"]);
  await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
    ["bot_username", ""]);

  // === D1 FIX: Indexes for frequent queries ===
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_order_images_order_id ON order_images(order_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_usage_unique_user ON promo_code_usage(promo_code_id, user_id)`);

  return db;
}

function sanitizeParams(params) {
  return params.map(p => p === undefined ? null : p);
}

async function queryAll(sql, params = []) {
  const sanitized = sanitizeParams(params);
  const result = await db.execute({ sql, args: sanitized });
  return result.rows;
}

async function queryOne(sql, params = []) {
  const results = await queryAll(sql, params);
  return results.length > 0 ? results[0] : undefined;
}

async function run(sql, params = []) {
  const sanitized = sanitizeParams(params);
  const result = await db.execute({ sql, args: sanitized });
  return {
    lastInsertRowid: Number(result.lastInsertRowid) || 0,
    changes: result.rowsAffected
  };
}

async function withTransaction(fn) {
  const tx = await db.transaction();
  try {
    const txRun = async (sql, params = []) => {
      const sanitized = sanitizeParams(params);
      const result = await tx.execute({ sql, args: sanitized });
      return {
        lastInsertRowid: Number(result.lastInsertRowid) || 0,
        changes: result.rowsAffected
      };
    };
    const txQueryOne = async (sql, params = []) => {
      const sanitized = sanitizeParams(params);
      const result = await tx.execute({ sql, args: sanitized });
      return result.rows.length > 0 ? result.rows[0] : undefined;
    };
    const result = await fn({ run: txRun, queryOne: txQueryOne });
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    throw err;
  }
}

module.exports = {
  initDatabase,
  queryAll,
  queryOne,
  run,
  withTransaction,
  getDb: () => db,
};
