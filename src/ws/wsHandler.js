import { WebSocketServer, WebSocket } from 'ws';
import {
  COOKIE_NAME,
  isOriginAllowed,
  parseCookies,
  verifyHubToken,
  verifySessionToken,
} from '../security/auth.js';
import { stateManager } from '../state/stateManager.js';

const MAX_WS_PAYLOAD = 16 * 1024; // 16 KB güvenlik sınırı

export function setupWebSockets(server) {
  const clientWss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD,
  });

  const hubWss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD,
  });

  // HTTP Upgrade isteklerini güvenli şekilde yönlendir
  server.on('upgrade', (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0];

    if (urlPath === '/ws/client') {
      if (!isOriginAllowed(req)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const cookies = parseCookies(req.headers.cookie);
      const session = verifySessionToken(cookies[COOKIE_NAME]);
      if (!session) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      clientWss.handleUpgrade(req, socket, head, (ws) => {
        ws.user = session.sub;
        clientWss.emit('connection', ws, req);
      });
      return;
    }

    if (urlPath === '/ws/hub') {
      if (!verifyHubToken(req)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      hubWss.handleUpgrade(req, socket, head, (ws) => {
        hubWss.emit('connection', ws, req);
      });
      return;
    }

    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  });

  // İstemci (Dashboard UI) bağlantıları
  clientWss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // İlk bağlantıda güncel snapshot gönder
    ws.send(
      JSON.stringify({
        type: 'state:snapshot',
        ...stateManager.getSnapshot(),
      })
    );

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }

      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'device:update') {
        const { spaceId, deviceId, patch } = msg;
        if (typeof spaceId === 'string' && typeof deviceId === 'string' && patch && typeof patch === 'object') {
          stateManager.updateDevice(spaceId, deviceId, patch, `ui:${ws.user}`);
        }
      } else if (msg.type === 'scene:apply') {
        if (typeof msg.sceneId === 'string') {
          stateManager.applyScene(msg.sceneId, `ui:${ws.user}`);
        }
      }
    });
  });

  // ESP32 Ana Merkez (/ws/hub) — Gelecekteki canlı senkronizasyon kanalı
  hubWss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    stateManager.setHubConnected(true);
    console.log('[ESP32-HUB] Ana Merkez bağlandı.');

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }

      // Gelecek aşamada ESP32 Ana Merkez'den gelen ESP-NOW telemetri ve durum güncellemeleri burada işlenecek
      if (msg?.type === 'device:sync' && msg.spaceId && msg.deviceId && msg.patch) {
        stateManager.updateDevice(msg.spaceId, msg.deviceId, msg.patch, 'esp32-hub');
      }
    });

    ws.on('close', () => {
      const anyHubAlive = [...hubWss.clients].some((c) => c.readyState === WebSocket.OPEN);
      stateManager.setHubConnected(anyHubAlive);
      console.log('[ESP32-HUB] Ana Merkez bağlantısı kesildi.');
    });
  });

  // StateManager'dan gelen değişiklikleri tüm bağlı UI ve Hub istemcilerine yayınla
  stateManager.on('state:changed', (payload) => {
    const serialized = JSON.stringify(payload);

    for (const client of clientWss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }

    // UI'dan gelen komutları gelecekte ESP32 Ana Merkez'e de iletmek için hazır kanca
    if (payload.source !== 'esp32-hub') {
      for (const hub of hubWss.clients) {
        if (hub.readyState === WebSocket.OPEN) {
          hub.send(serialized);
        }
      }
    }
  });

  // Ölü bağlantıları temizlemek için 30 saniyede bir heartbeat
  const heartbeat = setInterval(() => {
    for (const wss of [clientWss, hubWss]) {
      for (const ws of wss.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30_000);

  server.on('close', () => clearInterval(heartbeat));
}
