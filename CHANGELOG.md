# Değişiklik Günlüğü (CHANGELOG)

Projede yapılan tüm değişiklikler geriye dönük takip ve hata kurtarma amacıyla burada kayıt altına alınır.

---

## [2026-11-22 04:53] — 3 Boyutlu Bento Kiosk Izgarası (`S: 1x1`, `M: 2x1`, `L: 2x2`), Canlı Boyut/Stil Seçici & Kalıcı Layout Kaydı
- **Özet:**
  1. **3 Boyutlu Bento Izgara (`grid-auto-flow: dense`):** Odadaki tüm cihaz kartları tek birleşik Bento ızgarasında `S` (`1x1` kompakt dikey kare karo), `M` (`2x1` yatay yüzey-slider/güç butonlu karo) ve `L` (`2x2` alt kontrol barı, fan kademeleri ve iklimlendirme çubuğu açık büyük kontrol modülü) boyutlarında boşluksuz dizilecek şekilde yapılandırıldı. Mobilde (`<=640px`) 2 temel sütun (`S`=yarım ekran kare, `M`=tam genişlik yatay, `L`=tam genişlik yüksek) kullanılır.
  2. **Düzenleme Modu Kart Araç Çubuğu (`S | M | L` + `% | ⏻`):** Üst çubuktaki düzenleme (kalem) butonuna basıldığında her kartın sağ üstünde `S / M / L` boyut butonları, `% / ⏻` (sağ yüzde göstergesi veya yuvarlak güç butonu) geçiş butonu ve sürükleme tutamacı açılır; seçilen boyut ve stil anında canlı önizlenir.
  3. **Kalıcı Sunucu Kaydı (`data/layout.json`):** **Kaydet** butonuna basıldığında kartların yeni sırası, boyutları (`size`) ve sağ kontrol stilleri (`rightControl`) hem tüm bağlı ekranlara senkronize edilir hem de Node.js sunucusunda `data/layout.json` dosyasına kalıcı olarak kaydedilir.
- **Etkilenen Dosyalar:**
  - `config/spaces.config.js`, `src/state/stateManager.js`, `src/ws/wsHandler.js`, `server.js`
  - `public/js/state.js`, `public/js/components.js`, `public/js/app.js`, `public/css/components.css`
- **Geri Alma (Rollback):** `data/layout.json` silinerek ve ilgili dosyalar önceki sürüme döndürülerek geri alınabilir.

---

## [2026-11-22 04:41] — Yüzey Slider Göreli (Atlamasız) Sürükleme & Kart Üst Border Çift Renk Düzeltmesi
- **Özet:**
  1. Arka planı kaydırmalı (`has-surface-slider`) kartlarda karta dokunulduğunda veya kaydırmaya başlandığında değerin basılan X koordinatına doğrudan atlaması kaldırıldı; bunun yerine mevcut yüzdeden (`startPct`) itibaren parmak/fare hareket miktarı kadar (`+deltaPct`) göreli olarak artıp azalan atlamasız sürükleme mantığına geçildi.
  2. Kartlardaki `inset 0 1px 0` iç gölge ve yarı saydam `rgba` border nedeniyle yüzey slider dolgusunun (`.card-surface-fill`) olduğu sol kısım ile sağ kısım arasında üst kenarlıkta 2 farklı renk görünmesi sorunu giderildi; `inset` üst çizgi kaldırıldı ve tam opak `color-mix(..., #152342)` kenarlık renkleri tanımlandı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`getCardCurrentPct`, `startPct + deltaPct` göreli yüzey slider hesaplaması)
  - `public/css/components.css` (`.device-card` ve `.device-card.is-on` tek renk homojen kenarlık düzeltmesi)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-22 03:06] — Mobil Kart Dokunma (Aç/Kapa) Optimistic UI, HTTP Fallback & Dokunmatik Eşik Düzeltmesi
- **Özet:** Mobil cihazda kartlara dokunulduğunda açılıp kapanmama sorununa yol açan iki neden giderildi:
  1. Dokunmatik ekranlarda parmak dokunuşu sırasında oluşan küçük yatay titremelerin (`6px`) yanlışlıkla yüzey slider sürüklemesi olarak algılanıp `click` (aç/kapa) olayını iptal etmesini önlemek için dokunmatik yatay kaydırma eşiği `16px` (`Math.abs(dx) > Math.abs(dy) * 1.25`) olarak yükseltildi.
  2. `store.sendDeviceUpdate` içine `0ms` **Optimistic UI** (`applyOptimisticPatch`) ve WebSocket kapalı/yeniden bağlanıyor durumdayken devreye giren **HTTP REST Fallback** (`POST /api/devices/update`, `/api/spaces/reorder`, `/api/scenes/apply`) eklendi; çerez `sameSite: 'lax'` yapılarak mobil WebSocket bağlantı kararlılığı artırıldı.
- **Etkilenen Dosyalar:**
  - `public/js/state.js` (`applyOptimisticPatch` ve HTTP REST fallback)
  - `public/js/components.js` (Dokunmatik `minSlideDx = 16` eşiği)
  - `server.js` (`/api/devices/update`, `/api/spaces/reorder`, `/api/scenes/apply` uçları ve `sameSite: 'lax'`)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-22 03:02] — Mobil / Tailscale Giriş Ekranı Keep-Alive (`FIN_WAIT_2`) Kopma ve HSTS Düzeltmesi
- **Özet:** Mobil Chrome üzerinden Tailscale (`100.82.34.47` -> `100.124.25.27:3004`) ile bağlanıldığında, kullanıcı giriş formunu doldururken Node.js'in varsayılan `5sn` `keepAliveTimeout` süresinin dolup soketi `FIN_WAIT_2` durumuna düşürmesi ve Chrome'un `POST /api/auth/login` isteğinde bayat soket hatası (`"Sunucuya bağlanılamadı"`) vermesi sorunu giderildi. `server.keepAliveTimeout` `65sn` yapıldı, HTTP modunda `helmet` HSTS başlığı kapatıldı ve istemci giriş formuna bayat soket durumunda otomatik yeni bağlantı (`retry`) mekanizması eklendi.
- **Etkilenen Dosyalar:**
  - `server.js` (`keepAliveTimeout: 65000`, `headersTimeout: 66000`, `hsts: USE_HTTPS`)
  - `public/js/app.js` (`attemptLogin` otomatik yeni soket retry desteği)
  - `.env` (`ALLOWED_ORIGINS` içine yerel Wi-Fi IP `http://192.168.1.5:3004` eklendi)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-22 02:50] — Mobil 120Hz Scroll Akıcılığı ve GPU / Compositor Optimizasyonu (Tecno Spark 30 Pro)
