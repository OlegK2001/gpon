# Инструкция по установке

## Требования

### Минимальные системные требования

- **ОС**: Windows 10/11, Linux (Ubuntu 20.04+), macOS 10.15+
- **RAM**: 4GB (рекомендуется 8GB)
- **Диск**: 2GB свободного места
- **Процессор**: 2 ядра (рекомендуется 4+)

### Программное обеспечение

- **Docker**: 20.10+ (рекомендуется для быстрого запуска)
  - Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Linux: `sudo apt-get install docker.io docker-compose`
  - macOS: `brew install docker docker-compose`

ИЛИ

- **Python**: 3.10 или выше
- **Node.js**: 18 или выше
- **PostgreSQL**: 15 (опционально, для production)
- **Redis**: 7 (опционально, для очередей)

## Способ 1: Docker (Рекомендуется)

### Быстрый старт

```bash
# Клонировать репозиторий
git clone <repository-url>
cd gpon-simulator

# Запустить все сервисы
docker-compose up -d

# Проверить статус
docker-compose ps

# Просмотреть логи
docker-compose logs -f

# Остановить
docker-compose down
```

### Доступ к приложению

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Способ 2: Локальная установка

### Шаг 1: Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv

# Активировать (Windows)
venv\Scripts\activate

# Активировать (Linux/macOS)
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Запустить сервер
python main.py
```

Backend будет доступен на http://localhost:8000

### Шаг 2: Frontend

```bash
# В новом терминале
cd frontend

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

Frontend будет доступен на http://localhost:3000

### Шаг 3: Redis (Опционально)

```bash
# Windows
# Скачать и запустить Redis: https://redis.io/download

# Linux
sudo apt-get install redis-server
redis-server

# macOS
brew install redis
brew services start redis
```

## Проверка установки

### 1. Проверить Backend

```bash
curl http://localhost:8000/
# Должен вернуть: {"status":"running",...}
```

### 2. Проверить Frontend

Откройте http://localhost:3000 — должна загрузиться главная страница.

### 3. Проверить API

```bash
curl http://localhost:8000/api/scenarios/
# Должен вернуть список сценариев
```

## Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gponsim

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
JWT_EXPIRATION=3600

# Frontend
VITE_API_URL=http://localhost:8000
```

### Настройка производительности

Для больших топологий (>100 устройств):

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Устранение проблем

### Проблема: Порт занят

```bash
# Linux/macOS: найти процесс
lsof -i :8000
kill -9 <PID>

# Windows: найти процесс
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Проблема: Docker не запускается

```bash
# Проверить Docker
docker --version
docker-compose --version

# Перезапустить Docker Desktop
# Windows: Перезапустить Docker Desktop
# Linux: sudo systemctl restart docker
```

### Проблема: Зависимости не устанавливаются

```bash
# Python: обновить pip
python -m pip install --upgrade pip

# Node: очистить кэш
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Проблема: База данных не подключается

```bash
# Проверить PostgreSQL
docker-compose logs postgres

# Сбросить базу
docker-compose down -v
docker-compose up -d
```

## Обновление

```bash
# Остановить
docker-compose down

# Обновить код
git pull

# Пересобрать
docker-compose build --no-cache

# Запустить
docker-compose up -d
```

## Production развёртывание

### Nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL сертификаты

```bash
# Certbot для Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### Системные сервисы

```bash
# systemd service для backend
sudo nano /etc/systemd/system/gpon-backend.service
```

```ini
[Unit]
Description=GPON Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/gpon-simulator/backend
ExecStart=/opt/gpon-simulator/backend/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable gpon-backend
sudo systemctl start gpon-backend
```

## Поддержка

Если возникли проблемы:

1. Проверьте логи: `docker-compose logs -f`
2. Прочитайте [FAQ](FAQ.md)
3. Создайте issue на GitHub
4. Напишите разработчикам

## Следующие шаги

- Прочитайте [Руководство пользователя](user-guide.md)
- Изучите [Архитектуру](architecture.md)
- Запустите первый сценарий
- Создайте свою топологию

