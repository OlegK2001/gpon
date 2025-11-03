import { create } from 'zustand'
import { NetworkDevice, Connection, Packet, Attack, LogEntry, SimulationState, AttackType } from '@/types/network'
import { PacketSimulator } from '@/utils/packetSimulation'

interface AttackMode {
  type: AttackType
  step: 'select_source' | 'select_target'
  sourceDeviceId?: string
}

interface ConnectionMode {
  active: boolean
  firstDeviceId?: string
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
  
  // Connection Mode
  connectionMode: ConnectionMode
  setConnectionMode: (mode: ConnectionMode) => void
  
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
  applyImpactToNode: (deviceId: string, intensity?: number) => void
  scheduleRecovery: (deviceId: string, delayMs?: number) => void
  
  // GPON Actions
  registerONUToOLT: (onuId: string, oltId: string) => void
  
  // Logging
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  
  // Project persistence
  saveProject: () => void
  loadProject: (file: File) => Promise<void>
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
  attackMode: null,
  connectionMode: { active: false },
  
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
  
  setConnectionMode: (mode) => {
    set({ connectionMode: mode })
    if (mode.active) {
      get().addLog({
        level: 'info',
        message: 'Connection Mode: Click on two devices to connect them'
      })
    }
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
    
    // If removing an attacker, find and remove related attack
    if (device?.type === 'ATTACKER') {
      // Extract attack ID from attacker device ID
      const attackId = deviceId.replace('attacker-', '')
      const relatedAttack = get().simulation.attacks.find(a => a.id === attackId)
      if (relatedAttack) {
        get().stopAttack(attackId)
      }
    }
    
    // Find and stop attacks where this device is source or target
    const affectedAttacks = get().simulation.attacks.filter(
      a => a.sourceDeviceId === deviceId || a.targetDeviceId === deviceId
    )
    affectedAttacks.forEach(attack => {
      get().stopAttack(attack.id)
      // Also remove attacker device if it exists
      const attackerDeviceId = `attacker-${attack.id}`
      const attackerDevice = get().devices.find(d => d.id === attackerDeviceId)
      if (attackerDevice) {
        // Recursively remove attacker device (but prevent infinite loop)
        if (attackerDeviceId !== deviceId) {
          set((state) => ({
            devices: state.devices.filter((d) => d.id !== attackerDeviceId),
            connections: state.connections.filter(
              (c) => c.sourceDeviceId !== attackerDeviceId && c.targetDeviceId !== attackerDeviceId
            ),
          }))
        }
      }
    })
    
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== deviceId),
      connections: state.connections.filter(
        (c) => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId
      ),
      selectedDeviceId: state.selectedDeviceId === deviceId ? null : state.selectedDeviceId,
      // Also remove related attacks
      simulation: {
        ...state.simulation,
        attacks: state.simulation.attacks.filter(
          a => a.sourceDeviceId !== deviceId && a.targetDeviceId !== deviceId
        ),
      },
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
    
