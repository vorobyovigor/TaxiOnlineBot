# 🚖 Telegram Mini App «Служба такси» — Полная инструкция по деплою

## Оглавление
1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка MongoDB](#установка-mongodb)
4. [Установка Node.js и Python](#установка-nodejs-и-python)
5. [Настройка проекта](#настройка-проекта)
6. [Настройка Backend](#настройка-backend)
7. [Настройка Frontend](#настройка-frontend)
8. [Настройка Nginx и SSL](#настройка-nginx-и-ssl)
9. [Настройка Systemd сервисов](#настройка-systemd-сервисов)
10. [Настройка Telegram бота](#настройка-telegram-бота)
11. [Проверка работоспособности](#проверка-работоспособности)
12. [Резервное копирование](#резервное-копирование)
13. [Мониторинг и логи](#мониторинг-и-логи)
14. [Обновление проекта](#обновление-проекта)
15. [Решение проблем](#решение-проблем)

---

## Требования к серверу

### Минимальные требования:
- **CPU:** 1 ядро
- **RAM:** 1 GB
- **Диск:** 20 GB SSD
- **ОС:** Ubuntu 22.04 LTS / Debian 12

### Рекомендуемые требования:
- **CPU:** 2 ядра
- **RAM:** 2 GB
- **Диск:** 40 GB SSD
- **ОС:** Ubuntu 22.04 LTS

### Необходимо:
- Домен (например: taxi.example.com)
- Доступ к DNS для настройки A-записи
- SSH доступ к серверу с правами sudo

---

## Подготовка сервера

### 1. Подключение к серверу
```bash
ssh root@ваш-ip-адрес
```

### 2. Обновление системы
```bash
apt update && apt upgrade -y
```

### 3. Установка базовых утилит
```bash
apt install -y curl wget git nano htop ufw software-properties-common
```

### 4. Настройка файрвола
```bash
# Включаем UFW
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Проверяем статус
ufw status
```

### 5. Создание пользователя для приложения
```bash
# Создаём пользователя
useradd -m -s /bin/bash taxi

# Добавляем в группу sudo (опционально)
usermod -aG sudo taxi

# Создаём директорию для проекта
mkdir -p /var/www/taxi
chown -R taxi:taxi /var/www/taxi
```

### 6. Настройка DNS
В панели управления вашего домена создайте A-запись:
```
Тип: A
Имя: taxi (или @ для корневого домена)
Значение: IP-адрес-вашего-сервера
TTL: 300
```

---

## Установка MongoDB

### 1. Импорт GPG ключа MongoDB
```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
   gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
```

### 2. Добавление репозитория
```bash
# Для Ubuntu 22.04
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

### 3. Установка MongoDB
```bash
apt update
apt install -y mongodb-org
```

### 4. Запуск и автозагрузка
```bash
systemctl start mongod
systemctl enable mongod
systemctl status mongod
```

### 5. Проверка работы MongoDB
```bash
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### 6. Настройка безопасности MongoDB (рекомендуется)
```bash
# Подключаемся к MongoDB
mongosh

# Создаём администратора
use admin
db.createUser({
  user: "admin",
  pwd: "ваш_сложный_пароль_админа",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Создаём пользователя для приложения
use taxi_db
db.createUser({
  user: "taxi_user",
  pwd: "ваш_сложный_пароль",
  roles: [ { role: "readWrite", db: "taxi_db" } ]
})

exit
```

### 7. Включение авторизации (опционально, но рекомендуется)
```bash
nano /etc/mongod.conf
```

Добавьте или раскомментируйте:
```yaml
security:
  authorization: enabled
```

```bash
systemctl restart mongod
```

---

## Установка Node.js и Python

### 1. Установка Node.js 18.x
```bash
# Добавляем репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Устанавливаем Node.js
apt install -y nodejs

# Проверяем версию
node --version
npm --version

# Устанавливаем Yarn глобально
npm install -g yarn
```

### 2. Установка Python 3.11
```bash
# Устанавливаем Python и pip
apt install -y python3 python3-pip python3-venv

# Проверяем версию
python3 --version
pip3 --version
```

---

## Настройка проекта

### 1. Клонирование репозитория
```bash
# Переключаемся на пользователя taxi
su - taxi

# Клонируем репозиторий
cd /var/www/taxi
git clone https://github.com/ваш-username/taxi-app.git .

# Или если репозиторий приватный:
git clone https://ваш-токен@github.com/ваш-username/taxi-app.git .
```

### 2. Структура проекта
```
/var/www/taxi/
├── backend/
│   ├── server.py           # Главный файл FastAPI
│   ├── requirements.txt    # Python зависимости
│   └── .env               # Переменные окружения backend
├── frontend/
│   ├── src/               # Исходный код React
│   ├── public/            # Статические файлы
│   ├── package.json       # Node.js зависимости
│   └── .env              # Переменные окружения frontend
├── docker-compose.yml     # Docker конфигурация (опционально)
├── nginx.conf            # Конфигурация Nginx
└── DEPLOY.md             # Эта инструкция
```

---

## Настройка Backend

### 1. Создание виртуального окружения Python
```bash
cd /var/www/taxi/backend

# Создаём виртуальное окружение
python3 -m venv venv

# Активируем его
source venv/bin/activate

# Обновляем pip
pip install --upgrade pip
```

### 2. Установка зависимостей
```bash
pip install -r requirements.txt
```

### 3. Создание файла .env
```bash
nano .env
```

Содержимое `.env`:
```bash
# MongoDB
# Без авторизации:
MONGO_URL=mongodb://localhost:27017
# С авторизацией:
# MONGO_URL=mongodb://taxi_user:ваш_пароль@localhost:27017/taxi_db?authSource=taxi_db

# Имя базы данных
DB_NAME=taxi_db

# CORS - укажите ваш домен
CORS_ORIGINS=https://taxi.example.com

# Telegram Bot
TELEGRAM_BOT_TOKEN=7084489410:AAF2v3vPHGQOxqDV87KhT3agjPMMYPCFrKQ
TELEGRAM_DRIVERS_CHAT_ID=-1002026151302

# URL Mini App (ваш домен)
WEBAPP_URL=https://taxi.example.com
```

### 4. Проверка работы Backend
```bash
# Активируем venv если не активирован
source venv/bin/activate

# Запускаем для теста
uvicorn server:app --host 127.0.0.1 --port 8001

# Должно появиться:
# INFO:     Uvicorn running on http://127.0.0.1:8001
# Нажмите Ctrl+C для остановки
```

---

## Настройка Frontend

### 1. Установка зависимостей
```bash
cd /var/www/taxi/frontend

# Устанавливаем зависимости через Yarn
yarn install
```

### 2. Создание файла .env
```bash
nano .env
```

Содержимое `.env`:
```bash
REACT_APP_BACKEND_URL=https://taxi.example.com
```

### 3. Сборка production-версии
```bash
yarn build
```

После сборки появится папка `build/` с готовыми статическими файлами.

### 4. Проверка сборки
```bash
ls -la build/
# Должны быть файлы: index.html, static/, asset-manifest.json и др.
```

---

## Настройка Nginx и SSL

### 1. Установка Nginx
```bash
# Возвращаемся к root
exit

apt install -y nginx
systemctl enable nginx
```

### 2. Установка Certbot для SSL
```bash
apt install -y certbot python3-certbot-nginx
```

### 3. Создание конфигурации Nginx
```bash
nano /etc/nginx/sites-available/taxi
```

Содержимое:
```nginx
# Редирект HTTP -> HTTPS
server {
    listen 80;
    server_name taxi.example.com;
    return 301 https://$server_name$request_uri;
}

# Основной сервер HTTPS
server {
    listen 443 ssl http2;
    server_name taxi.example.com;

    # SSL сертификаты (будут созданы Certbot)
    ssl_certificate /etc/letsencrypt/live/taxi.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taxi.example.com/privkey.pem;
    
    # SSL настройки
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Корневая директория - React build
    root /var/www/taxi/frontend/build;
    index index.html;

    # API запросы -> Backend
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router - все остальные запросы на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Логи
    access_log /var/log/nginx/taxi_access.log;
    error_log /var/log/nginx/taxi_error.log;
}
```

### 4. Активация конфигурации
```bash
# Удаляем дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Создаём симлинк
ln -s /etc/nginx/sites-available/taxi /etc/nginx/sites-enabled/

# Проверяем конфигурацию
nginx -t
```

### 5. Получение SSL сертификата
```bash
# Временно запускаем nginx без SSL для валидации
# Закомментируйте строки ssl_certificate в конфиге и listen 443

# Или используйте standalone режим:
systemctl stop nginx

certbot certonly --standalone -d taxi.example.com

# После получения сертификата раскомментируйте SSL строки в nginx конфиге
systemctl start nginx
```

### 6. Автообновление сертификатов
```bash
# Certbot автоматически добавляет cron задачу
# Проверяем:
systemctl status certbot.timer

# Тестируем обновление:
certbot renew --dry-run
```

---

## Настройка Systemd сервисов

### 1. Создание сервиса для Backend
```bash
nano /etc/systemd/system/taxi-backend.service
```

Содержимое:
```ini
[Unit]
Description=Taxi Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=taxi
Group=taxi
WorkingDirectory=/var/www/taxi/backend
Environment="PATH=/var/www/taxi/backend/venv/bin"
ExecStart=/var/www/taxi/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. Запуск сервисов
```bash
# Перезагружаем systemd
systemctl daemon-reload

# Запускаем backend
systemctl start taxi-backend
systemctl enable taxi-backend

# Перезапускаем nginx
systemctl restart nginx

# Проверяем статусы
systemctl status taxi-backend
systemctl status nginx
systemctl status mongod
```

---

## Настройка Telegram бота

### 1. Установка Webhook
```bash
# Замените YOUR_BOT_TOKEN на токен вашего бота
# Замените taxi.example.com на ваш домен

curl -X POST "https://api.telegram.org/bot7084489410:AAF2v3vPHGQOxqDV87KhT3agjPMMYPCFrKQ/setWebhook?url=https://taxi.example.com/api/telegram/webhook"

# Ответ должен быть:
# {"ok":true,"result":true,"description":"Webhook was set"}
```

### 2. Проверка Webhook
```bash
curl "https://api.telegram.org/bot7084489410:AAF2v3vPHGQOxqDV87KhT3agjPMMYPCFrKQ/getWebhookInfo"
```

### 3. Настройка Menu Button (кнопка Mini App)
```bash
curl -X POST "https://api.telegram.org/bot7084489410:AAF2v3vPHGQOxqDV87KhT3agjPMMYPCFrKQ/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🚖 Заказать такси",
      "web_app": {
        "url": "https://taxi.example.com"
      }
    }
  }'
```

### 4. Настройка Chat ID группы водителей
1. Создайте группу в Telegram
2. Добавьте бота в группу и дайте права администратора
3. Добавьте @RawDataBot в группу чтобы узнать Chat ID
4. Скопируйте Chat ID (например: -1002026151302)
5. Обновите TELEGRAM_DRIVERS_CHAT_ID в /var/www/taxi/backend/.env
6. Перезапустите backend: `systemctl restart taxi-backend`

---

## Проверка работоспособности

### 1. Проверка API
```bash
curl https://taxi.example.com/api/
# Ответ: {"message":"Taxi Service API","version":"1.0.0"}
```

### 2. Проверка статистики
```bash
curl https://taxi.example.com/api/admin/stats
```

### 3. Проверка фронтенда
Откройте в браузере: https://taxi.example.com

### 4. Проверка Mini App
1. Откройте чат с ботом в Telegram
2. Нажмите кнопку "🚖 Заказать такси"
3. Должно открыться Mini App

### 5. Полный тест заказа
1. Откройте Mini App
2. Подтвердите номер телефона
3. Заполните форму заказа
4. Проверьте что заказ пришёл в группу водителей

---

## Резервное копирование

### 1. Скрипт резервного копирования MongoDB
```bash
nano /var/www/taxi/backup.sh
```

Содержимое:
```bash
#!/bin/bash

# Настройки
BACKUP_DIR="/var/backups/taxi"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="taxi_db"

# Создаём директорию для бэкапов
mkdir -p $BACKUP_DIR

# Создаём дамп MongoDB
mongodump --db $DB_NAME --out $BACKUP_DIR/$DATE

# Архивируем
cd $BACKUP_DIR
tar -czf $DATE.tar.gz $DATE
rm -rf $DATE

# Удаляем бэкапы старше 30 дней
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/$DATE.tar.gz"
```

```bash
chmod +x /var/www/taxi/backup.sh
```

### 2. Настройка автоматического бэкапа (cron)
```bash
crontab -e
```

Добавьте строку (бэкап каждый день в 3:00):
```
0 3 * * * /var/www/taxi/backup.sh >> /var/log/taxi-backup.log 2>&1
```

### 3. Восстановление из бэкапа
```bash
# Распаковываем архив
cd /var/backups/taxi
tar -xzf 20260209_030000.tar.gz

# Восстанавливаем базу
mongorestore --db taxi_db --drop 20260209_030000/taxi_db
```

---

## Мониторинг и логи

### 1. Просмотр логов Backend
```bash
# Все логи
journalctl -u taxi-backend

# Последние 100 строк
journalctl -u taxi-backend -n 100

# В реальном времени
journalctl -u taxi-backend -f
```

### 2. Просмотр логов Nginx
```bash
# Access логи
tail -f /var/log/nginx/taxi_access.log

# Error логи
tail -f /var/log/nginx/taxi_error.log
```

### 3. Просмотр логов MongoDB
```bash
tail -f /var/log/mongodb/mongod.log
```

### 4. Проверка использования ресурсов
```bash
# Общая информация
htop

# Использование диска
df -h

# Использование памяти
free -h
```

---

## Обновление проекта

### 1. Получение обновлений из репозитория
```bash
cd /var/www/taxi

# Переключаемся на пользователя taxi
su - taxi

# Получаем изменения
git pull origin main
```

### 2. Обновление Backend
```bash
cd /var/www/taxi/backend

# Активируем venv
source venv/bin/activate

# Обновляем зависимости
pip install -r requirements.txt

# Выходим из venv
deactivate

# Перезапускаем сервис (от root)
exit
systemctl restart taxi-backend
```

### 3. Обновление Frontend
```bash
su - taxi
cd /var/www/taxi/frontend

# Обновляем зависимости
yarn install

# Пересобираем
yarn build

exit
```

### 4. Проверка после обновления
```bash
systemctl status taxi-backend
curl https://taxi.example.com/api/
```

---

## Решение проблем

### Проблема: Backend не запускается
```bash
# Проверяем логи
journalctl -u taxi-backend -n 50

# Частые причины:
# 1. Ошибка в .env файле
# 2. MongoDB не запущен
# 3. Ошибка в коде Python
```

### Проблема: 502 Bad Gateway
```bash
# Проверяем что backend работает
systemctl status taxi-backend

# Проверяем что порт слушается
ss -tlnp | grep 8001

# Проверяем nginx конфигурацию
nginx -t
```

### Проблема: MongoDB не подключается
```bash
# Проверяем статус MongoDB
systemctl status mongod

# Проверяем подключение
mongosh --eval "db.runCommand({ connectionStatus: 1 })"

# Проверяем .env
cat /var/www/taxi/backend/.env | grep MONGO
```

### Проблема: Telegram Webhook не работает
```bash
# Проверяем webhook
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"

# Проверяем SSL сертификат
curl -I https://taxi.example.com

# Проверяем логи при отправке сообщения боту
journalctl -u taxi-backend -f
```

### Проблема: Mini App не открывается
1. Проверьте что домен доступен по HTTPS
2. Проверьте что Telegram WebApp SDK загружается
3. Откройте консоль разработчика в браузере для диагностики

---

## Полезные команды

```bash
# Перезапуск всех сервисов
systemctl restart mongod taxi-backend nginx

# Проверка всех сервисов
systemctl status mongod taxi-backend nginx

# Очистка логов (осторожно!)
journalctl --vacuum-time=7d

# Проверка места на диске
du -sh /var/www/taxi/*
du -sh /var/backups/taxi/*

# Подключение к MongoDB
mongosh taxi_db

# Просмотр коллекций
mongosh taxi_db --eval "db.getCollectionNames()"

# Просмотр заказов
mongosh taxi_db --eval "db.orders.find().sort({created_at: -1}).limit(10).pretty()"
```

---

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи (см. раздел "Мониторинг и логи")
2. Проверьте статус сервисов
3. Убедитесь что все переменные окружения заполнены корректно

---

**Версия документации:** 1.0
**Дата обновления:** Февраль 2026
