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

const spaceNavEl = document.getElementById('space-nav');
const scenesGridEl = document.getElementById('scenes-grid');
const dashboardContentEl = document.getElementById('dashboard-content');
const viewTitleEl = document.getElementById('view-title');
const viewSubtitleEl = document.getElementById('view-subtitle');
const wsDotEl = document.getElementById('ws-dot');
const wsLabelEl = document.getElementById('ws-label');
const hubDotEl = document.getElementById('hub-status-dot');
const hubTitleEl = document.getElementById('hub-status-title');
const hubSubEl = document.getElementById('hub-status-sub');
const toastContainer = document.getElementById('toast-container');

// Statik ikonları yerleştir
document.getElementById('auth-logo-icon').innerHTML = getIcon('shield');
document.getElementById('brand-icon').innerHTML = getIcon('home');
document.getElementById('logout-icon').innerHTML = getIcon('logout');

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
    viewTitleEl.textContent = 'Tüm Yaşam Alanları';
    viewSubtitleEl.textContent = '1 Ana Merkez + 4 Mini Merkez ESP32 • Anlık Senkronizasyon';
  } else if (filter === 'topology') {
    viewTitleEl.textContent = 'ESP-NOW Ağ Topolojisi';
    viewSubtitleEl.textContent = '1 Gateway Ana Merkez ve 4 Mini Merkez Düğüm Detayları';
  } else {
    const space = snapshot.spaces.find((s) => s.id === filter);
    if (space) {
      viewTitleEl.textContent = space.name;
      viewSubtitleEl.textContent = `${space.subtitle} • ${space.node.nodeId}`;
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
  if (status === 'connected') wsLabelEl.textContent = 'Canlı Senkron';
  else if (status === 'connecting') wsLabelEl.textContent = 'Bağlanıyor...';
  else wsLabelEl.textContent = 'Yeniden Bağlanıyor';
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

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

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
    authError.textContent = 'Sunucuya bağlanılamadı.';
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
