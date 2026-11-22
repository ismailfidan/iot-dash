import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import {
  COOKIE_NAME,
  createSessionToken,
  requireAuth,
  verifyCredentials,
  verifySessionToken,
} from './src/security/auth.js';
import { stateManager } from './src/state/stateManager.js';
import { setupWebSockets } from './src/ws/wsHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3004;
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const USE_HTTPS = process.env.FORCE_HTTPS === 'true';

// Üst düzey HTTP güvenlik başlıkları (CSP dahil, harici script/CDN engelli)
// Not: Yerel ağ / Tailscale HTTP erişiminde alt kaynakların HTTPS'e zorlanmaması için upgradeInsecureRequests kapalıdır.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: USE_HTTPS ? [] : null,
      },
    },
    crossOriginOpenerPolicy: USE_HTTPS,
    originAgentCluster: USE_HTTPS,
    crossOriginEmbedderPolicy: false,
    hsts: USE_HTTPS,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

// Brute-force koruması: Giriş denemeleri için sıkı rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// Genel API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// --- Kimlik Doğrulama Rotaları ---
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  const token = createSessionToken(username);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD && USE_HTTPS,
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });

  return res.json({ ok: true, user: username });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, user: session.sub });
});

// --- Korumalı State API (WebSocket fallback & ilk yükleme) ---
app.get('/api/state', requireAuth, (req, res) => {
  return res.json(stateManager.getSnapshot());
});

app.post('/api/devices/update', requireAuth, (req, res) => {
  const { spaceId, deviceId, patch } = req.body || {};
  if (typeof spaceId !== 'string' || typeof deviceId !== 'string' || !patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }
  const result = stateManager.updateDevice(spaceId, deviceId, patch, `http:${req.user?.sub || 'admin'}`);
  if (!result) {
    return res.status(404).json({ error: 'Cihaz bulunamadı.' });
  }
  return res.json(result);
});

app.post('/api/spaces/layout', requireAuth, (req, res) => {
  const { spaceId, items } = req.body || {};
  if (typeof spaceId !== 'string' || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }
  const result = stateManager.saveSpaceLayout(spaceId, items, `http:${req.user?.sub || 'admin'}`);
  if (!result) {
    return res.status(404).json({ error: 'Alan bulunamadı.' });
  }
  return res.json(result);
});

app.post('/api/spaces/reorder', requireAuth, (req, res) => {
  const { spaceId, deviceIds } = req.body || {};
  if (typeof spaceId !== 'string' || !Array.isArray(deviceIds)) {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }
  const result = stateManager.saveSpaceLayout(spaceId, deviceIds, `http:${req.user?.sub || 'admin'}`);
  if (!result) {
    return res.status(404).json({ error: 'Alan bulunamadı.' });
  }
  return res.json(result);
});

app.post('/api/scenes/apply', requireAuth, (req, res) => {
  const { sceneId } = req.body || {};
  if (typeof sceneId !== 'string') {
    return res.status(400).json({ error: 'Geçersiz senaryo.' });
  }
  const result = stateManager.applyScene(sceneId, `http:${req.user?.sub || 'admin'}`);
  if (!result) {
    return res.status(404).json({ error: 'Senaryo bulunamadı.' });
  }
  return res.json(result);
});

// Statik ön yüz dosyaları
app.use(express.static(path.join(__dirname, 'public')));

// HTTP + WebSocket sunucusunu başlat
const server = http.createServer(app);
// Mobil / Tailscale bağlantılarında giriş formunu doldururken 5sn keep-alive kopmasını önle
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
setupWebSockets(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n[IoT Dashboard] Sunucu çalışıyor: http://localhost:${PORT} (ve ağ/Tailscale IP:3004)`);
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
    console.warn('[Güvenlik Uyarısı] .env dosyası bulunamadı veya varsayılan geliştirme bilgileri kullanılıyor.');
    console.warn('  -> Varsayılan Giriş: admin / admin1234 (Üretim öncesi .env.example dosyasını .env olarak kopyalayıp değiştirin)');
  }
});
