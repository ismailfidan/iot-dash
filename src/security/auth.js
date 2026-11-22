import crypto from 'node:crypto';

const DEV_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret() {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;
}

export const COOKIE_NAME = 'iot_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat

/**
 * Zamanlamaya dayanıklı (timing-safe) şifre doğrulaması
 */
export function verifyCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin1234';

  if (typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }

  const userSalt = 'iot-user-salt';
  const passSalt = 'iot-pass-salt';

  const u1 = crypto.scryptSync(username, userSalt, 32);
  const u2 = crypto.scryptSync(expectedUser, userSalt, 32);
  const p1 = crypto.scryptSync(password, passSalt, 32);
  const p2 = crypto.scryptSync(expectedPass, passSalt, 32);

  return crypto.timingSafeEqual(u1, u2) && crypto.timingSafeEqual(p1, p2);
}

/**
 * HMAC-SHA256 imzalı oturum token'ı üretir
 */
export function createSessionToken(username) {
  const payload = {
    sub: username,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * İmzalı oturum token'ını doğrular
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Cookie başlığından belirli bir cookie değerini okur (WebSocket upgrade için)
 */
export function parseCookies(cookieHeader = '') {
  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

/**
 * Express middleware: Oturum doğrulama
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
  }
  req.user = session;
  next();
}

/**
 * WebSocket Origin doğrulama (CSWSH koruması)
 */
export function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Origin göndermeyen yerel/donanım istemcileri için token kontrolü devrede

  const allowedEnv = process.env.ALLOWED_ORIGINS;
  if (allowedEnv) {
    const allowedList = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean);
    if (allowedList.includes(origin)) return true;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return origin === `http://${host}` || origin === `https://${host}`;
}

/**
 * Gelecekteki ESP32 Ana Merkez (/ws/hub) Bearer Token doğrulaması
 */
export function verifyHubToken(req) {
  const expectedToken = process.env.HUB_AUTH_TOKEN;
  if (!expectedToken) return false;

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const provided = authHeader.slice(7).trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * ESP32 Ana Merkez mesajları için opsiyonel HMAC-SHA256 bütünlük doğrulaması
 */
export function verifyHubHmac(rawBody, signatureHex) {
  const secret = process.env.HUB_HMAC_SECRET;
  if (!secret || !signatureHex) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHex, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
