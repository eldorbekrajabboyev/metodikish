const crypto = require('crypto');

function adminAuth(req, res, next) {
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
