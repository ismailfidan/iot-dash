import { getIcon } from './icons.js';
import { store } from './state.js';
import {
  bindDashboardEvents,
  patchDeviceCard,
  renderDashboardContent,
  renderNavigation,
  renderScenes,
} from './components.js';

const authOverlay = document.getElementById('auth-overlay');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
const SIDEBAR_STORAGE_KEY = 'tfr_sidebar_collapsed';

const spaceNavEl = document.getElementById('space-nav');
const scenesGridEl = document.getElementById('scenes-grid');
const dashboardContentEl = document.getElementById('dashboard-content');
const pageHeadingEl = document.getElementById('page-heading');
const viewIconEl = document.getElementById('view-icon');
const viewTitleEl = document.getElementById('view-title');
const viewSubtitleEl = document.getElementById('view-subtitle');
const viewSensorsEl = document.getElementById('view-sensors');
const toastContainer = document.getElementById('toast-container');

const topbarWifiBtn = document.getElementById('topbar-wifi-btn');
const topbarWifiIcon = document.getElementById('topbar-wifi-icon');
const topbarActiveBtn = document.getElementById('topbar-active-btn');
const topbarBoltIcon = document.getElementById('topbar-bolt-icon');
const topbarActiveBadge = document.getElementById('topbar-active-badge');
const topbarTopologyBtn = document.getElementById('topbar-topology-btn');
const topbarTopologyIcon = document.getElementById('topbar-topology-icon');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const iconToggleEdit = document.getElementById('icon-toggle-edit');
const editActionsEl = document.getElementById('edit-actions');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const iconCancelEdit = document.getElementById('icon-cancel-edit');
const btnSaveEdit = document.getElementById('btn-save-edit');
const iconSaveEdit = document.getElementById('icon-save-edit');
const topbarSettingsBtn = document.getElementById('topbar-settings-btn');
const topbarSettingsIcon = document.getElementById('topbar-settings-icon');
const topbarLogoutBtn = document.getElementById('topbar-logout-btn');
const topbarLogoutIcon = document.getElementById('topbar-logout-icon');

// Statik ikonları yerleştir
document.getElementById('auth-logo-icon').innerHTML = getIcon('shield');
if (topbarWifiIcon) topbarWifiIcon.innerHTML = getIcon('wifi');
if (topbarBoltIcon) topbarBoltIcon.innerHTML = getIcon('zap');
if (topbarTopologyIcon) topbarTopologyIcon.innerHTML = getIcon('cpu');
if (iconToggleEdit) iconToggleEdit.innerHTML = getIcon('edit');
if (iconCancelEdit) iconCancelEdit.innerHTML = getIcon('x');
if (iconSaveEdit) iconSaveEdit.innerHTML = getIcon('check');
if (topbarSettingsIcon) topbarSettingsIcon.innerHTML = getIcon('settings');
if (topbarLogoutIcon) topbarLogoutIcon.innerHTML = getIcon('logout');

function setEditMode(enabled) {
  document.body.classList.toggle('is-edit-mode', enabled);
  editActionsEl?.classList.toggle('hidden', !enabled);
}

btnToggleEdit?.addEventListener('click', () => {
  if (store.activeFilter === 'topology') {
    store.setFilter('hub-main');
  }
  setEditMode(true);
  showToast("Düzenleme modu: Boyut seçin (S/M/L), sürükleyin ve Kaydet'e basın.");
});

btnCancelEdit?.addEventListener('click', () => {
  setEditMode(false);
  if (store.snapshot) {
    renderDashboardContent(dashboardContentEl, store.snapshot, store.activeFilter);
  }
  showToast('Düzenleme değişiklikleri iptal edildi.');
});

btnSaveEdit?.addEventListener('click', () => {
  dashboardContentEl.querySelectorAll('[data-space-section]').forEach((section) => {
    const spaceId = section.dataset.spaceSection;
    const items = [...section.querySelectorAll('[data-device-card]')].map((el) => ({
      id: el.dataset.deviceCard,
      size: el.dataset.size || 'm',
      rightControl: el.dataset.rightControl || 'metric',
    }));
    if (spaceId && items.length > 0) {
      store.sendSpaceLayout(spaceId, items);
    }
  });
  setEditMode(false);
  showToast('Bento ızgara düzeni ve kart boyutları kaydedildi.');
});

