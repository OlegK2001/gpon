export type DeviceType = 'OLT' | 'ONT' | 'CPE' | 'Router' | 'Switch' | 'Cloud' | 'Core' | 'DHCP';

export type DeviceStatus = 'normal' | 'degraded' | 'under_attack' | 'failed';

export type LinkType = 'data' | 'mgmt' | 'pon';

export interface Position {
  x: number;
  y: number;
}

export interface NetworkNode {
  id: string;
  type: DeviceType;
  position: Position;
  ip: string;
  status: DeviceStatus;
  radius: number;
  label: string;
  metrics: {
    cpu: number;
    memory: number;
    uplinkUtil: number;
    packetLoss: number;
    delay: number;
  };
  trafficIn: number;
  trafficOut: number;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  type: LinkType;
  bandwidth: number;
  utilization: number;
  status: 'active' | 'degraded' | 'down';
}

export interface Packet {
  id: string;
  linkId: string;
  color: string;
  startTime: number;
  duration: number;
  size: number;
  type: 'normal' | 'attack' | 'omci' | 'dhcp';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  target: string;
  protocol: string;
  bytes: number;
  result: 'success' | 'dropped' | 'error';
  message: string;
  type: 'info' | 'warning' | 'error' | 'attack';
}

export interface Attack {
  id: string;
  name: string;
  type: 'arp' | 'dhcp' | 'omci' | 'ddos' | 'rogue_onu' | 'mac_flood';
  source: string;
  target: string;
  startTime: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  active: boolean;
}