- **Özet:** Mobil cihazlarda (Tecno Spark 30 Pro / Mali-G57 GPU) kaydırma sırasında takılmalara yol açan 5 ana darboğaz giderildi:
  1. `html, body` üzerindeki `background-attachment: fixed` kaldırılarak arka plan `body::before` (`position: fixed; contain: strict`) GPU katmanına taşındı (her scroll karesinde tam ekran repaint engellendi).
  2. Kartlardaki (`.device-card`) 15+ eşzamanlı `backdrop-filter: blur(14px)` FBO geçişi kaldırıldı ve `contain: layout style paint` eklendi; dokunmatik/mobil ekranlarda `.sidebar` ve `.topbar` üzerindeki `backdrop-filter` da devre dışı bırakıldı.
  3. SVG ikonlardaki pahalı `filter: drop-shadow(...)` ve `text-shadow` katmanları kaldırılarak donanım hızlandırmalı `box-shadow` ve `radial-gradient` iç aydınlatma korundu.
  4. `#dashboard-content` üzerinde compositor thread'ini bloklayan `{ passive: false }` `touchmove` dinleyicisi kaldırıldı (CSS `touch-action: pan-y` / `none` ile doğal 120Hz compositor scroll aktif edildi) ve `pointerdown`/`pointermove` içindeki `getBoundingClientRect()` layout thrashing'i önbelleğe alındı.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`body::before` sabit GPU katmanı ve dokunmatik cihazlarda `backdrop-filter: none`)
  - `public/css/components.css` (`.device-card` `contain: layout style paint`, `backdrop-filter` ve SVG `drop-shadow` temizliği)
  - `public/js/components.js` (`{ passive: false }` `touchmove` kaldırıldı, `{ passive: true }` `pointermove` ve `rect` önbelleklemesi eklendi)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-21 18:50] — Kart Sağ Taraf On/Off Güç Butonlarının Yuvarlak (`50%`) ve İkon Kutusuyla Eşit (`48×48px`) Yapılması
- **Özet:** 2. satırdaki sağ taraf On/Off güç butonları (`.card-power-btn`) tam daire (`border-radius: 50%`) yapıldı ve boyutları soldaki kart ikon kutucuğuyla (`.device-icon`) birebir eşitlenerek `48×48px` (mobilde `36×36px`) ölçüsüne getirildi.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.card-power-btn` `48×48px`, `border-radius: 50%`, `22×22px` SVG)
- **Geri Alma (Rollback):** `public/css/components.css` önceki değerlere döndürülebilir.

---

## [2026-11-21 18:47] — Sağ Tarafı On/Off Güç Kutucuklu (`rightControl: 'power'`) 2. Yüzey Slider Satırı
- **Özet:** `Merkez` odasında üst satırın altına 2. bir satır eklendi. Bu satırdaki arka planı kaydırmalı (`LED Dimmer`, `Kabin Fanı`, `Stor Perde`) ve anahtar tipi kartların sağ tarafındaki büyük yüzde (`%`) göstergesi kaldırılarak yerine aktifken kartın vurgu rengiyle parlayan, kapalıyken gömülü koyu yuva görünümünde `38×38px` (`8px` radius) **On/Off güç kutucuğu** (`.card-power-btn`) yerleştirildi.
- **Etkilenen Dosyalar:**
  - `config/spaces.config.js` (`Merkez` odasına `rightControl: 'power'` özellikli 2. satır kartları eklendi)
  - `public/js/components.js` (`rightControl: 'power'` HTML çıktısı ve `powerBoxDevices` satır grubu)
  - `public/css/components.css` (`.card-power-btn` kapalı/açık ışıklı güç kutucuğu stilleri)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-21 18:44] — Fan Kartı Durum Metninin `Hız: %XXX` Olarak Sadeleştirilmesi
- **Özet:** Fan kartlarında (`Kabin Fanı` vb.) alt durum metnindeki kademe (`Orta`, `Yüksek`) ve `PWM` ifadeleri kaldırılarak yalnızca `Hız: %55` formatında gösterilmesi sağlandı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`getDeviceStateText`, `applySurfaceSliderPreview`)
- **Geri Alma (Rollback):** `public/js/components.js` önceki sürüme döndürülebilir.

---

## [2026-11-21 18:42] — Kiosk Kontrol Modülü Derinliği, İkon İçe Aydınlatma (Inner Glow) & Shadow Efektleri
- **Özet:** Cihaz kartlarının sıkışık ve düz görünümünü gidermek için kart aralıkları (`14px`), iç boşluklar (`15px 16px`) ve kart yükseklikleri (`88px` / `132px`) ferahlatıldı. Kartlara çok katmanlı donanım kiosk derinliği (`inset` üst ışık yansıması + dış derinlik gölgesi + aktif kartlarda vurgu rengi ambient glow), ikon kutularına (`48×48px`) ise kapalıyken gömülü koyu yuva, açıkken (`is-on`) sidebar butonlarıyla uyumlu içe doğru neon aydınlatma (`radial-gradient` + `inset` glow + `drop-shadow`) eklendi.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.devices-grid`, `.device-card`, `.device-icon`, `.card-surface-fill`, `.touch-slider` derinlik ve ışıklandırma stilleri)
  - `public/css/base.css` (`.dashboard-content` ferahlatılmış kiosk kenar boşlukları)
- **Geri Alma (Rollback):** `public/css/components.css` ve `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-21 18:38] — Alt Barlı Cihaz Kartlarının (`Spot Dimmer`, `Egzoz Fanı`, `Klima Ünitesi`) Tek Satırda Toplanması
- **Özet:** Alt kısmında kontrol barı bulunan kartlar (`sliderStyle: 'bar'` olan `Spot Dimmer`, `Egzoz Fanı` ve `climate` tipi `Klima Ünitesi`) kendi özel satırında (`.devices-grid-bars`) tek satır halinde gruplandı. Alt barı olmayan kompakt kartların (`switch` ve `sliderStyle: 'surface'`) gereksiz alt boşluğu (`min-height: 98px` -> `64px`) kaldırılarak sıkı ve simetrik görünüm sağlandı.
- **Etkilenen Dosyalar:**
  - `config/spaces.config.js` (`Merkez` odası kart sırası güncellendi)
  - `public/js/components.js` (`compactDevices` ve `barDevices` satır ayrımı, `.has-bottom-bar` sınıfı)
  - `public/css/components.css` (`.devices-grid-bars`, `.device-card` ve `.device-card.has-bottom-bar` yükseklikleri)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-21 18:36] — Sidebar Numaratör Rozeti Sağ Kenar Kesilme Düzeltmesi
- **Özet:** `.nav-list` üzerindeki `overflow-y: auto` nedeniyle `.sidebar` yatay padding'inin dar alanda `right: -4px` taşan numaratör rozetlerini sağdan kesmesi sorunu giderildi; dar sidebar genişliği `74px` yapıldı ve `.sidebar` yatay padding'i kaldırılarak `.nav-list` içinde her iki yanda `12.5px` güvenli taşma alanı bırakıldı.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.app-shell.is-collapsed`, `.app-shell.is-collapsed .sidebar`, `.app-shell.is-collapsed .nav-list`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-21 18:35] — Sidebar Numaratör Rozetlerinin Sağ Üst Köşeye Alınması & Buton Aralığının Artırılması
- **Özet:** Sidebar butonlarındaki aktif cihaz numaratör rozetleri (`.nav-badge`) ikonu kapatmayacak şekilde sağ üst köşeye (`top: -4px; right: -4px`) taşındı ve butonlar arasındaki dikey boşluk (`gap: 10px`) artırıldı.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.nav-list`, `.app-shell.is-collapsed .nav-list`, `.app-shell.is-collapsed .nav-badge`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki değerlere döndürülebilir.

---

## [2026-11-21 14:02] — Sidebar Oda Butonları ve Logonun Eşit (`48×48px`) Büyütülmesi
- **Özet:** Sidebar içindeki oda butonları (`.nav-item`), marka logosu (`.brand-logo-img`) ve daraltılmış moddaki alt kontrol butonları `40×40px`'ten eşit şekilde **`48×48px`** (`1:1` kare) ölçüsüne büyütüldü; buton içi ikonlar `22×22px` yapıldı ve dar sidebar genişliği `68px` olarak dengelendi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.brand-logo-img`, `.nav-item`, `.nav-item-left svg`, `.app-shell.is-collapsed` `48×48px` eşit ölçüler)
- **Geri Alma (Rollback):** `public/css/base.css` önceki `40px` ölçülerine döndürülebilir.

