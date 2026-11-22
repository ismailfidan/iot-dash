import { getIcon } from './icons.js';
import { store } from './state.js';

const FAN_LABELS = ['Kapalı', 'Düşük', 'Orta', 'Yüksek'];
const CLIMATE_MODES = [
  { id: 'cool', label: 'Soğut', icon: 'climate' },
  { id: 'heat', label: 'Isıt', icon: 'flame' },
  { id: 'dry', label: 'Nem', icon: 'droplet' },
  { id: 'auto', label: 'Oto', icon: 'sparkle' },
];

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
    if (!device.on || !device.pwm) return 'Kapalı';
    return `Hız: %${device.pwm}`;
  }
  if (device.type === 'climate') {
    if (!device.on) return 'Kapalı';
    const modeObj = CLIMATE_MODES.find((m) => m.id === device.mode);
    return `${modeObj ? modeObj.label : 'Açık'} • ${device.targetTemp}°C`;
  }
  return '';
}

/**
 * Yan Menü Navigasyonu (Kiosk Sırası: Odalar üstte, Tüm Alanlar & ESP-NOW altta)
 */
export function renderNavigation(navEl, snapshot, activeFilter) {
  let html = '';

  for (const space of snapshot.spaces) {
    const activeCount = space.devices.filter((d) => d.on).length;
    const hasActive = activeCount > 0;
    const accent = space.theme?.accent || '#38bdf8';
    const glow = space.theme?.glow || 'rgba(56, 189, 248, 0.22)';
    const badgeHTML = hasActive ? `<span class="nav-badge">${activeCount}</span>` : '';
    html += `
      <button
        type="button"
        class="nav-item ${activeFilter === space.id ? 'active' : ''} ${hasActive ? 'has-active' : ''}"
        data-filter="${space.id}"
        title="${space.name}${hasActive ? ` (${activeCount} Aktif)` : ''}"
        style="--space-accent:${accent};--space-glow:${glow}"
      >
        <span class="nav-item-left">
          ${getIcon(space.icon)}
          <span class="nav-item-label">${space.name}</span>
        </span>
        ${badgeHTML}
      </button>
    `;
  }

  html += `
    <div class="nav-divider"></div>
    <button type="button" class="nav-item ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" title="Tüm Alanlar">
      <span class="nav-item-left">
        ${getIcon('grid')}
        <span class="nav-item-label">Tüm Alanlar</span>
      </span>
    </button>
    <button type="button" class="nav-item ${activeFilter === 'topology' ? 'active' : ''}" data-filter="topology" title="ESP-NOW Ağı">
      <span class="nav-item-left">
        ${getIcon('cpu')}
        <span class="nav-item-label">ESP-NOW Ağı</span>
      </span>
    </button>
  `;

  navEl.innerHTML = html;
}

/**
 * Üst Çubuk Kompakt İkonlu Hızlı Senaryo Butonları
 */
export function renderScenes(scenesEl, snapshot) {
  scenesEl.innerHTML = snapshot.scenes
    .map(
      (scene) => `
      <button
        type="button"
        class="topbar-scene-btn ${snapshot.activeScene === scene.id ? 'active' : ''}"
        data-scene-id="${scene.id}"
        title="${scene.name} — ${scene.description}"
        aria-label="${scene.name}"
      >
        ${getIcon(scene.icon)}
      </button>
    `
    )
    .join('');
}

/**
 * Tekil Cihaz Kartı HTML'i
 */
function getDeviceMetricText(device) {
  if (device.type === 'dimmer' || device.type === 'slider') {
    return `%${device.value ?? 0}`;
  }
  if (device.type === 'fan') {
    return `%${device.pwm ?? 0}`;
  }
  if (device.type === 'climate') {
    return `${device.targetTemp ?? 22}°C`;
  }
  return '';
}

function getDeviceDefaultSize(device) {
  if (device.size === 's' || device.size === 'm' || device.size === 'l') {
    return device.size;
  }
  if (device.type === 'climate' || device.sliderStyle === 'bar') return 'l';
  if (device.type === 'switch') return 's';
  return 'm';
}

