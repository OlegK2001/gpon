// Network Device Types
export type DeviceType = 'OLT' | 'ONU' | 'ONT' | 'SPLITTER' | 'ROUTER' | 'SWITCH' | 'PC' | 'SERVER'

export interface Position {
  x: number
  y: number
}

export interface NetworkDevice {
  id: string
  type: DeviceType
  position: Position
  name: string
  ipAddress?: string
  macAddress?: string
  ports: Port[]
  config: DeviceConfig
  status: 'active' | 'inactive' | 'error'
  statusLevel?: number // 0 = normal, 1 = yellow (warning), 2 = orange (moderate), 3 = red (critical)
  serialNumber?: string
}

export interface Port {
  id: string
  number: number
  type: 'optical' | 'ethernet' | 'wan'
  status: 'up' | 'down'
  connectedTo?: string // connection id
  speed?: string
  duplex?: 'full' | 'half'
}

export interface Connection {
  id: string
  sourceDeviceId: string
  sourcePortId: string
  targetDeviceId: string
  targetPortId: string
  type: 'optical' | 'ethernet'
  status: 'active' | 'inactive'
}

export interface DeviceConfig {
  vlan?: number[]
  routing?: RoutingConfig
  firewall?: FirewallConfig
  gponConfig?: GponConfig
  attackMode?: 'eavesdrop' | 'bruteforce' | 'ddos' // Режим атаки для несанкционированных устройств
  isAttackDevice?: boolean // Флаг атакующего устройства
  attackKind?: AttackType // Тип атаки для атакующего устройства
  // ID код для отображения в кружочке (например "7" или "42")
  idCode?: string
  // Флаг, что ID был подобран (для чёрного текста)
  idCracked?: boolean
}

export interface RoutingConfig {
  enabled: boolean
  routes: Route[]
}

export interface Route {
  destination: string
  gateway: string
  metric: number
}

export interface FirewallConfig {
  enabled: boolean
  rules: FirewallRule[]
}

export interface FirewallRule {
  id: string
  action: 'allow' | 'deny'
  protocol: 'tcp' | 'udp' | 'icmp' | 'any'
  source: string
  destination: string
  port?: number
}

export interface GponConfig {
  wavelengthDown?: number // 1490nm typically
  wavelengthUp?: number // 1310nm typically
  splitterRatio?: string // e.g., "1:32"
  maxDistance?: number // in km
  encryptionEnabled?: boolean
  // ONU/ONT registration info
  onuId?: number
  allocId?: number
  gemPort?: number
  serialNumber?: string
  // Двухзначный идентификатор ONT/ONU (00-99)
  gponId2?: string
  // Для OLT > 1: список известных ONT/ONU ID
  knownOntIds?: number[]
  // Номер OLT (для определения главного OLT #1)
  oltNumber?: number
}

// Packet Types for Simulation
export type PacketDirection = 'DOWNSTREAM' | 'UPSTREAM'
export type PayloadType = 'BROADCAST' | 'SERVICE' | 'USER_TRAFFIC' | 'ATTACK' | 'RESPONSE'

// Attack Types
export type AttackType = 'EAVESDROP' | 'BRUTEFORCE_ID' | 'UNAUTHORIZED_ONT' | 'ONT_SPOOF' | 'DDOS'

export interface ActiveAttack {
  isActive: boolean
  attackerDeviceId?: string
  timers: number[] // NodeJS.Timeout IDs
  packetIds: string[]
  targetDeviceId?: string // для spoof
  // Для ONT_SPOOF: информация для восстановления
  attackSplitterId?: string
  parentDeviceId?: string
  originalConnectionId?: string
  originalSourcePortId?: string
  originalTargetPortId?: string
  // Для DDoS: узел перегруза (congestion point)
  congestionNodeId?: string
  // Для ONT_SPOOF: ID подменного ONT и атакующего ПК
  substituteOntId?: string
  attackerPcId?: string
  // Для EAVESDROP и DDOS: информация о tap point
  tapSplitterId?: string
  createdSplitterId?: string
  replacedEdge?: { id: string; sourceId: string; targetId: string; sourcePortId: string; targetPortId: string; type: 'optical' | 'ethernet' }
  // Для EAVESDROP: ID сниффера и ПК атакующего
  snifferOntId?: string
  eavesdropPcId?: string
  // Для EAVESDROP: список найденных кодов устройств
  crackedCodes?: Array<{ deviceId: string; code: string }>
  // Для ONT_SPOOF: текущий ключ подбора и флаг forced success
  currentBruteKey?: string // Текущий ключ подбора (01-99)
  forcedSuccess?: boolean // Флаг принудительного успеха на 99
}

export interface Packet {
  id: string
  type: 'ethernet' | 'ip' | 'tcp' | 'udp' | 'icmp' | 'arp' | 'gpon'
  source: string // device id источника
  destination: string // device id назначения (может быть null для broadcast)
  current: string // текущее устройство, где находится пакет
  direction: PacketDirection // направление: DOWNSTREAM или UPSTREAM
  targetOntId?: string | null // идентификатор ONT/ONU, для которого пакет предназначен
  payloadType: PayloadType // тип пакета
  data: PacketData
  path: string[] // device IDs it travels through (для логирования и анимации)
  currentPosition: number
  timestamp: number
}

export interface PacketData {
  // Layer 2
  sourceMac?: string
  destMac?: string
  etherType?: string
  vlan?: number
  
  // Layer 3
  sourceIp?: string
  destIp?: string
  protocol?: string
  ttl?: number
  
  // Layer 4
  sourcePort?: number
  destPort?: number
  flags?: string[]
  
  // Layer 7
  payload?: string
  
  // GPON specific
  gponFrame?: {
    gemPort?: number
    allocId?: number
    onuId?: number
  }
  
  // Packet metadata (без анимации)
  packetColor?: 'yellow' | 'blue' | 'red' | 'orange'
  direction?: 'downstream' | 'upstream'
}

// OSI Layer representation
export type OSILayer = 'physical' | 'datalink' | 'network' | 'transport' | 'session' | 'presentation' | 'application'

export interface OSILayerInfo {
  layer: OSILayer
  layerNumber: number
  name: string
  protocols: string[]
  description: string
}

// Simulation State
export interface SimulationState {
  isRunning: boolean
  speed: number // 1x, 2x, 4x, etc.
  currentTime: number
  packets: Packet[]
  logs: LogEntry[]
  // Состояние потока пакетов по дереву
  flowDirection?: 'DOWNSTREAM' | 'UPSTREAM' | null // null = не инициализировано
  downstreamPacketsCompleted?: boolean // все пакеты вниз завершены
  upstreamStartTime?: number // время начала обратного процесса
}

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warning' | 'error' | 'critical'
  deviceId?: string
  message: string
  details?: any
}