    // Add attacker device to network - connect to TARGET device (where attack is directed)
    const targetDevice = get().devices.find(d => d.id === attack.targetDeviceId)
    if (targetDevice && attack.status === 'active') {
      const attackerId = `attacker-${attack.id}`
      const attackerDevice: NetworkDevice = {
        id: attackerId,
        type: 'ATTACKER',
        position: {
          x: targetDevice.position.x + 120,
          y: targetDevice.position.y - 80,
        },
        name: `Attacker-${attack.id.slice(-6)}`,
        status: 'active',
        ports: [
          {
            id: `port-${attackerId}-1`,
            number: 1,
            type: 'ethernet',
            status: 'up',
            speed: '1Gbps',
            duplex: 'full',
          },
        ],
        config: {},
        statusLevel: 3, // Always critical
      }
      
      // Add attacker device if not exists
      if (!get().devices.find(d => d.id === attackerId)) {
        // Determine connection type based on TARGET device - attacker can connect to any device
        let connectionType: 'optical' | 'ethernet' = 'ethernet'
        if (targetDevice.type === 'OLT' || targetDevice.type === 'ONU' || targetDevice.type === 'ONT' || targetDevice.type === 'SPLITTER') {
          connectionType = 'optical'
        }
        
        // Update attacker device with appropriate port
        attackerDevice.ports = [{
          id: `port-${attackerId}-1`,
          number: 1,
          type: connectionType,
          status: 'up',
          speed: connectionType === 'optical' ? '10Gbps' : '1Gbps',
          duplex: 'full',
        }]
        
        get().addDevice(attackerDevice)
        
        // Connect attacker to TARGET device (where attack is directed)
        setTimeout(() => {
          get().addConnection({
            id: `conn-attacker-${attack.id}`,
            sourceDeviceId: attackerId,
            sourcePortId: `port-${attackerId}-1`,
            targetDeviceId: attack.targetDeviceId,
            targetPortId: `port-${attack.targetDeviceId}-1`,
            type: connectionType,
            status: 'active',
          })
        }, 100)
      }
    }
    
    // Apply initial impact to target device
    if (attack.status === 'active') {
      get().applyImpactToNode(attack.targetDeviceId, 1)
    }
    
    get().addLog({
      level: 'warning',
      message: `Attack launched: ${attack.name}`,
      details: attack,
    })
    
