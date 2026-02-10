# Telegram Taxi Mini App - PRD

## Описание проекта
Telegram Mini App для службы такси с функционалом для клиентов, водителей и администраторов.

## Статус: ✅ РАЗВЁРНУТО И РАБОТАЕТ

**Дата развёртывания:** 10 февраля 2026
**Домен:** https://taxi.tehnology.com.ru
**Админ-панель:** https://taxi.tehnology.com.ru/admin

---

## Реализованный функционал

### Клиентская часть (Telegram Mini App)
- ✅ Авторизация через Telegram аккаунт
- ✅ Верификация номера телефона через Telegram
- ✅ Создание заказа (адреса откуда/куда, комментарий)
- ✅ Указание цены за поездку (обязательное поле)
- ✅ Просмотр статуса активного заказа
- ✅ Отмена заказа
- ✅ Получение информации о водителе (имя, машина, телефон)
- ✅ Автоматическая отмена заказа через 15 минут без водителя

### Функционал водителей
- ✅ Автоматическая регистрация при вступлении в группу водителей
- ✅ Заполнение данных автомобиля (марка, модель, цвет, номер)
- ✅ Получение новых заказов в группу (без телефона клиента)
- ✅ Принятие заказа кнопкой
- ✅ Получение полной информации о заказе в личные сообщения
- ✅ Удаление заказа из группы после принятия

### Админ-панель (Web)
- ✅ Авторизация по Telegram ID
- ✅ Управление заказами
- ✅ Управление водителями (редактирование профилей)
- ✅ Управление клиентами
- ✅ Просмотр логов действий

---

## Техническая архитектура

### Сервер пользователя
- **Домен:** taxi.tehnology.com.ru
- **MongoDB:** Docker контейнер (mongo:4.4)
- **Backend:** Docker контейнер (FastAPI)
- **Frontend:** Docker контейнер (React + Nginx)
- **SSL:** Let's Encrypt

### Стек технологий
- **Backend:** FastAPI, Motor (async MongoDB), python-telegram-bot
- **Frontend:** React, Tailwind CSS, Telegram Mini App SDK
- **Database:** MongoDB 4.4
- **Deployment:** Docker, Docker Compose, Nginx

### Ключевые переменные окружения
```
TELEGRAM_BOT_TOKEN=***
TELEGRAM_DRIVERS_CHAT_ID=-1002026151302
MONGO_URL=mongodb://172.17.0.1:27017
DB_NAME=taxi_bot
ADMIN_TELEGRAM_IDS=1224747615
WEBAPP_URL=https://taxi.tehnology.com.ru
```

---

## Конфигурация

### Telegram Bot
- **Webhook:** https://taxi.tehnology.com.ru/api/telegram/webhook
- **Mini App URL:** https://taxi.tehnology.com.ru

### Администраторы
- Telegram ID: 1224747615

### Группа водителей
- Chat ID: -1002026151302

---

## Файловая структура на сервере
```
/var/www/taxi/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .env
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── DEPLOY_FULL.md
└── nginx.conf
```

---

## Команды управления

### Docker
```bash
# Статус контейнеров
docker ps

# Логи backend
docker logs taxi-backend --tail 50

# Перезапуск
cd /var/www/taxi && docker-compose restart

# Пересборка
cd /var/www/taxi && docker-compose down && docker-compose up -d --build
```

### Telegram Webhook
```bash
# Проверка webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Установка webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://taxi.tehnology.com.ru/api/telegram/webhook"
```

---

## Будущие улучшения (Backlog)
- [ ] История заказов для клиентов
- [ ] Рейтинг водителей
- [ ] Интеграция с картами для расчёта маршрута
- [ ] Push-уведомления
- [ ] Статистика для админов
