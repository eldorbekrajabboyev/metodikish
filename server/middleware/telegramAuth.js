const crypto = require('crypto');

const MAX_AUTH_AGE = 86400; // 24 hours in seconds

function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Remove hash from data check
  params.delete('hash');

  // Sort params and build data-check-string
  const dataCheckEntries = [];
  params.forEach((value, key) => {
    dataCheckEntries.push(`${key}=${value}`);
  });
  dataCheckEntries.sort();
  const dataCheckString = dataCheckEntries.join('\n');

  // HMAC-SHA256 with bot token as secret
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!hash || calculatedHash.length !== hash.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'))) return null;

  // Check auth_date freshness
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (!authDate) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE) return null;

  // Parse user
  try {
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.id) return null;
    return { telegram_id: user.id, user };
  } catch {
    return null;
  }
}

function telegramAuth(req, res, next) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return res.status(401).json({ error: 'Server konfiguratsiya xatosi: BOT_TOKEN mavjud emas' });
  }

  const initData = req.headers['x-telegram-init-data'];
  if (!initData) {
    return res.status(401).json({ error: 'Telegram auth talab qilinadi' });
  }

  const result = validateTelegramInitData(initData, botToken);
  if (!result) {
    return res.status(401).json({ error: 'Telegram auth xatosi: noto\'g\'ri yoki muddati o\'tgan' });
  }

  req.telegramUser = result.user;
  req.telegramUserId = result.telegram_id;
  next();
}

module.exports = telegramAuth;
module.exports.validateTelegramInitData = validateTelegramInitData;
