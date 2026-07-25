const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_API_KEY || 'fallback-change-this';

function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), ADMIN_JWT_SECRET);
      if (decoded && decoded.role === 'admin') {
        return next();
      }
    } catch (e) { /* fall through to API key check */ }
  }

  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_API_KEY sozlanmagan' });
  }

  if (!key) {
    return res.status(401).json({ error: 'Ruxsatsiz kirish. Admin kalit kiritilmagan.' });
  }

  const keyBuf = Buffer.from(key, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Ruxsatsiz kirish. Admin kalit noto\'g\'ri.' });
  }

  next();
}

module.exports = adminAuth;