function getDeviceDefaultRightControl(device) {
  if (device.rightControl === 'metric' || device.rightControl === 'power') {
    return device.rightControl;
  }
  return device.type === 'switch' ? 'power' : 'metric';
}

export function buildDeviceCardHTML(spaceId, device) {
  const size = getDeviceDefaultSize(device);
  const rightControl = getDeviceDefaultRightControl(device);

  const isFanSpinning = device.type === 'fan' && device.on && device.pwm > 0;
  const fanDur = isFanSpinning ? getFanDuration(device) : null;
  const iconClass = isFanSpinning ? 'fan-spinning' : '';
  const iconStyle = fanDur ? `style="--fan-duration:${fanDur}"` : '';

  const isSliderDevice = device.type === 'dimmer' || device.type === 'slider' || device.type === 'fan';
  const isBarSlider = isSliderDevice && size === 'l';
  const isSurfaceSlider = isSliderDevice && !isBarSlider;
  const hasBottomBar = size === 'l';

  let fillPct = 0;
  if (device.on) {
    fillPct = device.type === 'fan' ? (device.pwm ?? 0) : (device.value ?? 0);
  }

  let controlsHTML = '';

  if (size === 'l') {
    if (isSliderDevice) {
      const min = device.min ?? 0;
      const max = device.max ?? 100;
      const actionName = device.type === 'fan' ? 'fan-pwm' : 'slider';
      const ariaText = device.type === 'fan' ? `${device.name} PWM Hızı` : `${device.name} Seviyesi`;
      controlsHTML = `
        <div class="slider-wrap">
          <div class="touch-slider" style="--slider-pct:${fillPct}%" data-zero="${fillPct <= 0}">
            <div class="touch-slider-fill">
              <span class="touch-slider-handle"></span>
            </div>
            <input
              type="range"
              class="range-slider"
              min="${min}"
              max="${max}"
              value="${fillPct}"
              data-action="${actionName}"
              data-space-id="${spaceId}"
              data-device-id="${device.id}"
              aria-label="${ariaText}"
            />
          </div>
        </div>
      `;
    } else if (device.type === 'climate') {
      const min = device.min ?? 16;
      const max = device.max ?? 30;
      const pct = Math.round(((device.targetTemp - min) / (max - min)) * 100);

      controlsHTML = `
        <div class="slider-wrap">
          <div class="climate-bar" data-climate-bar>
            <button type="button" class="climate-step-btn" data-action="climate-temp" data-delta="-1" data-space-id="${spaceId}" data-device-id="${device.id}" aria-label="Sıcaklığı Azalt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
            <div class="climate-meter">
              <div class="climate-meter-fill" data-role="climate-fill" style="width:${pct}%"></div>
              <span class="climate-meter-text" data-role="climate-meter-text">${device.targetTemp}°C</span>
            </div>
            <button type="button" class="climate-step-btn" data-action="climate-temp" data-delta="1" data-space-id="${spaceId}" data-device-id="${device.id}" aria-label="Sıcaklığı Artır"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>
          </div>
        </div>
      `;
    } else if (device.type === 'switch') {
      controlsHTML = `
        <div class="slider-wrap">
          <div class="large-switch-bar">
            <span class="large-switch-dot"></span>
            <span data-role="large-switch-text">${device.on ? 'Devrede • Kapatmak için dokun' : 'Beklemede • Açmak için dokun'}</span>
          </div>
        </div>
      `;
    }
  }

  const hasPowerBox = rightControl === 'power';
  const metricText = getDeviceMetricText(device);
  let rightSideHTML = '';
  if (hasPowerBox) {
    rightSideHTML = `
      <button
        type="button"
        class="card-power-btn"
        data-action="power-toggle"
        data-space-id="${spaceId}"
        data-device-id="${device.id}"
        title="Aç / Kapat"
        aria-label="${device.name} Aç / Kapat"
      >
        ${getIcon('power')}
      </button>
    `;
  } else if (metricText) {
    rightSideHTML = `<span class="device-metric" data-role="device-metric">${metricText}</span>`;
  }

  let subtitleHTML = `<span class="device-state-text" data-role="state-text">${getDeviceStateText(device)}</span>`;

  if (device.type === 'fan' && size === 'l') {
    const activeSpeed = device.on ? (device.speed ?? 0) : 0;
    subtitleHTML = `<div class="fan-steps">${[0, 1, 2, 3]
      .map(
        (spd) => `
      <button
        type="button"
        class="fan-step-btn ${activeSpeed === spd ? 'active' : ''}"
        data-action="fan-step"
        data-speed="${spd}"
        data-space-id="${spaceId}"
        data-device-id="${device.id}"
        title="${FAN_LABELS[spd]}"
        aria-label="Fan Kademe ${spd}"
      >${spd}</button>
    `
      )
      .join('')}</div>`;
  } else if (device.type === 'climate' && size !== 's') {
    subtitleHTML = `<div class="climate-modes">${CLIMATE_MODES.map(
      (m) => `
      <button
        type="button"
        class="climate-mode-btn ${device.mode === m.id ? 'active' : ''}"
        data-action="climate-mode"
        data-mode="${m.id}"
        data-space-id="${spaceId}"
        data-device-id="${device.id}"
        title="${m.label}"
        aria-label="${m.label}"
      >${getIcon(m.icon)}</button>
    `
    ).join('')}</div>`;
  }

  const showRightToggle = device.type !== 'switch';

  return `
    <article
      class="device-card ${device.on ? 'is-on' : ''} ${isSurfaceSlider ? 'has-surface-slider' : ''} ${hasBottomBar ? 'has-bottom-bar' : ''}"
      data-device-card="${device.id}"
      data-space-id="${spaceId}"
      data-type="${device.type}"
      data-size="${size}"
      data-right-control="${rightControl}"
    >
      ${isSurfaceSlider ? `<div class="card-surface-fill" data-role="card-surface-fill" style="width:${fillPct}%"></div>` : ''}
      <div class="card-edit-toolbar" data-edit-toolbar>
        <div class="edit-size-group" role="group" aria-label="Kart Boyutu">
          <button type="button" class="edit-pill-btn ${size === 's' ? 'active' : ''}" data-edit-size="s" title="Küçük (1x1)">S</button>
          <button type="button" class="edit-pill-btn ${size === 'm' ? 'active' : ''}" data-edit-size="m" title="Orta (2x1)">M</button>
          <button type="button" class="edit-pill-btn ${size === 'l' ? 'active' : ''}" data-edit-size="l" title="Büyük (2x2)">L</button>
        </div>
        ${
          showRightToggle
            ? `<button
                type="button"
                class="edit-pill-btn edit-style-btn ${rightControl === 'power' ? 'active' : ''}"
                data-edit-right="${rightControl === 'power' ? 'metric' : 'power'}"
                title="${rightControl === 'power' ? 'Sağ: Güç Butonu (% Göstergeye Geç)' : 'Sağ: % Gösterge (Güç Butonuna Geç)'}"
              >${rightControl === 'power' ? '⏻' : '%'}</button>`
            : ''
        }
        <span class="card-drag-handle" data-drag-handle title="Sürükle ve Sırala">
          ${getIcon('grip')}
        </span>
      </div>
      <div class="device-top">
        <div class="device-identity">
          <div class="device-icon" ${iconStyle}>
            ${getIcon(device.icon, iconClass)}
          </div>
          <div class="device-info">
            <span class="device-name">${device.name}</span>
            ${subtitleHTML}
          </div>
        </div>
        ${rightSideHTML}
      </div>
      ${controlsHTML}
    </article>
  `;
}

