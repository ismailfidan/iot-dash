import { EventEmitter } from 'node:events';
import { SPACES_CONFIG, SCENES_CONFIG } from '../../config/spaces.config.js';

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
      if (device.type === 'fan' && !device.on) {
        device.speed = 0;
        device.pwm = 0;
      } else if (device.type === 'fan' && device.on && device.speed === 0) {
        device.speed = 1;
        device.pwm = 30;
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
        const clamped = Math.max(0, Math.min(4, Math.round(patch.speed)));
        device.speed = clamped;
        device.on = clamped > 0;
        const speedToPwm = { 0: 0, 1: 30, 2: 55, 3: 90, 4: 65 };
        if (typeof patch.pwm !== 'number') {
          device.pwm = speedToPwm[clamped];
        }
        device.autoMode = clamped === 4;
      }
      if (typeof patch.pwm === 'number' && Number.isFinite(patch.pwm)) {
        device.pwm = Math.max(0, Math.min(100, Math.round(patch.pwm)));
        device.on = device.pwm > 0;
        if (device.pwm === 0) device.speed = 0;
        else if (device.pwm <= 35) device.speed = 1;
        else if (device.pwm <= 70) device.speed = 2;
        else device.speed = 3;
        device.autoMode = false;
      }
      if (typeof patch.autoMode === 'boolean') {
        device.autoMode = patch.autoMode;
        if (patch.autoMode) {
          device.on = true;
          device.speed = 4;
          device.pwm = 65;
        }
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
          if (device.id === 'bedroom-lamp-night') {
            device.on = true;
            device.value = 15;
          } else if (device.id === 'bedroom-fan') {
            device.on = true;
            device.speed = 1;
            device.pwm = 25;
            device.autoMode = true;
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
          if (space.id === 'hub-main' || space.id === 'mini-1') {
            if (device.type === 'dimmer') {
              device.on = true;
              device.value = 70;
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
