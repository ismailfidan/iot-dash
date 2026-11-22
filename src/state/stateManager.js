import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPACES_CONFIG, SCENES_CONFIG } from '../../config/spaces.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYOUT_FILE_PATH = path.join(__dirname, '../../data/layout.json');

/**
 * Merkezi Durum Yöneticisi (State Store)
 * Tüm bağlı tarayıcılar arasında anlık senkronizasyon sağlar.
 * Gelecekte ESP32 Ana Merkez (/ws/hub) bağlandığında doğrudan bu store üzerinden
 * çift yönlü (bidirectional) senkronizasyon yapılacaktır.
 */
class StateManager extends EventEmitter {
  constructor() {
    super();
    this.spaces = structuredClone(SPACES_CONFIG);
    this.scenes = structuredClone(SCENES_CONFIG);
    this.activeScene = 'home';
    this.hubConnected = false; // Gerçek ESP32 Ana Merkez bağlı mı?
    this.lastSyncAt = Date.now();
    this.loadLayoutFromDisk();
  }

  loadLayoutFromDisk() {
    try {
      if (!fs.existsSync(LAYOUT_FILE_PATH)) return;
      const raw = fs.readFileSync(LAYOUT_FILE_PATH, 'utf8');
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;

      for (const space of this.spaces) {
        const items = saved[space.id];
        if (!Array.isArray(items)) continue;
        this.applySpaceLayoutItems(space, items);
      }
    } catch {
      // Bozuk veya okunamayan layout dosyasında varsayılan config ile devam et
    }
  }

