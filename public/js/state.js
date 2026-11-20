/**
 * İstemci Durum Deposu & Gerçek Zamanlı WebSocket Senkronizasyonu
 */
class ClientStateStore {
  constructor() {
    this.snapshot = null;
    this.activeFilter = 'all'; // 'all' | 'topology' | spaceId
    this.ws = null;
    this.reconnectDelay = 1000;
    this.listeners = new Set();
    this.wsStatusListeners = new Set();
    this.throttleTimers = new Map();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onWsStatus(fn) {
    this.wsStatusListeners.add(fn);
    return () => this.wsStatusListeners.delete(fn);
  }

  notify(event) {
    for (const fn of this.listeners) fn(event, this.snapshot);
  }

  notifyWsStatus(status) {
    for (const fn of this.wsStatusListeners) fn(status);
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.notify({ type: 'filter:changed' });
  }

  async fetchInitialState() {
    const res = await fetch('/api/state', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Durum alınamadı');
    this.snapshot = await res.json();
    this.notify({ type: 'state:snapshot' });
  }

  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.notifyWsStatus('connecting');
    this.ws = new WebSocket(`${proto}//${location.host}/ws/client`);

    this.ws.addEventListener('open', () => {
      this.reconnectDelay = 1000;
      this.notifyWsStatus('connected');
    });

    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === 'state:snapshot') {
        this.snapshot = msg;
        this.notify({ type: 'state:snapshot' });
      } else if (msg.type === 'device:updated') {
        this.applyLocalDeviceUpdate(msg.spaceId, msg.deviceId, msg.device);
        this.notify({
          type: 'device:updated',
          spaceId: msg.spaceId,
          deviceId: msg.deviceId,
          device: msg.device,
        });
      } else if (msg.type === 'hub:status' && this.snapshot) {
        this.snapshot.hubConnected = msg.hubConnected;
        this.notify({ type: 'hub:status' });
      }
    });

    this.ws.addEventListener('close', () => {
      this.notifyWsStatus('disconnected');
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000);
        this.connectWebSocket();
      }, this.reconnectDelay);
    });
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  applyLocalDeviceUpdate(spaceId, deviceId, newDevice) {
    if (!this.snapshot) return;
    const space = this.snapshot.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const idx = space.devices.findIndex((d) => d.id === deviceId);
    if (idx !== -1) {
      space.devices[idx] = newDevice;
    }
  }

  /**
   * Optimistik UI güncellemesi + WebSocket üzerinden yayın
   */
  sendDeviceUpdate(spaceId, deviceId, patch, throttleMs = 0) {
    const sendNow = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'device:update', spaceId, deviceId, patch }));
      }
    };

    if (throttleMs > 0) {
      const key = `${spaceId}:${deviceId}`;
      if (this.throttleTimers.has(key)) {
        clearTimeout(this.throttleTimers.get(key));
      }
      this.throttleTimers.set(
        key,
        setTimeout(() => {
          this.throttleTimers.delete(key);
          sendNow();
        }, throttleMs)
      );
    } else {
      sendNow();
    }
  }

  sendSceneApply(sceneId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'scene:apply', sceneId }));
    }
  }
}

export const store = new ClientStateStore();