---

## [2026-11-21 13:59] — Sidebar Aktif Buton İçe Doğru Işıklandırma (Inner Glow) & Aktif Cihaz Sayısı Rozeti
- **Özet:** Sidebar navigasyon butonlarında seçili (`.active`) buton için kenarlardan merkeze doğru içe aydınlatma (`radial-gradient` + `inset` glow ve parlak kenarlık) uygulandı. Aktif cihaz bulunan odalarda (`activeCount > 0`) ikon kehribar (`#f59e0b`) rengiyle vurgulanır ve hem açık hem de daraltılmış (`1:1` kare) sidebar modunda sağ üst köşede dairesel aktif cihaz sayısı rozeti (`.nav-badge`) gösterilir (`0` olanlarda gizlenir).
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.nav-item`, `.nav-item.active` içe doğru ışıklandırma, `.nav-item.has-active`, `.nav-badge` açık ve dar mod konumlandırması)
  - `public/js/components.js` (`renderNavigation` içinde `has-active` sınıfı ve yalnızca `activeCount > 0` olduğunda rozet gösterimi)
- **Geri Alma (Rollback):** `public/css/base.css` ve `public/js/components.js` önceki sürüme döndürülebilir.

---

## [2026-11-21 13:52] — Anahtar (`switch`) Kartlarındaki Alt Durum Bloğunun Kaldırılması
- **Özet:** `switch` tipi kartların (`Tavan Işık`, `UPS Prizi`, `Sunucu WOL` vb.) alt kısmındaki `"Aktif • Kapatmak için dokun"` / `"Kapalı • Açmak için dokun"` yazılı `.switch-status-bar` bloğu tamamen kaldırıldı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`switch-status-bar` HTML çıktısı ve güncellemesi kaldırıldı)
  - `public/css/components.css` (`.switch-status-bar` ve `.switch-bar-dot` stilleri kaldırıldı)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-21 13:51] — Alt Bar Slider (`sliderStyle: 'bar'`) Kartlarının Ayrı Varyant Olarak Eklenmesi
- **Özet:** Arka plan yüzeyinden kaydırmalı (`sliderStyle: 'surface'`) kartların yanı sıra, önceki alt dokunmatik barlı (`.touch-slider`) ve fan kademeli (`.fan-steps` `0 | 1 | 2 | 3`) tasarım `sliderStyle: 'bar'` seçeneğiyle ayrı kart varyantı olarak korundu. `Merkez` (`hub-main`) odasına hem yüzey slider (`LED Dimmer`, `Kabin Fanı`) hem de alt barlı slider (`Spot Dimmer`, `Egzoz Fanı`) kartları yan yana eklendi.
- **Etkilenen Dosyalar:**
  - `config/spaces.config.js` (`Merkez` odasına `sliderStyle: 'bar'` olan `Spot Dimmer` ve `Egzoz Fanı` kartları eklendi)
  - `public/js/components.js` (`sliderStyle: 'bar'` ve `'surface'` çift varyant desteği)
- **Geri Alma (Rollback):** `config/spaces.config.js` ve `public/js/components.js` önceki sürüme döndürülebilir.

---

## [2026-11-21 13:47] — Tam Yüzey Arka Plan Slider Etkileşimi & Drag-Drop Sıralama Düzenleme Modu
- **Özet:** `dimmer`, `fan` ve `slider` kartlarında alt slider barı yerine doğrudan kartın arka plan yüzeyini yatay kaydırarak (`0–100%`) değer değiştirme (`has-surface-slider`, `.card-surface-fill`, canlı metrik/durum önizlemesi ve WebSocket senkronizasyonu) tamamlandı; karta tek dokunuş/tıklama yine aç/kapa yapar. Kart yüzeyinde kaydırma ile kart sıralama sürüklemesinin çakışmaması için üst çubuktaki düzenleme (`#btn-toggle-edit`), **Kaydet** (`#btn-save-edit`) ve **Vazgeç** (`#btn-cancel-edit`) butonlarının ikonları (`edit`, `check`, `x`) ve olay dinleyicileri bağlandı; sıralama modu aktifken kartların sağ üstünde `.card-drag-handle` (`grip`) tutamacı görünür ve kartlar sürükle-bırak ile yeniden sıralanabilir.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`applySurfaceSliderPreview`, `patchDeviceCard` içinde `.card-surface-fill` güncellemesi, yüzey slider `pointermove` ve `is-edit-mode` drag-drop ayrımı)
  - `public/js/app.js` (`#icon-toggle-edit`, `#icon-cancel-edit`, `#icon-save-edit` ikonları ve `Kaydet` / `Vazgeç` sıralama modu yönetimi)
  - `public/css/components.css` (`.is-sliding`, `.has-surface-slider` ve `body.is-edit-mode` tutamaç/metrik görünürlüğü)
- **Geri Alma (Rollback):** İlgili JS ve CSS dosyaları önceki sürüme döndürülebilir.

---

## [2026-11-20 18:36] — Cihaz Kartı İkon Arka Planlarının Koyu/Kontrast Yapılması & Menü Buton İnce Çizgisi
- **Özet:** Canlı ve açık tonlu kiosk arka planında kartların ana ikonlarının (`.device-icon`) silikleşmesini önlemek için ikon kutularına derin koyu baz (`#090e1a`) ve ince belirgin kenarlık (`rgba(255, 255, 255, 0.12)`) verildi. Aktif (`is-on`) moddaki dimmer, fan, anahtar ve iklimlendirme ikonları donuk pastel şeffaflık yerine doymuş renk karışımlı koyu arka plan (`color-mix`) ve neon kenarlıkla yüksek kontrastlı hale getirildi. Sol dock altındaki "Menüyü Kapat" ve "Oturumu Kapat" butonlarının dikey ayırıcı çizgisi ve yükseklikleri (`38px`) netleştirildi.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.device-icon` ve aktif varyantların arka plan & kenarlık renkleri)
  - `public/css/base.css` (`.btn-ghost`, `.btn-icon` ölçü ve ayırıcı çizgi renk netliği)
- **Geri Alma (Rollback):** İlgili CSS dosyaları önceki sürüme döndürülebilir.

---

## [2026-11-20 18:19] — Canlı Kobalt Mavi & Zümrüt Teal Kiosk Arka Planı & Frosted Glass Karolar
- **Özet:** Paylaşılan referans görseldeki canlı Kobalt Mavi, Periwinkle ve Zümrüt Teal tonlu arka plan saf CSS katmanlı gradient olarak uygulandı; kart ve paneller bu canlı arka planı şık şekilde geçiren gölgesiz frosted-glass (`rgba(14, 23, 46, 0.40)`, `blur(12px)`) tonlarına ayarlandı.
- **Etkilenen Dosyalar:**
  - `public/css/tokens.css` (Frosted-glass yarı saydamlık ve parlak cam kenarlıkları)
  - `public/css/base.css` (Canlı 4 katmanlı Kobalt Mavi / Teal kiosk duvar kağıdı)
  - `SYSTEM_PLAN_AND_RULES.md` (Canlı Kiosk Duvar Kağıdı & Frosted Glass kuralı)
- **Geri Alma (Rollback):** `public/css/tokens.css` ve `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 18:15] — Gerçek Donanım Kiosk / APK Paneli Dönüşümü
- **Özet:** Web sitesi hissini tamamen kaldırmak için varsayılan görünüm tek oda kiosk moduna (`Merkez`) alındı; üstteki büyük senaryo banner'ı kaldırılarak oda sensörleri ve ikonlu hızlı senaryolar tek birleşik üst durum çubuğunda toplandı. Arka plan derin grafit/karbon donanım yüzeyine geçirildi ve mobil APK ekranları için `2` sütunlu sıkı kiosk karo ızgarası eklendi.
- **Etkilenen Dosyalar:**
  - `public/index.html`, `public/js/state.js`, `public/js/app.js`, `public/js/components.js` (Tek oda varsayılanı, birleşik üst durum & ikonlu senaryo şeridi)
  - `public/css/tokens.css`, `public/css/base.css`, `public/css/components.css` (Donanım grafit yüzeyi, birleşik topbar ve `361–640px` 2 sütunlu mobil karo ızgarası)
  - `SYSTEM_PLAN_AND_RULES.md` (APK/Kiosk paneli ve donanım yüzeyi kuralları güncellendi)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 17:52] — Menü Kapatıldığında Logo Konumu & Boşluklarının Sabitlenmesi