  saveLayoutToDisk() {
    try {
      const dir = path.dirname(LAYOUT_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {};
      for (const space of this.spaces) {
        data[space.id] = space.devices.map((d) => ({
          id: d.id,
          size: d.size || 'm',
          rightControl: d.rightControl || 'metric',
        }));
      }
      fs.writeFileSync(LAYOUT_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // Disk yazma hatası olursa çalışma zamanını kesme
    }
  }

  applySpaceLayoutItems(space, items) {
    const deviceMap = new Map(space.devices.map((d) => [d.id, d]));
    const reordered = [];

    for (const entry of items) {
      const id = typeof entry === 'string' ? entry : entry?.id;
      if (!id || !deviceMap.has(id)) continue;
      const dev = deviceMap.get(id);
      deviceMap.delete(id);

      if (entry && typeof entry === 'object') {
        if (['s', 'm', 'l'].includes(entry.size)) {
          dev.size = entry.size;
          if (dev.type === 'dimmer' || dev.type === 'slider' || dev.type === 'fan') {
            dev.sliderStyle = entry.size === 'l' ? 'bar' : 'surface';
          }
        }
        if (['metric', 'power'].includes(entry.rightControl)) {
          dev.rightControl = entry.rightControl;
        }
      }
      reordered.push(dev);
    }

    for (const leftover of deviceMap.values()) {
      reordered.push(leftover);
    }
    space.devices = reordered;
  }

  getSnapshot() {
    return {
      spaces: this.spaces,
      scenes: this.scenes,
      activeScene: this.activeScene,
      hubConnected: this.hubConnected,
      lastSyncAt: this.lastSyncAt,
      mode: this.hubConnected ? 'live-esp32' : 'design-simulation',
    };
  }

  /**
   * Tek bir cihazın durumunu günceller ve tüm istemcilere yayınlar
   */
  updateDevice(spaceId, deviceId, patch, source = 'client') {
    const space = this.spaces.find((s) => s.id === spaceId);
    if (!space) return null;

    const device = space.devices.find((d) => d.id === deviceId);
    if (!device) return null;

    // Güvenli alan bazlı güncelleme (whitelist)
    if (typeof patch.on === 'boolean') {
      device.on = patch.on;
      if (device.type === 'fan') {
        if (!device.on) {
          if (device.pwm > 0) device.lastPwm = device.pwm;
          device.speed = 0;
          device.pwm = 0;
        } else if (device.pwm === 0) {
          const restored = device.lastPwm || 50;
          device.pwm = restored;
          device.speed = restored <= 35 ? 1 : restored <= 70 ? 2 : 3;
        }
      } else if (device.type === 'dimmer' || device.type === 'slider') {
        if (!device.on) {
          if (device.value > 0) device.lastValue = device.value;
          device.value = 0;
        } else if (device.value === 0) {
          device.value = device.lastValue || 80;
        }
      }
    }

    if (typeof patch.value === 'number' && Number.isFinite(patch.value)) {
      const min = device.min ?? 0;
      const max = device.max ?? 100;
      device.value = Math.max(min, Math.min(max, Math.round(patch.value)));
      device.on = device.value > 0;
    }

    if (device.type === 'fan') {
      if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) {
        const clamped = Math.max(0, Math.min(3, Math.round(patch.speed)));
        device.speed = clamped;
        device.on = clamped > 0;
        const speedToPwm = { 0: 0, 1: 30, 2: 55, 3: 90 };
        if (typeof patch.pwm !== 'number') {
          device.pwm = speedToPwm[clamped];
        }
      }
      if (typeof patch.pwm === 'number' && Number.isFinite(patch.pwm)) {
        device.pwm = Math.max(0, Math.min(100, Math.round(patch.pwm)));
        device.on = device.pwm > 0;
        if (device.pwm === 0) device.speed = 0;
        else if (device.pwm <= 35) device.speed = 1;
        else if (device.pwm <= 70) device.speed = 2;
        else device.speed = 3;
      }
    }

    if (device.type === 'climate') {
      if (typeof patch.targetTemp === 'number' && Number.isFinite(patch.targetTemp)) {
        const min = device.min ?? 16;
        const max = device.max ?? 30;
        device.targetTemp = Math.max(min, Math.min(max, Math.round(patch.targetTemp)));
        device.on = true;
      }
      if (typeof patch.mode === 'string' && ['cool', 'heat', 'dry', 'auto'].includes(patch.mode)) {
        device.mode = patch.mode;
        device.on = true;
      }
    }

    this.activeScene = null;
    this.lastSyncAt = Date.now();

    const eventPayload = {
      type: 'device:updated',
      spaceId,
      deviceId,
      device: structuredClone(device),
      source,
      timestamp: this.lastSyncAt,
    };

    this.emit('state:changed', eventPayload);
    return eventPayload;
  }

  /**
   * Bir odadaki cihaz kartlarının sıralamasını, boyutlarını (s/m/l) ve sağ kontrol stillerini günceller
   */
  saveSpaceLayout(spaceId, items, source = 'client') {
    const space = this.spaces.find((s) => s.id === spaceId);
    if (!space || !Array.isArray(items)) return null;

    this.applySpaceLayoutItems(space, items);
    this.saveLayoutToDisk();
    this.lastSyncAt = Date.now();

    const payload = {
      type: 'space:layout',
      spaceId,
      devices: structuredClone(space.devices),
      source,
      timestamp: this.lastSyncAt,
    };

    this.emit('state:changed', payload);
    return payload;
  }

  /**
   * Geriye dönük uyumluluk: yalnızca ID dizisiyle sıralama
   */
  reorderDevices(spaceId, deviceIds, source = 'client') {
    return this.saveSpaceLayout(spaceId, deviceIds, source);
  }

  /**
   * Hazır senaryo uygular
   */
  applyScene(sceneId, source = 'client') {
    const exists = this.scenes.some((s) => s.id === sceneId);
    if (!exists) return null;

    for (const space of this.spaces) {
      for (const device of space.devices) {
        if (sceneId === 'all-off') {
          device.on = false;
          if (device.type === 'fan') {
            device.speed = 0;
            device.pwm = 0;
            device.autoMode = false;
          }
          if (device.type === 'dimmer') {
            device.value = 0;
          }
        } else if (sceneId === 'away') {
          device.on = false;
          if (device.type === 'fan') {
            device.speed = 0;
            device.pwm = 0;
          }
          if (device.type === 'slider') {
            device.value = 0; // Perde/panjur kapat
          }
        } else if (sceneId === 'night') {
          if (device.id === 'koridor-light-amb') {
            device.on = true;
            device.value = 20;
          } else if (device.id === 'gozcu-camera-power') {
            device.on = true;
          } else if (device.type === 'slider') {
            device.on = false;
            device.value = 0;
          } else {
            device.on = false;
            if (device.type === 'fan') {
              device.speed = 0;
              device.pwm = 0;
            }
          }
        } else if (sceneId === 'home') {
          if (space.id === 'hub-main' || space.id === 'mini-1' || space.id === 'mini-2' || space.id === 'mini-3') {
            if (device.type === 'dimmer') {
              device.on = true;
              device.value = 80;
            } else if (device.type === 'switch' && device.icon !== 'power') {
              device.on = true;
            } else if (device.type === 'slider') {
              device.on = true;
              device.value = 80;
            }
          }
        }
      }
    }

    this.activeScene = sceneId;
    this.lastSyncAt = Date.now();

    const payload = {
      type: 'state:snapshot',
      ...this.getSnapshot(),
      source,
    };

    this.emit('state:changed', payload);
    return payload;
  }

  /**
   * Gelecekteki ESP32 Ana Merkez telemetri & tam senkronizasyon kancası
   */
  setHubConnected(connected) {
    this.hubConnected = connected;
    this.lastSyncAt = Date.now();
    this.emit('state:changed', {
      type: 'hub:status',
      hubConnected: this.hubConnected,
      lastSyncAt: this.lastSyncAt,
    });
  }
}

export const stateManager = new StateManager();
