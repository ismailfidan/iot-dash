/**
 * İstemci Durum Deposu & Gerçek Zamanlı WebSocket Senkronizasyonu
 */
class ClientStateStore {
  constructor() {
    this.snapshot = null;
    this.activeFilter = 'hub-main'; // Kiosk varsayılanı: doğrudan Merkez odası
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
      } else if (msg.type === 'space:layout') {
        this.applyLocalSpaceLayout(msg.spaceId, msg.devices);
        this.notify({
          type: 'space:layout',
          spaceId: msg.spaceId,
          devices: msg.devices,
        });
      } else if (msg.type === 'space:reordered') {
        this.applyLocalReorder(msg.spaceId, msg.deviceIds);
        this.notify({
          type: 'space:reordered',
          spaceId: msg.spaceId,
          deviceIds: msg.deviceIds,
        });
      } else if (msg.type === 'hub:status' && this.snapshot) {
        this.snapshot.hubConnected = msg.hubConnected;
        this.notify({ type: 'hub:status' });
      }
    });

    this.ws.addEventListener('close', () => {
      this.notifyWsStatus('disconnected');
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 5000);
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
   * Kullanıcı dokunduğu anda 0ms gecikmeyle yerel cihaz durumunu günceller (Optimistic UI)
   */
  applyOptimisticPatch(spaceId, deviceId, patch) {
    if (!this.snapshot) return;
    const space = this.snapshot.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const device = space.devices.find((d) => d.id === deviceId);
    if (!device) return;

    if (typeof patch.on === 'boolean') {
      device.on = patch.on;
      if (device.type === 'fan') {
        if (!device.on) {
          if (device.pwm > 0) device.lastPwm = device.pwm;
          device.speed = 0;
          device.pwm = 0;
        } else if (!device.pwm) {
          const restored = device.lastPwm || 50;
          device.pwm = restored;
          device.speed = restored <= 35 ? 1 : restored <= 70 ? 2 : 3;
        }
      } else if (device.type === 'dimmer' || device.type === 'slider') {
        if (!device.on) {
          if (device.value > 0) device.lastValue = device.value;
          device.value = 0;
        } else if (!device.value) {
          device.value = device.lastValue || 80;
        }
      }
    }

    if (typeof patch.value === 'number') {
      device.value = Math.max(device.min ?? 0, Math.min(device.max ?? 100, Math.round(patch.value)));
      device.on = device.value > 0;
    }

    if (device.type === 'fan') {
      if (typeof patch.speed === 'number') {
        const clamped = Math.max(0, Math.min(3, Math.round(patch.speed)));
        device.speed = clamped;
        device.on = clamped > 0;
        const speedToPwm = { 0: 0, 1: 30, 2: 55, 3: 90 };
        if (typeof patch.pwm !== 'number') device.pwm = speedToPwm[clamped];
      }
      if (typeof patch.pwm === 'number') {
        device.pwm = Math.max(0, Math.min(100, Math.round(patch.pwm)));
        device.on = device.pwm > 0;
        device.speed = device.pwm === 0 ? 0 : device.pwm <= 35 ? 1 : device.pwm <= 70 ? 2 : 3;
      }
    }

    if (device.type === 'climate') {
      if (typeof patch.targetTemp === 'number') {
        device.targetTemp = Math.max(device.min ?? 16, Math.min(device.max ?? 30, Math.round(patch.targetTemp)));
        device.on = true;
      }
      if (typeof patch.mode === 'string') {
        device.mode = patch.mode;
        device.on = true;
      }
    }

    this.notify({
      type: 'device:updated',
      spaceId,
      deviceId,
      device,
    });
  }

  applyLocalSpaceLayout(spaceId, devices) {
    if (!this.snapshot || !Array.isArray(devices)) return;
    const space = this.snapshot.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    space.devices = devices;
  }

  applyLocalReorder(spaceId, deviceIds) {
    if (!this.snapshot || !Array.isArray(deviceIds)) return;
    const space = this.snapshot.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const map = new Map(space.devices.map((d) => [d.id, d]));
    const next = [];
    for (const entry of deviceIds) {
      const id = typeof entry === 'string' ? entry : entry?.id;
      if (id && map.has(id)) {
        const dev = map.get(id);
        if (entry && typeof entry === 'object') {
          if (entry.size) {
            dev.size = entry.size;
            if (dev.type === 'dimmer' || dev.type === 'slider' || dev.type === 'fan') {
              dev.sliderStyle = entry.size === 'l' ? 'bar' : 'surface';
            }
          }
          if (entry.rightControl) dev.rightControl = entry.rightControl;
        }
        next.push(dev);
        map.delete(id);
      }
    }
    for (const leftover of map.values()) next.push(leftover);
    space.devices = next;
  }

  sendSpaceLayout(spaceId, items) {
    this.applyLocalReorder(spaceId, items);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'space:layout', spaceId, items }));
    } else {
      fetch('/api/spaces/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ spaceId, items }),
      }).catch(() => {});
      this.connectWebSocket();
    }
  }

  sendDeviceReorder(spaceId, deviceIds) {
    this.sendSpaceLayout(spaceId, deviceIds);
  }

  /**
   * Optimistik UI güncellemesi + WebSocket (veya HTTP Fallback) üzerinden yayın
   */
  sendDeviceUpdate(spaceId, deviceId, patch, throttleMs = 0) {
    // Dokunulduğu anda ekranı 0ms gecikmeyle güncelle
    if (throttleMs === 0) {
      this.applyOptimisticPatch(spaceId, deviceId, patch);
    }

    const sendNow = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'device:update', spaceId, deviceId, patch }));
      } else {
        fetch('/api/devices/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ spaceId, deviceId, patch }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.device) {
              this.applyLocalDeviceUpdate(data.spaceId, data.deviceId, data.device);
              this.notify({
                type: 'device:updated',
                spaceId: data.spaceId,
                deviceId: data.deviceId,
                device: data.device,
              });
            }
          })
          .catch(() => {});
        this.connectWebSocket();
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
    } else {
      fetch('/api/scenes/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sceneId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((snapshot) => {
          if (snapshot?.spaces) {
            this.snapshot = snapshot;
            this.notify({ type: 'state:snapshot' });
          }
        })
        .catch(() => {});
      this.connectWebSocket();
    }
  }
}

export const store = new ClientStateStore();