topbarActiveBtn?.addEventListener('click', () => {
  store.setFilter('all');
});

topbarTopologyBtn?.addEventListener('click', () => {
  store.setFilter('topology');
});

function updateWifiButtonState(isConnected) {
  if (!topbarWifiBtn || !topbarWifiIcon) return;
  topbarWifiBtn.classList.toggle('is-active', isConnected);
  topbarWifiBtn.classList.toggle('is-passive', !isConnected);
  topbarWifiIcon.innerHTML = getIcon(isConnected ? 'wifi' : 'wifiOff');
  topbarWifiBtn.title = isConnected ? 'Bağlantı Durumu: Aktif' : 'Bağlantı Durumu: Pasif';
}

function updateActiveDevicesBadge(snapshot) {
  if (!topbarActiveBadge || !snapshot?.spaces) return;
  const totalActive = snapshot.spaces.reduce(
    (sum, space) => sum + space.devices.filter((d) => d.on).length,
    0
  );
  topbarActiveBadge.textContent = String(totalActive);
  topbarActiveBadge.classList.toggle('hidden', totalActive === 0);
}

function applySidebarState(collapsed) {
  appShell.classList.toggle('is-collapsed', collapsed);
  if (sidebarToggleIcon) {
    sidebarToggleIcon.innerHTML = getIcon(collapsed ? 'chevronRight' : 'chevronLeft');
  }
  sidebarToggleBtn.title = collapsed ? 'Menüyü Aç ve Sabitle' : 'Menüyü Kapat';
}

// Kayıtlı sabitleme/gizleme tercihini yükle (mobilde varsayılan gizli, masaüstünde açık)
const savedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY);
const initialCollapsed = savedCollapsed !== null ? savedCollapsed === 'true' : window.innerWidth <= 900;
applySidebarState(initialCollapsed);

sidebarToggleBtn.addEventListener('click', () => {
  const nextCollapsed = !appShell.classList.contains('is-collapsed');
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));
  applySidebarState(nextCollapsed);
});

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function updateHeaderTitles(snapshot, filter) {
  topbarActiveBtn?.classList.toggle('is-selected', filter === 'all');
  topbarTopologyBtn?.classList.toggle('is-selected', filter === 'topology');

  if (filter === 'all') {
    viewTitleEl.textContent = 'Aktif Cihazlar';
    if (viewSubtitleEl) viewSubtitleEl.textContent = 'Tüm Yaşam Alanları • Anlık Kontrol';
    if (viewIconEl) {
      viewIconEl.innerHTML = '';
      viewIconEl.classList.add('hidden');
    }
    pageHeadingEl?.style.setProperty('--space-accent', '#38bdf8');
    viewSensorsEl.innerHTML = `<span class="sensor-pill"><strong>${snapshot.spaces.length} Düğüm</strong></span>`;
  } else if (filter === 'topology') {
    viewTitleEl.textContent = 'ESP-NOW Ağı';
    if (viewSubtitleEl) viewSubtitleEl.textContent = 'Kablosuz Düğüm & Sinyal Topolojisi';
    if (viewIconEl) {
      viewIconEl.classList.remove('hidden');
      viewIconEl.innerHTML = getIcon('cpu');
    }
    pageHeadingEl?.style.setProperty('--space-accent', '#38bdf8');
    viewSensorsEl.innerHTML = `<span class="sensor-pill"><strong>1 Ana + ${snapshot.spaces.length - 1} Mini</strong></span>`;
  } else {
    const space = snapshot.spaces.find((s) => s.id === filter);
    if (space) {
      viewTitleEl.textContent = space.name;
      if (viewSubtitleEl) viewSubtitleEl.textContent = space.subtitle || '';
      if (viewIconEl) {
        viewIconEl.classList.remove('hidden');
        viewIconEl.innerHTML = getIcon(space.icon);
      }
      pageHeadingEl?.style.setProperty('--space-accent', space.theme?.accent || '#38bdf8');
      viewSensorsEl.innerHTML = `
        <span class="sensor-pill">${getIcon('thermometer')} <strong>${space.sensors.temperature.toFixed(1)}°C</strong></span>
        <span class="sensor-pill">${getIcon('humidity')} <strong>%${space.sensors.humidity}</strong></span>
        <span class="node-pill">${getIcon('wifi')} ${space.node.rssi} dBm</span>
      `;
    }
  }
}

