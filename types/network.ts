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
}

// Packet Types for Simulation
export interface Packet {
  id: string
  type: 'ethernet' | 'ip' | 'tcp' | 'udp' | 'icmp' | 'arp' | 'gpon'
  source: string
  destination: string
  data: PacketData
  path: string[] // device IDs it travels through
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

// Attack Types
export type AttackType = 
  | 'dos' 
  | 'ddos' 
  | 'mitm' 
  | 'arp_poisoning' 
  | 'rogue_onu'
  | 'mac_flooding'
  | 'port_scan'
  | 'packet_sniffing'
  | 'unauthorized_access'

export interface Attack {
  id: string
  type: AttackType
  name: string
  description: string
  sourceDeviceId: string
  targetDeviceId: string
  status: 'pending' | 'active' | 'completed' | 'blocked'
  startTime: number
  endTime?: number
  impact: AttackImpact
}

export interface AttackImpact {
  affectedDevices: string[]
  packetsDropped: number
  bandwidthConsumed: number
  detectedBy?: string[]
}

// Simulation State
export interface SimulationState {
  isRunning: boolean
  speed: number // 1x, 2x, 4x, etc.
  currentTime: number
  packets: Packet[]
  attacks: Attack[]
  logs: LogEntry[]
}

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warning' | 'error' | 'critical'
  deviceId?: string
  message: string
  details?: any
}


