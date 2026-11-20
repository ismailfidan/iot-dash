# Akıllı Yaşam Alanları IoT Dashboard — Sistem Planı ve Kuralları

Bu doküman, projenin temel mimarisini, geliştirme kurallarını ve güvenlik standartlarını tanımlar.

---

## 1. Sistem Mimarisi
- **Sunucu:** Node.js (Express + `ws`), **Port: `3004`** (`http://localhost:3004`)
- **Ön Yüz (UI):** Derleme gerektirmeyen ham dosyalar (HTML5 + Modern CSS3 + Vanilla ES6+ Modules), Koyu Glassmorphism tasarım, harici CDN bağımlılığı yok.
- **Donanım Topolojisi (Planlanan):**
  - **1x Ana Merkez ESP32 (`ESP32-MAIN-00`):** Wi-Fi + ESP-NOW Master (Gateway + Salon kontrolü). Node.js sunucusuna `/ws/hub` üzerinden bağlanacak.
  - **4x Mini Merkez ESP32 (`ESP32-MINI-01` .. `04`):** ESP-NOW Peer düğümleri (Mutfak, Yatak Odası, Çalışma Odası, Teras & Balkon). Ana Merkez ile ESP-NOW üzerinden haberleşir.
- **Senkronizasyon Kanalları:**
  - `/ws/client`: Tarayıcı / tablet arayüzlerinin anlık çift yönlü senkronizasyonu.
  - `/ws/hub`: Ana Merkez ESP32 için ayrılmış güvenli WebSocket kanalı.

---

## 2. Güvenlik Kuralları (En Üst Seviye)
1. **Kimlik Doğrulama:** `crypto.scryptSync` + `timingSafeEqual` ile zamanlama saldırılarına dayanıklı doğrulama.
2. **Oturum Yönetimi:** `HttpOnly`, `SameSite=Strict`, HMAC-SHA256 imzalı oturum çerezi (`iot_session`).
3. **HTTP Güvenlik Başlıkları:** `helmet` ile sıkı CSP (`default-src 'self'`, harici script/CDN engelli).
4. **Rate Limiting:** Giriş (`/api/auth/login`) ve API uçlarında brute-force koruması.
5. **WebSocket Güvenliği:** Origin doğrulaması (CSWSH koruması), payload boyutu sınırı (`16 KB`), `/ws/hub` için Bearer Token + opsiyonel HMAC-SHA256 imza doğrulaması.
6. **Gizli Bilgiler:** `.env` dosyası **asla** Git deposuna gönderilmez (`.gitignore` ile korunur). Yalnızca `.env.example` takip edilir.

---

## 3. Geliştirme ve Değişiklik Takibi Kuralları
1. **Zorunlu Değişiklik Kaydı (`CHANGELOG.md`):**
   - Projede yapılan **her değişiklik** (tasarım, özellik, yapılandırma, hata düzeltme) mutlaka `CHANGELOG.md` dosyasına kaydedilir.
   - Her kayıt şu bilgileri içermelidir: **Tarih/Saat**, **Değişiklik Özeti**, **Etkilenen Dosyalar** ve **Geri Alma (Rollback) Notu**.
2. **Servis Yönetimi:**
   - Node.js servisi `3004` portunda `node --watch server.js` ile çalışır.
   - `.env` veya izlenmeyen yapılandırma değişikliklerinde Node.js servisi yeniden başlatılır.
3. **Git & GitHub Senkronizasyonu:**
   - Tüm dosyalar `npm run push` komutu ile GitHub deposuna gönderilir.
   - Özel commit mesajı vermek için: `npm run push -- "mesajiniz"` kullanılabilir.

---

## 4. Yol Haritası
- [x] **Faz 1:** Node.js (3004) + Güvenlik İskeleti + Ham Tasarım Dosyaları (Switch, Slider, Fan, Sensör, Senaryo, ESP-NOW Topoloji).
- [x] **Faz 2:** Sistem Planı, Değişiklik Günlüğü (`CHANGELOG.md`) ve `npm run push` GitHub otomasyonu.
- [ ] **Faz 3:** Tasarım iyileştirmeleri (ikonlar, animasyonlar, özel oda/cihaz düzenlemeleri).
- [ ] **Faz 4:** ESP32 Ana Merkez + 4 Mini Merkez ESP-NOW firmware ve `/ws/hub` canlı senkronizasyon entegrasyonu.