/**
 * Yüzey slider'ı (dimmer, fan, slider) sürüklenirken kartın görsel durumunu anlık günceller
 */
function applySurfaceSliderPreview(card, type, pct) {
  const isOn = pct > 0;
  card.classList.toggle('is-on', isOn);

  const fillEl = card.querySelector('[data-role="card-surface-fill"]');
  if (fillEl) {
    fillEl.style.width = `${pct}%`;
  }

  const metricEl = card.querySelector('[data-role="device-metric"]');
  if (metricEl) {
    metricEl.textContent = `%${pct}`;
  }

  const stateTextEl = card.querySelector('[data-role="state-text"]');
  if (stateTextEl) {
    if (type === 'dimmer') {
      stateTextEl.textContent = isOn ? `Parlaklık %${pct}` : 'Kapalı';
    } else if (type === 'slider') {
      stateTextEl.textContent = pct === 0 ? 'Tam Kapalı' : `%${pct} Açık`;
    } else if (type === 'fan') {
      stateTextEl.textContent = isOn ? `Hız: %${pct}` : 'Kapalı';
    }
  }

  if (type === 'fan') {
    const iconBox = card.querySelector('.device-icon');
    const svg = iconBox?.querySelector('svg');
    if (svg && iconBox) {
      if (isOn) {
        const duration = Math.max(0.35, 1.9 - (pct / 100) * 1.55);
        svg.classList.add('fan-spinning');
        iconBox.style.setProperty('--fan-duration', `${duration.toFixed(2)}s`);
      } else {
        svg.classList.remove('fan-spinning');
        iconBox.style.removeProperty('--fan-duration');
      }
    }
  }
}

