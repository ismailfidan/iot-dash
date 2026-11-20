import { getIcon } from './icons.js';
import { store } from './state.js';

const FAN_LABELS = ['Kapalı', 'Düşük', 'Orta', 'Yüksek', 'Oto'];

function getFanDuration(device) {
  if (!device.on || device.pwm === 0) return null;
  // PWM yükseldikçe dönüş hızlanır (1.8s -> 0.35s)
  const duration = Math.max(0.35, 1.9 - (device.pwm / 100) * 1.55);
  return `${duration.toFixed(2)}s`;
}

function getDeviceStateText(device) {
  if (device.type === 'switch') {
    return device.on ? 'Açık' : 'Kapalı';
  }
  if (device.type === 'dimmer') {
    return device.on ? `Parlaklık %${device.value}` : 'Kapalı';
  }
  if (device.type === 'slider') {
    return device.value === 0 ? 'Tam Kapalı' : `%${device.value} Açık`;
  }
  if (device.type === 'fan') {
    if (!device.on || device.speed === 0) return 'Kapalı';
    return `${FAN_LABELS[device.speed] || 'Açık'} • %${device.pwm} PWM`;
  }
  return '';
}

/**
 * Yan Menü Navigasyonu
 */
export function renderNavigation(navEl, snapshot, activeFilter) {
  const activeCountTotal = snapshot.spaces.reduce(
    (acc, s) => acc + s.devices.filter((d) => d.on).length,
    0
  );

  let html = `
    <button type="button" class="nav-item ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">
      <span class="nav-item-left">
        ${getIcon('grid')}
        <span class="nav-item-label">Tüm Alanlar</span>
      </span>
      <span class="nav-badge">${activeCountTotal}</span>
    </button>
    <div class="nav-divider"></div>
  `;

  for (const space of snapshot.spaces) {
    const activeCount = space.devices.filter((d) => d.on).length;
    html += `
      <button type="button" class="nav-item ${activeFilter === space.id ? 'active' : ''}" data-filter="${space.id}">
        <span class="nav-item-left">
          ${getIcon(space.icon)}
          <span class="nav-item-label">${space.name}</span>
        </span>
        <span class="nav-badge">${activeCount}</span>
      </button>
    `;
  }

  html += `
    <div class="nav-divider"></div>
    <button type="button" class="nav-item ${activeFilter === 'topology' ? 'active' : ''}" data-filter="topology">
      <span class="nav-item-left">
        ${getIcon('cpu')}
        <span class="nav-item-label">ESP-NOW Ağı (1+4)</span>
      </span>
      <span class="nav-badge">5</span>
    </button>
  `;

  navEl.innerHTML = html;
}

/**
 * Hızlı Senaryo Kartları
 */
export function renderScenes(scenesEl, snapshot) {
  scenesEl.innerHTML = snapshot.scenes
    .map(
      (scene) => `
      <button type="button" class="scene-card ${snapshot.activeScene === scene.id ? 'active' : ''}" data-scene-id="${scene.id}">
        <div class="scene-icon">${getIcon(scene.icon)}</div>
        <div class="scene-meta">
          <span class="scene-name">${scene.name}</span>
          <span class="scene-desc">${scene.description}</span>
        </div>
      </button>
    `
    )
    .join('');
}

/**
 * Tekil Cihaz Kartı HTML'i
 */
