import { create } from 'zustand'
import { NetworkDevice, Connection, Packet, Attack, LogEntry, SimulationState, AttackType } from '@/types/network'

interface AttackMode {
  type: AttackType
  step: 'select_source' | 'select_target'
  sourceDeviceId?: string
}

interface NetworkStore {
  // Devices and Connections
  devices: NetworkDevice[]
  connections: Connection[]
  selectedDeviceId: string | null
  selectedConnectionId: string | null
  
  // Simulation
  simulation: SimulationState
  
  // Attack Mode
  attackMode: AttackMode | null
  setAttackMode: (mode: AttackMode | null) => void
  
  // Actions
  addDevice: (device: NetworkDevice) => void
  removeDevice: (deviceId: string) => void
  updateDevice: (deviceId: string, updates: Partial<NetworkDevice>) => void
  selectDevice: (deviceId: string | null) => void
  
  addConnection: (connection: Connection) => void
  removeConnection: (connectionId: string) => void
  selectConnection: (connectionId: string | null) => void
  
  // Simulation Actions
  startSimulation: () => void
  stopSimulation: () => void
  setSimulationSpeed: (speed: number) => void
  addPacket: (packet: Packet) => void
  updatePacket: (packetId: string, updates: Partial<Packet>) => void
  removePacket: (packetId: string) => void
  
  // Attack Actions
  launchAttack: (attack: Attack) => void
  stopAttack: (attackId: string) => void
  
  // GPON Actions
  registerONUToOLT: (onuId: string, oltId: string) => void
  
  // Logging
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
  attackMode: null,
  
  simulation: {
    isRunning: false,
    speed: 1,
    currentTime: 0,
    packets: [],
    attacks: [],
    logs: [],
  },
  
  setAttackMode: (mode) => {
    set({ attackMode: mode })
  },
  
  addDevice: (device) => {
    set((state) => ({
      devices: [...state.devices, device],
    }))
    get().addLog({
      level: 'info',
      deviceId: device.id,
      message: `Device ${device.name} (${device.type}) added to network`,
    })
  },
  
  removeDevice: (deviceId) => {
    const device = get().devices.find(d => d.id === deviceId)
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== deviceId),
      connections: state.connections.filter(
        (c) => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId
      ),
      selectedDeviceId: state.selectedDeviceId === deviceId ? null : state.selectedDeviceId,
    }))
    if (device) {
      get().addLog({
        level: 'info',
        deviceId,
        message: `Device ${device.name} removed from network`,
      })
    }
  },
  
  updateDevice: (deviceId, updates) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, ...updates } : d
      ),
    }))
  },
  
  selectDevice: (deviceId) => {
    set({ selectedDeviceId: deviceId })
  },
  
  addConnection: (connection) => {
    set((state) => ({
      connections: [...state.connections, connection],
    }))
    get().addLog({
      level: 'info',
      message: `Connection established between devices`,
      details: connection,
    })
  },
  
  removeConnection: (connectionId) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
      selectedConnectionId: state.selectedConnectionId === connectionId ? null : state.selectedConnectionId,
    }))
  },
  
  selectConnection: (connectionId) => {
    set({ selectedConnectionId: connectionId })
  },
  
  startSimulation: () => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        isRunning: true,
        currentTime: Date.now(),
      },
    }))
    get().addLog({
      level: 'info',
      message: 'Simulation started',
    })
  },
  
  stopSimulation: () => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        isRunning: false,
      },
    }))
    get().addLog({
      level: 'info',
      message: 'Simulation stopped',
    })
  },
  
  setSimulationSpeed: (speed) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        speed,
      },
    }))
  },
  
  addPacket: (packet) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        packets: [...state.simulation.packets, packet],
      },
    }))
  },
  
  updatePacket: (packetId, updates) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        packets: state.simulation.packets.map((p) =>
          p.id === packetId ? { ...p, ...updates } : p
        ),
      },
    }))
  },
  
  removePacket: (packetId) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        packets: state.simulation.packets.filter((p) => p.id !== packetId),
      },
    }))
  },
  
  launchAttack: (attack) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        attacks: [...state.simulation.attacks, attack],
      },
    }))
    get().addLog({
      level: 'warning',
      message: `Attack launched: ${attack.name}`,
      details: attack,
    })
  },
  
  stopAttack: (attackId) => {
    const attack = get().simulation.attacks.find(a => a.id === attackId)
    set((state) => ({
      simulation: {
        ...state.simulation,
        attacks: state.simulation.attacks.map((a) =>
          a.id === attackId ? { ...a, status: 'completed' as const, endTime: Date.now() } : a
        ),
      },
    }))
    if (attack) {
      get().addLog({
        level: 'info',
        message: `Attack stopped: ${attack.name}`,
      })
    }
  },
  
  addLog: (log) => {
    const newLog: LogEntry = {
      ...log,
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }
    set((state) => ({
      simulation: {
        ...state.simulation,
        logs: [newLog, ...state.simulation.logs].slice(0, 1000), // Keep last 1000 logs
      },
    }))
  },
  
  clearLogs: () => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        logs: [],
      },
    }))
  },
  
  registerONUToOLT: (onuId, oltId) => {
    const onu = get().devices.find(d => d.id === onuId)
    const olt = get().devices.find(d => d.id === oltId)
    
    if (!onu || !olt || olt.type !== 'OLT') return
    
    // Generate ONU ID and other GPON parameters
    const existingONUs = get().devices.filter(d => 
      (d.type === 'ONU' || d.type === 'ONT') && 
      d.config.gponConfig?.onuId !== undefined
    )
    const onuIdNumber = existingONUs.length + 1
    const allocId = 1024 + onuIdNumber
    const gemPort = 1280 + onuIdNumber
    const serialNumber = `GPON${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    
    // Update ONU with registration info
    get().updateDevice(onuId, {
      config: {
        ...onu.config,
        gponConfig: {
          ...onu.config.gponConfig,
          onuId: onuIdNumber,
          allocId,
          gemPort,
          serialNumber,
        }
      }
    })
    
    get().addLog({
      level: 'info',
      deviceId: onuId,
      message: `ONU ${onu.name} registered to OLT ${olt.name} with ID ${onuIdNumber}`,
      details: { onuId: onuIdNumber, allocId, gemPort, serialNumber }
    })
  },
}))


