require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, queryAll, queryOne, run, withTransaction } = require('./database');

const telegramAuth = require('./middleware/telegramAuth');
const { validateTelegramInitData } = require('./middleware/telegramAuth');
const adminAuth = require('./middleware/adminAuth');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });

const generalLimiter = rateLimit({ windowMs: 60000, max: 100, message: { error: "Juda ko'p so'rov. 1 daqiqa kuting." } });
const writeLimiter = rateLimit({ windowMs: 60000, max: 20, message: { error: "Juda ko'p amal. 1 daqiqa kuting." } });
const promoLimiter = rateLimit({ windowMs: 60000, max: 10, message: { error: "Promo-kod tekshirish limiti. 1 daqiqa kuting." } });
const broadcastLimiter = rateLimit({ windowMs: 300000, max: 5, message: { error: "Xabar yuborish limiti. 5 daqiqa kuting." } });
const statsLimiter = rateLimit({ windowMs: 60000, max: 30, message: { error: "Statistika limiti. 1 daqiqa kuting." } });

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_API_KEY || 'fallback-change-this';
const ADMIN_JWT_EXPIRY = '4h';

function nowUZ() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' });
}

function maskCardNumber(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') return '****';
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length < 4) return '****';
  return '**** **** **** ' + cleaned.slice(-4);
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function toISODate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  if (dateStr.includes('T')) return dateStr;
  return dateStr.replace(' ', 'T') + '+05:00';
}

function getLanguageSurcharge(schoolType, subject) {
  if (!schoolType || !subject) return 0;
  const st = schoolType;
  const sub = subject.toLowerCase();
  const isUzbek = sub === "o'zbek tili" || sub === 'ona tili' || sub === "o'qish" ||
    sub === 'ўзбек тили' || sub === 'ана тили' || sub === 'ўқиш' ||
    sub === 'карақалпақ тили';
  const isRussian = sub === 'rus tili' || sub === 'русский язык';
  const isEnglish = sub === 'ingliz tili' || sub === 'английский язык';
  if (st === 'uzbek') {
    if (isRussian || isEnglish) return 50000;
    return 0;
  }
  if (st === 'russian') {
    if (isUzbek) return 0;
    if (isEnglish) return 60000;
    return 50000;
  }
  if (st === 'qoraqalpoq') {
    if (isUzbek || sub === 'карақалпақ тили') return 0;
    if (isRussian || isEnglish) return 60000;
    return 50000;
  }
  return 0;
}

function fixOrderDates(order) {
  if (!order) return order;
  for (const key of ['created_at', 'receipt_uploaded_at', 'ready_at', 'updated_at']) {
    if (order[key]) order[key] = toISODate(order[key]);
  }
  return order;
}

async function deleteOrderImages(orderId) {
  const images = await queryAll('SELECT image_path FROM order_images WHERE order_id = ?', [orderId]);
  for (const img of images) {
    const filePath = path.join(__dirname, '..', img.image_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  await run('DELETE FROM order_images WHERE order_id = ?', [orderId]);
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Simple in-memory cache
const cache = new Map();
function cached(key, ttlMs, fn) {
  return async (...args) => {
    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now - entry.ts < ttlMs) return entry.data;
    const data = await fn(...args);
    cache.set(key, { data, ts: now });
    return data;
  };
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      'https://metodikish.fly.dev',
      'https://metodikish.vercel.app',
    ];
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS ruxsatsiz'));
    }
  }
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://metodikish.fly.dev", "https://api.telegram.org"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);
app.use('/uploads', (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
    return next();
  }
  if (!req.headers['x-telegram-init-data']) {
    return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi' });
  }
  const result = validateTelegramInitData(req.headers['x-telegram-init-data'], process.env.BOT_TOKEN);
  if (!result) return res.status(401).json({ error: 'Telegram auth xatosi' });
  const requestedPath = '/' + req.path.replace(/\\/g, '/');
  const allowedPrefixes = ['/receipts/', '/images/', '/documents/'];
  const hasValidPrefix = allowedPrefixes.some(p => requestedPath.startsWith(p));
  if (!hasValidPrefix) return res.status(403).json({ error: 'Ruxsatsiz' });
  const basename = path.basename(req.path);
  if (basename === 'local.db' || basename.endsWith('.db')) {
    return res.status(403).json({ error: 'Ruxsatsiz' });
  }
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

const fs = require('fs');
const uploadsDir = path.join(__dirname, '..', 'uploads');
['receipts', 'documents', 'images'].forEach(dir => {
  const fullPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.uploadType || 'images';
    cb(null, path.join(uploadsDir, type));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const allowedMimes = /image\/jpeg|image\/jpg|image\/png|image\/gif|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/;
    const ext = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedMimes.test(file.mimetype);
    cb(null, ext && mime);
  }
});

function setUploadType(type) {
  return (req, res, next) => { req.uploadType = type; next(); };
}

// ==================== ADMIN LOGIN (JWT) ====================

const loginLimiter = rateLimit({ windowMs: 60000, max: 5, message: { error: "Juda ko'p urinish. 1 daqiqa kuting." } });