- **Özet:** Menü açılıp kapatıldığında logonun üst/alt boşluklarının ve boyutunun değişmemesi için `.brand-logo-img` her iki modda `40×40px` olarak eşitlendi; `.is-collapsed` modunda `.sidebar` (`10px 8px`) ve `.brand` (`4px 0 10px`) dikey paddingleri açık modla birebir sabitlendi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.brand-logo-img`, `.is-collapsed .sidebar`, `.is-collapsed .brand`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 17:51] — Ana Başlıkların Letter-Spacing Değeri `0` Yapıldı
- **Özet:** Giriş ekranı ana başlığı (`.auth-logo h1`) ve üst panel ana başlığı (`.topbar-left h2`) için `letter-spacing` değerleri `0` olarak güncellendi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.auth-logo h1`, `.topbar-left h2`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki değerlere döndürülebilir.

---

## [2026-11-20 17:49] — Alt Buton Hizalaması, İkon Ayırıcı Çizgi & Sidebar Başlık Büyütme
- **Özet:** `Menüyü Kapat` ve `Oturumu Kapat` butonları eşit `36px` yüksekliğe getirildi; ikonlar sola yaslanıp sağ kenarlarına yukarıdan aşağı tam boy ince ayırıcı çizgi (`border-right`) eklendi. Açık sidebar'da `TEKFIKIR - IOT` (`0.98rem`) ve `AKILLI YAŞAM ALANLARI` (`0.67rem`) başlık boyutları büyütüldü.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.btn-ghost`, `.btn-icon`, `.brand-title`, `.brand-sub`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 17:47] — Sidebar Gizle Butonu Alt Kısma (`Menüyü Kapat`) Taşındı
- **Özet:** Üst logo yanındaki daraltma butonu kaldırılarak alt kısımdaki `Oturumu Kapat` butonunun hemen üstüne `.btn-ghost` stilinde **Menüyü Kapat** butonu olarak taşındı; dar modda `40×40px` `1:1` kare ikon buton olarak kalır.
- **Etkilenen Dosyalar:**
  - `public/index.html` (`#sidebar-toggle-btn` alt kısma taşındı, `Menüyü Kapat` etiketi eklendi)
  - `public/js/app.js` (`#sidebar-toggle-icon` ikonu güncellenir)
  - `public/css/base.css` (`.btn-sidebar-toggle`, `.btn-icon` ve eski `.sidebar-toggle-btn` temizliği)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 17:46] — Marka Başlığı: `TEKFIKIR - IOT` & Alt Başlık: `AKILLI YAŞAM ALANLARI`
- **Özet:** Sidebar, giriş ekranı ve sayfa başlığı `TEKFIKIR - IOT`, alt başlık ise `AKILLI YAŞAM ALANLARI` olarak güncellendi; `208px` sidebar içine tek satırda taşmadan sığacak şekilde font boyutları ayarlandı.
- **Etkilenen Dosyalar:**
  - `public/index.html` (`TEKFIKIR - IOT` ve `AKILLI YAŞAM ALANLARI`)
  - `public/css/base.css` (`.brand-title` `0.86rem`, `.brand-sub` `0.58rem`)