    // Start packet generation for active attacks - generate packets from attacker to target
    if (attack.status === 'active') {
      const attackerId = `attacker-${attack.id}`
      const currentState = get()
      
      // Generate attack packets when simulation is running
      if (currentState.simulation.isRunning) {
        const attackInterval = setInterval(() => {
          const currentAttack = get().simulation.attacks.find(a => a.id === attack.id)
          if (!currentAttack || currentAttack.status !== 'active') {
            clearInterval(attackInterval)
            return
          }
          
          const attackerDevice = get().devices.find(d => d.id === attackerId)
          const targetDevice = get().devices.find(d => d.id === attack.targetDeviceId)
          
          if (attackerDevice && targetDevice) {
            // Calculate path from attacker to target
            const path = PacketSimulator.calculatePath(
              attackerId,
              attack.targetDeviceId,
              get().devices,
              get().connections
            )
            
            if (path.length >= 2) {
              // Create attack packet
              const attackPacket: Packet = {
                id: `attack-packet-${attack.id}-${Date.now()}`,
                type: attack.type === 'arp_poisoning' ? 'arp' : 'ip',
                source: attackerId,
                destination: attack.targetDeviceId,
                data: {
                  sourceIp: '0.0.0.0', // Attacker has no IP
                  destIp: targetDevice.ipAddress || '0.0.0.0',
                  sourceMac: attackerDevice.macAddress || '00:00:00:00:00:00',
                  destMac: targetDevice.macAddress || '00:00:00:00:00:00',
                  protocol: attack.type === 'arp_poisoning' ? 'ARP' : 'TCP',
                  ttl: 64,
                  sourcePort: Math.floor(Math.random() * 60000) + 1024,
                  destPort: 80,
                  payload: `Attack: ${attack.name}`,
                },
                path,
                currentPosition: 0,
                timestamp: Date.now(),
              }
              
              // Add attack packet to simulation
              get().addPacket(attackPacket)
              
              // Apply impact every N packets (every 5 packets = intensity +0.2)
              const packetsGenerated = currentAttack.impact.packetsDropped || 0
              if (packetsGenerated > 0 && packetsGenerated % 5 === 0) {
                get().applyImpactToNode(attack.targetDeviceId, 0.2)
              }
              
              // Update attack impact
              set((state) => ({
                simulation: {
                  ...state.simulation,
                  attacks: state.simulation.attacks.map(a =>
                    a.id === attack.id
                      ? {
                          ...a,
                          impact: {
                            ...a.impact,
                            packetsDropped: (a.impact.packetsDropped || 0) + 1,
                          },
                        }
                      : a
                  ),
                },
              }))
            }
          }
        }, 500 / currentState.simulation.speed)
        
        // Stop attack after 10 seconds or when manually stopped
        setTimeout(() => {
          clearInterval(attackInterval)
          get().stopAttack(attack.id)
        }, 10000 / currentState.simulation.speed)
      }
    }
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
      // Schedule recovery for target device
      get().scheduleRecovery(attack.targetDeviceId, 5000)
      get().addLog({
        level: 'info',
        message: `Attack stopped: ${attack.name}`,
      })
    }
  },
  
  applyImpactToNode: (deviceId, intensity = 1) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              statusLevel: Math.min(3, Math.max(0, (d.statusLevel || 0) + intensity)),
            }
          : d
      ),
    }))
  },
  
  scheduleRecovery: (deviceId, delayMs = 5000) => {
    setTimeout(() => {
      set((state) => ({
        devices: state.devices.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                statusLevel: Math.max(0, (d.statusLevel || 0) - 1),
              }
            : d
        ),
      }))
      
      // Schedule next recovery step if still affected
      const device = get().devices.find(d => d.id === deviceId)
      if (device && device.statusLevel && device.statusLevel > 0) {
        get().scheduleRecovery(deviceId, delayMs)
      }
    }, delayMs)
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
      },
      serialNumber,
    })
    
    get().addLog({
      level: 'info',
      deviceId: onuId,
      message: `ONU ${onu.name} registered to OLT ${olt.name} with ID ${onuIdNumber}`,
      details: { onuId: onuIdNumber, allocId, gemPort, serialNumber }
    })
  },
  
  saveProject: () => {
    const state = get()
    const payload = {
      version: '1.0',
      topology: {
        devices: state.devices,
        connections: state.connections,
      },
      simulation: {
        isRunning: state.simulation.isRunning,
        speed: state.simulation.speed,
        attacks: state.simulation.attacks,
        logs: state.simulation.logs,
      },
      timestamp: Date.now(),
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('gpon_project', JSON.stringify(payload))
      
      // Also save logs separately
      if (state.simulation.logs.length > 0) {
        localStorage.setItem('gpon_logs', JSON.stringify(state.simulation.logs.slice(-5000)))
      }
    } catch (error) {
      console.error('Failed to save project:', error)
      state.addLog({
        level: 'error',
        message: 'Failed to save project to localStorage',
      })
      return
    }
    
    // Export as JSON file
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gpon_project_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    state.addLog({
      level: 'info',
      message: 'Project saved successfully',
    })
  },
  
  loadProject: async (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          const state = get()
          
          if (data.topology) {
            // Load devices and connections
            if (data.topology.devices) {
              set({ devices: data.topology.devices })
            }
            if (data.topology.connections) {
              set({ connections: data.topology.connections })
            }
          }
          
          if (data.simulation) {
            // Load simulation state
            set((current) => ({
              simulation: {
                ...current.simulation,
                isRunning: false, // Always start stopped
                speed: data.simulation.speed || 1,
                attacks: data.simulation.attacks || [],
                logs: data.simulation.logs || [],
              },
            }))
            
            // Restore active attacks if simulation should be running
            if (data.simulation.attacks) {
              data.simulation.attacks.forEach((attack: Attack) => {
                if (attack.status === 'active') {
                  // Re-launch attack
                  setTimeout(() => {
                    get().launchAttack(attack)
                  }, 100)
                }
              })
            }
          }
          
          state.addLog({
            level: 'info',
            message: 'Project loaded successfully',
          })
          
          resolve()
        } catch (error) {
          get().addLog({
            level: 'error',
            message: `Failed to load project: ${error}`,
          })
          reject(error)
        }
      }
      reader.onerror = () => {
        get().addLog({
          level: 'error',
          message: 'Failed to read project file',
        })
        reject(new Error('Failed to read file'))
      }
      reader.readAsText(file)
    })
  },
}))