function buildDeviceCardHTML(spaceId, device) {
  const isFanSpinning = device.type === 'fan' && device.on && device.pwm > 0;
  const fanDur = isFanSpinning ? getFanDuration(device) : null;
  const iconClass = isFanSpinning ? 'fan-spinning' : '';
  const iconStyle = fanDur ? `style="--fan-duration:${fanDur}"` : '';

  let controlsHTML = '';

  if (device.type === 'dimmer' || device.type === 'slider') {
    const val = device.value ?? 0;
    const label = device.type === 'dimmer' ? 'Parlaklık' : 'Konum';
    controlsHTML = `
      <div class="slider-wrap">
        <div class="slider-header">
          <span>${label}</span>
          <span class="slider-val" data-role="slider-val">%${val}</span>
        </div>
        <input
          type="range"
          class="range-slider"
          min="${device.min ?? 0}"
          max="${device.max ?? 100}"
          value="${val}"
          style="--slider-pct:${val}%"
          data-action="slider"
          data-space-id="${spaceId}"
          data-device-id="${device.id}"
          aria-label="${device.name} ${label}"
        />
      </div>
    `;
  } else if (device.type === 'fan') {
    const stepsHTML = FAN_LABELS.map(
      (lbl, idx) => `
        <button
          type="button"
          class="fan-step-btn ${device.speed === idx ? 'active' : ''}"
          data-action="fan-step"
          data-speed="${idx}"
          data-space-id="${spaceId}"
          data-device-id="${device.id}"
        >${lbl}</button>
      `
    ).join('');

    controlsHTML = `
      <div class="fan-steps">${stepsHTML}</div>
      <div class="slider-wrap">
        <div class="slider-header">
          <span>Hassas PWM Hızı</span>
          <span class="slider-val" data-role="slider-val">%${device.pwm}</span>
        </div>
        <input
          type="range"
          class="range-slider"
          min="0"
          max="100"
          value="${device.pwm}"
          style="--slider-pct:${device.pwm}%"
          data-action="fan-pwm"
          data-space-id="${spaceId}"
          data-device-id="${device.id}"
          aria-label="${device.name} PWM Hızı"
        />
      </div>
    `;
  }

  return `
    <article class="device-card ${device.on ? 'is-on' : ''}" data-device-card="${device.id}" data-space-id="${spaceId}" data-type="${device.type}">
      <div class="device-top">
        <div class="device-identity">
          <div class="device-icon" ${iconStyle}>
            ${getIcon(device.icon, iconClass)}
          </div>
          <div class="device-info">
            <span class="device-name">${device.name}</span>
            <span class="device-state-text" data-role="state-text">${getDeviceStateText(device)}</span>
          </div>
        </div>

        <label class="switch-control" aria-label="${device.name} Aç/Kapat">
          <input
            type="checkbox"
            ${device.on ? 'checked' : ''}
            data-action="toggle"
            data-space-id="${spaceId}"
            data-device-id="${device.id}"
          />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
      </div>
      ${controlsHTML}
    </article>
  `;
}

/**
 * Tek bir cihaz kartını DOM'da sıfırdan çizmeden akıcı şekilde günceller
 */
export function patchDeviceCard(deviceId, device) {
  const card = document.querySelector(`[data-device-card="${deviceId}"]`);
  if (!card) return;

  card.classList.toggle('is-on', Boolean(device.on));

  const stateTextEl = card.querySelector('[data-role="state-text"]');
  if (stateTextEl) stateTextEl.textContent = getDeviceStateText(device);

  const toggleEl = card.querySelector('input[data-action="toggle"]');
  if (toggleEl) toggleEl.checked = Boolean(device.on);

  const sliderEl = card.querySelector('input[type="range"]');
  const sliderValEl = card.querySelector('[data-role="slider-val"]');
  if (sliderEl) {
    const val = device.type === 'fan' ? device.pwm : device.value;
    if (document.activeElement !== sliderEl) {
      sliderEl.value = val;
    }
    sliderEl.style.setProperty('--slider-pct', `${val}%`);
    if (sliderValEl) sliderValEl.textContent = `%${val}`;
  }

  if (device.type === 'fan') {
    const iconBox = card.querySelector('.device-icon');
    const svg = iconBox?.querySelector('svg');
    const dur = getFanDuration(device);
    if (svg && iconBox) {
      if (dur) {
        svg.classList.add('fan-spinning');
        iconBox.style.setProperty('--fan-duration', dur);
      } else {
        svg.classList.remove('fan-spinning');
        iconBox.style.removeProperty('--fan-duration');
      }
    }

    card.querySelectorAll('.fan-step-btn').forEach((btn) => {
      const idx = Number(btn.dataset.speed);
      btn.classList.toggle('active', device.speed === idx);
    });
  }
}

/**
 * Yaşam Alanları veya ESP-NOW Topolojisi Görünümü
 */