- **Geri Alma (Rollback):** `public/index.html` ve `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 17:43] — Sidebar ve Sistem Başlığı: Tekfikir IoT
- **Özet:** Sidebar, giriş ekranı ve sayfa başlığı **Tekfikir IoT** olarak güncellendi; tek satırda temiz sığması için `.brand-title` `0.94rem` (`white-space: nowrap`) olarak ayarlandı.
- **Etkilenen Dosyalar:**
  - `public/index.html` (`<title>`, giriş başlığı ve sidebar başlığı)
  - `public/css/base.css` (`.brand-title`)
- **Geri Alma (Rollback):** `public/index.html` ve `public/css/base.css` önceki başlığa döndürülebilir.

---

## [2026-11-20 17:41] — Özel SVG Favicon (`favicon.svg` 1:1 ViewBox) & Başlık Letter-Spacing `0`
- **Özet:** `public/img/favicon.svg` dosyası kenar kesilmelerini önlemek için dört tarafında güvenli boşluk bulunan net `1:1` kare (`256×256px`, `viewBox="-0.18 -0.33 2.64 2.64"`) oranına ayarlandı ve `index.html` içindeki tüm favicon/touch-icon alanlarına bağlandı. Sidebar başlığı (`TFR IOT`) `letter-spacing` değeri `0` yapıldı.
- **Etkilenen Dosyalar:**
  - `public/img/favicon.svg` (`1:1` güvenli `viewBox` padding)
  - `public/index.html` (`icon`, `shortcut icon`, `apple-touch-icon` -> `/img/favicon.svg`)
  - `public/css/base.css` (`.brand-title` `letter-spacing: 0`)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:58] — Kart Sağ Üst Sürükleme İkonunun Kaldırılması
- **Özet:** Kartların sağ üst köşesine eklenen 6 noktalı `.drag-handle` ikonu kaldırıldı; uzun basma (`240ms`) + `touchmove`/`contextmenu` korumalı dokunmatik sürükle-bırak mekanizması korundu.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`.drag-handle` HTML öğesi kaldırıldı)
  - `public/css/components.css` (`.drag-handle` stilleri kaldırıldı)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:57] — Mobil & Tablet Dokunmatik Drag-Drop Tutamacı (`touch-action: none`)
- **Özet:** Tablet ve telefonlarda tarayıcının sayfa kaydırma hareketiyle çakışmasını önlemek için her kartın sağ üstüne `24×24px` 6 noktalı sürükleme tutamacı (`.drag-handle`, `touch-action: none`) eklendi. Ayrıca sürükleme sırasında `touchmove` (`passive: false`) ve `contextmenu` engellendi.
- **Etkilenen Dosyalar:**
  - `public/js/icons.js` (`grip` 6 noktalı flat ikonu eklendi)
  - `public/js/components.js` (`.drag-handle` HTML'i, anında dokunmatik sürükleme ve `touchmove`/`contextmenu` koruması)
  - `public/css/components.css` (`.drag-handle` stilleri ve `touch-action: none`)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:55] — Kartlar İçin Drag & Drop Sıralama (Canlı Yerleşim & Saydam Sürükleme)
- **Özet:** Odalardaki cihaz kartları fare ile sürükleyerek veya dokunmatik ekranda kısa basılı tutarak (`240ms`) sürükle-bırak ile yeniden sıralanabilir hale getirildi. Sürüklenen kart yarı saydam (`.drag-ghost`) olurken, gezdirilen konumda grid içinde anlık yerleşmiş gibi önizleme (`.is-dragging` canlı yer değiştirme) gösterir ve yeni sıra WebSocket üzerinden tüm cihazlara senkronize edilir.
- **Etkilenen Dosyalar:**
  - `src/state/stateManager.js`, `src/ws/wsHandler.js` (`reorderDevices` ve `space:reorder` WebSocket olayı)
  - `public/js/state.js` (`applyLocalReorder`, `sendDeviceReorder`)
  - `public/js/components.js` (Pointer Events tabanlı fare + dokunmatik Drag & Drop motoru)
  - `public/css/components.css` (`.is-dragging`, `.drag-ghost`, `body.is-reordering`)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:52] — Fan Oto Modu Kaldırıldı & Kart Dış Paddingleri Sıkılaştırıldı
- **Özet:** Fan kartlarından `Oto (A)` modu kaldırılarak `0 | 1 | 2 | 3` kademelerine indirildi. Tüm cihaz kartlarının dış çerçeve padding'i `12px`'den `9px`'e (`gap: 8px`) azaltılarak daha sıkı ve kompakt görünüm sağlandı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`['0', '1', '2', '3']` fan kademeleri)
  - `src/state/stateManager.js` (fan kademesi `0..3` aralığı)
  - `public/css/components.css` (`.device-card` `padding: 9px; gap: 8px;`)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:51] — PWM / Dimmer / Slider Kartları Kapatıldığında Sıfırlanma
- **Özet:** `dimmer`, `slider` ve `fan` kartları kapatıldığında (`on: false`) dokunmatik bar ve yüzde göstergesi otomatik olarak `%0` konumuna iner; tekrar açıldığında ise önceki seviye (`lastValue` / `lastPwm`) geri yüklenir.
- **Etkilenen Dosyalar:**
  - `src/state/stateManager.js` (`updateDevice` kapatma/açma değer sıfırlama ve geri yükleme mantığı)
- **Geri Alma (Rollback):** `src/state/stateManager.js` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:49] — Kart İkon Kutusu & Başlık/Mod Kareleri Yükseklik Eşitleme + 6px Mod Radius
- **Özet:** `.device-icon` ve `.device-info` yükseklikleri tam `44px` olarak eşitlendi (`justify-content: space-between`), böylece başlık üstü ve mod karelerinin altı soldaki ikon kutusuyla piksel düzeyinde hizalandı. Fan ve klima mod karelerinin `border-radius` değeri `2px` azaltılarak `calc(var(--radius-card) - 2px)` (`6px`) yapıldı.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.device-icon`, `.device-info`, `.fan-step-btn`, `.climate-mode-btn`)
- **Geri Alma (Rollback):** `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:47] — Metrik Üst Hizalama & Fan Başlık Altı 5'li Kare Kademe Butonları
- **Özet:** Sağ üst yüzde/derece göstergeleri (`.device-metric`) ikon kutusunun üst kenarına (`align-self: flex-start`) hizalandı. Fan kartlarındaki alt durum yazısı kaldırılarak yerine klima mod butonlarıyla aynı boyutta (`24×24px`) 5 adet `1:1` kare buton (`0`, `1`, `2`, `3`, `A`) yerleştirildi; PWM slider sürüklendikçe ilgili kare anlık aktifleşir.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.device-metric` `align-self: flex-start`, `.fan-steps` `margin-top: 4px`)
  - `public/js/components.js` (Fan başlık altı 5 kare buton ve anlık slider senkronizasyonu)
- **Geri Alma (Rollback):** `public/css/components.css` ve `public/js/components.js` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:45] — Klima Ünite İkonu (`acUnit`) & Merkez WOL Kartı (`Sunucu WOL`)
- **Özet:** Klima Ünitesi kartının ana ikonu split klima cihazı görünümünde `acUnit` ikonuyla değiştirildi (kar tanesi ikonu Soğut modu için korundu). Merkez odasına Wake-on-LAN (WOL) için `Sunucu WOL` kartı (`wol` ikonu ile) eklendi.
- **Etkilenen Dosyalar:**
  - `public/js/icons.js` (`acUnit` ve `wol` flat ikonları eklendi)
  - `config/spaces.config.js` (`merkez-climate` ikonu `acUnit`, yeni `merkez-wol-server` / `Sunucu WOL` kartı)
- **Geri Alma (Rollback):** `public/js/icons.js` ve `config/spaces.config.js` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:43] — Tam Kart Simetrisi: Fan Hızlı Modlar Kaldırıldı & Klima İkonlu Modlar Başlık Altına Alındı
- **Özet:** Tüm cihaz kartlarının birebir aynı yükseklikte ve simetrik olması için fan kartlarındaki hızlı mod satırı kaldırıldı. Klima kartındaki mod butonları başlığın altındaki alt yazının yerine `24×24px` ikonlu butonlar (Soğut, Isıt, Nem, Oto) olarak taşındı.
- **Etkilenen Dosyalar:**
  - `public/js/icons.js` (`flame` ısıtma ikonu eklendi)
  - `public/js/components.js` (Fan hızlı mod satırı kaldırıldı, klima başlık altı ikonlu mod butonları eklendi)
  - `public/css/components.css` (`.climate-mode-btn` `24×24px` ikon buton stilleri)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:41] — Sağ Üst Yüzde/Derece Fontu Light (300) & Büyük Boyut (1.75rem)
