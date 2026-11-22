#!/bin/bash
# ====================================================
# 🌐 TEKFİKİR - IOT DASHBOARD SUNUCU GÜNCELLEME BETİĞİ (update.sh)
# ====================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "\n${CYAN}====================================================${NC}"
echo -e "${CYAN}🌐 TEKFİKİR - IOT GÜNCELLEME SÜRECİ BAŞLATILIYOR...${NC}"
echo -e "${CYAN}📍 Dizin: ${PROJECT_DIR}${NC}"
echo -e "${CYAN}====================================================${NC}\n"

# 0. Canlı Kiosk Kart Düzeni (data/layout.json) Yedeklemesi
LAYOUT_BACKUP=""
if [ -f "data/layout.json" ]; then
  LAYOUT_BACKUP="$(cat data/layout.json)"
fi

# 1. Git Güncellemesi
echo -e "${YELLOW}📥 [1/4] Git deposundan güncel dosyalar çekiliyor...${NC}"
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true
git fetch origin main
git reset --hard origin/main
if [ -n "$LAYOUT_BACKUP" ] && [ "$LAYOUT_BACKUP" != "{}" ]; then
  mkdir -p data
  printf '%s\n' "$LAYOUT_BACKUP" > data/layout.json
fi
echo -e "${GREEN}✔ Git deposu güncellendi.${NC}\n"

# 2. .env Dosyası Kontrolü
echo -e "${YELLOW}⚙️ [2/4] Ortam değişkenleri (.env) kontrol ediliyor...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    echo -e "${YELLOW}ℹ️ .env bulunamadı, .env.production kopyalanıyor...${NC}"
    cp .env.production .env
  elif [ -f .env.example ]; then
    cp .env.example .env
  fi
fi
echo -e "${GREEN}✔ .env dosyası hazır.${NC}\n"

# 3. Bağımlılıkların Güncellenmesi & İzinler
echo -e "${YELLOW}📦 [3/4] Node.js bağımlılıkları güncelleniyor (npm install)...${NC}"
export PATH="/www/server/nodejs/v24.19.0/bin:$PATH"
chown -R tfr_server:www "$PROJECT_DIR" 2>/dev/null || sudo chown -R tfr_server:www "$PROJECT_DIR" 2>/dev/null || true
npm install --omit=dev --no-audit --no-fund
mkdir -p data
chown -R www:www "$PROJECT_DIR/data" 2>/dev/null || sudo chown -R www:www "$PROJECT_DIR/data" 2>/dev/null || true
echo -e "${GREEN}✔ Bağımlılıklar başarıyla yüklendi.${NC}\n"

# 4. aaPanel Node Servisi / PM2 Yeniden Başlatma
echo -e "${YELLOW}🔄 [4/4] Uygulama servisi (iot_tekfikir) yeniden başlatılıyor...${NC}"
if [ -f "/www/server/panel/script/nodejs-service.py" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    /www/server/panel/pyenv/bin/python /www/server/panel/script/nodejs-service.py iot_tekfikir restart
  else
    sudo /www/server/panel/pyenv/bin/python /www/server/panel/script/nodejs-service.py iot_tekfikir restart
  fi
  chown -R tfr_server:www "$PROJECT_DIR" 2>/dev/null || sudo chown -R tfr_server:www "$PROJECT_DIR" 2>/dev/null || true
  chmod -R 775 "$PROJECT_DIR" 2>/dev/null || true
  echo -e "${GREEN}✔ aaPanel Node servisi (iot_tekfikir - Port 3004) yeniden başlatıldı.${NC}"
elif command -v pm2 &> /dev/null; then
  if pm2 describe iot_tekfikir > /dev/null 2>&1; then
    pm2 restart iot_tekfikir
    echo -e "${GREEN}✔ PM2 servisi (iot_tekfikir) yeniden başlatıldı.${NC}"
  else
    pm2 start server.js --name "iot_tekfikir" --time
    pm2 save
    echo -e "${GREEN}✔ PM2 servisi 'iot_tekfikir' adıyla başlatıldı ve kaydedildi.${NC}"
  fi
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 TEKFİKİR - IOT BAŞARIYLA GÜNCELLENDİ!${NC}"
echo -e "${CYAN}🌐 Web Adresi : http://iot.tfrserver.com.tr (Port: 3004)${NC}"
echo -e "${CYAN}🌿 Son Commit : $(git log -1 --format='%h - %s (%cr)')${NC}"
echo -e "${GREEN}====================================================${NC}\n"