export function renderDashboardContent(containerEl, snapshot, activeFilter) {
  if (activeFilter === 'topology') {
    containerEl.innerHTML = `
      <div class="topology-grid">
        ${snapshot.spaces
          .map((space) => {
            const isGw = space.node.role === 'gateway';
            return `
              <article class="node-card ${isGw ? 'is-gateway' : ''}">
                <div class="node-card-head">
                  <div class="space-title-group">
                    <div class="space-icon-box">${getIcon(space.icon)}</div>
                    <div>
                      <h3>${space.name}</h3>
                      <p class="space-subtitle">${space.node.nodeId}</p>
                    </div>
                  </div>
                  <span class="node-role-badge">${isGw ? 'ANA MERKEZ' : 'MİNİ MERKEZ'}</span>
                </div>

                <div class="node-meta-list">
                  <div class="node-meta-row"><span>Protokol</span><code>${space.node.protocol}</code></div>
                  <div class="node-meta-row"><span>MAC Adresi</span><code>${space.node.macAddress}</code></div>
                  <div class="node-meta-row"><span>Sinyal (RSSI)</span><code>${space.node.rssi} dBm</code></div>
                  <div class="node-meta-row"><span>Cihaz Sayısı</span><code>${space.devices.length} Bileşen</code></div>
                  <div class="node-meta-row"><span>Senkronizasyon</span><code>${snapshot.hubConnected ? 'Canlı ESP32' : 'Tasarım Modu'}</code></div>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;
    return;
  }

  const visibleSpaces =
    activeFilter === 'all'
      ? snapshot.spaces
      : snapshot.spaces.filter((s) => s.id === activeFilter);

  containerEl.innerHTML = `
    <div class="spaces-stack">
      ${visibleSpaces
        .map(
          (space) => `
          <section class="space-section" data-space-section="${space.id}">
            <header class="space-header">
              <div class="space-title-group">
                <div class="space-icon-box">${getIcon(space.icon)}</div>
                <div>
                  <h3>${space.name}</h3>
                  <p class="space-subtitle">${space.subtitle}</p>
                </div>
              </div>

              <div class="space-telemetry">
                <span class="sensor-pill">${getIcon('thermometer')} <strong>${space.sensors.temperature.toFixed(1)}°C</strong></span>
                <span class="sensor-pill">${getIcon('humidity')} <strong>%${space.sensors.humidity}</strong></span>
                <span class="node-pill">${getIcon('wifi')} ${space.node.rssi} dBm</span>
              </div>
            </header>

            <div class="devices-grid">
              ${space.devices.map((dev) => buildDeviceCardHTML(space.id, dev)).join('')}
            </div>
          </section>
        `
        )
        .join('')}
    </div>
  `;
}

/**
 * Etkileşim Olaylarını Bağla (Event Delegation — yüksek performans)
 */
export function bindDashboardEvents(containerEl, scenesEl, navEl) {
  navEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    store.setFilter(btn.dataset.filter);
  });

  scenesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scene-id]');
    if (!btn) return;
    store.sendSceneApply(btn.dataset.sceneId);
  });

  // Switch & Fan kademe butonları
  containerEl.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset.action === 'toggle') {
      store.sendDeviceUpdate(target.dataset.spaceId, target.dataset.deviceId, {
        on: target.checked,
      });
    }
  });

  containerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="fan-step"]');
    if (!btn) return;
    store.sendDeviceUpdate(btn.dataset.spaceId, btn.dataset.deviceId, {
      speed: Number(btn.dataset.speed),
    });
  });

  // Slider sürüklerken anlık görsel akıcılık + 60ms throttle ile WebSocket gönderimi
  containerEl.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    if (action !== 'slider' && action !== 'fan-pwm') return;

    const val = Number(target.value);
    target.style.setProperty('--slider-pct', `${val}%`);
    const valLabel = target.closest('.slider-wrap')?.querySelector('[data-role="slider-val"]');
    if (valLabel) valLabel.textContent = `%${val}`;

    const patch = action === 'fan-pwm' ? { pwm: val } : { value: val };
    store.sendDeviceUpdate(target.dataset.spaceId, target.dataset.deviceId, patch, 60);
  });
}