- **Özet:** Kartların sağ üst köşesindeki yüzde ve derece göstergeleri (`.device-metric`) daha zarif görünüm için `font-weight: 300` (Light) ve `font-size: 1.75rem` olarak güncellendi.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.device-metric`)
- **Geri Alma (Rollback):** `public/css/components.css` içinde `.device-metric` değerleri `1.35rem` / `700` olarak geri alınabilir.

---

## [2026-11-20 15:39] — Sağ Üst Büyük Yüzde/Derece Göstergesi & Gereksiz Etiketlerin Kaldırılması
- **Özet:** Kartların içindeki `Parlaklık` ve `Konum` yazıları kaldırıldı. Yüzde (`%`) ve klima derece (`°C`) değerleri kartların sağ üst köşesinde büyük, yüksek kontrastlı fontla (`.device-metric`, `1.35rem`, `tabular-nums`) gösterilmeye başlandı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`getDeviceMetricText`, `.device-metric` sağ üst yerleşimi ve canlı slider güncellemesi)
  - `public/css/components.css` (`.device-metric` tipografi ve aktif renk stilleri)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:37] — Klima `+/−` Dikey Hizalama & Fan `1:1` Kare Mod Butonları (`A`)
- **Özet:** Klima ünitesindeki `+` ve `−` butonları piksel hassasiyetli dikey/yatay ortalama (`display: grid; place-items: center` + vektörel flat SVG) ile düzeltildi. Fan hızlı mod butonları `24×24px` (`1:1`) tam kare yapıldı ve `Oto` etiketi `A` olarak kısaltıldı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`['0', '1', '2', '3', 'A']` ve klima `+/−` SVG ikonları)
  - `public/css/components.css` (`.fan-steps .fan-step-btn` `24×24px` kare, `.climate-step-btn` `display: grid; place-items: center`)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:34] — Smoked-Glass Kontrast İyileştirmesi & Oda Renk Uyumu
- **Özet:** Çok renkli arka plan üzerinde kapalı/açık kartların net ayrışması için kart yüzeyleri yüksek kontrastlı smoked-glass (`rgba(10, 14, 24, 0.74–0.86)`) tonuna çekildi ve metin kontrastları artırıldı. Ayrıca `switch` ve `slider` kartlarındaki aktif ikon, kenarlık ve durum çubuğu renkleri odanın kendi `--space-accent` rengiyle tamamen uyumlu hale getirildi (renk çakışması giderildi).
- **Etkilenen Dosyalar:**
  - `public/css/tokens.css` (Smoked-glass yüzey ve metin kontrastları)
  - `public/css/components.css` (Oda rengiyle tam uyumlu aktif kart ikon/border/slider renkleri)
- **Geri Alma (Rollback):** `public/css/tokens.css` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:32] — 3 Renkli Glass Mesh Arka Plan & Yarı Saydam Cam Yüzeyler
- **Özet:** Sade koyu arka plan yerine `box-shadow` ve ağır `blur()` küreleri olmadan saf CSS `radial-gradient` / `linear-gradient` tabanlı 3 renkli (Camgöbeği Mavi, Zümrüt Teal, Mor) canlı arka plan oluşturuldu; kart ve panel yüzeyleri bu renklerin cam arkasından hissedileceği şekilde daha saydam glass tonlarına çekildi.
- **Etkilenen Dosyalar:**
  - `public/css/tokens.css` (Yarı saydam glass yüzey ve kenarlık tonları)
  - `public/css/base.css` (3 renkli `radial-gradient` + `linear-gradient` arka plan)
- **Geri Alma (Rollback):** `public/css/tokens.css` ve `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:29] — Merkez Odası İçin Tüm Kart Stilleri (Aydınlatma, Dimmer, Fan, Klima, Priz, Perde)
- **Özet:** Merkez odasına sistemde kullanılacak tüm kart tipleri eklendi: Aydınlatma (`switch`), LED Dimmer (`dimmer`), Kabin Fanı (`fan`), Klima Ünitesi (`climate` — Soğut/Isıt/Nem/Oto modları + `-`/`+` derece kontrolü), UPS Prizi (`switch`) ve Stor Perde (`slider`). Tüm kartlar aynı yükseklik ve `8px` radius simetrisiyle hizalandı.
- **Etkilenen Dosyalar:**
  - `config/spaces.config.js` (`hub-main` / `Merkez` odası 6 farklı kart tipiyle güncellendi)
  - `src/state/stateManager.js` (`climate` tipi için `targetTemp` ve `mode` güncelleme desteği)
  - `public/js/icons.js` (`climate` flat ikonu eklendi)
  - `public/js/components.js` (`climate` kartı render, `patchDeviceCard` ve olay yönetimi)
  - `public/css/components.css` (`.climate-modes`, `.climate-bar`, `.climate-step-btn`, `.climate-meter` stilleri)
- **Geri Alma (Rollback):** İlgili dosyalar önceki sürüme döndürülebilir.

---

## [2026-11-20 15:27] — Fan Kartı Yükseklik Eşitleme (Kompakt Kademe Seçici)
- **Özet:** Fan kartlarının diğer cihaz kartlarından daha yüksek görünmesine neden olan ayrı `.fan-steps` satırı kaldırıldı; bunun yerine kompakt hızlı mod butonları (`0 | 1 | 2 | 3 | Oto`) doğrudan PWM slider başlığı satırına (`.slider-header-fan`) entegre edildi. Böylece tüm cihaz kartları eşit yüksekliğe ve tam simetriye kavuştu.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`fan` kademe butonları `.slider-header-fan` içine alındı)
  - `public/css/components.css` (`.slider-header-fan`, kompakt `.fan-steps` ve `22px` yükseklikli `.fan-step-btn`)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:25] — Mobil Pull-to-Refresh Düzeltmesi & Kare Buton Border Kesilme Giderimi
- **Özet:** Mobil/tablette aşağı çekerek sayfa yenilemenin (pull-to-refresh) çalışmasını engelleyen `body/main-content` `overflow: hidden` kilidi kaldırıldı; sidebar ve topbar `position: sticky` yapıldı. Ayrıca kapalı sidebar genişliği `58px` -> `60px` (`padding: 8px`) yapılarak `40×40px` aktif butonun sağ border'ının `1px` kesilmesi düzeltildi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (Doğal sayfa kaydırma + sticky dock/topbar + `60px` dar sidebar genişliği)
- **Geri Alma (Rollback):** `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:23] — Kalıcı Oturum (`.env`) & Gölgesiz Glass / Gradient Kiosk Tasarımı
- **Özet:** `node --watch` yeniden başlarken rastgele `SESSION_SECRET` üretilmesi nedeniyle tablet oturumunun düşmesi sorunu kalıcı `.env` oluşturularak çözüldü. Web 2.0 düz görünüm yerine `box-shadow` olmadan yarı saydam glass yüzeyler, arka plan `radial-gradient` derinliği ve aktif kartlarda `linear-gradient` stillendirmeler uygulandı.
- **Etkilenen Dosyalar:**
  - `.env` (Oluşturuldu — `.gitignore` ile korunur; kalıcı `SESSION_SECRET` ve `PORT=3004`)
  - `public/css/tokens.css`, `public/css/base.css`, `public/css/components.css` (Gölgesiz glass & gradient yüzeyler)
  - `SYSTEM_PLAN_AND_RULES.md` (Gölgesiz Glass & Gradient kuralı güncellendi)
- **Geri Alma (Rollback):** CSS dosyaları önceki sürüme döndürülebilir.

---

## [2026-11-20 15:21] — Daraltılmış Aktif Kare Çizgi Düzeltmesi & Genişlik Taşma Önlemi
- **Özet:** Kapalı sidebar'daki `1:1` kare aktif butonun sol kenarında köşeli taşmaya neden olan `::before` çubuğu gizlendi; `.app-shell` genişliği `100vw` yerine `100%` yapılarak yatay taşma engellendi ve `.topbar` dar ekranlar için `flex-wrap: wrap` ile güvenli hale getirildi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.is-collapsed .nav-item.active::before` gizlendi, `width: 100%`, `.topbar` `flex-wrap: wrap`)
- **Geri Alma (Rollback):** `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:20] — Daraltılmış Sidebar Butonları Net 1:1 Kare (40×40px)
- **Özet:** Sidebar gizli (ikon) modundayken logo, aç/kapa butonu, tüm oda/alan butonları, durum göstergesi ve çıkış butonu net `40×40px` (`1:1`) kare oranına getirildi.
- **Etkilenen Dosyalar:**
  - `public/css/base.css` (`.app-shell.is-collapsed` altındaki tüm öğeler `40×40px` `1:1` kare)
- **Geri Alma (Rollback):** `public/css/base.css` önceki `.is-collapsed` kurallarına döndürülebilir.

---

## [2026-11-20 15:18] — Gizlenebilir & Sabitlenebilir Sidebar (İkon Şeridi + Kalıcı Tercih)
- **Özet:** Sidebar hem gizlenebilir (ikonlar kalacak şekilde `58px` dar mod) hem de açık şekilde sabitlenebilir (`208px` tam mod) hale getirildi. Kullanıcının seçimi `localStorage` (`tfr_sidebar_collapsed`) üzerinden kalıcı olarak saklanır.
- **Etkilenen Dosyalar:**
  - `public/index.html` (`#sidebar-toggle-btn` eklendi)
  - `public/js/icons.js` (`chevronLeft`, `chevronRight` ikonları eklendi)
  - `public/css/base.css` (`.app-shell.is-collapsed` ve `.sidebar-toggle-btn` stilleri)
  - `public/js/app.js` (Açma/gizleme ve `localStorage` sabitleme mantığı)