/**
 * Tek bir cihaz kartını DOM'da sıfırdan çizmeden akıcı şekilde günceller
 */
export function patchDeviceCard(deviceId, device) {
  const card = document.querySelector(`[data-device-card="${deviceId}"]`);
  if (!card) return;

  // Kullanıcı şu an bu kartın yüzeyini parmağıyla/faresiyle sürüklüyorsa anlık sürüklemeyi ezme
  if (card.classList.contains('is-sliding')) return;

  card.classList.toggle('is-on', Boolean(device.on));

  const stateTextEl = card.querySelector('[data-role="state-text"]');
  if (stateTextEl) stateTextEl.textContent = getDeviceStateText(device);

  const metricEl = card.querySelector('[data-role="device-metric"]');
  if (metricEl) metricEl.textContent = getDeviceMetricText(device);

  const largeSwitchTextEl = card.querySelector('[data-role="large-switch-text"]');
  if (largeSwitchTextEl) {
    largeSwitchTextEl.textContent = device.on
      ? 'Devrede • Kapatmak için dokun'
      : 'Beklemede • Açmak için dokun';
  }

  const surfaceFillEl = card.querySelector('[data-role="card-surface-fill"]');
  if (surfaceFillEl) {
    let fillPct = 0;
    if (device.on) {
      fillPct = device.type === 'fan' ? (device.pwm ?? 0) : (device.value ?? 0);
    }
    surfaceFillEl.style.width = `${fillPct}%`;
  }

  const sliderEl = card.querySelector('input[type="range"]');
  const touchSliderEl = card.querySelector('.touch-slider');
  if (sliderEl) {
    const val = device.on ? (device.type === 'fan' ? (device.pwm ?? 0) : (device.value ?? 0)) : 0;
    if (document.activeElement !== sliderEl) {
      sliderEl.value = val;
    }
    if (touchSliderEl) {
      touchSliderEl.style.setProperty('--slider-pct', `${val}%`);
      touchSliderEl.dataset.zero = String(val <= 0);
    }
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

    const activeSpeed = device.on ? (device.speed ?? 0) : 0;
    card.querySelectorAll('.fan-step-btn').forEach((btn) => {
      const idx = Number(btn.dataset.speed);
      btn.classList.toggle('active', activeSpeed === idx);
    });
  }

  if (device.type === 'climate') {
    const tempEl = card.querySelector('[data-role="climate-temp"]');
    const meterText = card.querySelector('[data-role="climate-meter-text"]');
    const fillEl = card.querySelector('[data-role="climate-fill"]');
    if (tempEl) tempEl.textContent = `${device.targetTemp}°C`;
    if (meterText) meterText.textContent = `${device.targetTemp}°C`;
    if (fillEl) {
      const min = device.min ?? 16;
      const max = device.max ?? 30;
      const pct = Math.round(((device.targetTemp - min) / (max - min)) * 100);
      fillEl.style.width = `${pct}%`;
    }
    card.querySelectorAll('[data-action="climate-mode"]').forEach((btn) => {
      btn.classList.toggle('active', device.mode === btn.dataset.mode);
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
            const accent = space.theme?.accent || '#38bdf8';
            const glow = space.theme?.glow || 'rgba(56, 189, 248, 0.22)';
            return `
              <article class="node-card ${isGw ? 'is-gateway' : ''}" style="--space-accent:${accent};--space-glow:${glow}">
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

  const isSingleRoom = activeFilter !== 'all';

  containerEl.innerHTML = `
    <div class="spaces-stack ${isSingleRoom ? 'is-single-room' : ''}">
      ${visibleSpaces
        .map((space) => {
          const accent = space.theme?.accent || '#38bdf8';
          const glow = space.theme?.glow || 'rgba(56, 189, 248, 0.22)';
          const headerHTML = isSingleRoom
            ? ''
            : `
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
          `;
          return `
          <section class="space-section" data-space-section="${space.id}" style="--space-accent:${accent};--space-glow:${glow}">
            ${headerHTML}
            <div class="devices-grid">
              ${space.devices.map((dev) => buildDeviceCardHTML(space.id, dev)).join('')}
            </div>
          </section>
        `;
        })
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

  let justDragged = false;

  // Kart üstüne basınca aç/kapa, Klima butonları & Düzenleme Modu Boyut/Stil Seçicileri
  containerEl.addEventListener('click', (e) => {
    if (justDragged) {
      e.preventDefault();
      return;
    }

    if (document.body.classList.contains('is-edit-mode')) {
      const sizeBtn = e.target.closest('[data-edit-size]');
      const rightBtn = e.target.closest('[data-edit-right]');
      if (!sizeBtn && !rightBtn) {
        e.preventDefault();
        return;
      }

      const card = e.target.closest('[data-device-card]');
      if (!card) return;
      const spaceId = card.dataset.spaceId;
      const deviceId = card.dataset.deviceCard;
      const nextSize = sizeBtn ? sizeBtn.dataset.editSize : card.dataset.size || 'm';
      const nextRight = rightBtn ? rightBtn.dataset.editRight : card.dataset.rightControl || 'metric';

      const space = store.snapshot?.spaces?.find((s) => s.id === spaceId);
      const baseDevice = space?.devices?.find((d) => d.id === deviceId);
      if (!baseDevice) return;

      const previewDevice = {
        ...baseDevice,
        size: nextSize,
        rightControl: nextRight,
        sliderStyle: nextSize === 'l' ? 'bar' : 'surface',
      };
      card.outerHTML = buildDeviceCardHTML(spaceId, previewDevice);
      return;
    }

    const fanBtn = e.target.closest('[data-action="fan-step"]');
    if (fanBtn) {
      store.sendDeviceUpdate(fanBtn.dataset.spaceId, fanBtn.dataset.deviceId, {
        speed: Number(fanBtn.dataset.speed),
      });
      return;
    }

    const climateModeBtn = e.target.closest('[data-action="climate-mode"]');
    if (climateModeBtn) {
      store.sendDeviceUpdate(climateModeBtn.dataset.spaceId, climateModeBtn.dataset.deviceId, {
        mode: climateModeBtn.dataset.mode,
      });
      return;
    }

    const climateTempBtn = e.target.closest('[data-action="climate-temp"]');
    if (climateTempBtn) {
      const card = climateTempBtn.closest('[data-device-card]');
      const currentText = card?.querySelector('[data-role="device-metric"]')?.textContent || '22';
      const currentTemp = parseInt(currentText, 10) || 22;
      const delta = Number(climateTempBtn.dataset.delta);
      store.sendDeviceUpdate(climateTempBtn.dataset.spaceId, climateTempBtn.dataset.deviceId, {
        targetTemp: currentTemp + delta,
      });
      return;
    }

    if (e.target.closest('.touch-slider, .fan-steps, .climate-modes, .climate-bar, [data-drag-handle]')) return;

    const card = e.target.closest('[data-device-card]');
    if (!card) return;

    const isCurrentlyOn = card.classList.contains('is-on');
    store.sendDeviceUpdate(card.dataset.spaceId, card.dataset.deviceCard, {
      on: !isCurrentlyOn,
    });
  });

  // Alt bar tipi (.touch-slider / sliderStyle: 'bar') kartlar için anlık sürükleme + 60ms throttle
  containerEl.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    if (action !== 'slider' && action !== 'fan-pwm') return;

    const val = Number(target.value);
    const touchSlider = target.closest('.touch-slider');
    if (touchSlider) {
      touchSlider.style.setProperty('--slider-pct', `${val}%`);
      touchSlider.dataset.zero = String(val <= 0);
    }
    const card = target.closest('[data-device-card]');
    if (card) {
      card.classList.toggle('is-on', val > 0);
    }
    const metricEl = card?.querySelector('[data-role="device-metric"]');
    if (metricEl) metricEl.textContent = `%${val}`;

    if (action === 'fan-pwm' && card) {
      const liveSpeed = val === 0 ? 0 : val <= 35 ? 1 : val <= 70 ? 2 : 3;
      card.querySelectorAll('.fan-step-btn').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.speed) === liveSpeed);
      });
    }

    const patch = action === 'fan-pwm' ? { pwm: val } : { value: val };
    store.sendDeviceUpdate(target.dataset.spaceId, target.dataset.deviceId, patch, 60);
  });

  // --- 1) Normal Mod: Tam Yüzey Arka Plan Slider (dimmer, fan, slider) ---
  // --- 2) Düzenleme Modu (body.is-edit-mode): Kart Sürükle-Bırak Sıralama ---
  let slideState = null;
  let dragState = null;

  function getCardCurrentPct(card) {
    if (!card.classList.contains('is-on')) return 0;
    const fillEl = card.querySelector('[data-role="card-surface-fill"]');
    const parsed = parseFloat(fillEl?.style.width);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
  }

  function finishSurfaceSlide() {
    if (!slideState) return;
    if (slideState.active) {
      slideState.card.classList.remove('is-sliding');
      const patch =
        slideState.type === 'fan' ? { pwm: slideState.currentPct } : { value: slideState.currentPct };
      store.sendDeviceUpdate(slideState.spaceId, slideState.deviceId, patch, 0);

      justDragged = true;
      setTimeout(() => {
        justDragged = false;
      }, 120);
    }
    slideState = null;
  }

  function cleanupDrag() {
    if (!dragState) return;
    if (dragState.active) {
      dragState.card.classList.remove('is-dragging');
      dragState.ghost?.remove();
      document.body.classList.remove('is-reordering');

      justDragged = true;
      setTimeout(() => {
        justDragged = false;
      }, 120);
    }
    dragState = null;
  }

  function startDrag(state, clientX, clientY) {
    state.active = true;
    const rect = state.card.getBoundingClientRect();
    state.offsetX = clientX - rect.left;
    state.offsetY = clientY - rect.top;

    const ghost = state.card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    document.body.appendChild(ghost);
    state.ghost = ghost;

    state.card.classList.add('is-dragging');
    document.body.classList.add('is-reordering');
    navigator.vibrate?.(15);
  }

  containerEl.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;

    const card = e.target.closest('[data-device-card]');
    const grid = card?.closest('.devices-grid');
    if (!card || !grid) return;

    const isEditMode = document.body.classList.contains('is-edit-mode');

    if (isEditMode) {
      // Boyut (S/M/L) veya sağ stil (%/⏻) butonlarına basıldıysa sürükleme başlatma, click çalışsın
      if (e.target.closest('[data-edit-size], [data-edit-right]')) {
        return;
      }
      // Düzenleme modunda kartın herhangi bir yerinden veya tutamaçtan sürüklenebilir
      e.preventDefault();
      const state = {
        card,
        grid,
        spaceId: card.dataset.spaceId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: 0,
        offsetY: 0,
        active: false,
        ghost: null,
      };
      startDrag(state, e.clientX, e.clientY);
      dragState = state;
      return;
    }

    // Normal modda yalnızca yüzey slider'ı olan kartlarda (dimmer, fan, slider) yatay kaydırmayı dinle
    // Not: pointerdown anında getBoundingClientRect() çağrılmaz; böylece mobil scroll başlangıcı sıfır maliyetlidir.
    if (!card.classList.contains('has-surface-slider')) return;
    if (e.target.closest('button, input, .climate-modes, .climate-bar')) return;

    slideState = {
      card,
      rect: null,
      spaceId: card.dataset.spaceId,
      deviceId: card.dataset.deviceCard,
      type: card.dataset.type,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      dragOriginX: e.clientX,
      startPct: 0,
      currentPct: -1,
      active: false,
    };
  });

  containerEl.addEventListener('contextmenu', (e) => {
    if (dragState?.active || slideState?.active || document.body.classList.contains('is-edit-mode')) {
      e.preventDefault();
    }
  });

  window.addEventListener(
    'pointermove',
    (e) => {
      // 1) Yüzey Slider Sürükleme (Normal Mod — Basılan Noktaya Atlamadan Göreli Sürükleme)
      if (slideState && e.pointerId === slideState.pointerId) {
        const dx = e.clientX - slideState.startX;
        const dy = e.clientY - slideState.startY;
        const minSlideDx = slideState.pointerType === 'touch' ? 14 : 5;

        if (!slideState.active) {
          // Dikey kaydırma baskınsa sayfa scroll'una izin ver (CSS touch-action: pan-y)
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            slideState = null;
            return;
          }
          if (Math.abs(dx) > minSlideDx && Math.abs(dx) > Math.abs(dy) * 1.25) {
            slideState.active = true;
            slideState.rect = slideState.card.getBoundingClientRect();
            slideState.startPct = getCardCurrentPct(slideState.card);
            slideState.currentPct = slideState.startPct;
            slideState.dragOriginX = e.clientX;
            slideState.card.classList.add('is-sliding');
            slideState.card.setPointerCapture?.(e.pointerId);
          } else {
            return;
          }
        }

        const width = Math.max(1, slideState.rect?.width || 1);
        const deltaPct = ((e.clientX - slideState.dragOriginX) / width) * 100;
        const rawPct = slideState.startPct + deltaPct;

        // %0 veya %100 sınırına ulaşıldığında geri dönüşte ölü bölge olmaması için referansı sınıra sabitle
        if (rawPct <= 0) {
          slideState.startPct = 0;
          slideState.dragOriginX = e.clientX;
        } else if (rawPct >= 100) {
          slideState.startPct = 100;
          slideState.dragOriginX = e.clientX;
        }

        const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
        if (pct === slideState.currentPct) return;
        slideState.currentPct = pct;
        applySurfaceSliderPreview(slideState.card, slideState.type, pct);

        const patch = slideState.type === 'fan' ? { pwm: pct } : { value: pct };
        store.sendDeviceUpdate(slideState.spaceId, slideState.deviceId, patch, 55);
        return;
      }

      // 2) Kart Sıralama Sürükleme (Düzenleme Modu)
      if (!dragState || e.pointerId !== dragState.pointerId) return;

      if (dragState.ghost) {
        const x = e.clientX - dragState.offsetX;
        const y = e.clientY - dragState.offsetY;
        dragState.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }

      // Altındaki hedef kartı bul ve canlı olarak grid içinde yer değiştir
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const targetCard = elUnder?.closest('[data-device-card]');
      if (
        targetCard &&
        targetCard !== dragState.card &&
        targetCard.closest('.devices-grid') === dragState.grid
      ) {
        const targetRect = targetCard.getBoundingClientRect();
        const dragRect = dragState.card.getBoundingClientRect();
        const insertAfter =
          e.clientY > targetRect.top + targetRect.height / 2 ||
          (Math.abs(e.clientY - (targetRect.top + targetRect.height / 2)) < targetRect.height * 0.35 &&
            dragRect.left < targetRect.left);

        if (insertAfter) {
          targetCard.after(dragState.card);
        } else {
          targetCard.before(dragState.card);
        }
      }
    },
    { passive: true }
  );

  window.addEventListener('pointerup', (e) => {
    if (slideState && e.pointerId === slideState.pointerId) {
      finishSurfaceSlide();
    }
    if (dragState && e.pointerId === dragState.pointerId) {
      cleanupDrag();
    }
  });

  window.addEventListener('pointercancel', () => {
    finishSurfaceSlide();
    cleanupDrag();
  });
}
