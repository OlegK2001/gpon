# Архитектура системы

## Обзор

GPON Network Simulator состоит из трёх основных компонентов:

1. **Frontend** — React-интерфейс для визуализации
2. **Backend** — FastAPI сервер с логикой симуляции
3. **Database** — PostgreSQL для хранения конфигураций

## Слои приложения

### Frontend Layer

```
React Application
├── Components
│   ├── TopologyView      # Визуализация топологии
│   ├── Sidebar           # Панель сценариев
│   ├── MetricsPanel      # Метрики и логи
│   └── DeviceCard        # Карточка устройства
├── State Management      # React hooks
├── API Client           # Axios для backend
└── WebSocket Client     # Real-time updates
```

**Технологии**:
- React 18 + TypeScript
- TailwindCSS для стилей
- Recharts для графиков
- Socket.IO для WebSocket

### Backend Layer

```
FastAPI Application
├── API Routes
│   ├── /api/topology     # Управление топологией
│   ├── /api/devices      # CRUD устройств
│   ├── /api/scenarios    # Сценарии атак
│   └── /api/metrics      # Метрики
├── Models
│   ├── device.py         # Модели устройств
│   ├── protocols.py      # Симуляция протоколов
│   └── scenarios.py      # Сценарии атак
├── WebSocket
│   └── /ws               # Real-time broadcast
└── Background Tasks
    └── Scenario Runner   # Выполнение атак
```

**Технологии**:
- FastAPI
- Pydantic для валидации
- Asyncio для параллельной работы
- Redis для координации

### Simulation Layer

```
Simulation Engine
├── Device Manager        # Управление устройствами
├── Protocol Simulator    # OMCI, DHCP, ARP, etc.
└── Scenario Runner       # Выполнение атак

Devices:
├── OLT                  # T-CONT, DBA, OMCI
├── ONT                  # OMCI slave, authentication
├── CPE Router           # DHCP client, NAT, firewall
├── Client               # Traffic generation
├── Switch               # L2 switching, VLAN
└── Server               # DHCP server, BRAS
```

## Потоки данных

### Device Management Flow

```
Client Request → API Endpoint → Device Manager → Protocol Simulator
                                              ↓
                                         State Update
                                              ↓
Client ← WebSocket Broadcast ← Device Manager
```

### Attack Scenario Flow

```
User Selects Scenario → Scenario Runner → Action Handlers
                                         ↓
                                    Protocol Simulator
                                         ↓
                                    Device Manager
                                         ↓
User ← WebSocket Update ← Metrics & Logs
```

### Real-time Monitoring Flow

```
Protocol Events → Log Collector → Metrics Aggregator
                                ↓
                           WebSocket Push
                                ↓
All Connected Clients
```

## Протоколы

### OMCI Simulation

```python
OMCICommand {
    device_id: str
    command_type: str  # set_vlan, reboot, firmware_update
    parameters: dict
    timestamp: datetime
}

# Execution flow:
ONT Request → OLT Validation → Command Execution → Response
```

### DHCP Simulation

```python
DHCPDiscovery {
    mac_address: str
    hostname: Optional[str]
}

# Flow:
Discover → Offer (if available) → Request → ACK
# Threat: Starvation (flood discovers)
# Threat: Spoofing (fake offers)
```

### ARP Simulation

```python
ARPTable {
    ip_address: str → mac_address: str
}

# Flow:
ARP Request → ARP Reply → Table Update
# Threat: Poisoning (fake replies)
# Effect: MITM routing
```

## Хранение данных

### Persistent Storage

- **PostgreSQL**: Конфигурации, сценарии, пользователи
- **TimescaleDB**: Временные метрики (опционально)
- **Redis**: Кэш, сессии, очереди

### In-Memory

- **Device Manager**: Текущая топология
- **Protocol Simulator**: DHCP leases, ARP table
- **Scenario Runner**: Активные сценарии

## Масштабируемость

### Горизонтальное масштабирование

```
Load Balancer
├── Frontend Instance 1
├── Frontend Instance 2
└── Frontend Instance N

Message Queue (Redis)
├── Backend Worker 1
├── Backend Worker 2
└── Backend Worker N
```

### Вертикальное масштабирование

- **Frontend**: Статические файлы на CDN
- **Backend**: Увеличение CPU/RAM для большего числа устройств
- **Database**: Репликация для чтения

## Безопасность

### Аутентификация

- JWT-токены для API
- WebSocket аутентификация
- RBAC для ролей (admin/teacher/student)

### Изоляция

- Симулятор работает в изолированной среде
- Нет доступа к реальным сетям
- Логирование всех действий

## Производительность

### Оптимизации

- Lazy loading компонентов UI
- Virtualization для больших топологий
- Batch updates для метрик
- Connection pooling для DB

### Ограничения MVP

- До 1000 устройств
- До 100 одновременных пользователей
- До 10 активных сценариев

## Тестирование

```
Unit Tests
├── Device models
├── Protocol simulation
└── Scenario execution

Integration Tests
├── API endpoints
├── WebSocket communication
└── Full attack scenarios

E2E Tests
└── Playwright
    ├── Topology creation
    ├── Scenario execution
    └── Metrics verification
```

## Развёртывание

### Development

```bash
docker-compose up
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

```yaml
# docker-compose.prod.yml includes:
- Nginx reverse proxy
- SSL certificates
- Database backups
- Monitoring (Prometheus/Grafana)
```

## Расширяемость

### Плагины

Система поддерживает добавление:
- Новых типов устройств
- Новых протоколов
- Новых сценариев атак
- Новых визуализаций

### API для интеграции

- REST API для внешних инструментов
- Webhook для уведомлений
- SIEM интеграция через syslog
- Grafana для метрик