- **Geri Alma (Rollback):** `public/js/app.js` ve `public/css/base.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:16] — Kart Simetrisi, Switch Durum Çubuğu & Fan Kademe Taşma Düzeltmesi
- **Özet:** Fan kartındaki 5'li kademe seçicinin sağdan taşma sorunu (`minmax(0, 1fr)`, `0.68rem`, `overflow: hidden`) çözüldü. Priz/anahtar kartlarındaki boşluğu gidermek ve tüm kartları aynı taban çizgisinde simetrik hizalamak için `38px` yüksekliğinde `.switch-status-bar` eklendi ve `.slider-wrap` alt hizaya (`margin-top: auto`) sabitlendi.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`switch` cihazlar için `.switch-status-bar` ve `patchDeviceCard` güncellemesi)
  - `public/css/components.css` (`.devices-grid` minimum `255px`, `.device-card` `min-width: 0; overflow: hidden`, `.fan-steps` taşma düzeltmesi, `.switch-status-bar` simetrik alt çubuk)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:13] — Kart Üzerine Basarak Aç/Kapa & 2 Kelimelik Kısa İsimlendirmeler
- **Özet:** Cihaz kartlarındaki sağ üst toggle switch butonları kaldırıldı; artık kartın üzerine basıldığında cihaz açılıp kapanır (PWM `.touch-slider` ve fan kademe butonları bağımsız çalışır). Tüm cihaz ve senaryo isimleri en fazla 2 kelime olacak şekilde kısaltıldı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (Switch HTML'i kaldırıldı, kart tıklama ile `on/off` tetiklemesi eklendi)
  - `public/css/components.css` (`.device-card` `cursor: pointer`)
  - `config/spaces.config.js` (Tüm cihaz ve senaryo isimleri 2 kelimeye kısaltıldı)
- **Geri Alma (Rollback):** `public/js/components.js` ve `config/spaces.config.js` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:11] — Dış Çerçevesiz Oda Kartları, Standart Font & Standart 8px Radius
- **Özet:** Oda/alan bölümlerinin dış çerçeve kutuları kaldırılarak cihaz kartları doğrudan panele yerleştirildi. Derece, `dBm`, yüzde (`%`) ve saat dahil tüm sayısal alanlar standart `Plus Jakarta Sans` fontuna (`tabular-nums`) alındı; sensör/düğüm rozetleri standart `8px` (`--radius-card`) radius ile hizalandı.
- **Etkilenen Dosyalar:**
  - `public/css/base.css`, `public/css/components.css` (`.space-section` dış çerçeve kaldırıldı, `--font-mono` -> `--font-sans`, rozetlerde `--radius-card`)
  - `SYSTEM_PLAN_AND_RULES.md` (Sayısal değerlerde standart font kuralı eklendi)
- **Geri Alma (Rollback):** `public/css/base.css` ve `public/css/components.css` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:08] — Tam Ekran Kiosk Paneli İskeleti & Mat Karbon Renk Paleti
- **Özet:** Web sitesi görünümünden tamamen çıkılarak `100vw × 100dvh` kenardan kenara tam ekran kiosk paneli iskeleti kuruldu. Standart lacivert/mavi tonlar yerine mat karbon/obsidyen donanım tonları (`#08090c`, `#0e1015`, `#14171f`), ince üst durum çubuğu, sol sabit dock ve sıkı kontrol ızgarası uygulandı.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Kiosk Paneli İskeleti kuralı eklendi)
  - `public/css/tokens.css`, `public/css/base.css`, `public/css/components.css` (Tam ekran kiosk iskeleti ve mat karbon palet)
- **Geri Alma (Rollback):** `git checkout dba1e6d` veya önceki CSS dosyalarına dönüş.

---

## [2026-11-20 15:06] — Dokunmatik Dostu Geniş Bar Slider (HomeKit PWM Stili)
- **Özet:** Dimmer, perde ve PWM fan hızı slider'ları dokunmatik ekranlarda çok daha rahat kullanılabilen kalın bar stiline (`.touch-slider`, dolgu çubuğu + beyaz dikey tutamaç çizgisi) geçirildi.
- **Etkilenen Dosyalar:**
  - `public/css/components.css` (`.touch-slider`, `.touch-slider-fill`, `.touch-slider-handle` stilleri)
  - `public/js/components.js` (Slider HTML yapısı, `patchDeviceCard` ve `input` event güncellemesi)
- **Geri Alma (Rollback):** `components.css` ve `components.js` içindeki slider bloğunu önceki `<input type="range">` stiline döndürün.

---

## [2026-11-20 15:05] — Sidebar Renk Noktalarının Kaldırılması, Buton Font Boyutu & Logo Letter-Spacing
- **Özet:** Sidebar butonlarının solundaki küçük renk daireleri kaldırıldı, buton yazı boyutu ~1px küçültüldü (`0.82rem`) ve logo başlığındaki (`TFR IOT`) `letter-spacing` değeri `-0.04em` olarak azaltıldı.
- **Etkilenen Dosyalar:**
  - `public/js/components.js` (`.nav-color-dot` HTML çıktısı kaldırıldı)
  - `public/css/base.css` (`.nav-color-dot` stilleri kaldırıldı, `.nav-item` `font-size: 0.82rem`, `.brand-title` `letter-spacing: -0.04em`)
- **Geri Alma (Rollback):** `public/js/components.js` ve `public/css/base.css` önceki değerlere döndürülebilir.

---

