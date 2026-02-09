# Telegram Mini App «Служба такси» — Инструкция по деплою

## Вариант 1: Docker Compose (рекомендуется)

### Требования
- Docker 20+
- Docker Compose 2+
- Домен с SSL-сертификатом (для Telegram Mini App обязателен HTTPS)

### Шаги установки

1. **Склонируйте репозиторий на сервер:**
```bash
git clone https://github.com/ваш-репозиторий/taxi-app.git
cd taxi-app
```

2. **Создайте файл `.env` в корне проекта:**
```bash
cp .env.example .env
nano .env
```

Заполните переменные:
```
MONGO_URL=mongodb://mongodb:27017
DB_NAME=taxi_db
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_DRIVERS_CHAT_ID=-1002026151302
WEBAPP_URL=https://ваш-домен.ru
REACT_APP_BACKEND_URL=https://ваш-домен.ru
```

3. **Запустите через Docker Compose:**
```bash
docker-compose up -d --build
```

4. **Настройте Nginx (см. nginx.conf в проекте)**

5. **Установите webhook для бота:**
```bash
curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url=https://ваш-домен.ru/api/telegram/webhook"
```

---

## Вариант 2: Ручная установка (systemd)

### Требования
- Ubuntu 22.04+ / Debian 12+
- Python 3.10+
- Node.js 18+
- MongoDB 6+
- Nginx
- Certbot (для SSL)

### Шаг 1: Установка зависимостей

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Python
sudo apt install python3 python3-pip python3-venv -y

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y
npm install -g yarn

# MongoDB
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install mongodb-org -y
sudo systemctl enable mongod
sudo systemctl start mongod

# Nginx
sudo apt install nginx -y
sudo systemctl enable nginx
```

### Шаг 2: Создание пользователя и папок

```bash
sudo useradd -m -s /bin/bash taxi
sudo mkdir -p /var/www/taxi
sudo chown -R taxi:taxi /var/www/taxi
```

### Шаг 3: Копирование проекта

```bash
sudo -u taxi git clone https://github.com/ваш-репозиторий/taxi-app.git /var/www/taxi
cd /var/www/taxi
```

### Шаг 4: Настройка Backend

```bash
cd /var/www/taxi/backend

# Создаём виртуальное окружение
sudo -u taxi python3 -m venv venv
sudo -u taxi ./venv/bin/pip install -r requirements.txt

# Создаём .env файл
sudo -u taxi nano .env
```

Содержимое `.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=taxi_db
CORS_ORIGINS=https://ваш-домен.ru
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_DRIVERS_CHAT_ID=-1002026151302
WEBAPP_URL=https://ваш-домен.ru
```

### Шаг 5: Настройка Frontend

```bash
cd /var/www/taxi/frontend

# Создаём .env файл
sudo -u taxi nano .env
```

Содержимое `.env`:
```
REACT_APP_BACKEND_URL=https://ваш-домен.ru
```

```bash
# Устанавливаем зависимости и собираем
sudo -u taxi yarn install
sudo -u taxi yarn build
```

### Шаг 6: Создание systemd сервиса для Backend

```bash
sudo nano /etc/systemd/system/taxi-backend.service
```

Содержимое:
```ini
[Unit]
Description=Taxi Backend API
After=network.target mongod.service

[Service]
User=taxi
Group=taxi
WorkingDirectory=/var/www/taxi/backend
Environment="PATH=/var/www/taxi/backend/venv/bin"
ExecStart=/var/www/taxi/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable taxi-backend
sudo systemctl start taxi-backend
```

### Шаг 7: Настройка Nginx

```bash
sudo nano /etc/nginx/sites-available/taxi
```

Содержимое:
```nginx
server {
    listen 80;
    server_name ваш-домен.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ваш-домен.ru;

    ssl_certificate /etc/letsencrypt/live/ваш-домен.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ваш-домен.ru/privkey.pem;

    # Frontend (React build)
    root /var/www/taxi/frontend/build;
    index index.html;

    # API проксирование
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # React Router - все остальные запросы на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/taxi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 8: SSL сертификат (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d ваш-домен.ru
```

### Шаг 9: Установка Webhook

```bash
curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url=https://ваш-домен.ru/api/telegram/webhook"
```

---

## Проверка работоспособности

```bash
# Статус сервисов
sudo systemctl status taxi-backend
sudo systemctl status nginx
sudo systemctl status mongod

# Логи backend
sudo journalctl -u taxi-backend -f

# Тест API
curl https://ваш-домен.ru/api/
```

---

## Обновление проекта

```bash
cd /var/www/taxi
sudo -u taxi git pull

# Backend
sudo systemctl restart taxi-backend

# Frontend (если изменился)
cd frontend
sudo -u taxi yarn install
sudo -u taxi yarn build
```

---

## Резервное копирование MongoDB

```bash
# Создать бэкап
mongodump --db taxi_db --out /backup/mongo/$(date +%Y%m%d)

# Восстановить
mongorestore --db taxi_db /backup/mongo/20260209/taxi_db
```