app.post('/api/admin/login', loginLimiter, (req, res) => {
  try {
    const { api_key } = req.body;
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return res.status(500).json({ error: 'Server sozlanmagan' });
    if (!api_key) return res.status(400).json({ error: 'API kalit kiritilmagan' });

    const keyBuf = Buffer.from(String(api_key), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
      return res.status(401).json({ error: 'Noto\'g\'ri API kalit' });
    }

    const token = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_JWT_EXPIRY });
    res.json({ token, expiresIn: ADMIN_JWT_EXPIRY });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// ==================== API ROUTES ====================

app.get('/api/users', adminAuth, async (req, res) => {
  try {
    const users = await queryAll(`
      SELECT u.*,
        (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) as referred_count
      FROM users u ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/users/:telegram_id', telegramAuth, async (req, res) => {
  try {
    if (req.telegramUserId !== parseInt(req.params.telegram_id)) {
      return res.status(403).json({ error: 'Ruxsatsiz — faqat o\'zingizning ma\'lumotlaringizni ko\'ra olasiz' });
    }
    const user = await queryOne('SELECT * FROM users WHERE telegram_id = ?', [parseInt(req.params.telegram_id)]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json(user);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/users', writeLimiter, telegramAuth, async (req, res) => {
  try {
    const { username, first_name, last_name } = req.body;
    const telegram_id = req.telegramUserId;
    const existing = await queryOne('SELECT * FROM users WHERE telegram_id = ?', [telegram_id]);
    if (existing) {
      await run('UPDATE users SET username = ?, first_name = ?, last_name = ? WHERE telegram_id = ?',
        [username, first_name, last_name, telegram_id]);
      return res.json(await queryOne('SELECT * FROM users WHERE telegram_id = ?', [telegram_id]));
    }
    const result = await run('INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
      [telegram_id, username, first_name, last_name]);
    res.json(await queryOne('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await queryAll('SELECT * FROM services ORDER BY id ASC');
    res.json(services);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/services', adminAuth, async (req, res) => {
  try {
    const { name, description, price } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) return sendError(res, 400, 'Nomi kamida 2 ta belgi bo\'lishi kerak');
    if (!price || typeof price !== 'number' || price < 0) return sendError(res, 400, 'Narx noto\'g\'ri');
    const result = await run('INSERT INTO services (name, description, price) VALUES (?, ?, ?)',
      [name.trim().slice(0, 200), (description || '').trim().slice(0, 500), price]);
    res.json(await queryOne('SELECT * FROM services WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.put('/api/services/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, is_active } = req.body;
    await run('UPDATE services SET name = ?, description = ?, price = ?, is_active = ? WHERE id = ?',
      [name, description, price, is_active, req.params.id]);
    res.json(await queryOne('SELECT * FROM services WHERE id = ?', [req.params.id]));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.delete('/api/services/:id', adminAuth, async (req, res) => {
  try {
    await run('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/cards', adminAuth, async (req, res) => {
  try {
    const cards = await queryAll('SELECT * FROM payment_cards ORDER BY id ASC');
    res.json(cards.map(c => ({ ...c, card_number: maskCardNumber(c.card_number) })));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/cards', adminAuth, async (req, res) => {
  try {
    const { card_number, card_holder, bank_name } = req.body;
    if (!card_number || typeof card_number !== 'string' || card_number.replace(/\s/g, '').length < 16) return sendError(res, 400, 'Karta raqami noto\'g\'ri');
    if (!card_holder || typeof card_holder !== 'string' || card_holder.trim().length < 2) return sendError(res, 400, 'Karta egasi nomi kerak');
    const result = await run('INSERT INTO payment_cards (card_number, card_holder, bank_name) VALUES (?, ?, ?)',
      ['**** **** **** ' + card_number.trim().slice(-4), card_holder.trim().slice(0, 100), (bank_name || '').trim().slice(0, 100)]);
    res.json(await queryOne('SELECT * FROM payment_cards WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.put('/api/cards/:id', adminAuth, async (req, res) => {
  try {
    const { card_number, card_holder, bank_name, is_active } = req.body;
    const masked = card_number ? ('**** **** **** ' + String(card_number).replace(/\s/g, '').slice(-4)) : undefined;
    const updates = [];
    const params = [];
    if (masked !== undefined) { updates.push('card_number = ?'); params.push(masked); }
    if (card_holder !== undefined) { updates.push('card_holder = ?'); params.push(String(card_holder).trim().slice(0, 100)); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); params.push(String(bank_name).trim().slice(0, 100)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (updates.length > 0) {
      params.push(req.params.id);
      await run(`UPDATE payment_cards SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    res.json(await queryOne('SELECT * FROM payment_cards WHERE id = ?', [req.params.id]));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.delete('/api/cards/:id', adminAuth, async (req, res) => {
  try {
    await run('DELETE FROM payment_cards WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, region, subject, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('o.status = ?'); params.push(status); }
    if (region) { conditions.push("o.address LIKE ?"); params.push(region + ',%'); }
    if (subject) { conditions.push('o.subject = ?'); params.push(subject); }
    if (date_from) { conditions.push('o.created_at >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('o.created_at <= ?'); params.push(date_to + ' 23:59:59'); }
    if (search) {
      conditions.push("(o.full_name LIKE ? OR o.order_code LIKE ? OR u.username LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `
      SELECT o.*, u.username, u.first_name, u.last_name, u.telegram_id,
             s.name as service_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN services s ON o.service_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const orders = await queryAll(query, params);
    for (const order of orders) {
      order.images = await queryAll('SELECT * FROM order_images WHERE order_id = ?', [order.id]);
    }
    orders.forEach(fixOrderDates);
    const countResult = await queryOne(`SELECT COUNT(*) as count FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereClause}`, params.slice(0, params.length - 2));
    const total = countResult ? countResult.count : 0;
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const isAdmin = !!(adminKey && adminKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY);
    const isTelegram = !!req.headers['x-telegram-init-data'];
    if (!isAdmin && !isTelegram) {
      return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi' });
    }
    if (isTelegram && !isAdmin) {
      const result = validateTelegramInitData(req.headers['x-telegram-init-data'], process.env.BOT_TOKEN);
      if (!result) return res.status(401).json({ error: 'Telegram auth xatosi' });
      req.telegramUserId = result.telegram_id;
    }
    const order = await queryOne(`
      SELECT o.*, u.username, u.first_name, u.last_name, u.telegram_id, u.phone,
             s.name as service_name, s.description as service_description
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN services s ON o.service_id = s.id
      WHERE o.id = ?
    `, [parseInt(req.params.id)]);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (isTelegram && !isAdmin) {
      const dbUser = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
      if (!dbUser || dbUser.id !== order.user_id) return res.status(403).json({ error: 'Ruxsatsiz' });
    }
    order.images = await queryAll('SELECT * FROM order_images WHERE order_id = ?', [order.id]);
    res.json(fixOrderDates(order));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/orders', writeLimiter, telegramAuth, async (req, res) => {
  try {
    const { service_id, full_name, address, school, subject, grade, topic, school_type, geographic_level, promo_code_id, promo_discount, use_referral_discount } = req.body;
    if (!full_name || full_name.length > 65) return res.status(400).json({ error: 'F.I.Sh 1-65 belgi bo\'lishi kerak' });
    if (!school || school.length > 100) return res.status(400).json({ error: 'Maktab nomi 1-100 belgi bo\'lishi kerak' });
    if (!topic || topic.length > 400) return res.status(400).json({ error: 'Mavzu 1-400 belgi bo\'lishi kerak' });
    const service = await queryOne('SELECT * FROM services WHERE id = ?', [service_id]);
    if (!service) return res.status(400).json({ error: 'Xizmat topilmadi' });
    const tgUser = await queryOne('SELECT id, referral_balance FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!tgUser) return res.status(400).json({ error: 'Foydalanuvchi topilmadi' });
    const user_id = tgUser.id;

    const languageSurcharge = getLanguageSurcharge(school_type, subject);
    const geoSurcharge = geographic_level === 'viloyat' ? 60000 : geographic_level === 'respublika' ? 110000 : 0;
    const basePrice = service.price + languageSurcharge + geoSurcharge;

    // Validate promo code if provided
    let validPromoId = null;
    let validPromoDiscount = 0;
    if (promo_code_id) {
      const promo = await queryOne('SELECT * FROM promo_codes WHERE id = ? AND is_active = 1', [promo_code_id]);
      if (promo) {
        const reservedRow = await queryOne("SELECT COUNT(*) as cnt FROM promo_code_usage WHERE promo_code_id = ? AND status = 'reserved'", [promo.id]);
        const reservedCount = reservedRow ? reservedRow.cnt : 0;
        const available = promo.max_uses <= 0 || (promo.used_count + reservedCount) < promo.max_uses;
        if (available) {
          const alreadyUsed = await queryOne('SELECT id FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?', [promo.id, user_id]);
          if (!alreadyUsed) {
            validPromoId = promo.id;
            validPromoDiscount = Math.round(basePrice * promo.discount_percent / 100);
          }
        }
      }
    }

    // Validate referral discount if requested
    let validReferralDiscount = 0;
    if (use_referral_discount) {
      const setting = await queryOne("SELECT value FROM settings WHERE key = 'referral_discount_amount'");
      const discountAmount = setting ? parseInt(setting.value) || 0 : 0;
      if (discountAmount > 0 && (tgUser.referral_balance || 0) >= discountAmount) {
        validReferralDiscount = discountAmount;
      }
    }

    const orderCode = `MK-${Date.now().toString(36).toUpperCase()}${uuidv4().substring(0, 4).toUpperCase()}`;
    const totalPrice = Math.max(0, basePrice - validPromoDiscount - validReferralDiscount);

    // P5: Wrap order + promo usage + referral deduction in a transaction
    const orderId = await withTransaction(async ({ run: txRun, queryOne: txQueryOne }) => {
      const result = await txRun(`
        INSERT INTO orders (order_code, user_id, service_id, full_name, address, school, subject, grade, topic, total_price, school_type, language_surcharge, geographic_level, geographic_surcharge, promo_code_id, promo_discount, referral_discount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderCode, user_id, service_id, full_name, address, school, subject, grade, topic, totalPrice, school_type || null, languageSurcharge, geographic_level || 'maktab', geoSurcharge, validPromoId, validPromoDiscount, validReferralDiscount, nowUZ()]);

      const oid = result.lastInsertRowid;

      // Record promo usage as reserved (C1: unique index prevents race condition)
      if (validPromoId) {
        await txRun('INSERT INTO promo_code_usage (promo_code_id, user_id, order_id, status, used_at) VALUES (?, ?, ?, ?, ?)',
          [validPromoId, user_id, oid, 'reserved', nowUZ()]);
      }

      // Deduct referral balance
      if (validReferralDiscount > 0) {
        await txRun('UPDATE users SET referral_balance = referral_balance - ? WHERE id = ?', [validReferralDiscount, user_id]);
      }

      return oid;
    });

    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json(fixOrderDates(order));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Promo-kod allaqachon ishlatilgan' });
    }
    console.error('[POST /api/orders] Error:', err);
    sendError(res, 500, 'Server xatosi');
  }
});

app.put('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    const updates = ['updated_at = ?'];
    const params = [nowUZ()];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (status === 'ready') { updates.push('ready_at = ?'); params.push(nowUZ()); }
    if (admin_note !== undefined) { updates.push('admin_note = ?'); params.push(admin_note); }
    params.push(parseInt(req.params.id));
    await run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
    const order = await queryOne(`
      SELECT o.*, u.username, u.first_name, u.last_name, u.telegram_id,
             s.name as service_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN services s ON o.service_id = s.id
      WHERE o.id = ?
    `, [parseInt(req.params.id)]);
    order.images = await queryAll('SELECT * FROM order_images WHERE order_id = ?', [order.id]);
    res.json(fixOrderDates(order));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/orders/:id/receipt', telegramAuth, setUploadType('receipts'), upload.single('receipt'), async (req, res) => {
  try {
    const order = await queryOne('SELECT id, user_id FROM orders WHERE id = ?', [parseInt(req.params.id)]);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    const dbUser = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!dbUser || dbUser.id !== order.user_id) return res.status(403).json({ error: 'Ruxsatsiz' });
    await run(`UPDATE orders SET payment_receipt = ?, status = ?, receipt_uploaded_at = ? WHERE id = ?`,
      [`/uploads/receipts/${req.file.filename}`, 'pending_confirmation', nowUZ(), parseInt(req.params.id)]);
    res.json({ success: true, path: `/uploads/receipts/${req.file.filename}` });
  } catch (err) {
    if (req.file) { const fp = path.join(uploadsDir, 'receipts', req.file.filename); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    sendError(res, 500, 'Server xatosi');
  }
});

app.post('/api/orders/:id/images', telegramAuth, setUploadType('images'), upload.array('images', 5), async (req, res) => {
  try {
    const order = await queryOne('SELECT id, user_id FROM orders WHERE id = ?', [parseInt(req.params.id)]);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    const dbUser = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!dbUser || dbUser.id !== order.user_id) return res.status(403).json({ error: 'Ruxsatsiz' });
    const images = [];
    for (const file of req.files) {
      const result = await run('INSERT INTO order_images (order_id, image_path) VALUES (?, ?)',
        [parseInt(req.params.id), `/uploads/images/${file.filename}`]);
      images.push({ id: result.lastInsertRowid, image_path: `/uploads/images/${file.filename}` });
    }
    res.json(images);
  } catch (err) {
    if (req.files) { for (const f of req.files) { const fp = path.join(uploadsDir, 'images', f.filename); if (fs.existsSync(fp)) fs.unlinkSync(fp); } }
    sendError(res, 500, 'Server xatosi');
  }
});

app.post('/api/orders/:id/document', adminAuth, setUploadType('documents'), upload.single('document'), async (req, res) => {
  try {
    await run('UPDATE orders SET document_file = ?, status = ? WHERE id = ?',
      [`/uploads/documents/${req.file.filename}`, 'ready', parseInt(req.params.id)]);
    res.json({ success: true, path: `/uploads/documents/${req.file.filename}` });
  } catch (err) {
    if (req.file) { const fp = path.join(uploadsDir, 'documents', req.file.filename); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    sendError(res, 500, 'Server xatosi');
  }
});

app.put('/api/orders/:id/confirm-payment', adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await queryOne(`
      SELECT o.*, u.telegram_id, u.first_name
      FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?
    `, [orderId]);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    await run('UPDATE orders SET status = ? WHERE id = ?', ['in_progress', orderId]);
    if (order.promo_code_id) {
      await run("UPDATE promo_code_usage SET status = 'used' WHERE promo_code_id = ? AND user_id = ? AND order_id = ?", [order.promo_code_id, order.user_id, orderId]);
      await run('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [order.promo_code_id]);
    }
    const orderUser = await queryOne('SELECT referred_by FROM users WHERE id = ?', [order.user_id]);
    if (orderUser && orderUser.referred_by) {
      const setting = await queryOne("SELECT value FROM settings WHERE key = 'referral_discount_amount'");
      const rewardAmount = setting ? parseInt(setting.value) || 0 : 0;
      if (rewardAmount > 0) {
        await run('UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?', [rewardAmount, orderUser.referred_by]);
      }
    }
    const queueResult = await queryOne(
      `SELECT COUNT(*) as position FROM orders WHERE status = 'in_progress' AND created_at <= ?`,
      [order.created_at]
    );
    const queuePosition = queueResult ? queueResult.position : 1;
    const bot = require('./bot').getBotInstance();
    if (bot && order.telegram_id) {
      bot.sendMessage(order.telegram_id,
        `✅ *To'lovingiz tasdiqlandi!*\n\n📋 Buyurtma: #${order.order_code}\n🔢 Sizning navbatingiz: *${queuePosition}*\n\nHujjat tayyor bo'lgach sizga xabar beriladi.`,
        { parse_mode: 'Markdown' }
      ).catch(err => console.error('Failed to send notification:', err.message));
    }
    res.json({ success: true, queuePosition });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.put('/api/orders/:id/reject-payment', adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;
    const order = await queryOne(`
      SELECT o.*, u.telegram_id, u.first_name
      FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?
    `, [orderId]);
    await deleteOrderImages(orderId);
    await run('UPDATE orders SET status = ?, admin_note = ? WHERE id = ?',
      ['rejected', reason || null, orderId]);
    if (order && order.promo_code_id) {
      await run('DELETE FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ? AND order_id = ?', [order.promo_code_id, order.user_id, orderId]);
    }
    if (order && order.referral_discount > 0) {
      await run('UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?', [order.referral_discount, order.user_id]);
    }
    const bot = require('./bot').getBotInstance();
    if (bot && order && order.telegram_id) {
      const reasonText = reason ? `\nSababi: ${reason}` : '';
      bot.sendMessage(order.telegram_id,
        `❌ *Buyurtmangiz rad etildi!*\n\n📋 Buyurtma: #${order.order_code}${reasonText}\n\nIltimos, buyurtmani qaytadan yarating.`,
        { parse_mode: 'Markdown' }
      ).catch(err => console.error('Failed to send rejection notification:', err.message));
    }
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/orders/:id/auto-cancel', telegramAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await queryOne('SELECT status, promo_code_id, user_id, referral_discount FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    const dbUser = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!dbUser || dbUser.id !== order.user_id) return res.status(403).json({ error: 'Ruxsatsiz' });
    if (order.status !== 'pending_payment') {
      return res.json({ success: true, alreadyHandled: true });
    }
    await deleteOrderImages(orderId);
    await run("UPDATE orders SET status = 'rejected', admin_note = 'Avtomatik bekor qilindi: 5 daqiqada chek yuklanmadi' WHERE id = ?", [orderId]);
    if (order.promo_code_id) {
      await run('DELETE FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ? AND order_id = ?', [order.promo_code_id, order.user_id, orderId]);
    }
    if (order.referral_discount > 0) {
      await run('UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?', [order.referral_discount, order.user_id]);
    }
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.put('/api/orders/:id/send', adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await queryOne(`
      SELECT o.*, u.telegram_id FROM orders o
      LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?
    `, [orderId]);
    await run('UPDATE orders SET status = ? WHERE id = ?', ['sent', orderId]);
    const bot = require('./bot').getBotInstance();
    if (bot && order && order.telegram_id) {
      const message = `📤 *Buyurtma tayyor va yuborildi!*\n\n📋 Buyurtma: #${order.order_code}`;
      if (order.document_file) {
        const filePath = path.join(__dirname, '..', order.document_file);
        if (fs.existsSync(filePath)) {
          bot.sendMessage(order.telegram_id, message, { parse_mode: 'Markdown' })
            .then(() => bot.sendDocument(order.telegram_id, filePath, { caption: `📄 ${order.service_name || 'Hujjat'}` }))
            .catch(err => console.error('Failed to send document:', err.message));
        } else {
          bot.sendMessage(order.telegram_id, message + '\n\n📥 Hujjatni bot orqali yuklab oling.', { parse_mode: 'Markdown' })
            .catch(err => console.error('Failed to send notification:', err.message));
        }
      } else {
        bot.sendMessage(order.telegram_id, message, { parse_mode: 'Markdown' })
          .catch(err => console.error('Failed to send notification:', err.message));
      }
    }
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/stats', adminAuth, statsLimiter, async (req, res) => {
  try {
    const schoolTypeFilter = req.query.school_type;
    const stParams = schoolTypeFilter ? [schoolTypeFilter] : [];
    const stWhere = schoolTypeFilter ? 'WHERE school_type = ?' : '';
    const totalOrders = (await queryOne(`SELECT COUNT(*) as count FROM orders ${stWhere}`, stParams))?.count || 0;
    const pendingPayment = (await queryOne(`SELECT COUNT(*) as count FROM orders WHERE status = ? ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, schoolTypeFilter ? ['pending_payment', schoolTypeFilter] : ['pending_payment']))?.count || 0;
    const pendingConfirmation = (await queryOne(`SELECT COUNT(*) as count FROM orders WHERE status = ? ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, schoolTypeFilter ? ['pending_confirmation', schoolTypeFilter] : ['pending_confirmation']))?.count || 0;
    const inProgress = (await queryOne(`SELECT COUNT(*) as count FROM orders WHERE status = ? ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, schoolTypeFilter ? ['in_progress', schoolTypeFilter] : ['in_progress']))?.count || 0;
    const ready = (await queryOne(`SELECT COUNT(*) as count FROM orders WHERE status = ? ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, schoolTypeFilter ? ['ready', schoolTypeFilter] : ['ready']))?.count || 0;
    const sent = (await queryOne(`SELECT COUNT(*) as count FROM orders WHERE status = ? ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, schoolTypeFilter ? ['sent', schoolTypeFilter] : ['sent']))?.count || 0;
    const totalUsers = (await queryOne('SELECT COUNT(*) as count FROM users'))?.count || 0;
    const totalRevenueResult = await queryOne(`SELECT COALESCE(SUM(total_price), 0) as total FROM orders WHERE status IN ('in_progress', 'ready', 'sent') ${schoolTypeFilter ? 'AND school_type = ?' : ''}`, stParams);
    const totalRevenue = totalRevenueResult ? totalRevenueResult.total : 0;
    let subjectStats = [], gradeStats = [], regionStats = [], recentOrders = [];
    try { subjectStats = await queryAll(`SELECT subject, COUNT(*) as count FROM orders ${stWhere} GROUP BY subject ORDER BY count DESC LIMIT 10`, stParams); } catch (e) {}
    try { gradeStats = await queryAll(`SELECT grade, COUNT(*) as count FROM orders ${stWhere} GROUP BY grade ORDER BY count DESC`, stParams); } catch (e) {}
    try { regionStats = await queryAll(`SELECT address as region, COUNT(*) as count FROM orders ${stWhere} GROUP BY region ORDER BY count DESC LIMIT 20`, stParams); } catch (e) {}
    try { recentOrders = await queryAll(`SELECT o.id, o.order_code, o.full_name, o.status, o.total_price, o.created_at, s.name as service_name FROM orders o LEFT JOIN services s ON o.service_id = s.id ${schoolTypeFilter ? 'WHERE o.school_type = ?' : ''} ORDER BY o.created_at DESC LIMIT 7`, stParams); recentOrders.forEach(fixOrderDates); } catch (e) {}

    // Daily chart data (last 14 days)
    let dailyChart = [];
    try {
      dailyChart = await queryAll(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM orders WHERE created_at >= datetime('now', '-14 days')
        GROUP BY DATE(created_at) ORDER BY date
      `);
    } catch (e) {}

    // Weekly chart data (last 8 weeks)
    let weeklyChart = [];
    try {
      weeklyChart = await queryAll(`
        SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
        FROM orders WHERE created_at >= datetime('now', '-56 days')
        GROUP BY week ORDER BY week
      `);
    } catch (e) {}

    res.json({ totalOrders, pendingPayment, pendingConfirmation, inProgress, ready, sent, totalUsers, totalRevenue, subjectStats, gradeStats, regionStats, recentOrders, dailyChart, weeklyChart });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await queryAll('SELECT * FROM settings');
    const obj = {};
    settings.forEach(s => obj[s.key] = s.value);
    delete obj.bot_token;
    delete obj.admin_chat_id;
    res.json(obj);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.put('/api/settings', adminAuth, async (req, res) => {
  try {
    const allowedKeys = ['bot_username', 'channels', 'referral_discount_amount', 'referral_reward_amount'];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowedKeys.includes(key)) continue;
      await run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = ?`, [value, nowUZ(), key]);
    }
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/settings/channels', async (req, res) => {
  try {
    const row = await queryOne("SELECT value FROM settings WHERE key = 'channels'");
    if (!row || !row.value) return res.json([]);
    try {
      const channels = JSON.parse(row.value);
      res.json(Array.isArray(channels) ? channels : []);
    } catch {
      res.json([]);
    }
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.post('/api/settings/channels', adminAuth, async (req, res) => {
  try {
    const { name, link } = req.body;
    if (!name || !link) return res.status(400).json({ error: 'Nomi va link kiritilishi shart' });
    const row = await queryOne("SELECT value FROM settings WHERE key = 'channels'");
    let channels = [];
    if (row && row.value) {
      try { channels = JSON.parse(row.value); } catch { channels = []; }
      if (!Array.isArray(channels)) channels = [];
    }
    if (channels.length >= 5) return res.status(400).json({ error: 'Maksimal 5 ta kanal qo\'shish mumkin' });
    channels.push({ name, link, updated_at: nowUZ() });
    await run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)", ['channels', JSON.stringify(channels), nowUZ()]);
    res.json({ success: true, channels });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.delete('/api/settings/channels/:index', adminAuth, async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const row = await queryOne("SELECT value FROM settings WHERE key = 'channels'");
    if (!row || !row.value) return res.status(404).json({ error: 'Kanallar topilmadi' });
    let channels = [];
    try { channels = JSON.parse(row.value); } catch { channels = []; }
    if (!Array.isArray(channels)) channels = [];
    if (idx < 0 || idx >= channels.length) return res.status(400).json({ error: 'Noto\'g\'ri index' });
    channels.splice(idx, 1);
    await run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)", ['channels', JSON.stringify(channels), nowUZ()]);
    res.json({ success: true, channels });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/user/orders/:telegram_id', telegramAuth, async (req, res) => {
  try {
    const requestedId = parseInt(req.params.telegram_id);
    if (requestedId !== req.telegramUserId) return res.status(403).json({ error: 'Ruxsatsiz' });
    const user = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [requestedId]);
    if (!user) return res.json([]);
    const orders = await queryAll(`
      SELECT o.*, s.name as service_name FROM orders o
      LEFT JOIN services s ON o.service_id = s.id
      WHERE o.user_id = ? ORDER BY o.created_at DESC
    `, [user.id]);
    res.json(orders.map(fixOrderDates));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/user/active-cards', async (req, res) => {
  try {
    const cards = await queryAll('SELECT * FROM payment_cards WHERE is_active = 1');
    res.json(cards.map(c => ({ ...c, card_number: maskCardNumber(c.card_number) })));
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

app.get('/api/user/referral-info/:telegram_id', telegramAuth, async (req, res) => {
  try {
    const requestedId = parseInt(req.params.telegram_id);
    if (requestedId !== req.telegramUserId) return res.status(403).json({ error: 'Ruxsatsiz' });
    const user = await queryOne('SELECT id, referral_balance, referred_by FROM users WHERE telegram_id = ?', [requestedId]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const referredCount = await queryOne('SELECT COUNT(*) as cnt FROM users WHERE referred_by = ?', [user.id]);
    const setting = await queryOne("SELECT value FROM settings WHERE key = 'referral_discount_amount'");
    const discountAmount = setting ? parseInt(setting.value) || 0 : 0;
    res.json({
      referral_balance: user.referral_balance || 0,
      referral_discount_amount: discountAmount,
      referred_count: referredCount ? referredCount.cnt : 0,
      referral_code: req.params.telegram_id
    });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Broadcast message to all users
app.post('/api/broadcast', adminAuth, broadcastLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Xabar bo\'sh bo\'lmasligi kerak' });
    const users = await queryAll('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');
    const bot = require('./bot').getBotInstance();
    let sent = 0, failed = 0;
    if (bot) {
      for (const user of users) {
        try {
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          sent++;
        } catch (e) { failed++; }
      }
    }
    res.json({ success: true, total: users.length, sent, failed });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Get unique filter options for orders (extract region from address)
app.get('/api/filters', async (req, res) => {
  try {
    const regions = await queryAll("SELECT DISTINCT SUBSTR(address, 1, INSTR(address, ',') - 1) as region FROM orders WHERE address IS NOT NULL AND address != '' AND INSTR(address, ',') > 0 ORDER BY region");
    const subjects = await queryAll("SELECT DISTINCT subject FROM orders WHERE subject IS NOT NULL AND subject != '' ORDER BY subject");
    res.json({ regions: regions.map(r => r.region), subjects: subjects.map(s => s.subject) });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// ═══════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════

// MiniApp: validate promo code
app.post('/api/promo-codes/validate', promoLimiter, telegramAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const dbUser = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!dbUser) return res.status(400).json({ error: 'Foydalanuvchi topilmadi' });
    const user_id = dbUser.id;
    if (!code) return res.status(400).json({ error: 'Kod kiritilishi shart' });

    const promo = await queryOne('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1', [code.toUpperCase().trim()]);
    if (!promo) return res.status(400).json({ error: 'Noto\'g\'ri yoki faol emas promo-kod' });

    const used = await queryOne('SELECT id FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?', [promo.id, user_id]);
    if (used) return res.status(400).json({ error: 'Siz allaqachon bu promo-koddan foydalangansiz' });

    if (promo.max_uses > 0) {
      const reservedRow = await queryOne("SELECT COUNT(*) as cnt FROM promo_code_usage WHERE promo_code_id = ? AND status = 'reserved'", [promo.id]);
      const reservedCount = reservedRow ? reservedRow.cnt : 0;
      if ((promo.used_count + reservedCount) >= promo.max_uses) {
        if (reservedCount > 0) {
          return res.status(400).json({ error: 'Promo-kod limiti tugagan. Hozir to\'lov jarayonida. Tasdiqlansa bo\'shatilishi mumkin.' });
        }
        return res.status(400).json({ error: 'Promo-kodning barcha limitlari tugagan. Boshqa foydalanib bo\'lmaydi.' });
      }
    }

    res.json({ success: true, promo_code_id: promo.id, discount_percent: promo.discount_percent, source_name: promo.source_name });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Admin: list promo codes
app.get('/api/promo-codes', adminAuth, async (req, res) => {
  try {
    const codes = await queryAll('SELECT * FROM promo_codes ORDER BY id DESC');
    res.json(codes);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Admin: create promo code
app.post('/api/promo-codes', adminAuth, async (req, res) => {
  try {
    const { code, discount_percent, source_name, max_uses } = req.body;
    if (!code || typeof code !== 'string' || code.trim().length < 3) return sendError(res, 400, 'Kod kamida 3 ta belgi bo\'lishi kerak');
    if (!discount_percent || typeof discount_percent !== 'number' || discount_percent < 1 || discount_percent > 100) return sendError(res, 400, 'Chegirma % 1-100 orasida bo\'lishi kerak');
    if (max_uses !== undefined && (typeof max_uses !== 'number' || max_uses < 0)) return sendError(res, 400, 'Maksimal ishlatish soni noto\'g\'ri');

    const existing = await queryOne('SELECT id FROM promo_codes WHERE code = ?', [code.toUpperCase().trim()]);
    if (existing) return res.status(400).json({ error: 'Bu kod allaqachon mavjud' });

    const result = await run(
      'INSERT INTO promo_codes (code, discount_percent, source_name, max_uses, created_at) VALUES (?, ?, ?, ?, ?)',
      [code.toUpperCase().trim(), discount_percent, source_name || null, max_uses || 0, nowUZ()]
    );
    const promo = await queryOne('SELECT * FROM promo_codes WHERE id = ?', [result.lastInsertRowid]);
    res.json(promo);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Admin: toggle promo code active/inactive
app.put('/api/promo-codes/:id', adminAuth, async (req, res) => {
  try {
    const { is_active } = req.body;
    const promo = await queryOne('SELECT * FROM promo_codes WHERE id = ?', [req.params.id]);
    if (!promo) return res.status(404).json({ error: 'Promo-kod topilmadi' });

    await run('UPDATE promo_codes SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
    const updated = await queryOne('SELECT * FROM promo_codes WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Admin: delete promo code
app.delete('/api/promo-codes/:id', adminAuth, async (req, res) => {
  try {
    await run('DELETE FROM promo_code_usage WHERE promo_code_id = ?', [req.params.id]);
    await run('DELETE FROM promo_codes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { sendError(res, 500, 'Server xatosi'); }
});

// Serve built frontend files
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
const adminBuildPath = path.join(__dirname, '..', 'admin', 'dist');

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}
// ═══════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════

// Public: get published reviews
app.get('/api/reviews/published', async (req, res) => {
  try {
    const reviews = await queryAll(
      `SELECT r.id, r.stars, r.text, r.author_name, r.region, r.created_at
       FROM reviews r WHERE r.status = 'published' ORDER BY r.id DESC LIMIT 20`
    );
    res.json(reviews);
  } catch (e) {
    sendError(res, 500, 'Server xatosi');
  }
});

// MiniApp: submit review (order must be 'sent' and belong to user)
app.post('/api/reviews', writeLimiter, telegramAuth, async (req, res) => {
  try {
    const { order_id, stars, text, author_name, region } = req.body;
    if (!order_id || !stars || !text)
      return res.status(400).json({ error: 'Majburiy maydonlar yetishmayapdi' });
    if (stars < 1 || stars > 5)
      return res.status(400).json({ error: 'Yulduzlar 1-5 orasida bo\'lishi kerak' });

    const user = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [req.telegramUserId]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const order = await queryOne(
      `SELECT id FROM orders WHERE id = ? AND user_id = ? AND status IN ('sent','ready')`,
      [order_id, user.id]
    );
    if (!order) return res.status(403).json({ error: 'Sharh yozish uchun buyurtma tayyor yoki yuborilgan bo\'lishi kerak' });

    const existing = await queryOne('SELECT id FROM reviews WHERE order_id = ?', [order_id]);
    if (existing) return res.status(409).json({ error: 'Bu buyurtma uchun allaqachon sharh yozilgan' });

    const result = await run(
      `INSERT INTO reviews (order_id, user_id, stars, text, author_name, region, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order_id, user.id, stars, text.trim(), author_name || null, region || null, nowUZ()]
    );
    res.json({ id: result.lastInsertRowid, message: 'Sharh qabul qilindi' });
  } catch (e) {
    sendError(res, 500, 'Server xatosi');
  }
});

// Admin: get all reviews
app.get('/api/admin/reviews', adminAuth, async (req, res) => {
  try {
    const reviews = await queryAll(
      `SELECT r.*, u.first_name, u.username, o.order_code
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN orders o ON r.order_id = o.id
       ORDER BY r.id DESC`
    );
    res.json(reviews);
  } catch (e) {
    console.error('Reviews list error:', e.message);
    sendError(res, 500, 'Server xatosi');
  }
});

// Admin: publish or reject review
app.patch('/api/admin/reviews/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'published' | 'rejected'
    if (!['published', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Noto\'g\'ri status' });
    await run('UPDATE reviews SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('Review status update error:', e.message);
    sendError(res, 500, 'Server xatosi');
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (fs.existsSync(adminBuildPath)) {
  app.use('/admin', express.static(adminBuildPath));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    const adminIndex = path.join(adminBuildPath, 'index.html');
    if (fs.existsSync(adminIndex)) return res.sendFile(adminIndex);
  }
  const clientIndex = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(clientIndex)) return res.sendFile(clientIndex);
  res.status(404).json({ error: 'Not found' });
});

Sentry.setupExpressErrorHandler(app);
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); process.exit(1); });
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

let httpServer;
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => { console.error('Forced shutdown after timeout.'); process.exit(1); }, 10000);
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function start() {
  await initDatabase();
  try {
    const codes = await queryAll('SELECT id, used_count FROM promo_codes');
    for (const c of codes) {
      const row = await queryOne("SELECT COUNT(*) as cnt FROM promo_code_usage WHERE promo_code_id = ? AND status = 'used'", [c.id]);
      const actual = row ? row.cnt : 0;
      if (c.used_count !== actual) {
        await run('UPDATE promo_codes SET used_count = ? WHERE id = ?', [actual, c.id]);
        console.log(`🔧 Fixed promo_code id=${c.id}: used_count ${c.used_count} → ${actual}`);
      }
    }
  } catch (e) { console.error('Promo used_count recalc error:', e.message); }
  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
  });
  if (process.env.BOT_TOKEN) {
    try {
      const { startBot } = require('./bot');
      await startBot(app);
      console.log('🤖 Bot started');
    } catch (err) {
      console.error('⚠️ Bot failed to start:', err.message);
    }
  } else {
    console.log('⚠️ BOT_TOKEN not set, bot not started');
  }
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