## [2026-11-20 15:02] — Sidebar Oda İsimleri & İkonları (Merkez, Ofis, Koridor, Makina, Montaj, Gözcü)
- **Özet:** Sidebar ve yaşam alanı isimleri/ikonları **Merkez**, **Ofis**, **Koridor**, **Makina**, **Montaj** ve **Gözcü** olarak güncellendi; her alana uygun özel flat ikonlar ve renk tonları eklendi.
- **Etkilenen Dosyalar:**
  - `public/js/icons.js` (`hub`, `door`, `cog`, `wrench`, `eye` ikonları eklendi)
  - `config/spaces.config.js` (6 alan ve cihazları yeni isimlere göre güncellendi)
  - `src/state/stateManager.js` (`home` ve `night` senaryoları yeni alan/cihaz ID'leriyle uyumlu hale getirildi)
- **Geri Alma (Rollback):** `config/spaces.config.js`, `public/js/icons.js` ve `src/state/stateManager.js` önceki sürüme döndürülebilir.

---

## [2026-11-20 15:00] — Sidebar SVG Logo (`logo-mini.svg`) & Sayfa İsmi (`TFR IOT`)
- **Özet:** Sidebar logosu yüksek keskinlikli vektörel `/img/logo-mini.svg` olarak güncellendi (ayrıca favicon olarak eklendi) ve sayfa/uygulama ismi **TFR IOT** yapıldı.
- **Etkilenen Dosyalar:**
  - `public/index.html` (`<title>TFR IOT</title>`, favicon, sidebar `logo-mini.svg` `<img>` ve marka adı)
  - `public/css/base.css` (`.brand-logo-img` vektörel logo stili)
  - `public/js/app.js` (eski `brand-icon` SVG ataması kaldırıldı)
- **Geri Alma (Rollback):** `public/index.html` ve `public/js/app.js` içindeki marka alanını önceki haline döndürün.

---

## [2026-11-20 14:55] — Varsayılan Sistem Fontu: Plus Jakarta Sans (Self-Hosted Variable WOFF2)
- **Özet:** Google Sans karakterine yakın, `200–800` (Light–ExtraBold) ağırlık aralığına ve tam Türkçe karakter desteğine sahip **Plus Jakarta Sans** yerel olarak eklendi ve sistemin varsayılan fontu yapıldı.
- **Etkilenen Dosyalar:**
  - `public/fonts/plus-jakarta-sans-latin.woff2` (Yeni, 27.3 KB)
  - `public/fonts/plus-jakarta-sans-latin-ext.woff2` (Yeni, 21.7 KB)
  - `public/css/tokens.css` (`@font-face` tanımları ve `--font-sans` güncellemesi)
  - `SYSTEM_PLAN_AND_RULES.md` (Tipografi kuralı eklendi)
- **Geri Alma (Rollback):** `tokens.css` içinde `--font-sans` değerini sistem fontlarına döndürün ve `public/fonts/` klasörünü kaldırın.

---

## [2026-11-20 14:52] — Kart Hover Yukarı/Aşağı Kayma (`translateY`) Stilinin Kaldırılması
- **Özet:** Senaryo ve cihaz kartlarında üzerine gelindiğinde oluşan yukarı/aşağı kayma (`translateY`) hareketi kaldırıldı ve bu kural kalıcı olarak sistem kurallarına eklendi.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (`translateY` yasağı eklendi)
  - `public/css/components.css` (`.scene-card:hover` ve `.device-card:hover` üzerindeki `translateY` kaldırıldı)
- **Geri Alma (Rollback):** İstenirse `components.css` içinde hover renk geçişleri korunarak önceki sürüme dönülebilir.

---

## [2026-11-20 14:50] — Mobil Sol Sidebar, Sıkı Yerleşim & Tek Renk Line/Solid İkon Güncellemesi
- **Özet:** Mobil ve tablet ekranlarda da sidebar ekranın solunda (kompakt ikon şeridi olarak) konumlandırıldı, gereksiz padding ve boşluklar azaltıldı ve ikonlar tek renk (`currentColor`) line flat formata güncellendi.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Mobil sol sidebar, sıkı yerleşim ve monokrom flat ikon kuralları güncellendi)
  - `public/css/base.css`, `public/css/components.css` (Mobil/tablet sol sidebar 58px rail, sıkı padding ve boşluklar)
  - `public/js/icons.js` (Tek renk `currentColor` line flat ikonlar)
- **Geri Alma (Rollback):** `git checkout dba1e6d` veya önceki CSS/ikon dosyalarına dönüş.

---

## [2026-11-20 14:48] — Tailscale / LAN HTTP Erişimi İçin CSP `upgrade-insecure-requests` Düzeltmesi
- **Özet:** Tailscale IP (`http://100.124.25.27:3004`) üzerinden tablet/mobil erişimde tarayıcıların CSS/JS dosyalarını HTTPS'e yükseltip engellemesine neden olan `upgrade-insecure-requests` CSP direktifi HTTP modunda devre dışı bırakıldı ve sunucu açıkça `0.0.0.0` arayüzüne bağlandı.
- **Etkilenen Dosyalar:**
  - `server.js` (`helmet` CSP `upgradeInsecureRequests: null`, `0.0.0.0` bind)
- **Geri Alma (Rollback):** `server.js` içinde `helmet` yapılandırmasını önceki haline döndürün.

---

## [2026-11-20 14:45] — Flat İkon Kütüphanesi & Hafif CSS3 Kart Efektleri
- **Özet:** Tüm ikonlar keskin Flat (düz dolgu) SVG stiline geçirildi; kartlara GPU ve RAM'i zorlamayan estetik CSS3 `linear-gradient` vurguları ve akıcı `cubic-bezier` mikro etkileşimler eklendi.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Flat İkon ve Hafif CSS3 Efekt kuralları güncellendi)
  - `public/js/icons.js` (Tüm ikonlar flat dolgu SVG olarak yeniden yazıldı)
  - `public/css/components.css` (Hafif CSS3 gradient yüzeyler ve `translateY` / `rotate` mikro etkileşimleri eklendi)
- **Geri Alma (Rollback):** `git checkout dba1e6d` veya önceki `icons.js` / `components.css` sürümüne dönüş.

---

## [2026-11-20 14:42] — GPU Dostu Performans Optimizasyonu (Shadow, Glass Blur & Ağır Animasyonların İptali)
- **Özet:** Orta seviye mobil cihazlarda dahi sıfır takılma ile çalışması için `backdrop-filter`, `box-shadow`, arka plan `blur()` küreleri ve sürekli çalışan `@keyframes` animasyonları tamamen kaldırıldı; düz ve net yüksek kontrastlı yüzeylere geçildi.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Performans & Mobil Akıcılık kuralı eklendi)
  - `public/index.html` (`.ambient-bg` blur katmanı kaldırıldı)
  - `public/css/tokens.css`, `public/css/base.css`, `public/css/components.css` (Tüm `box-shadow`, `backdrop-filter`, `will-change` ve `@keyframes` kuralları kaldırıldı)
- **Geri Alma (Rollback):** `git checkout dba1e6d` veya ilgili CSS kurallarının geri yüklenmesi.

---

## [2026-11-20 14:39] — Tasarım Kuralları: Tek Noktadan 8px Radius & Oda Bazlı Renk Tonları
- **Özet:** Bütünleşik tek sayfa kuralı, oda bazlı özel renk tonları ve tüm sistemde tek noktadan yönetilen `8px` kart/bileşen radius kuralı eklendi ve uygulandı.
- **Etkilenen Dosyalar:**
  - `SYSTEM_PLAN_AND_RULES.md` (Bütünleşik mimari, oda renk tonu ve `8px` radius kuralları eklendi)
  - `config/spaces.config.js` (Her yaşam alanına `theme: { accent, glow }` renk tonu tanımlandı)
  - `public/css/tokens.css` (`--radius-card: 8px` merkezi radius değişkeni eklendi)
  - `public/css/base.css`, `public/css/components.css` (Sabit radius değerleri `--radius-card` ile birleştirildi; `--space-accent` oda renk stilleri eklendi)
  - `public/js/components.js` (Oda kartları, navigasyon ve topoloji kartlarına oda renk tonları bağlandı)
- **Geri Alma (Rollback):** `git checkout dba1e6d` veya `tokens.css` içindeki `--radius-card` değerini değiştirin.

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
