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
const logoutBtn = document.getElementById('logout-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
const SIDEBAR_STORAGE_KEY = 'tfr_sidebar_collapsed';

const spaceNavEl = document.getElementById('space-nav');
const scenesGridEl = document.getElementById('scenes-grid');
const dashboardContentEl = document.getElementById('dashboard-content');
const viewTitleEl = document.getElementById('view-title');
const viewSensorsEl = document.getElementById('view-sensors');
const wsDotEl = document.getElementById('ws-dot');
const wsPillEl = document.getElementById('ws-status-pill');
const hubDotEl = document.getElementById('hub-status-dot');
const hubTitleEl = document.getElementById('hub-status-title');
const hubSubEl = document.getElementById('hub-status-sub');
const toastContainer = document.getElementById('toast-container');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const editActionsEl = document.getElementById('edit-actions');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSaveEdit = document.getElementById('btn-save-edit');

// Statik ikonları yerleştir
document.getElementById('auth-logo-icon').innerHTML = getIcon('shield');
document.getElementById('logout-icon').innerHTML = getIcon('logout');
document.getElementById('icon-toggle-edit').innerHTML = getIcon('edit');
document.getElementById('icon-cancel-edit').innerHTML = getIcon('x');
document.getElementById('icon-save-edit').innerHTML = getIcon('check');

function setEditMode(enabled) {
  document.body.classList.toggle('is-edit-mode', enabled);
  editActionsEl.classList.toggle('hidden', !enabled);
}

btnToggleEdit.addEventListener('click', () => {
  if (store.activeFilter === 'topology') {
    store.setFilter('hub-main');
  }
  setEditMode(true);
  showToast('Düzenleme modu: Boyut seçin (S/M/L), sürükleyin ve Kaydet\'e basın.');
});

btnCancelEdit.addEventListener('click', () => {
  setEditMode(false);
  if (store.snapshot) {
    renderDashboardContent(dashboardContentEl, store.snapshot, store.activeFilter);
  }
  showToast('Düzenleme değişiklikleri iptal edildi.');
});

btnSaveEdit.addEventListener('click', () => {
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

function updateClock() {
  const now = new Date();
  document.getElementById('live-clock').textContent = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
updateClock();
setInterval(updateClock, 15_000);

function updateHeaderTitles(snapshot, filter) {
  if (filter === 'all') {
    viewTitleEl.textContent = 'Tüm Alanlar';
    viewSensorsEl.innerHTML = `<span class="topbar-sensor-chip">${snapshot.spaces.length} Düğüm</span>`;
  } else if (filter === 'topology') {
    viewTitleEl.textContent = 'ESP-NOW Ağı';
    viewSensorsEl.innerHTML = `<span class="topbar-sensor-chip">1 Ana + ${snapshot.spaces.length - 1} Mini</span>`;
  } else {
    const space = snapshot.spaces.find((s) => s.id === filter);
    if (space) {
      viewTitleEl.textContent = space.name;
      viewSensorsEl.innerHTML = `
        <span class="topbar-sensor-chip">${getIcon('thermometer')} ${space.sensors.temperature.toFixed(1)}°C</span>
        <span class="topbar-sensor-chip">${getIcon('humidity')} %${space.sensors.humidity}</span>
        <span class="topbar-sensor-chip is-rssi">${getIcon('wifi')} ${space.node.rssi} dBm</span>
      `;
    }
  }

  hubDotEl.className = `status-dot ${snapshot.hubConnected ? 'live' : 'sim'}`;
  hubTitleEl.textContent = snapshot.hubConnected ? 'ESP32 Canlı Bağlı' : 'Tasarım & Simülasyon';
  hubSubEl.textContent = snapshot.hubConnected
    ? 'Ana Merkez Senkronize'
    : 'ESP32 Ana Merkez Bekleniyor';
}

// Store abonelikleri
store.subscribe((event, snapshot) => {
  if (!snapshot) return;

  if (event.type === 'device:updated') {
    patchDeviceCard(event.deviceId, event.device);
    renderNavigation(spaceNavEl, snapshot, store.activeFilter);
    renderScenes(scenesGridEl, snapshot);
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
});

store.onWsStatus((status) => {
  wsDotEl.className = `ws-dot ${status}`;
  if (status === 'connected') wsPillEl.title = 'Canlı Senkron Bağlı';
  else if (status === 'connecting') wsPillEl.title = 'Bağlanıyor...';
  else wsPillEl.title = 'Yeniden Bağlanıyor';
});

bindDashboardEvents(dashboardContentEl, scenesGridEl, spaceNavEl);

// Oturum kontrolü ve giriş işlemleri
async function startAuthenticatedApp() {
  authOverlay.classList.add('hidden');
  appShell.classList.remove('hidden');
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

logoutBtn.addEventListener('click', async () => {
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
