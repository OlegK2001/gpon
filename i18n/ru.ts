// Russian localization dictionary

export const ru = {
  topbar: {
    title: 'GPON Сетевой Симулятор',
    connect: 'Соединить',
    start: 'Пуск',
    stop: 'Стоп',
    reset: 'Сброс',
    speed: 'Скорость',
    save: 'Сохранить',
    load: 'Загрузить',
    running: 'Работает',
    slow: 'Медленно (0.5x)',
    fast: 'Быстро (2x)',
    connectionMode: 'Режим соединения - Кликните на два устройства для соединения',
  },
  panels: {
    deviceConfig: 'Конфигурация устройства',
    consoleLogs: 'Журнал консоли',
    trafficMonitor: 'Монитор трафика',
    security: 'Безопасность и атаки',
    attackMode: 'Режим атаки активен',
    step1: 'Шаг 1: Выберите источник атаки',
    step2: 'Шаг 2: Выберите цель атаки',
    addDevices: 'Добавить устройства',
    launchAttacks: 'Запустить атаки для тестирования',
  },
  attacks: {
    arp: 'ARP-отравление',
    dos: 'DoS-атака',
    ddos: 'DDoS-атака',
    rogue: 'Поддельное ONU',
    mac: 'MAC-флуд',
    mitm: 'Человек посередине',
    sniff: 'Перехват пакетов',
    scan: 'Сканирование портов',
    unauthorized: 'Несанкционированный доступ',
    arp_poisoning: 'ARP-подмена',
    rogue_onu: 'Несанкционированное ONU',
    mac_flooding: 'MAC-флуд',
    port_scan: 'Сканирование портов',
    packet_sniffing: 'Перехват пакетов',
    unauthorized_access: 'Несанкционированный доступ',
  },
  attackSeverity: {
    critical: 'КРИТИЧЕСКИЙ',
    high: 'ВЫСОКИЙ',
    medium: 'СРЕДНИЙ',
    low: 'НИЗКИЙ',
  },
  buttons: {
    stopAttack: 'Остановить',
    launchAttack: 'Запустить атаку',
  },
  status: {
    running: 'Идёт',
    paused: 'Пауза',
    active: 'Активно',
    inactive: 'Неактивно',
  },
  messages: {
    attackCancelled: 'Режим атаки отменён',
    sourceSelected: 'Источник атаки выбран',
    targetSelected: 'Цель атаки выбрана',
    attackLaunched: 'Атака запущена',
    cannotAttackSelf: 'Невозможно атаковать то же устройство! Выберите другую цель.',
    firstDeviceSelected: 'Первое устройство выбрано',
    clickSecondDevice: 'Кликните на второе устройство для соединения',
    cannotConnectToSelf: 'Невозможно соединить устройство с самим собой! Выберите другое устройство.',
    connected: 'Соединено',
    connectionModeActive: 'Режим соединения: Кликните на два устройства для соединения',
    needTwoDevices: 'Необходимо как минимум 2 устройства для запуска атаки',
  },
  activeAttack: {
    title: 'Активная атака',
    connectedToNetwork: 'Атакующий подключен к сети',
    scanningTarget: 'Сканирование цели',
    sendingFloodPackets: 'Отправка пакетов наводнения',
    interceptingTraffic: 'Перехват трафика',
    poisoningARP: 'Отравление ARP-таблицы',
    unauthorizedONU: 'Обнаружено несанкционированное ONU',
    floodingMAC: 'Заполнение MAC-таблицы',
    scanningPorts: 'Сканирование портов',
    capturingPackets: 'Захват пакетов',
    attemptingAccess: 'Попытка доступа',
    impact: 'Воздействие',
    packetsDropped: 'пакетов потеряно',
    devicesAffected: 'устройств затронуто',
    attacker: 'Атакующий',
    target: 'Цель',
  },
  devices: {
    olt: 'OLT',
    onu: 'ONU',
    ont: 'ONT',
    splitter: 'Сплиттер',
    router: 'Роутер',
    switch: 'Коммутатор',
    pc: 'ПК',
    server: 'Сервер',
  },
}

export type Dict = typeof ru

/**
 * Simple translation function
 * @param path - Dot-separated path to translation key (e.g., 'topbar.connect')
 * @returns Translated string or path if not found
 */
export const t = <K extends string>(path: K): string => {
  return path
    .split('.')
    .reduce<any>((a, k) => (a && a[k] !== undefined ? a[k] : path), ru) as string
}