// Store abonelikleri
store.subscribe((event, snapshot) => {
  if (!snapshot) return;

  if (event.type === 'device:updated') {
    patchDeviceCard(event.deviceId, event.device);
    renderNavigation(spaceNavEl, snapshot, store.activeFilter);
    renderScenes(scenesGridEl, snapshot);
    updateActiveDevicesBadge(snapshot);
    return;
  }

  if (event.type === 'hub:status') {
    updateHeaderTitles(snapshot, store.activeFilter);
    showToast(snapshot.hubConnected ? 'ESP32 Ana Merkez bağlandı!' : 'ESP32 Ana Merkez bağlantısı kesildi.');
    return;
  }

  renderNavigation(spaceNavEl, snapshot, store.activeFilter);
  renderScenes(scenesGridEl, snapshot);
  renderDashboardContent(dashboardContentEl, snapshot, store.activeFilter);
  updateHeaderTitles(snapshot, store.activeFilter);
  updateActiveDevicesBadge(snapshot);
});

store.onWsStatus((status) => {
  updateWifiButtonState(status === 'connected');
});

bindDashboardEvents(dashboardContentEl, scenesGridEl, spaceNavEl);

function syncBrandTextWidth() {
  const titleEl = document.querySelector('.topbar-brand .brand-title');
  const subEl = document.querySelector('.topbar-brand .brand-sub');
  if (!titleEl || !subEl) return;

  titleEl.style.letterSpacing = '0px';
  titleEl.style.marginRight = '0px';
  const baseTitleW = titleEl.getBoundingClientRect().width;
  const targetSubW = subEl.getBoundingClientRect().width;
  const charCount = [...titleEl.textContent.trim()].length;

  if (charCount > 1 && targetSubW > baseTitleW) {
    const ls = ((targetSubW - baseTitleW) / (charCount - 1)) * 0.86;
    titleEl.style.letterSpacing = `${ls.toFixed(2)}px`;
    titleEl.style.marginRight = `${(-ls).toFixed(2)}px`;
  } else {
    titleEl.style.removeProperty('letter-spacing');
    titleEl.style.removeProperty('margin-right');
  }
}

window.addEventListener('resize', syncBrandTextWidth);
document.fonts?.ready?.then(syncBrandTextWidth);

// Oturum kontrolü ve giriş işlemleri
async function startAuthenticatedApp() {
  authOverlay.classList.add('hidden');
  appShell.classList.remove('hidden');
  syncBrandTextWidth();
  document.fonts?.ready?.then(syncBrandTextWidth);
  try {
    await store.fetchInitialState();
    store.connectWebSocket();
  } catch {
    showToast('Sunucu durumu alınamadı.');
  }
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.ok) {
      await startAuthenticatedApp();
      return;
    }
  } catch {
    // Ağ hatası
  }
  appShell.classList.add('hidden');
  authOverlay.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;

  async function attemptLogin() {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ username, password }),
    });
  }

  try {
    let res;
    try {
      res = await attemptLogin();
    } catch {
      // Mobil / Tailscale NAT üzerinde bayat keep-alive soketi koptuysa yeni soketle 1 kez otomatik tekrar dene
      res = await attemptLogin();
    }

    const data = await res.json();
    if (!res.ok) {
      authError.textContent = data.error || 'Giriş başarısız.';
      authError.classList.remove('hidden');
      return;
    }

    loginForm.reset();
    await startAuthenticatedApp();
    showToast('Güvenli oturum başlatıldı.');
  } catch {
    authError.textContent = 'Sunucuya bağlanılamadı. Lütfen sayfayı yenileyip tekrar deneyin.';
    authError.classList.remove('hidden');
  }
});

topbarLogoutBtn?.addEventListener('click', async () => {
  store.disconnectWebSocket();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  appShell.classList.add('hidden');
  authOverlay.classList.remove('hidden');
});

checkSession();

// PWA Service Worker Kaydı (Mobil & Masaüstü Uygulama Kurulumu)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
