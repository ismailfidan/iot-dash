# Değişiklik Günlüğü (CHANGELOG)

Projede yapılan tüm değişiklikler geriye dönük takip ve hata kurtarma amacıyla burada kayıt altına alınır.

---

## [2026-11-20 14:29] — Sistem Planı, Kurallar ve `npm run push` Otomasyonu
- **Özet:** Proje kuralları ve yol haritası belirlendi; değişiklik takip sistemi ve GitHub push komutu eklendi.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Yeni)
  - `CHANGELOG.md` (Yeni)
  - `scripts/git-push.mjs` (Yeni)
  - `package.json` (`"push"` scripti eklendi)
- **Geri Alma (Rollback):** `git checkout HEAD~1` veya ilgili dosyaların önceki commit'e döndürülmesi.

---

## [2026-11-20 14:08] — Sunucu Portu 3004 Olarak Güncellendi
- **Özet:** Varsayılan sunucu portu `3000` yerine `3004` olarak ayarlandı ve `node --watch server.js` servisi başlatıldı.
- **Etkilenen Dosyalar:**
  - `server.js` (`PORT` varsayılanı `3004`)
  - `.env.example` (`PORT=3004`, `ALLOWED_ORIGINS` `3004`)
- **Geri Alma (Rollback):** `server.js` ve `.env.example` içinde `3004` değerlerini önceki porta döndürün.

---

## [2026-11-20 14:06] — İlk Kurulum (v1.0.0 Tasarım ve Güvenlik İskeleti)
- **Özet:** Node.js (Express + `ws`) tabanlı ham dashboard dosyaları, üst düzey güvenlik katmanı ve 1 Ana Merkez + 4 Mini Merkez ESP32 simülasyon/tasarım arayüzü oluşturuldu.
- **Etkilenen Dosyalar:**
  - `package.json`, `.env.example`, `.gitignore`, `server.js`
  - `config/spaces.config.js`, `src/security/auth.js`, `src/state/stateManager.js`, `src/ws/wsHandler.js`
  - `public/index.html`, `public/css/*`, `public/js/*`
- **Geri Alma (Rollback):** İlk commit referansı.
