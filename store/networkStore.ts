import { create } from 'zustand'
import { NetworkDevice, Connection, Packet, LogEntry, SimulationState, AttackType, ActiveAttack } from '@/types/network'
import { PacketSimulator } from '@/utils/packetSimulation'
import { buildNodeGraph, findPath } from '@/utils/pathfinding'
import { initializeKnownOntIds } from '@/utils/simulationEngine'
import { getPathTravelMs } from '@/constants/packetAnimation'
import { normalizePath } from '@/utils/packetProcessing'

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
  upsertPacket: (packet: Packet) => void // Добавляет или обновляет пакет по id (убирает дубли)
  addTransientPacket: (packet: Packet, ttlMs?: number) => void // Для attack-пакетов с авто-удалением
  updatePacket: (packetId: string, updates: Partial<Packet>) => void
  removePacket: (packetId: string) => void
  setFlowDirection: (direction: 'DOWNSTREAM' | 'UPSTREAM' | null) => void
  setDownstreamPacketsCompleted: (completed: boolean) => void
  setUpstreamStartTime: (time: number | undefined) => void
  
  // GPON Actions
  registerONUToOLT: (onuId: string, oltId: string) => void
  
  // Attack Actions
  createRogueOntDevice: () => string | null // Returns device ID or null if failed
  createRogueOntWithConnection: (targetDeviceId: string, targetDeviceType: string) => Promise<string | null> // Создает вредоносный ONT с подключением
  unauthorizedOntAttack: (direction: 'eavesdrop' | 'bruteforce' | 'ddos') => Promise<void>
  executeAttackDirection: (rogueOntId: string, direction: 'eavesdrop' | 'bruteforce' | 'ddos', olt: NetworkDevice, splitter?: NetworkDevice) => Promise<void>
  gponRanging: (ontId: string) => Promise<boolean>
  attemptOntRegistration: (ontId: string, serialNumber?: string, loid?: string, password?: string) => Promise<boolean>
  assignServiceProfile: (ontId: string, vlan?: number, profile?: string) => Promise<boolean>
  
  // Logging
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  
  // Project persistence
  saveProject: (nodePositions?: Record<string, { x: number; y: number }>) => void
  loadProject: (file: File) => Promise<void>

  // Device animation coordinates (updated from NetworkCanvas)
  deviceAnimationCoords: Record<string, { x: number; y: number }>
  updateDeviceAnimationCoords: (deviceId: string, coords: { x: number; y: number }) => void
  
  // Node positions cache (updated from NetworkCanvas)
  nodePositions: Record<string, { x: number; y: number }>
  syncNodePositions: (positions: Record<string, { x: number; y: number }>) => void
  
  // Highlighted devices (for attack mode selection)
  highlightedDevices: string[]
  setHighlightedDevices: (deviceIds: string[]) => void
  
  // Attack Engine
  activeAttacks: Record<AttackType, ActiveAttack>
  startAttack: (type: AttackType, options?: { targetDeviceId?: string }) => Promise<void>
  stopAttack: (type: AttackType) => void
  executeAttack: (type: AttackType, attackerId: string, splitter: NetworkDevice, olt: NetworkDevice | undefined, targetDeviceId?: string) => Promise<void>
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
  connectionMode: { active: false },
  
  simulation: {
    isRunning: false,
    speed: 1,
    currentTime: 0,
    packets: [],
    logs: [],
  },
  
  deviceAnimationCoords: {},
  nodePositions: {},
  
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
    const state = get()
    
    // Инициализация для OLT: определяем номер
    let updatedDevice = { ...device }
    if (device.type === 'OLT') {
      const existingOLTs = state.devices.filter(d => d.type === 'OLT')
      const oltNumber = existingOLTs.length === 0 ? 1 : existingOLTs.length + 1
      
      updatedDevice = {
        ...device,
        config: {
          ...device.config,
          gponConfig: {
            ...device.config.gponConfig,
            oltNumber,
          },
        },
      }
    }
    
    set((state) => ({
      devices: [...state.devices, updatedDevice],
    }))
    
    // Если это промежуточный OLT, инициализируем knownOntIds
    if (updatedDevice.type === 'OLT' && updatedDevice.config.gponConfig?.oltNumber && 
        updatedDevice.config.gponConfig.oltNumber > 1) {
      // Инициализация knownOntIds будет выполнена при первом запуске симуляции
      // или при изменении соединений
    }
    
    get().addLog({
      level: 'info',
      deviceId: updatedDevice.id,
      message: `Device ${updatedDevice.name} (${updatedDevice.type}) added to network`,
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
      // Удаляем позиции и координаты анимации для удаляемого устройства
      nodePositions: (() => {
        const { [deviceId]: removed, ...rest } = state.nodePositions || {}
        return rest
      })(),
      deviceAnimationCoords: (() => {
        const { [deviceId]: removed, ...rest } = state.deviceAnimationCoords || {}
        return rest
      })(),
      // Also remove related packets
      simulation: {
        ...state.simulation,
        packets: state.simulation.packets.filter(
          p => p.source !== deviceId && p.destination !== deviceId
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
    
    // Обновляем knownOntIds для всех промежуточных OLT
    const stateAfter = get()
    stateAfter.devices
      .filter(d => d.type === 'OLT' && d.config.gponConfig?.oltNumber && d.config.gponConfig.oltNumber > 1)
      .forEach(olt => {
        const knownIds = initializeKnownOntIds(olt, stateAfter.devices, stateAfter.connections)
        get().updateDevice(olt.id, {
          config: {
            ...olt.config,
            gponConfig: {
              ...olt.config.gponConfig,
              knownOntIds: knownIds,
            },
          },
        })
      })
    
    get().addLog({
      level: 'info',
      message: `Connection established between devices`,
      details: connection,
    })
  },
  
  removeConnection: (connectionId) => {
    const state = get()
    const connection = state.connections.find((c) => c.id === connectionId)
    
    // Проверяем, не является ли удаляемое соединение частью пути ROGUE ONT
    if (connection) {
      const sourceDevice = state.devices.find((d) => d.id === connection.sourceDeviceId)
      const targetDevice = state.devices.find((d) => d.id === connection.targetDeviceId)
      
      // Если удаляется соединение, связанное с ROGUE ONT, отключаем режим атаки
      const isRogueOntSource = sourceDevice && (
        sourceDevice.id.startsWith('ont-rogue-') ||
        (sourceDevice.config.attackMode !== undefined && sourceDevice.config.attackMode !== null)
      )
      const isRogueOntTarget = targetDevice && (
        targetDevice.id.startsWith('ont-rogue-') ||
        (targetDevice.config.attackMode !== undefined && targetDevice.config.attackMode !== null)
      )
      
      if (isRogueOntSource || isRogueOntTarget) {
        const rogueDevice = isRogueOntSource ? sourceDevice : targetDevice
        if (rogueDevice) {
          get().addLog({
            level: 'warning',
            deviceId: rogueDevice.id,
            message: `[${rogueDevice.id}] ⚠️ Соединение разорвано. Атака остановлена.`,
          })
          // Отключаем режим атаки
          get().updateDevice(rogueDevice.id, {
            config: {
              ...rogueDevice.config,
              attackMode: undefined
            }
          })
        }
      }
    }
    
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
      selectedConnectionId: state.selectedConnectionId === connectionId ? null : state.selectedConnectionId,
    }))
    
    // Обновляем knownOntIds для всех промежуточных OLT после удаления соединения
    const stateAfter = get()
    stateAfter.devices
      .filter(d => d.type === 'OLT' && d.config.gponConfig?.oltNumber && d.config.gponConfig.oltNumber > 1)
      .forEach(olt => {
        const knownIds = initializeKnownOntIds(olt, stateAfter.devices, stateAfter.connections)
        get().updateDevice(olt.id, {
          config: {
            ...olt.config,
            gponConfig: {
              ...olt.config.gponConfig,
              knownOntIds: knownIds,
            },
          },
        })
      })
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
        flowDirection: null, // Инициализируем как null, будет установлено при первом тике
        downstreamPacketsCompleted: false,
        upstreamStartTime: undefined,
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
        flowDirection: null,
        downstreamPacketsCompleted: false,
        upstreamStartTime: undefined,
      },
    }))
    get().addLog({
      level: 'info',
      message: 'Simulation stopped',
    })
  },
  
  setFlowDirection: (direction) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        flowDirection: direction,
      },
    }))
  },
  
  setDownstreamPacketsCompleted: (completed) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        downstreamPacketsCompleted: completed,
      },
    }))
  },
  
  setUpstreamStartTime: (time) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        upstreamStartTime: time,
      },
    }))
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
  
  upsertPacket: (packet) => {
    set((state) => {
      const existingIndex = state.simulation.packets.findIndex(p => p.id === packet.id)
      if (existingIndex >= 0) {
        // Обновляем существующий пакет
        const newPackets = [...state.simulation.packets]
        newPackets[existingIndex] = packet
        return {
          simulation: {
            ...state.simulation,
            packets: newPackets,
          },
        }
      } else {
        // Добавляем новый пакет
        return {
          simulation: {
            ...state.simulation,
            packets: [...state.simulation.packets, packet],
          },
        }
      }
    })
  },
  
  addTransientPacket: (packet, ttlMs?: number) => {
    // Вычисляем TTL на основе длины пути, если не указан
    const actualTtl = ttlMs ?? getPathTravelMs(
      packet.path.length, 
      get().simulation.speed, 
      800
    )
    
    // Добавляем пакет
    get().addPacket(packet)
    
    // Автоматически удаляем через TTL
    setTimeout(() => {
      get().removePacket(packet.id)
    }, actualTtl)
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
  
  // Attack Actions
  createRogueOntDevice: () => {
    const state = get()
    
    // Check if rogue ONT already exists
    const existingRogueOnt = state.devices.find(d => d.id.startsWith('ont-rogue-'))
    if (existingRogueOnt) {
      return existingRogueOnt.id
    }
    
    // Find splitter or OLT for positioning (сплитер опционален)
    const splitter = state.devices.find(d => d.type === 'SPLITTER')
    const olt = state.devices.find(d => d.type === 'OLT')
    
    // Определяем базовое устройство для позиционирования (приоритет сплитеру, если есть)
    const baseDevice = splitter || olt
    if (!baseDevice) {
      get().addLog({
        level: 'error',
        message: 'Не найден OLT или сплиттер для создания несанкционированного ONT',
      })
      return null
    }
    
    // Create unauthorized ONT
    const rogueOntId = `ont-rogue-${Date.now()}`
    const rogueSerialNumber = `ROGUE${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    
    // Calculate position relative to base device (splitter or OLT)
    const baseX = baseDevice.position?.x || 500
    const baseY = baseDevice.position?.y || 300
    
    const rogueOnt: NetworkDevice = {
      id: rogueOntId,
      type: 'ONT',
      name: `🚨 ROGUE-ONT-${rogueSerialNumber.substring(0, 4)}`,
      position: {
        x: baseX + 200,
        y: baseY + 150,
      },
      ports: [{
        id: `${rogueOntId}-port-1`,
        number: 1,
        type: 'optical',
        status: 'down',
      }, {
        id: `${rogueOntId}-port-2`,
        number: 2,
        type: 'ethernet',
        status: 'down',
      }],
      config: {
        gponConfig: {
          serialNumber: rogueSerialNumber,
          wavelengthDown: 1490,
          wavelengthUp: 1310,
        },
      },
      status: 'active', // Make it active so it's visible
      statusLevel: 3, // Critical - unauthorized device (red indicator)
      serialNumber: rogueSerialNumber,
    }
    
    get().addDevice(rogueOnt)
    
    // Автоматически подключаем ONT к сплиттеру или напрямую к OLT
    if (splitter) {
      // Если есть сплитер, подключаемся к нему
      const splitterPort = splitter.ports.find(p => !p.connectedTo) || splitter.ports[splitter.ports.length - 1]
      if (splitterPort) {
        const connection = {
          id: `conn-${Date.now()}-rogue`,
          sourceDeviceId: splitter.id,
          sourcePortId: splitterPort.id,
          targetDeviceId: rogueOntId,
          targetPortId: rogueOnt.ports[0].id,
          type: 'optical' as const,
          status: 'active' as const,
        }
        
        get().addConnection(connection)
        
        get().addLog({
          level: 'warning',
          deviceId: rogueOntId,
          message: `⚠️ Несанкционированный ONT "${rogueOnt.name}" подключен к сплиттеру ${splitter.name}`,
        })
      }
    } else if (olt) {
      // Если сплитера нет, подключаемся напрямую к OLT
      const oltPort = olt.ports.find(p => !p.connectedTo && p.type === 'optical') || olt.ports.find(p => p.type === 'optical')
      if (oltPort) {
        const connection = {
          id: `conn-${Date.now()}-rogue`,
          sourceDeviceId: olt.id,
          sourcePortId: oltPort.id,
          targetDeviceId: rogueOntId,
          targetPortId: rogueOnt.ports[0].id,
          type: 'optical' as const,
          status: 'active' as const,
        }
        
        get().addConnection(connection)
        
        get().addLog({
          level: 'warning',
          deviceId: rogueOntId,
          message: `⚠️ Несанкционированный ONT "${rogueOnt.name}" подключен напрямую к OLT ${olt.name}`,
        })
      }
    }
    
    get().addLog({
      level: 'warning',
      deviceId: rogueOntId,
      message: `⚠️ Создан несанкционированный ONT "${rogueOnt.name}" с серийным номером: ${rogueSerialNumber}`,
      details: { 
        position: rogueOnt.position,
        deviceId: rogueOntId 
      }
    })
    
    return rogueOntId
  },

  // Создает вредоносный ONT с подключением к выбранному устройству
  createRogueOntWithConnection: async (targetDeviceId: string, targetDeviceType: string) => {
    const state = get()
    
    // Проверяем, есть ли уже вредоносный ONT
    const existingRogueOnt = state.devices.find(d => d.id.startsWith('ont-rogue-'))
    if (existingRogueOnt) {
      get().addLog({
        level: 'warning',
        message: 'Вредоносный ONT уже существует',
      })
      return existingRogueOnt.id
    }

    const targetDevice = state.devices.find(d => d.id === targetDeviceId)
    if (!targetDevice) {
      get().addLog({
        level: 'error',
        message: 'Целевое устройство не найдено',
      })
      return null
    }

    // Создаем вредоносный ONT
    const rogueOntId = `ont-rogue-${Date.now()}`
    const rogueSerialNumber = `ROGUE${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    
    let splitterId: string
    let rogueOntPosition: { x: number; y: number }

    if (targetDeviceType === 'SPLITTER') {
      // Простое подключение к сплиттеру
      splitterId = targetDeviceId
      rogueOntPosition = {
        x: targetDevice.position.x + 200,
        y: targetDevice.position.y + 150,
      }
    } else {
      // Внедрение нового сплиттера в линию
      // Находим соединение с целевым устройством
      const connection = state.connections.find(
        c => (c.sourceDeviceId === targetDeviceId || c.targetDeviceId === targetDeviceId) &&
             c.status === 'active'
      )

      if (!connection) {
        get().addLog({
          level: 'error',
          message: 'Не найдено активное соединение с целевым устройством',
        })
        return null
      }

      // Определяем второе устройство в соединении
      const otherDeviceId = connection.sourceDeviceId === targetDeviceId
        ? connection.targetDeviceId
        : connection.sourceDeviceId
      const otherDevice = state.devices.find(d => d.id === otherDeviceId)

      if (!otherDevice) {
        get().addLog({
          level: 'error',
          message: 'Не найдено второе устройство в соединении',
        })
        return null
      }

      // Удаляем старое соединение
      get().removeConnection(connection.id)

      // Создаем ОБЫЧНЫЙ сплиттер между устройствами (не вредоносный!)
      // Вредоносным является только ONT, сплиттер просто внедряется в линию
      const newSplitterId = `splitter-injected-${Date.now()}`
      const splitterPosition = {
        x: (targetDevice.position.x + otherDevice.position.x) / 2,
        y: (targetDevice.position.y + otherDevice.position.y) / 2,
      }

      const newSplitter: NetworkDevice = {
        id: newSplitterId,
        type: 'SPLITTER',
        name: `Splitter (внедрен)`,
        position: splitterPosition,
        ports: [
          { id: `${newSplitterId}-port-1`, number: 1, type: 'optical', status: 'up' },
          { id: `${newSplitterId}-port-2`, number: 2, type: 'optical', status: 'up' },
          { id: `${newSplitterId}-port-3`, number: 3, type: 'optical', status: 'up' },
          { id: `${newSplitterId}-port-4`, number: 4, type: 'optical', status: 'up' },
        ],
        config: {},
        status: 'active',
      }

      get().addDevice(newSplitter)

      // Подключаем сплиттер к целевому устройству
      const targetPort = targetDevice.ports.find(p => !p.connectedTo) || targetDevice.ports[0]
      const splitterPort1 = newSplitter.ports[0]
      
      get().addConnection({
        id: `conn-${Date.now()}-1`,
        sourceDeviceId: targetDeviceId,
        sourcePortId: targetPort.id,
        targetDeviceId: newSplitterId,
        targetPortId: splitterPort1.id,
        type: 'optical',
        status: 'active',
      })

      // Подключаем сплиттер ко второму устройству
      const otherPort = otherDevice.ports.find(p => !p.connectedTo) || otherDevice.ports[0]
      const splitterPort2 = newSplitter.ports[1]

      get().addConnection({
        id: `conn-${Date.now()}-2`,
        sourceDeviceId: otherDeviceId,
        sourcePortId: otherPort.id,
        targetDeviceId: newSplitterId,
        targetPortId: splitterPort2.id,
        type: 'optical',
        status: 'active',
      })

      splitterId = newSplitterId
      rogueOntPosition = {
        x: splitterPosition.x + 200,
        y: splitterPosition.y + 150,
      }

      get().addLog({
        level: 'info',
        deviceId: newSplitterId,
        message: `📡 Внедрен сплиттер "${newSplitter.name}" в линию между ${targetDevice.name} и ${otherDevice.name}`,
      })
    }

    // Создаем вредоносный ONT (красный!)
    const rogueOnt: NetworkDevice = {
      id: rogueOntId,
      type: 'ONT',
      name: `🚨 ROGUE-ONT-${rogueSerialNumber.substring(0, 4)}`,
      position: rogueOntPosition,
      ports: [{
        id: `${rogueOntId}-port-1`,
        number: 1,
        type: 'optical',
        status: 'down',
      }, {
        id: `${rogueOntId}-port-2`,
        number: 2,
        type: 'ethernet',
        status: 'down',
      }],
      config: {
        gponConfig: {
          serialNumber: rogueSerialNumber,
          wavelengthDown: 1490,
          wavelengthUp: 1310,
        },
      },
      status: 'active',
      statusLevel: 3, // Critical - unauthorized device (red indicator)
      serialNumber: rogueSerialNumber,
    }

    get().addDevice(rogueOnt)

    // Подключаем вредоносный ONT к сплиттеру
    const splitter = state.devices.find(d => d.id === splitterId) || get().devices.find(d => d.id === splitterId)
    if (splitter) {
      const splitterPort = splitter.ports.find(p => !p.connectedTo) || splitter.ports[splitter.ports.length - 1]
      const ontPort = rogueOnt.ports[0]

      get().addConnection({
        id: `conn-${Date.now()}-3`,
        sourceDeviceId: splitterId,
        sourcePortId: splitterPort.id,
        targetDeviceId: rogueOntId,
        targetPortId: ontPort.id,
        type: 'optical',
        status: 'active',
      })
    }

    get().addLog({
      level: 'warning',
      deviceId: rogueOntId,
      message: `⚠️ Создан вредоносный ONT "${rogueOnt.name}" и подключен к сети`,
      details: {
        targetDevice: targetDevice.name,
        targetDeviceType,
        position: rogueOntPosition,
        deviceId: rogueOntId,
      },
    })

    return rogueOntId
  },
  
  unauthorizedOntAttack: async (direction: 'eavesdrop' | 'bruteforce' | 'ddos') => {
    const state = get()
    
    // Step 1: Find OLT
    const olt = state.devices.find(d => d.type === 'OLT')
    if (!olt) {
      get().addLog({
        level: 'error',
        message: 'Не найден OLT для регистрации ONT',
      })
      return
    }
    
    const attackNames = {
      eavesdrop: 'Прослушка канала нисходящего',
      bruteforce: 'Подбор идентификаторов других ONU/ONT',
      ddos: 'DDoS атака (зашумление канала)'
    }
    
    // Step 3: Get or create unauthorized ONT
    let rogueOntId: string | null | undefined = state.devices.find(d => d.id.startsWith('ont-rogue-'))?.id
    if (!rogueOntId) {
      rogueOntId = get().createRogueOntDevice()
      if (!rogueOntId) {
        return
      }
      // Force a small delay to ensure ReactFlow updates
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    const rogueOnt = state.devices.find(d => d.id === rogueOntId)
    if (!rogueOnt) {
      get().addLog({
        level: 'error',
        message: 'Не удалось найти или создать несанкционированный ONT',
      })
      return
    }
    
    // ВАЖНО: Получаем серийный номер из устройства
    const rogueSerialNumber = rogueOnt.serialNumber || rogueOnt.config.gponConfig?.serialNumber || 'UNKNOWN'
    
    get().addLog({
      level: 'warning',
      deviceId: rogueOntId,
      message: `[ont-rogue-${rogueOntId}] Начало атаки: ${attackNames[direction]} (SN: ${rogueSerialNumber})`,
    })
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Step 4: Find splitter (опционально) и подключить ROGUE ONT
    const splitter = state.devices.find(d => d.type === 'SPLITTER')
    
    // Проверяем, подключен ли ROGUE ONT к сети (к OLT или через сплитер)
    const existingConnection = state.connections.find(
      c => (c.sourceDeviceId === rogueOntId || c.targetDeviceId === rogueOntId) &&
           c.status === 'active'
    )
    
    if (!existingConnection) {
      // Если есть сплитер, подключаемся к нему
      if (splitter) {
        const splitterPort = splitter.ports.find(p => !p.connectedTo) || splitter.ports[0]
        if (splitterPort) {
          const connection = {
            id: `conn-${Date.now()}`,
            sourceDeviceId: splitter.id,
            sourcePortId: splitterPort.id,
            targetDeviceId: rogueOntId,
            targetPortId: rogueOnt.ports[0].id,
            type: 'optical' as const,
            status: 'active' as const,
          }
          
          get().addConnection(connection)
          
          get().addLog({
            level: 'warning',
            deviceId: rogueOntId,
            message: `[ont-rogue-${rogueOntId}] Подключен к сплиттеру`,
          })
        }
      } else {
        // Если сплитера нет, подключаемся напрямую к OLT
        const oltPort = olt.ports.find(p => !p.connectedTo && p.type === 'optical') || olt.ports.find(p => p.type === 'optical')
        if (oltPort) {
          const connection = {
            id: `conn-${Date.now()}`,
            sourceDeviceId: olt.id,
            sourcePortId: oltPort.id,
            targetDeviceId: rogueOntId,
            targetPortId: rogueOnt.ports[0].id,
            type: 'optical' as const,
            status: 'active' as const,
          }
          
          get().addConnection(connection)
          
          get().addLog({
            level: 'warning',
            deviceId: rogueOntId,
            message: `[ont-rogue-${rogueOntId}] Подключен напрямую к OLT`,
          })
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 5: GPON Ranging
    const rangingSuccess = await get().gponRanging(rogueOntId)
    if (!rangingSuccess) {
      get().addLog({
        level: 'error',
        deviceId: rogueOntId,
        message: `[ont-rogue-${rogueOntId}] Ошибка при выполнении GPON ranging`,
      })
      return
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 6: Attempt registration with spoofed credentials
    const registrationSuccess = await get().attemptOntRegistration(
      rogueOntId,
      rogueSerialNumber,
      'STOLEN_LOID',
      'BRUTEFORCE_PASS'
    )
    
    if (registrationSuccess) {
      get().addLog({
        level: 'critical',
        deviceId: rogueOntId,
        message: '🚨 КРИТИЧНО: Несанкционированный ONT успешно зарегистрирован на OLT!',
      })
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Step 7: Assign service profile
      await get().assignServiceProfile(rogueOntId, 100, 'legitimate_subscriber')
      
      get().addLog({
        level: 'critical',
        deviceId: rogueOntId,
        message: '🚨 Несанкционированный ONT получил доступ к сети оператора',
      })
      
      // Update device status
      get().updateDevice(rogueOntId, {
        status: 'active',
        statusLevel: 3,
      })
      
      // Сохраняем режим атаки в устройстве
      get().updateDevice(rogueOntId, {
        config: {
          ...rogueOnt.config,
          attackMode: direction
        }
      })

      // Execute specific attack direction (сплитер опционален)
      await get().executeAttackDirection(rogueOntId, direction, olt, splitter)
    } else {
      get().addLog({
        level: 'warning',
        deviceId: rogueOntId,
        message: '⚠️ Попытка регистрации не удалась (защита сработала)',
      })
    }
  },
  
  // Helper function to execute specific attack direction
  executeAttackDirection: async (rogueOntId: string, direction: 'eavesdrop' | 'bruteforce' | 'ddos', olt: NetworkDevice, splitter?: NetworkDevice) => {
    const state = get()
    const rogueOnt = state.devices.find(d => d.id === rogueOntId)
    if (!rogueOnt) {
      get().addLog({
        level: 'error',
        deviceId: rogueOntId,
        message: `[ont-rogue-${rogueOntId}] Ошибка: устройство не найдено`,
      })
      return
    }
    
    // ВАЖНО: Получаем серийный номер из устройства
    const rogueSerialNumber = rogueOnt.serialNumber || rogueOnt.config.gponConfig?.serialNumber || 'UNKNOWN'
    
    try {
      switch (direction) {
        case 'eavesdrop':
          // Прослушка канала нисходящего - перехват пакетов от OLT (только получает, не отправляет ответы)
          // ВАЖНО: Проверяем реальный путь через граф перед запуском атаки
          const eavesdropState = get()
          const eavesdropNodes = buildNodeGraph(eavesdropState.devices, eavesdropState.connections)
          const pathFromOlt = findPath(eavesdropNodes, olt.id, rogueOntId)
          
          if (!pathFromOlt || pathFromOlt.length < 2) {
            get().addLog({
              level: 'error',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] ❌ Невозможно начать прослушку: ROGUE ONT не подключен к сети (нет пути от OLT)`,
            })
            // Отключаем режим атаки, так как устройство не подключено
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                attackMode: undefined
              }
            })
            return
          }
          
          get().addLog({
            level: 'warning',
            deviceId: rogueOntId,
            message: `[ont-rogue-${rogueOntId}] Начало атаки: пассивная прослушка трафика (SN: ${rogueSerialNumber})`,
          })
        
        // Симулируем перехват пакетов - отправляем пакеты от OLT к ROGUE-ONT
        // ROGUE-ONT только получает, но НЕ отправляет ответы
        const eavesdropDuration = 60000 // 60 секунд прослушки (непрерывно)
        const eavesdropStartTime = Date.now()
        let interceptedCount = 0
        
        const interceptPacket = () => {
          // Атаки работают независимо от состояния симуляции для визуализации
          if (Date.now() - eavesdropStartTime > eavesdropDuration) {
            get().addLog({
              level: 'critical',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] Прослушка завершена. Перехвачено ${interceptedCount} пакетов`,
            })
            return
          }
          
          // КРИТИЧНО: Проверяем реальный путь через граф перед каждым пакетом
          const currentEavesdropState = get()
          const currentEavesdropNodes = buildNodeGraph(currentEavesdropState.devices, currentEavesdropState.connections)
          const currentPathFromOlt = findPath(currentEavesdropNodes, olt.id, rogueOntId)
          
          if (!currentPathFromOlt || currentPathFromOlt.length < 2) {
            // Путь больше не существует - ROGUE ONT отключен, останавливаем атаку
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] ⚠️ Прослушка остановлена: ROGUE ONT отключен от сети (путь от OLT разорван)`,
            })
            // Отключаем режим атаки
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                attackMode: undefined
              }
            })
            return
          }
          
          interceptedCount++
          
          // Используем реальный путь из графа, преобразуя Node[] в string[] и нормализуя
          const eavesdropPath = normalizePath(currentPathFromOlt.map(node => node.id))
          
          // Создаем пакет для визуализации перехвата (от OLT к ROGUE-ONT)
          // Пакет идет по реальному пути от OLT к вредоносному ONT (имитация перехвата трафика)
          // Используем оранжевый цвет для визуального отличия атаки
          const interceptedPacket: Packet = {
            id: `intercepted-${Date.now()}-${interceptedCount}`,
            type: 'gpon',
            source: olt.id, // Пакет идет от OLT
            destination: rogueOntId,
            current: olt.id,
            direction: 'DOWNSTREAM',
            targetOntId: null,
            payloadType: 'ATTACK',
            data: {
              sourceIp: olt.ipAddress || '10.0.0.1',
              destIp: '0.0.0.0', // Broadcast
              protocol: 'GPON',
              packetColor: 'red', // Красный для атаки
              direction: 'downstream',
              gponFrame: {
                onuId: Math.floor(Math.random() * 32) + 1,
                allocId: 1024 + Math.floor(Math.random() * 32),
                gemPort: 1280 + Math.floor(Math.random() * 32),
              },
            },
            path: eavesdropPath, // Реальный путь через граф от OLT к ROGUE ONT
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          get().addTransientPacket(interceptedPacket)
          
          // Логируем каждые 3 пакета для лучшей визуализации
          if (interceptedCount % 3 === 0) {
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] Перехвачено пакетов: ${interceptedCount}`,
            })
          }
          
          // Удаляем пакет через некоторое время (больше времени для визуализации)
          setTimeout(() => {
            get().removePacket(interceptedPacket.id)
          }, 3000)
          
          // Отправляем следующий пакет через 1.5 секунды (более частая отправка для лучшей визуализации)
          setTimeout(interceptPacket, 4500) // Увеличено в 3 раза: было 1500ms
        }
        
        // Начинаем перехват (пассивный режим - только прием)
        interceptPacket()
        break
        
      case 'bruteforce':
        // Подбор идентификаторов других ONU/ONT - периодически отправляет запросы на ближайший OLT
        // ВАЖНО: Проверяем реальный путь через граф перед запуском атаки
        const bruteforceState = get()
        const bruteforceNodes = buildNodeGraph(bruteforceState.devices, bruteforceState.connections)
        const bruteforcePathToOlt = findPath(bruteforceNodes, rogueOntId, olt.id)
        
        if (!bruteforcePathToOlt || bruteforcePathToOlt.length < 2) {
          get().addLog({
            level: 'error',
            deviceId: rogueOntId,
            message: `[ont-rogue-${rogueOntId}] ❌ Невозможно начать подбор идентификаторов: ROGUE ONT не подключен к сети (нет пути до OLT)`,
          })
          // Отключаем режим атаки, так как устройство не подключено
          get().updateDevice(rogueOntId, {
            config: {
              ...rogueOnt.config,
              attackMode: undefined
            }
          })
          return
        }
        
        get().addLog({
          level: 'warning',
          deviceId: rogueOntId,
          message: '🔓 Начало подбора идентификаторов других ONU/ONT (периодические запросы к OLT)...',
        })
        
        const legitimateOnts = bruteforceState.devices.filter(d => 
          (d.type === 'ONT' || d.type === 'ONU') && 
          d.id !== rogueOntId && 
          d.config.gponConfig?.onuId
        )
        
        if (legitimateOnts.length === 0) {
          get().addLog({
            level: 'warning',
            deviceId: rogueOntId,
            message: '⚠️ Не найдено легитимных ONT для подбора идентификаторов',
          })
          return
        }
        
        let attemptCount = 0
        const bruteforceInterval = 3000 // Интервал между попытками: 3 секунды
        const maxAttempts = 20 // Максимум 20 попыток
        
        // Периодическая отправка запросов на подбор идентификаторов
        const sendBruteforceRequest = async () => {
          // Атаки работают независимо от состояния симуляции для визуализации
          if (attemptCount >= maxAttempts) {
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `🔓 Подбор идентификаторов завершен после ${attemptCount} попыток`,
            })
            return
          }
          
          // КРИТИЧНО: Проверяем реальный путь через граф перед каждой попыткой
          const currentBruteforceState = get()
          const currentBruteforceNodes = buildNodeGraph(currentBruteforceState.devices, currentBruteforceState.connections)
          const currentBruteforcePath = findPath(currentBruteforceNodes, rogueOntId, olt.id)
          
          if (!currentBruteforcePath || currentBruteforcePath.length < 2) {
            // Путь больше не существует - ROGUE ONT отключен, останавливаем атаку
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] ⚠️ Подбор идентификаторов остановлен: ROGUE ONT отключен от сети (путь до OLT разорван)`,
            })
            // Отключаем режим атаки
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                attackMode: undefined
              }
            })
            return
          }
          
          attemptCount++
          const targetOnt = legitimateOnts[attemptCount % legitimateOnts.length]
          const targetOnuId = targetOnt.config.gponConfig?.onuId
          const targetSerial = targetOnt.serialNumber || 'UNKNOWN'
          
          // Используем реальный путь из графа, преобразуя Node[] в string[] и нормализуя
          const bruteforcePath = normalizePath(currentBruteforcePath.map(node => node.id))

          const bruteforcePacket: Packet = {
            id: `bruteforce-${Date.now()}-${attemptCount}`,
            type: 'gpon',
            source: rogueOntId,
            destination: olt.id, // Всегда OLT как конечная цель
            current: rogueOntId,
            direction: 'UPSTREAM',
            targetOntId: targetOnuId !== undefined && targetOnuId !== null ? String(targetOnuId) : null,
            payloadType: 'ATTACK',
            data: {
              sourceIp: '0.0.0.0',
              destIp: olt.ipAddress || '10.0.0.1',
              protocol: 'GPON',
              packetColor: 'orange', // Оранжевый для атаки подбора
              direction: 'upstream',
              payload: `BRUTEFORCE_ATTEMPT_${attemptCount}_ONU_ID_${targetOnuId}`,
              gponFrame: {
                onuId: targetOnuId, // Пытаемся использовать чужой ID
                allocId: 1024 + (targetOnuId || 0),
                gemPort: 1280 + (targetOnuId || 0),
              },
            },
            path: normalizePath(bruteforcePath), // Реальный путь через граф от ROGUE ONT до OLT
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          // Используем больший TTL для атак (1500ms extra)
          const bruteforceTtl = getPathTravelMs(bruteforcePacket.path.length, get().simulation.speed, 1500)
          get().addTransientPacket(bruteforcePacket, bruteforceTtl)
          
          // Логируем каждую 10-ю попытку
          if (attemptCount % 10 === 0 || attemptCount === 1) {
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] Попытка авторизации: SN=${targetSerial}, попытка #${attemptCount}`,
            })
          }
          
          // Удаляем пакет через некоторое время (больше времени для визуализации)
          setTimeout(() => {
            get().removePacket(bruteforcePacket.id)
          }, 3000)
          
          // Симулируем попытку использования чужих идентификаторов (10% шанс успеха)
          const success = Math.random() < 0.1
          
          if (success) {
            get().addLog({
              level: 'critical',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] Доступ получен: SN=${targetSerial} принят ${olt.name || 'OLT-1'}`,
            })
            
            // Обновляем конфигурацию с подобранным ID
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                gponConfig: {
                  ...rogueOnt.config.gponConfig,
                  onuId: targetOnuId,
                },
              },
            })
          }
          
          // Планируем следующую попытку (более частые попытки для лучшей визуализации)
          setTimeout(sendBruteforceRequest, Math.max(bruteforceInterval * 3, 6000)) // Увеличено в 3 раза: было bruteforceInterval (3000ms) и min 2000ms
        }
        
        // Начинаем периодические запросы
        sendBruteforceRequest()
        break
        
        case 'ddos':
          // DDoS атака - постоянная отправка пакетов для перегрузки канала OLT
          // ВАЖНО: Проверяем реальный путь через граф перед запуском атаки
          const currentState = get()
          const nodes = buildNodeGraph(currentState.devices, currentState.connections)
          const pathToOlt = findPath(nodes, rogueOntId, olt.id)
          
          if (!pathToOlt || pathToOlt.length < 2) {
            get().addLog({
              level: 'error',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] ❌ Невозможно начать DDoS атаку: ROGUE ONT не подключен к сети (нет пути до OLT)`,
            })
            // Отключаем режим атаки, так как устройство не подключено
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                attackMode: undefined
              }
            })
            return
          }
          
          get().addLog({
            level: 'warning',
            deviceId: rogueOntId,
            message: `[ont-rogue-${rogueOntId}] Начало атаки: DDoS атака (зашумление канала) (SN: ${rogueSerialNumber})`,
          })
        
        let packetCounter = 0
        const lastPacketTimes: number[] = [] // Время последних пакетов для проверки наслоения
        const attackDuration = 60000 // 60 секунд атаки (непрерывно)
        const startTime = Date.now()
        let oltOverloaded = false
        
        // Функция для отправки одного DDoS пакета
        const sendDdosPacket = () => {
          // Атаки работают независимо от состояния симуляции для визуализации
          if (Date.now() - startTime > attackDuration) {
            if (oltOverloaded) {
              get().addLog({
                level: 'critical',
                deviceId: olt.id,
                message: `[${olt.name || 'OLT-1'}] Перегрузка: получено слишком много пакетов от rogue-ONT ${rogueSerialNumber}`,
              })
              get().addLog({
                level: 'critical',
                deviceId: olt.id,
                message: `[${olt.name || 'OLT-1'}] Состояние: ОТКЛЮЧЕН, пересылка трафика остановлена`,
              })
            } else {
              get().addLog({
                level: 'warning',
                deviceId: rogueOntId,
                message: `[ont-rogue-${rogueOntId}] Атака DDoS остановлена`,
              })
            }
            return
          }
          
          // КРИТИЧНО: Проверяем реальный путь через граф перед каждым пакетом
          // Если ROGUE ONT отключили, путь исчезнет и атака прекратится
          const currentStateForPath = get()
          const currentNodes = buildNodeGraph(currentStateForPath.devices, currentStateForPath.connections)
          const currentPath = findPath(currentNodes, rogueOntId, olt.id)
          
          if (!currentPath || currentPath.length < 2) {
            // Путь больше не существует - ROGUE ONT отключен, останавливаем атаку
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] ⚠️ DDoS атака остановлена: ROGUE ONT отключен от сети (путь до OLT разорван)`,
            })
            // Отключаем режим атаки
            get().updateDevice(rogueOntId, {
              config: {
                ...rogueOnt.config,
                attackMode: undefined
              }
            })
            return
          }
          
          const now = Date.now()
          packetCounter++
          
          // Используем случайный или неправильный идентификатор для части пакетов
          const useWrongId = Math.random() < 0.3 // 30% пакетов с неправильным ID
          const wrongOnuId = Math.floor(Math.random() * 100) + 200 // Несуществующий ID
          
          // Используем реальный путь из графа, преобразуя Node[] в string[] и нормализуя
          const attackPath = normalizePath(currentPath.map(node => node.id))
          
          const ddosPacket: Packet = {
            id: `ddos-${now}-${packetCounter}`,
            type: 'gpon',
            source: rogueOntId,
            destination: olt.id, // Всегда OLT как конечная цель
            current: rogueOntId,
            direction: 'UPSTREAM',
            targetOntId: useWrongId ? wrongOnuId : (rogueOnt.config.gponConfig?.onuId || null),
            payloadType: 'ATTACK',
            data: {
              sourceIp: '0.0.0.0',
              destIp: olt.ipAddress || '10.0.0.1',
              protocol: 'GPON',
              packetColor: 'red', // Красный для DDoS пакетов
              direction: 'upstream',
              payload: `DDoS_SPAM_${packetCounter}`,
              gponFrame: {
                onuId: useWrongId ? wrongOnuId : (rogueOnt.config.gponConfig?.onuId || 999),
                allocId: 1024 + (packetCounter % 32),
                gemPort: 1280 + (packetCounter % 32),
              },
            },
            path: normalizePath(attackPath), // Реальный путь через граф от ROGUE ONT до OLT
            currentPosition: 0,
            timestamp: now,
          }
          
          // Используем больший TTL для атак (1500ms extra)
          const ddosTtl = getPathTravelMs(ddosPacket.path.length, get().simulation.speed, 1500)
          get().addTransientPacket(ddosPacket, ddosTtl)
          
          // Проверка на наслоение данных (если 2 пакета пришли с разницей меньше 500ms)
          if (lastPacketTimes.length > 0) {
            const timeSinceLastPacket = now - lastPacketTimes[lastPacketTimes.length - 1]
            
            if (timeSinceLastPacket < 500) {
              // Критическое наслоение данных - перегрузка OLT
              if (!oltOverloaded && packetCounter >= 15) {
                oltOverloaded = true
                // OLT перегружен - покраснел и перестал пересылать сигналы
                get().updateDevice(olt.id, {
                  status: 'error',
                  statusLevel: 3, // Red - critical (перегружен)
                })
                
                get().addLog({
                  level: 'critical',
                  deviceId: olt.id,
                  message: `[${olt.name || 'OLT-1'}] Перегрузка: получено слишком много пакетов от rogue-ONT ${rogueSerialNumber}`,
                  details: {
                    packetId: ddosPacket.id,
                    timeSinceLast: timeSinceLastPacket,
                    onuId: ddosPacket.data.gponFrame?.onuId,
                    overloaded: true,
                  }
                })
                get().addLog({
                  level: 'critical',
                  deviceId: olt.id,
                  message: `[${olt.name || 'OLT-1'}] Состояние: ОТКЛЮЧЕН, пересылка трафика остановлена`,
                })
              } else {
                get().addLog({
                  level: 'error',
                  deviceId: olt.id,
                  message: `❌ ОШИБКА: Наслоение данных! Пакет #${packetCounter} пришел через ${timeSinceLastPacket}ms после предыдущего (< 500ms)`,
                  details: {
                    packetId: ddosPacket.id,
                    timeSinceLast: timeSinceLastPacket,
                    onuId: ddosPacket.data.gponFrame?.onuId,
                  }
                })
              }
            } else if (useWrongId) {
              // Ошибка неверного идентификатора
              get().addLog({
                level: 'error',
                deviceId: olt.id,
                message: `❌ ОШИБКА: Неверный идентификатор устройства! ONU ID=${wrongOnuId} не зарегистрирован`,
                details: {
                  packetId: ddosPacket.id,
                  onuId: wrongOnuId,
                }
              })
            }
          }
          
          lastPacketTimes.push(now)
          // Храним только последние 10 времен для проверки
          if (lastPacketTimes.length > 10) {
            lastPacketTimes.shift()
          }
          
          // Удаляем пакет через некоторое время (больше времени для визуализации)
          setTimeout(() => {
            get().removePacket(ddosPacket.id)
          }, 300)
          
          // Логируем каждые 5 пакетов для лучшей визуализации
          if (packetCounter % 5 === 0) {
            get().addLog({
              level: 'warning',
              deviceId: rogueOntId,
              message: `[ont-rogue-${rogueOntId}] DDoS: отправлено ${packetCounter} пакетов на ${olt.name || 'OLT-1'}`,
            })
          }
          
          // Отправляем следующий пакет через 300ms (очень быстро для перегрузки и лучшей визуализации)
          setTimeout(sendDdosPacket, 800) // 300ms между пакетами для максимальной перегрузки и визуализации
        }
        
        // Начинаем отправку пакетов
        sendDdosPacket()
        
        // Обновляем статус OLT (начало зашумления)
        get().updateDevice(olt.id, {
          statusLevel: 2, // Orange - moderate threat (будет изменен на 3 при перегрузке)
        })
        break
      }
    } catch (err) {
      console.error('Ошибка в executeAttackDirection:', err)
      get().addLog({
        level: 'error',
        deviceId: rogueOntId,
        message: `[ont-rogue-${rogueOntId}] Ошибка в логике атаки: ${String(err)}`,
      })
    }
  },
  
  gponRanging: async (ontId: string) => {
    const ont = get().devices.find(d => d.id === ontId)
    if (!ont || ont.type !== 'ONT') {
      get().addLog({
        level: 'error',
        message: `ONT ${ontId} не найден`,
      })
      return false
    }
    
    get().addLog({
      level: 'info',
      deviceId: ontId,
      message: '📡 Выполнение GPON ranging...',
    })
    
    // Simulate ranging delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const rangingDelay = Math.random() * 1.5 + 0.5 // 0.5-2.0 microseconds
    const opticalPower = -26 + Math.random() * 6 // -26 to -20 dBm
    
    get().addLog({
      level: 'info',
      deviceId: ontId,
      message: `✓ GPON ranging завершен. Задержка: ${rangingDelay.toFixed(2)} мкс, Мощность: ${opticalPower.toFixed(2)} дБм`,
      details: { rangingDelay, opticalPower },
    })
    
    return true
  },
  
  attemptOntRegistration: async (ontId: string, serialNumber?: string, loid?: string, password?: string) => {
    const ont = get().devices.find(d => d.id === ontId)
    if (!ont || ont.type !== 'ONT') {
      return false
    }
    
    get().addLog({
      level: 'warning',
      deviceId: ontId,
      message: `🔐 Попытка регистрации с поддельными данными: Serial=${serialNumber || 'unknown'}, LOID=${loid || 'unknown'}`,
    })
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate registration attempt (30-50% success rate for unauthorized)
    const successProbability = serialNumber?.startsWith('ROGUE') ? 0.35 : 0.5
    const success = Math.random() < successProbability
    
    if (success) {
      // Generate ONU ID
      const existingONUs = get().devices.filter(d => 
        (d.type === 'ONU' || d.type === 'ONT') && 
        d.config.gponConfig?.onuId !== undefined
      )
      const onuIdNumber = existingONUs.length + 1
      const allocId = 1024 + onuIdNumber
      const gemPort = 1280 + onuIdNumber
      
      get().updateDevice(ontId, {
        config: {
          ...ont.config,
          gponConfig: {
            ...ont.config.gponConfig,
            onuId: onuIdNumber,
            allocId,
            gemPort,
            serialNumber: serialNumber || ont.serialNumber,
          },
        },
      })
      
      get().addLog({
        level: 'critical',
        deviceId: ontId,
        message: `🚨 РЕГИСТРАЦИЯ УСПЕШНА! ONU ID: ${onuIdNumber}, Alloc ID: ${allocId}, GEM Port: ${gemPort}`,
        details: { onuId: onuIdNumber, allocId, gemPort },
      })
      
      return true
    } else {
      get().addLog({
        level: 'warning',
        deviceId: ontId,
        message: '❌ Регистрация отклонена: неверные идентификаторы или защита сработала',
      })
      return false
    }
  },
  
  assignServiceProfile: async (ontId: string, vlan?: number, profile?: string) => {
    const ont = get().devices.find(d => d.id === ontId)
    if (!ont || ont.type !== 'ONT') {
      return false
    }
    
    // Check if ONT is registered
    if (!ont.config.gponConfig?.onuId) {
      get().addLog({
        level: 'error',
        deviceId: ontId,
        message: 'ONT не зарегистрирован, невозможно назначить профиль услуг',
      })
      return false
    }
    
    const assignedVlan = vlan || Math.floor(Math.random() * 900) + 100 // 100-999
    const serviceProfile = profile || 'default_subscriber'
    
    get().updateDevice(ontId, {
      config: {
        ...ont.config,
        vlan: [assignedVlan],
      },
    })
    
    get().addLog({
      level: 'info',
      deviceId: ontId,
      message: `✓ Назначен профиль услуг: VLAN ${assignedVlan}, Профиль: ${serviceProfile}`,
      details: { vlan: assignedVlan, profile: serviceProfile },
    })
    
    return true
  },
  
  saveProject: (nodePositions?: Record<string, { x: number; y: number }>) => {
    const state = get()
    
    // Use provided positions, or fall back to cached positions, or use device positions from store
    const positionsToUse = nodePositions || state.nodePositions
    
    // Update device positions with actual node positions from ReactFlow
    const devicesToSave = state.devices.map(device => {
      const nodePosition = positionsToUse[device.id]
      if (nodePosition) {
        return { ...device, position: nodePosition }
      }
      // If no node position available, use device position from store
      return device
    })
    
    const payload = {
      version: '1.0',
      topology: {
        devices: devicesToSave,
        connections: state.connections,
      },
      simulation: {
        isRunning: state.simulation.isRunning,
        speed: state.simulation.speed,
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
              // Ensure all devices have valid positions
              const devicesWithPositions = data.topology.devices.map((device: NetworkDevice) => {
                if (!device.position || typeof device.position.x !== 'number' || typeof device.position.y !== 'number') {
                  // If position is missing or invalid, set a default position
                  return {
                    ...device,
                    position: { x: Math.random() * 400, y: Math.random() * 400 }
                  }
                }
                return device
              })
              
              // Sync node positions to store for saving
              const positionsMap: Record<string, { x: number; y: number }> = {}
              devicesWithPositions.forEach((device: NetworkDevice) => {
                positionsMap[device.id] = device.position
              })
              
              set({ 
                devices: devicesWithPositions,
                nodePositions: positionsMap
              })
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
                logs: data.simulation.logs || [],
              },
            }))
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

      updateDeviceAnimationCoords: (deviceId, coords) => {
    set((state) => ({
      deviceAnimationCoords: {
        ...state.deviceAnimationCoords,
        [deviceId]: coords,
      },
    }))
  },
  
  syncNodePositions: (positions) => {
    set({ nodePositions: positions })
  },
  
  highlightedDevices: [],
  setHighlightedDevices: (deviceIds) => {
    set({ highlightedDevices: deviceIds })
  },
  
  // Attack Engine
  activeAttacks: {
    EAVESDROP: { isActive: false, timers: [], packetIds: [] },
    BRUTEFORCE_ID: { isActive: false, timers: [], packetIds: [] },
    UNAUTHORIZED_ONT: { isActive: false, timers: [], packetIds: [] },
    ONT_SPOOF: { isActive: false, timers: [], packetIds: [] },
    DDOS: { isActive: false, timers: [], packetIds: [] },
  },
  
  // Helper функция для поиска/создания точки подключения (tap point)
  ensureTapPointForTarget: (targetId: string) => {
    const state = get()
    const target = state.devices.find(d => d.id === targetId)
    
    if (!target) {
      return null
    }
    
    // Если target - это сплиттер
    if (target.type === 'SPLITTER') {
      // Находим upstream parent сплиттера
      const upstreamEdge = state.connections.find(conn =>
        conn.targetDeviceId === target.id &&
        conn.status === 'active' &&
        conn.type === 'optical'
      )
      
      const parentId = upstreamEdge ? upstreamEdge.sourceDeviceId : undefined
      
      return {
        targetId: target.id,
        tapSplitterId: target.id,
        parentId,
        createdSplitterId: undefined,
        replacedEdge: undefined,
      }
    }
    
    // Если target - ONT или ONU
    if (target.type === 'ONT' || target.type === 'ONU') {
      // Находим upstream parent
      const upstreamEdge = state.connections.find(conn =>
        conn.targetDeviceId === target.id &&
        conn.status === 'active' &&
        conn.type === 'optical'
      )
      
      if (!upstreamEdge) {
        return null
      }
      
      const parentId = upstreamEdge.sourceDeviceId
      const parentDevice = state.devices.find(d => d.id === parentId)
      
      // Если parent - сплиттер, используем его
      if (parentDevice && parentDevice.type === 'SPLITTER') {
        return {
          targetId: target.id,
          tapSplitterId: parentId,
          parentId,
          createdSplitterId: undefined,
          replacedEdge: undefined,
        }
      }
      
      // Иначе вставляем новый сплиттер
      if (!parentDevice) {
        return null
      }
      
      // Удаляем старое соединение
      get().removeConnection(upstreamEdge.id)
      
      // Создаем TapSplitter в середине линии
      const tapSplitterId = `tap-splitter-${Date.now()}`
      const midX = (parentDevice.position.x + target.position.x) / 2
      const midY = (parentDevice.position.y + target.position.y) / 2
      
      const tapSplitter: NetworkDevice = {
        id: tapSplitterId,
        type: 'SPLITTER',
        name: 'TapSplitter',
        position: { x: midX, y: midY },
        ports: Array.from({ length: 4 }, (_, i) => ({
          id: `${tapSplitterId}-port-${i + 1}`,
          number: i + 1,
          type: 'optical',
          status: 'up',
        })),
        config: {
          isAttackDevice: true,
          gponConfig: {
            splitterRatio: '1:32',
          },
        },
        status: 'active',
        statusLevel: 0,
      }
      
      get().addDevice(tapSplitter)
      
      // Создаем соединения: parent -> TapSplitter, TapSplitter -> target
      get().addConnection({
        id: `conn-${Date.now()}-parent-tap`,
        sourceDeviceId: parentId,
        sourcePortId: upstreamEdge.sourcePortId,
        targetDeviceId: tapSplitterId,
        targetPortId: tapSplitter.ports[0].id,
        type: 'optical',
        status: 'active',
      })
      
      get().addConnection({
        id: `conn-${Date.now()}-tap-target`,
        sourceDeviceId: tapSplitterId,
        sourcePortId: tapSplitter.ports[1].id,
        targetDeviceId: target.id,
        targetPortId: upstreamEdge.targetPortId,
        type: 'optical',
        status: 'active',
      })
      
      return {
        targetId: target.id,
        tapSplitterId,
        parentId,
        createdSplitterId: tapSplitterId,
        replacedEdge: {
          id: upstreamEdge.id,
          sourceId: parentId,
          targetId: target.id,
          sourcePortId: upstreamEdge.sourcePortId,
          targetPortId: upstreamEdge.targetPortId,
          type: 'optical' as const,
        },
      }
    }
    
    return null
  },
  
  startAttack: async (type, options) => {
    const state = get()
    
    // Проверяем, не запущена ли уже эта атака
    if (state.activeAttacks[type].isActive) {
      get().addLog({
        level: 'warning',
        message: `Атака ${type} уже запущена`,
      })
      return
    }
    
    // Находим OLT (нужен для всех атак)
    const olt = state.devices.find(d => d.type === 'OLT' && 
      (d.config.gponConfig?.oltNumber === 1 || !d.config.gponConfig?.oltNumber))
    if (!olt) {
      get().addLog({
        level: 'error',
        message: 'Не найден OLT',
      })
      return
    }
    
    // Специальная логика для EAVESDROP
    if (type === 'EAVESDROP') {
      const targetId = options?.targetId || options?.targetDeviceId
      if (!targetId) {
        get().addLog({
          level: 'error',
          message: 'Не выбрана точка подключения для атаки EAVESDROP',
        })
        return
      }
      
      // Используем ensureTapPointForTarget
      const tapPoint = get().ensureTapPointForTarget(targetId)
      if (!tapPoint) {
        get().addLog({
          level: 'error',
          message: 'Не удалось определить точку подключения',
        })
        return
      }
      
      // Генерируем ID (idCode или gponId2) если нужно
      const allOnts = state.devices.filter(d => (d.type === 'ONT' || d.type === 'ONU') && 
        !d.config.idCode && !d.config.gponConfig?.gponId2)
      const usedIds = new Set(state.devices
        .filter(d => d.config.idCode || d.config.gponConfig?.gponId2)
        .map(d => d.config.idCode || d.config.gponConfig?.gponId2))
      
      allOnts.forEach(ont => {
        // Генерируем двухзначный ID в диапазоне 21-99
        let newId: string
        do {
          newId = String(Math.floor(Math.random() * 79) + 21).padStart(2, '0') // 21-99
        } while (usedIds.has(newId))
        usedIds.add(newId)
        get().updateDevice(ont.id, {
          config: {
            ...ont.config,
            idCode: newId, // Используем idCode как основной
            gponConfig: {
              ...ont.config.gponConfig,
              gponId2: newId, // Сохраняем и в gponId2 для совместимости
            },
          },
        })
      })
      
      // Создаем SnifferONT
      const snifferOntId = `sniffer-ont-${Date.now()}`
      const tapSplitter = state.devices.find(d => d.id === tapPoint.tapSplitterId) || get().devices.find(d => d.id === tapPoint.tapSplitterId)
      if (!tapSplitter) {
        get().addLog({
          level: 'error',
          message: 'Не найден сплиттер для подключения',
        })
        return
      }
      
      const snifferOnt: NetworkDevice = {
        id: snifferOntId,
        type: 'ONT',
        name: 'SnifferONT',
        position: {
          x: tapSplitter.position.x + 150,
          y: tapSplitter.position.y - 100,
        },
        ports: [
          {
            id: `${snifferOntId}-port-1`,
            number: 1,
            type: 'optical',
            status: 'down',
          },
          {
            id: `${snifferOntId}-port-2`,
            number: 2,
            type: 'ethernet',
            status: 'down',
          },
        ],
        config: {
          isAttackDevice: true,
          attackKind: 'EAVESDROP',
          gponConfig: {
            serialNumber: `SNIFF${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            wavelengthDown: 1490,
            wavelengthUp: 1310,
          },
        },
        status: 'active',
        statusLevel: 3,
        serialNumber: `SNIFF${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }
      
      get().addDevice(snifferOnt)
      
      // Подключаем SnifferONT к tapSplitter
      get().addConnection({
        id: `conn-${Date.now()}-tap-sniffer`,
        sourceDeviceId: tapPoint.tapSplitterId,
        sourcePortId: tapSplitter.ports.find(p => !p.connectedTo)?.id || tapSplitter.ports[2].id,
        targetDeviceId: snifferOntId,
        targetPortId: snifferOnt.ports[0].id,
        type: 'optical',
        status: 'active',
      })
      
      // Создаем AttackerPC
      const attackerPcId = `attacker-pc-eavesdrop-${Date.now()}`
      const attackerPC: NetworkDevice = {
        id: attackerPcId,
        type: 'PC',
        name: 'ATTACKER PC',
        position: {
          x: snifferOnt.position.x + 150,
          y: snifferOnt.position.y,
        },
        ports: [{
          id: `${attackerPcId}-port-1`,
          number: 1,
          type: 'ethernet',
          status: 'down',
        }],
        config: {
          isAttackDevice: true,
        },
        status: 'active',
        statusLevel: 3,
        ipAddress: '192.168.1.100',
      }
      
      get().addDevice(attackerPC)
      
      // Подключаем AttackerPC к SnifferONT
      get().addConnection({
        id: `conn-${Date.now()}-sniffer-pc`,
        sourceDeviceId: snifferOntId,
        sourcePortId: snifferOnt.ports[1].id,
        targetDeviceId: attackerPcId,
        targetPortId: attackerPC.ports[0].id,
        type: 'ethernet',
        status: 'active',
      })
      
      // Сохраняем состояние атаки
      set((state) => ({
        activeAttacks: {
          ...state.activeAttacks,
          [type]: {
            isActive: true,
            attackerDeviceId: snifferOntId,
            timers: [],
            packetIds: [],
            targetDeviceId: targetId,
            tapSplitterId: tapPoint.tapSplitterId,
            createdSplitterId: tapPoint.createdSplitterId,
            replacedEdge: tapPoint.replacedEdge,
            snifferOntId,
            eavesdropPcId: attackerPcId,
            crackedCodes: [], // Инициализируем пустой массив для найденных кодов
          },
        },
      }))
      
      // Запускаем атаку
      await get().executeAttack(type, snifferOntId, tapSplitter, olt, targetId)
      return
    }
    
    // Специальная логика для DDOS
    if (type === 'DDOS') {
      const targetId = options?.targetId || options?.targetDeviceId
      if (!targetId) {
        get().addLog({
          level: 'error',
          message: 'Не выбрана точка подключения для атаки DDOS',
        })
        return
      }
      
      // Используем ensureTapPointForTarget
      const tapPoint = get().ensureTapPointForTarget(targetId)
      if (!tapPoint) {
        get().addLog({
          level: 'error',
          message: 'Не удалось определить точку подключения',
        })
        return
      }
      
      // Создаем DdosONT
      const ddosOntId = `ddos-ont-${Date.now()}`
      const tapSplitter = state.devices.find(d => d.id === tapPoint.tapSplitterId) || get().devices.find(d => d.id === tapPoint.tapSplitterId)
      if (!tapSplitter) {
        get().addLog({
          level: 'error',
          message: 'Не найден сплиттер для подключения',
        })
        return
      }
      
      const ddosOnt: NetworkDevice = {
        id: ddosOntId,
        type: 'ONT',
        name: 'DdosONT',
        position: {
          x: tapSplitter.position.x + 150,
          y: tapSplitter.position.y + 100,
        },
        ports: [{
          id: `${ddosOntId}-port-1`,
          number: 1,
          type: 'optical',
          status: 'down',
        }],
        config: {
          isAttackDevice: true,
          attackKind: 'DDOS',
          gponConfig: {
            serialNumber: `DDOS${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            wavelengthDown: 1490,
            wavelengthUp: 1310,
          },
        },
        status: 'active',
        statusLevel: 3,
        serialNumber: `DDOS${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }
      
      get().addDevice(ddosOnt)
      
      // Подключаем DdosONT к tapSplitter
      get().addConnection({
        id: `conn-${Date.now()}-tap-ddos`,
        sourceDeviceId: tapPoint.tapSplitterId,
        sourcePortId: tapSplitter.ports.find(p => !p.connectedTo)?.id || tapSplitter.ports[2].id,
        targetDeviceId: ddosOntId,
        targetPortId: ddosOnt.ports[0].id,
        type: 'optical',
        status: 'active',
      })
      
      // Сохраняем состояние атаки
      set((state) => ({
        activeAttacks: {
          ...state.activeAttacks,
          [type]: {
            isActive: true,
            attackerDeviceId: ddosOntId,
            timers: [],
            packetIds: [],
            targetDeviceId: targetId,
            tapSplitterId: tapPoint.tapSplitterId,
            createdSplitterId: tapPoint.createdSplitterId,
            replacedEdge: tapPoint.replacedEdge,
          },
        },
      }))
      
      // Запускаем атаку
      await get().executeAttack(type, ddosOntId, tapSplitter, olt, targetId)
      return
    }
    
    // Специальная логика для ONT_SPOOF (новый сценарий подмены)
    if (type === 'ONT_SPOOF') {
      if (!options?.targetDeviceId) {
        get().addLog({
          level: 'error',
          message: 'Не выбрано устройство ONT/ONU для атаки Подмена ONT',
        })
        return
      }
      
      // Проверяем, что выбрано устройство типа ONT или ONU
      const target = state.devices.find(d => d.id === options.targetDeviceId)
      if (!target || (target.type !== 'ONT' && target.type !== 'ONU')) {
        get().addLog({
          level: 'error',
          message: 'Выбранное устройство не является ONT/ONU',
        })
        return
      }
      
      // Генерируем двухзначный ID для всех ONT/ONU если еще не сгенерирован
      const allOnts = state.devices.filter(d => (d.type === 'ONT' || d.type === 'ONU') && 
        !d.config.gponConfig?.gponId2)
      const usedIds = new Set(state.devices
        .filter(d => d.config.gponConfig?.gponId2)
        .map(d => d.config.gponConfig?.gponId2))
      
      allOnts.forEach(ont => {
        // Генерируем двухзначный ID в диапазоне 21-99
        let newId: string
        do {
          newId = String(Math.floor(Math.random() * 79) + 21).padStart(2, '0') // 21-99
        } while (usedIds.has(newId))
        usedIds.add(newId)
        get().updateDevice(ont.id, {
          config: {
            ...ont.config,
            gponConfig: {
              ...ont.config.gponConfig,
              gponId2: newId,
            },
          },
        })
      })
      
      // Обновляем target после генерации ID
      const updatedTarget = get().devices.find(d => d.id === target.id)
      if (!updatedTarget) return
      
      // Находим parent (устройство выше target по upstream edge)
      // Ищем активный edge, где target является получателем (targetDeviceId)
      const upstreamEdge = state.connections.find(conn =>
        conn.targetDeviceId === target.id &&
        conn.status === 'active' &&
        conn.type === 'optical'
      )
      
      if (!upstreamEdge) {
        get().addLog({
          level: 'error',
          message: 'Не найдено upstream соединение для целевого ONT/ONU',
        })
        return
      }
      
      const parentDevice = state.devices.find(d => d.id === upstreamEdge.sourceDeviceId)
      if (!parentDevice) {
        get().addLog({
          level: 'error',
          message: 'Не найдено родительское устройство для целевого ONT/ONU',
        })
        return
      }
      
      // Удаляем исходное соединение parent -> target
      get().removeConnection(upstreamEdge.id)
      
      // Создаем AttackSplitter в середине линии
      const attackSplitterId = `attack-splitter-${Date.now()}`
      const midX = (parentDevice.position.x + updatedTarget.position.x) / 2
      const midY = (parentDevice.position.y + updatedTarget.position.y) / 2
      
      const attackSplitter: NetworkDevice = {
        id: attackSplitterId,
        type: 'SPLITTER',
        name: 'AttackSplitter',
        position: { x: midX, y: midY },
        ports: Array.from({ length: 4 }, (_, i) => ({
          id: `${attackSplitterId}-port-${i + 1}`,
          number: i + 1,
          type: 'optical',
          status: 'up',
        })),
        config: {
          isAttackDevice: true,
          gponConfig: {
            splitterRatio: '1:32',
          },
        },
        status: 'active',
        statusLevel: 0,
      }
      
      get().addDevice(attackSplitter)
      
      // Создаем соединения: parent -> AttackSplitter, AttackSplitter -> target (параллельно)
      get().addConnection({
        id: `conn-${Date.now()}-parent-splitter`,
        sourceDeviceId: parentDevice.id,
        sourcePortId: upstreamEdge.sourcePortId,
        targetDeviceId: attackSplitterId,
        targetPortId: attackSplitter.ports[0].id,
        type: 'optical',
        status: 'active',
      })
      
      get().addConnection({
        id: `conn-${Date.now()}-splitter-target`,
        sourceDeviceId: attackSplitterId,
        sourcePortId: attackSplitter.ports[1].id,
        targetDeviceId: updatedTarget.id,
        targetPortId: upstreamEdge.targetPortId,
        type: 'optical',
        status: 'active',
      })
      
      // Создаем SubstituteONT (подменный ONT) с ДВУМЯ оптическими портами
      const substituteOntId = `substitute-ont-${Date.now()}`
      const substituteOnt: NetworkDevice = {
        id: substituteOntId,
        type: 'ONT',
        name: 'SubstituteONT',
        position: {
          x: attackSplitter.position.x + 150,
          y: attackSplitter.position.y - 100,
        },
        ports: [
          {
            id: `${substituteOntId}-port-1`,
            number: 1,
            type: 'optical',
            status: 'down',
          },
          {
            id: `${substituteOntId}-port-2`,
            number: 2,
            type: 'optical', // Второй оптический порт для подключения к target
            status: 'down',
          },
          {
            id: `${substituteOntId}-port-3`,
            number: 3,
            type: 'ethernet',
            status: 'down',
          },
        ],
        config: {
          isAttackDevice: true,
          attackKind: 'ONT_SPOOF_SUBSTITUTE',
          gponConfig: {
            serialNumber: `SUB${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            wavelengthDown: 1490,
            wavelengthUp: 1310,
          },
        },
        status: 'active',
        statusLevel: 3,
        serialNumber: `SUB${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }
      
      get().addDevice(substituteOnt)
      
      // Подключаем SubstituteONT к AttackSplitter (верхнее оптическое подключение)
      get().addConnection({
        id: `conn-${Date.now()}-splitter-substitute`,
        sourceDeviceId: attackSplitterId,
        sourcePortId: attackSplitter.ports[2].id,
        targetDeviceId: substituteOntId,
        targetPortId: substituteOnt.ports[0].id,
        type: 'optical',
        status: 'active',
      })
      
      // Подключаем SubstituteONT к target по ОПТИКЕ (нижнее оптическое подключение)
      // Находим свободный оптический порт у target
      const targetOpticalPort = updatedTarget.ports.find(p => p.type === 'optical' && !p.connectedTo) || 
                                updatedTarget.ports.find(p => p.type === 'optical')
      if (targetOpticalPort) {
        get().addConnection({
          id: `conn-${Date.now()}-substitute-target`,
          sourceDeviceId: substituteOntId,
          sourcePortId: substituteOnt.ports[1].id, // Второй оптический порт
          targetDeviceId: updatedTarget.id,
          targetPortId: targetOpticalPort.id,
          type: 'optical', // ОПТИЧЕСКОЕ соединение, не ethernet
          status: 'active',
        })
      }
      
      // Создаем AttackerPC и подключаем к SubstituteONT
      const attackerPcId = `attacker-pc-${Date.now()}`
      const attackerPC: NetworkDevice = {
        id: attackerPcId,
        type: 'PC',
        name: 'ATTACKER PC',
        position: {
          x: substituteOnt.position.x + 150,
          y: substituteOnt.position.y,
        },
        ports: [{
          id: `${attackerPcId}-port-1`,
          number: 1,
          type: 'ethernet',
          status: 'down',
        }],
        config: {
          isAttackDevice: true,
        },
        status: 'active',
        statusLevel: 3,
        ipAddress: '192.168.1.100',
      }
      
      get().addDevice(attackerPC)
      
      // Подключаем AttackerPC к SubstituteONT (ethernet - третий порт)
      get().addConnection({
        id: `conn-${Date.now()}-substitute-pc`,
        sourceDeviceId: substituteOntId,
        sourcePortId: substituteOnt.ports[2].id, // Третий порт (ethernet)
        targetDeviceId: attackerPcId,
        targetPortId: attackerPC.ports[0].id,
        type: 'ethernet',
        status: 'active',
      })
      
      get().addLog({
        level: 'warning',
        deviceId: substituteOntId,
        message: `[ATTACK][ONT SPOOF] SubstituteONT подключен параллельно к ${updatedTarget.name} через AttackSplitter`,
      })
      
      // Обновляем состояние атаки с информацией для восстановления
      set((state) => ({
        activeAttacks: {
          ...state.activeAttacks,
          [type]: {
            isActive: true,
            attackerDeviceId: substituteOntId,
            timers: [],
            packetIds: [],
            targetDeviceId: updatedTarget.id,
            attackSplitterId: attackSplitterId,
            parentDeviceId: parentDevice.id,
            originalConnectionId: upstreamEdge.id,
            originalSourcePortId: upstreamEdge.sourcePortId,
            originalTargetPortId: upstreamEdge.targetPortId,
            substituteOntId: substituteOntId,
            attackerPcId: attackerPcId,
          },
        },
      }))
      
      // Запускаем конкретную атаку
      await get().executeAttack(type, substituteOntId, attackSplitter, olt, updatedTarget.id)
      return
    }
    
    // Стандартная логика для других атак
    // Находим сплиттер
    const splitters = state.devices.filter(d => d.type === 'SPLITTER')
    if (splitters.length === 0) {
      get().addLog({
        level: 'error',
        message: 'Не найден сплиттер для подключения атакующего устройства',
      })
      return
    }
    
    // Выбираем ближайший к OLT или первый
    const splitter = olt 
      ? splitters.reduce((closest, s) => {
          const closestDist = Math.sqrt(
            Math.pow(closest.position.x - olt.position.x, 2) + 
            Math.pow(closest.position.y - olt.position.y, 2)
          )
          const sDist = Math.sqrt(
            Math.pow(s.position.x - olt.position.x, 2) + 
            Math.pow(s.position.y - olt.position.y, 2)
          )
          return sDist < closestDist ? s : closest
        })
      : splitters[0]
    
    // Создаем атакующее устройство
    const attackerId = `attacker-${type}-${Date.now()}`
    const attackNames: Record<AttackType, string> = {
      EAVESDROP: 'ROGUE ONT (Sniffer)',
      BRUTEFORCE_ID: 'ROGUE ONT (Bruteforce)',
      UNAUTHORIZED_ONT: 'ROGUE ONT (Unauthorized)',
      ONT_SPOOF: 'CLONED ONT (Spoof)',
      DDOS: 'BOTNET ONT (DDoS)',
    }
    
    const attackerDevice: NetworkDevice = {
      id: attackerId,
      type: 'ONT',
      name: attackNames[type],
      position: {
        x: splitter.position.x + 200,
        y: splitter.position.y + 150,
      },
      ports: [{
        id: `${attackerId}-port-1`,
        number: 1,
        type: 'optical',
        status: 'down',
      }],
      config: {
        isAttackDevice: true,
        attackKind: type,
        gponConfig: {
          serialNumber: `ATTACK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          wavelengthDown: 1490,
          wavelengthUp: 1310,
        },
      },
      status: 'active',
      statusLevel: 3,
      serialNumber: `ATTACK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    }
    
    get().addDevice(attackerDevice)
    
    // Подключаем к сплиттеру
    const splitterPort = splitter.ports.find(p => !p.connectedTo) || splitter.ports[0]
    if (splitterPort) {
      get().addConnection({
        id: `conn-${Date.now()}-attack`,
        sourceDeviceId: splitter.id,
        sourcePortId: splitterPort.id,
        targetDeviceId: attackerId,
        targetPortId: attackerDevice.ports[0].id,
        type: 'optical',
        status: 'active',
      })
    }
    
    // Обновляем состояние атаки
    set((state) => ({
      activeAttacks: {
        ...state.activeAttacks,
        [type]: {
          isActive: true,
          attackerDeviceId: attackerId,
          timers: [],
          packetIds: [],
          targetDeviceId: options?.targetDeviceId,
        },
      },
    }))
    
    // Запускаем конкретную атаку
    await get().executeAttack(type, attackerId, splitter, olt, options?.targetDeviceId)
  },
  
  stopAttack: (type) => {
    const state = get()
    const attack = state.activeAttacks[type]
    
    if (!attack.isActive) {
      return
    }
    
    // Отменяем все таймеры
    attack.timers.forEach(timerId => {
      clearTimeout(timerId)
      clearInterval(timerId)
    })
    
    // Удаляем все пакеты атаки
    attack.packetIds.forEach(packetId => {
      get().removePacket(packetId)
    })
    
    // Специальная логика для EAVESDROP
    if (type === 'EAVESDROP') {
      // Удаляем SnifferONT и AttackerPC
      if (attack.snifferOntId) {
        const snifferConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.snifferOntId || conn.targetDeviceId === attack.snifferOntId
        )
        snifferConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
        get().removeDevice(attack.snifferOntId)
      }
      
      if (attack.eavesdropPcId) {
        get().removeDevice(attack.eavesdropPcId)
      }
      
      // Если был создан TapSplitter - удаляем его и восстанавливаем соединение
      if (attack.createdSplitterId && attack.replacedEdge) {
        const splitterConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.createdSplitterId || conn.targetDeviceId === attack.createdSplitterId
        )
        splitterConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
        get().removeDevice(attack.createdSplitterId)
        
        // Восстанавливаем исходное соединение
        get().addConnection({
          id: attack.replacedEdge.id,
          sourceDeviceId: attack.replacedEdge.sourceId,
          sourcePortId: attack.replacedEdge.sourcePortId,
          targetDeviceId: attack.replacedEdge.targetId,
          targetPortId: attack.replacedEdge.targetPortId,
          type: attack.replacedEdge.type,
          status: 'active',
        })
      }
      
      // Сбрасываем состояние атаки
      set((state) => ({
        activeAttacks: {
          ...state.activeAttacks,
          [type]: {
            isActive: false,
            timers: [],
            packetIds: [],
          },
        },
      }))
      
      get().addLog({
        level: 'info',
        message: `Атака ${type} остановлена`,
      })
      return
    }
    
    // Специальная логика для DDOS
    if (type === 'DDOS') {
      // Удаляем DdosONT
      if (attack.attackerDeviceId) {
        const ddosConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.attackerDeviceId || conn.targetDeviceId === attack.attackerDeviceId
        )
        ddosConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
        get().removeDevice(attack.attackerDeviceId)
      }
      
      // Если был создан TapSplitter - удаляем его и восстанавливаем соединение
      if (attack.createdSplitterId && attack.replacedEdge) {
        const splitterConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.createdSplitterId || conn.targetDeviceId === attack.createdSplitterId
        )
        splitterConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
        get().removeDevice(attack.createdSplitterId)
        
        // Восстанавливаем исходное соединение
        get().addConnection({
          id: attack.replacedEdge.id,
          sourceDeviceId: attack.replacedEdge.sourceId,
          sourcePortId: attack.replacedEdge.sourceId,
          targetDeviceId: attack.replacedEdge.targetId,
          targetPortId: attack.replacedEdge.targetId,
          type: attack.replacedEdge.type,
          status: 'active',
        })
      }
      
      // Сбрасываем состояние атаки
      set((state) => ({
        activeAttacks: {
          ...state.activeAttacks,
          [type]: {
            isActive: false,
            timers: [],
            packetIds: [],
          },
        },
      }))
      
      get().addLog({
        level: 'info',
        message: `Атака ${type} остановлена`,
      })
      return
    }
    
    // Специальная логика для ONT_SPOOF: восстановление соединений
    if (type === 'ONT_SPOOF' && attack.parentDeviceId && attack.targetDeviceId) {
      // Удаляем все соединения, связанные с атакующими устройствами
      if (attack.substituteOntId) {
        const substituteConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.substituteOntId || conn.targetDeviceId === attack.substituteOntId
        )
        substituteConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
      }
      
      if (attack.attackerPcId) {
        const pcConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.attackerPcId || conn.targetDeviceId === attack.attackerPcId
        )
        pcConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
      }
      
      // Удаляем AttackSplitter если он еще существует
      if (attack.attackSplitterId) {
        const splitterConnections = state.connections.filter(conn =>
          conn.sourceDeviceId === attack.attackSplitterId || conn.targetDeviceId === attack.attackSplitterId
        )
        splitterConnections.forEach(conn => {
          get().removeConnection(conn.id)
        })
        get().removeDevice(attack.attackSplitterId)
      }
      
      // Восстанавливаем исходное соединение parent -> target
      if (attack.originalConnectionId && attack.originalSourcePortId && attack.originalTargetPortId) {
        // Проверяем, не существует ли уже такое соединение
        const existingConn = state.connections.find(conn =>
          conn.sourceDeviceId === attack.parentDeviceId && conn.targetDeviceId === attack.targetDeviceId
        )
        
        if (!existingConn) {
          get().addConnection({
            id: attack.originalConnectionId,
            sourceDeviceId: attack.parentDeviceId,
            sourcePortId: attack.originalSourcePortId,
            targetDeviceId: attack.targetDeviceId,
            targetPortId: attack.originalTargetPortId,
            type: 'optical',
            status: 'active',
          })
        }
      }
      
      // Удаляем атакующие устройства
      if (attack.substituteOntId) {
        get().removeDevice(attack.substituteOntId)
      }
      
      if (attack.attackerPcId) {
        get().removeDevice(attack.attackerPcId)
      }
      
      // Снимаем флаг compromised у целевого ONT/ONU
      if (attack.targetDeviceId) {
        const victim = state.devices.find(d => d.id === attack.targetDeviceId)
        if (victim) {
          get().updateDevice(attack.targetDeviceId, {
            config: {
              ...victim.config,
              compromised: false,
            },
            status: 'active',
            statusLevel: 0,
          })
        }
      }
    }
    
    // Удаляем атакующее устройство и его соединения
    if (attack.attackerDeviceId) {
      const attackerDevice = state.devices.find(d => d.id === attack.attackerDeviceId)
      if (attackerDevice) {
        // Удаляем устройство (это также удалит соединения)
        get().removeDevice(attack.attackerDeviceId)
      }
    }
    
    // Сбрасываем состояние атаки
    set((state) => ({
      activeAttacks: {
        ...state.activeAttacks,
        [type]: {
          isActive: false,
          timers: [],
          packetIds: [],
          currentBruteKey: undefined, // Очищаем текущий ключ подбора
          forcedSuccess: false, // Сбрасываем флаг forced success
        },
      },
    }))
    
    get().addLog({
      level: 'info',
      message: `Атака ${type} остановлена`,
    })
  },
  
  // Helper функция для построения дерева и определения устройств в ветке для подбора ID
  getTargetsToCrack: (targetDeviceId: string): NetworkDevice[] => {
    const state = get()
    const target = state.devices.find(d => d.id === targetDeviceId)
    if (!target) return []
    
    // Строим childrenMap: sourceId -> [targetId, ...]
    const childrenMap: Record<string, string[]> = {}
    state.connections
      .filter(conn => conn.status === 'active' && conn.type === 'optical')
      .forEach(conn => {
        if (!childrenMap[conn.sourceDeviceId]) {
          childrenMap[conn.sourceDeviceId] = []
        }
        childrenMap[conn.sourceDeviceId].push(conn.targetDeviceId)
      })
    
    // Определяем root для подбора
    let rootId: string
    if (target.type === 'ONT' || target.type === 'ONU') {
      // Подбираем только это устройство
      rootId = target.id
    } else if (target.type === 'SPLITTER') {
      // Подбираем всех ONT/ONU в поддереве сплиттера
      rootId = target.id
    } else if (target.type === 'OLT') {
      // Подбираем всех ONT/ONU в сети
      rootId = target.id
    } else {
      return []
    }
    
    // DFS для сбора всех ONT/ONU в поддереве
    const targetsToCrack: NetworkDevice[] = []
    const visited = new Set<string>()
    
    const dfs = (deviceId: string) => {
      if (visited.has(deviceId)) return
      visited.add(deviceId)
      
      const device = state.devices.find(d => d.id === deviceId)
      if (device && (device.type === 'ONT' || device.type === 'ONU')) {
        // Если root - это ONT/ONU, добавляем только его
        if (deviceId === target.id && (target.type === 'ONT' || target.type === 'ONU')) {
          targetsToCrack.push(device)
        } else if (deviceId !== target.id) {
          // Для других случаев добавляем все ONT/ONU в поддереве
          targetsToCrack.push(device)
        }
      }
      
      // Продолжаем обход детей
      const children = childrenMap[deviceId] || []
      children.forEach(childId => dfs(childId))
    }
    
    dfs(rootId)
    
    // Если root - это ONT/ONU, добавляем его явно
    if (target.type === 'ONT' || target.type === 'ONU') {
      if (!targetsToCrack.find(d => d.id === target.id)) {
        targetsToCrack.push(target)
      }
    }
    
    return targetsToCrack
  },
  
  // Внутренняя функция для выполнения конкретной атаки
  executeAttack: async (type: AttackType, attackerId: string, splitter: NetworkDevice, olt: NetworkDevice | undefined, targetDeviceId?: string) => {
    const state = get()
    if (!olt) {
      get().addLog({
        level: 'error',
        message: 'Не найден OLT для атаки',
      })
      return
    }
    
    const nodes = buildNodeGraph(state.devices, state.connections)
    const attackerDevice = state.devices.find(d => d.id === attackerId)
    if (!attackerDevice) return
    
    const attack = state.activeAttacks[type]
    const timers: number[] = []
    
    switch (type) {
      case 'EAVESDROP':
        // Прослушивание нисходящего канала (ТОЛЬКО downstream, НЕТ upstream)
        get().addLog({
          level: 'warning',
          deviceId: attackerId,
          message: '[ATTACK][EAVESDROP] tap connected',
        })
        
        // Определяем список устройств для подбора ID
        const targetsToCrack = targetDeviceId ? get().getTargetsToCrack(targetDeviceId) : []
        
        // Инициализируем состояние подбора для каждого устройства
        const bruteState: Record<string, { currentAttempt: number; codeLength: number; maxAttempts: number; found: boolean }> = {}
        targetsToCrack.forEach(target => {
          const idCode = target.config.idCode || target.config.gponConfig?.gponId2 || ''
          const codeLength = idCode.length || 2 // По умолчанию 2-значный
          bruteState[target.id] = {
            currentAttempt: 0,
            codeLength,
            maxAttempts: codeLength === 1 ? 10 : 100, // 0-9 для 1-значного, 00-99 для 2-значного
            found: false,
          }
        })
        
        // Подбор ID для каждого устройства в очереди
        const bruteTimer = setInterval(() => {
          const currentState = get()
          if (!currentState.activeAttacks[type].isActive) {
            clearInterval(bruteTimer)
            return
          }
          
          // Обрабатываем каждое устройство по очереди
          for (const targetId in bruteState) {
            const brute = bruteState[targetId]
            if (brute.found) continue
            
            const target = currentState.devices.find(d => d.id === targetId)
            if (!target) {
              brute.found = true // Помечаем как обработанное, если устройство удалено
              continue
            }
            
            const idCode = target.config.idCode || target.config.gponConfig?.gponId2 || ''
            if (!idCode) {
              brute.found = true // Помечаем как обработанное, если нет ID
              continue
            }
            
            brute.currentAttempt++
            
            // Генерируем кандидата на основе длины кода
            let testCode: string
            if (brute.codeLength === 1) {
              testCode = String(brute.currentAttempt % 10)
            } else {
              testCode = String(brute.currentAttempt % 100).padStart(2, '0')
            }
            
            // Проверяем совпадение
            if (testCode === idCode) {
              brute.found = true
              
              // Обновляем устройство: помечаем как подобранное
              get().updateDevice(targetId, {
                config: {
                  ...target.config,
                  idCracked: true,
                  idCode: idCode, // Сохраняем idCode если его не было
                },
              })
              
              // Добавляем в список найденных кодов
              set((state) => {
                const currentAttack = state.activeAttacks[type]
                const crackedCodes = currentAttack.crackedCodes || []
                if (!crackedCodes.find(item => item.deviceId === targetId)) {
                  crackedCodes.push({ deviceId: targetId, code: idCode })
                }
                return {
                  activeAttacks: {
                    ...state.activeAttacks,
                    [type]: {
                      ...currentAttack,
                      crackedCodes,
                    },
                  },
                }
              })
              
              get().addLog({
                level: 'critical',
                deviceId: attackerId,
                message: `[ATTACK][EAVESDROP] ID CRACKED: ${target.name} (${idCode})`,
              })
            }
            
            // Логируем каждые 10 попыток
            if (brute.currentAttempt % 10 === 0) {
              get().addLog({
                level: 'warning',
                deviceId: attackerId,
                message: `[ATTACK][EAVESDROP] brute attempt ${testCode} for ${target.name} -> ${testCode === idCode ? 'FOUND' : 'FAIL'}`,
              })
            }
            
            // Если достигли максимума попыток, переходим к следующему
            if (brute.currentAttempt >= brute.maxAttempts) {
              brute.found = true // Помечаем как обработанное (даже если не нашли)
            }
          }
          
          // Проверяем, все ли устройства обработаны
          const allFound = Object.values(bruteState).every(b => b.found)
          if (allFound) {
            clearInterval(bruteTimer)
            get().addLog({
              level: 'info',
              deviceId: attackerId,
              message: '[ATTACK][EAVESDROP] All target IDs processed',
            })
          }
        }, 2000) // Каждые 2 секунды попытка
        
        timers.push(bruteTimer as any)
        
        // Перехват downstream пакетов (ТОЛЬКО downstream, НЕТ upstream)
        const eavesdropInterval = setInterval(() => {
          const currentState = get()
          if (!currentState.activeAttacks[type].isActive) {
            clearInterval(eavesdropInterval)
            return
          }
          
          // Пересчитываем граф для актуальности пути
          const currentNodes = buildNodeGraph(currentState.devices, currentState.connections)
          const pathFromOlt = findPath(currentNodes, olt.id, attackerId)
          if (!pathFromOlt || pathFromOlt.length < 2) return
          
          // Создаем ТОЛЬКО downstream пакет (копия трафика от OLT)
          const packet: Packet = {
            id: `eavesdrop-${Date.now()}-${Math.random()}`,
            type: 'gpon',
            source: olt.id,
            destination: attackerId,
            current: olt.id,
            direction: 'DOWNSTREAM',
            targetOntId: null,
            payloadType: 'ATTACK',
            data: {
              sourceIp: olt.ipAddress || '10.0.0.1',
              destIp: '0.0.0.0',
              protocol: 'GPON',
              packetColor: 'red',
              direction: 'downstream',
              gponFrame: {
                onuId: Math.floor(Math.random() * 32) + 1,
                allocId: 1024 + Math.floor(Math.random() * 32),
                gemPort: 1280 + Math.floor(Math.random() * 32),
              },
            },
            path: normalizePath(pathFromOlt.map(n => n.id)),
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          // Используем правильный TTL на основе длины пути (1500ms extra для атак)
          const attackTtl = getPathTravelMs(packet.path.length, currentState.simulation.speed, 1500)
          get().addTransientPacket(packet, attackTtl)
          
          // Обновляем список пакетов атаки
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                packetIds: [...state.activeAttacks[type].packetIds, packet.id],
              },
            },
          }))
          
          // Логирование перехвата (только downstream)
          get().addLog({
            level: 'warning',
            deviceId: attackerId,
            message: `[ATTACK][EAVESDROP] capture downstream frame #${currentState.activeAttacks[type].packetIds.length + 1} (simulated)`,
          })
        }, 7200 + Math.random() * 3600) // 7200-10800ms
        
        timers.push(eavesdropInterval as any)
        break
        
      case 'BRUTEFORCE_ID': {
        // Подбор идентификаторов
        let attemptCount = 0
        const maxAttempts = 30
        
        const bruteforceInterval = setInterval(() => {
          const currentState = get()
          if (!currentState.activeAttacks[type].isActive || attemptCount >= maxAttempts) {
            clearInterval(bruteforceInterval)
            if (attemptCount >= maxAttempts) {
              get().addLog({
                level: 'critical',
                deviceId: attackerId,
                message: `[ATTACK][BRUTEFORCE_ID] attempt #${maxAttempts} id=YYYY -> ACCEPT (simulated)`,
              })
            }
            return
          }
          
          attemptCount++
          const pathToOlt = findPath(nodes, attackerId, olt.id)
          if (!pathToOlt || pathToOlt.length < 2) return
          
          const packet: Packet = {
            id: `bruteforce-${Date.now()}-${attemptCount}`,
            type: 'gpon',
            source: attackerId,
            destination: olt.id,
            current: attackerId,
            direction: 'UPSTREAM',
            targetOntId: String(Math.floor(Math.random() * 32) + 1),
            payloadType: 'ATTACK',
            data: {
              sourceIp: '0.0.0.0',
              destIp: olt.ipAddress || '10.0.0.1',
              protocol: 'GPON',
              packetColor: 'red',
              direction: 'upstream',
              gponFrame: {
                onuId: Math.floor(Math.random() * 32) + 1,
                allocId: 1024 + Math.floor(Math.random() * 32),
                gemPort: 1280 + Math.floor(Math.random() * 32),
              },
            },
            path: normalizePath(pathToOlt.map(n => n.id)),
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          get().addTransientPacket(packet, 2000)
          
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                packetIds: [...state.activeAttacks[type].packetIds, packet.id],
              },
            },
          }))
          
          get().addLog({
            level: 'warning',
            deviceId: attackerId,
            message: `[ATTACK][BRUTEFORCE_ID] attempt #${attemptCount} id=XXXX -> REJECT`,
          })
        }, 6000) // Увеличено в 3 раза: было 2000ms
        
        timers.push(bruteforceInterval as any)
        break
      }
        
      case 'UNAUTHORIZED_ONT':
        // Несанкционированное подключение ONT
        get().addLog({
          level: 'warning',
          deviceId: attackerId,
          message: '[ATTACK][UNAUTHORIZED_ONT] link up',
        })
        
        const pathToOltUnauth = findPath(nodes, attackerId, olt.id)
        if (pathToOltUnauth && pathToOltUnauth.length >= 2) {
          const packet: Packet = {
            id: `unauthorized-${Date.now()}`,
            type: 'gpon',
            source: attackerId,
            destination: olt.id,
            current: attackerId,
            direction: 'UPSTREAM',
            targetOntId: null,
            payloadType: 'ATTACK',
            data: {
              sourceIp: '0.0.0.0',
              destIp: olt.ipAddress || '10.0.0.1',
              protocol: 'GPON',
              packetColor: 'red',
              direction: 'upstream',
            },
            path: normalizePath(pathToOltUnauth.map(n => n.id)),
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          get().addTransientPacket(packet, 2000)
          
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                packetIds: [...state.activeAttacks[type].packetIds, packet.id],
              },
            },
          }))
        }
        
        setTimeout(() => {
          get().addLog({
            level: 'warning',
            deviceId: attackerId,
            message: '[ATTACK][UNAUTHORIZED_ONT] registration -> REJECT',
          })
          get().addLog({
            level: 'warning',
            deviceId: attackerId,
            message: '[ATTACK][UNAUTHORIZED_ONT] state=BLOCKED',
          })
        }, 1000)
        break
        
      case 'ONT_SPOOF': {
        // Подмена ONT (объединенная атака)
        if (!targetDeviceId) {
          get().addLog({
            level: 'error',
            message: 'Не выбрана жертва для подмены ONT',
          })
          return
        }
        
        const victim = state.devices.find(d => d.id === targetDeviceId)
        if (!victim || (victim.type !== 'ONT' && victim.type !== 'ONU')) {
          get().addLog({
            level: 'error',
            message: 'Выбранное устройство не является ONT/ONU',
          })
          return
        }
        
        get().addLog({
          level: 'warning',
          deviceId: attackerId,
          message: `[ATTACK][ONT_SPOOF] начат подбор двухзначного ID для ${victim.name}`,
        })
        
        // Получаем целевой двухзначный ID (валидируем диапазон 21-99)
        const targetId2 = victim.config.gponConfig?.gponId2
        if (!targetId2) {
          get().addLog({
            level: 'error',
            message: 'У целевого ONT/ONU отсутствует двухзначный ID',
          })
          return
        }
        
        // Валидация: ID должен быть в диапазоне 21-99
        const targetIdNum = parseInt(targetId2, 10)
        if (isNaN(targetIdNum) || targetIdNum < 21 || targetIdNum > 99) {
          get().addLog({
            level: 'error',
            message: `ID целевого устройства ${targetId2} вне допустимого диапазона 21-99`,
          })
          return
        }
        
        // Общая функция для финализации успеха (реального или forced)
        const finalizeSuccess = (foundId: string, isForced: boolean = false) => {
          const currentStateForRewiring = get()
          const attackState = currentStateForRewiring.activeAttacks[type]
          
          if (!attackState.attackSplitterId || !attackState.targetDeviceId || !attackState.parentDeviceId || !attackState.substituteOntId) {
            get().addLog({
              level: 'error',
              message: '[ATTACK][ONT_SPOOF] Недостаточно данных для перекоммутации',
            })
            return
          }
          
          const substituteOnt = currentStateForRewiring.devices.find(d => d.id === attackState.substituteOntId)
          const targetOnt = currentStateForRewiring.devices.find(d => d.id === attackState.targetDeviceId)
          const parentDevice = currentStateForRewiring.devices.find(d => d.id === attackState.parentDeviceId)
          const attackSplitter = currentStateForRewiring.devices.find(d => d.id === attackState.attackSplitterId)
          
          if (!substituteOnt || !targetOnt || !parentDevice || !attackSplitter) {
            get().addLog({
              level: 'error',
              message: '[ATTACK][ONT_SPOOF] Не найдены устройства для перекоммутации',
            })
            return
          }
          
          // 1. Удаляем соединения через AttackSplitter
          const connectionsToRemove = currentStateForRewiring.connections.filter(conn =>
            conn.sourceDeviceId === attackState.attackSplitterId || conn.targetDeviceId === attackState.attackSplitterId
          )
          connectionsToRemove.forEach(conn => {
            get().removeConnection(conn.id)
          })
          
          // 2. Удаляем AttackSplitter
          get().removeDevice(attackState.attackSplitterId)
          
          // 3. Создаем новое optical соединение: parent -> SubstituteONT
          const substituteOpticalPort = substituteOnt.ports.find(p => p.type === 'optical')
          const parentOpticalPort = parentDevice.ports.find(p => p.type === 'optical' && !p.connectedTo) || parentDevice.ports.find(p => p.type === 'optical')
          
          if (substituteOpticalPort && parentOpticalPort) {
            get().addConnection({
              id: `conn-${Date.now()}-parent-substitute`,
              sourceDeviceId: parentDevice.id,
              sourcePortId: parentOpticalPort.id,
              targetDeviceId: substituteOnt.id,
              targetPortId: substituteOpticalPort.id,
              type: 'optical',
              status: 'active',
            })
            
            get().addLog({
              level: 'warning',
              deviceId: substituteOnt.id,
              message: '[ATTACK][ONT SPOOF] rewiring: SubstituteONT -> parent',
            })
          }
          
          // 4. Создаем ethernet соединение: SubstituteONT -> target
          const currentConnections = currentStateForRewiring.connections.filter(conn =>
            conn.sourceDeviceId === substituteOnt.id || conn.targetDeviceId === substituteOnt.id
          )
          const usedPortIds = new Set(
            currentConnections.map(conn =>
              conn.sourceDeviceId === substituteOnt.id ? conn.sourcePortId : conn.targetPortId
            )
          )
          
          const freeEthernetPort = substituteOnt.ports.find(p =>
            p.type === 'ethernet' && !usedPortIds.has(p.id)
          )
          
          let ethernetPortId: string
          if (freeEthernetPort) {
            ethernetPortId = freeEthernetPort.id
          } else {
            ethernetPortId = `${substituteOnt.id}-port-3`
            get().updateDevice(substituteOnt.id, {
              ports: [
                ...substituteOnt.ports,
                {
                  id: ethernetPortId,
                  number: 3,
                  type: 'ethernet',
                  status: 'down',
                },
              ],
            })
          }
          
          const targetEthernetPort = targetOnt.ports.find(p => p.type === 'ethernet') || targetOnt.ports[0]
          if (targetEthernetPort) {
            get().addConnection({
              id: `conn-${Date.now()}-substitute-target`,
              sourceDeviceId: substituteOnt.id,
              sourcePortId: ethernetPortId,
              targetDeviceId: targetOnt.id,
              targetPortId: targetEthernetPort.id,
              type: 'ethernet',
              status: 'active',
            })
          }
          
          get().addLog({
            level: 'warning',
            deviceId: substituteOnt.id,
            message: '[ATTACK][ONT SPOOF] rewiring: target -> SubstituteONT (ethernet)',
          })
          
          // 5. Устанавливаем флаг compromised у целевого ONT/ONU
          get().updateDevice(targetDeviceId, {
            config: {
              ...victim.config,
              compromised: true,
            },
            statusLevel: 3,
          })
          
          // Обновляем статус SubstituteONT
          get().updateDevice(substituteOnt.id, {
            config: {
              ...substituteOnt.config,
              status: 'ACTIVE_ATTACK',
            },
          })
          
          get().addLog({
            level: 'critical',
            deviceId: attackerId,
            message: `[ATTACK][ONT SPOOF] Устройство подключено. Атака завершена успешно.${isForced ? ' (forced success на 99)' : ''}`,
          })
          
          get().addLog({
            level: 'warning',
            deviceId: targetDeviceId,
            message: '[ATTACK][ONT_SPOOF] Целевой ONT/ONU скомпрометирован',
          })
          
          // Обновляем состояние атаки с флагом forcedSuccess
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                forcedSuccess: isForced,
                currentBruteKey: undefined, // Очищаем текущий ключ после успеха
              },
            },
          }))
          
          // Запускаем attack request/response loop для AttackerPC после успешной перекоммутации
          const attackerPcId = attackState.attackerPcId
          if (attackerPcId) {
            const attackerPC = currentStateForRewiring.devices.find(d => d.id === attackerPcId)
            
            if (attackerPC && olt) {
              // Запускаем периодическую генерацию attack request/response
              const attackTrafficInterval = setInterval(() => {
                const currentState = get()
                const currentAttack = currentState.activeAttacks[type]
                
                if (!currentAttack.isActive || !currentAttack.attackerPcId) {
                  clearInterval(attackTrafficInterval)
                  return
                }
                
                const currentAttackerPC = currentState.devices.find(d => d.id === currentAttack.attackerPcId)
                if (!currentAttackerPC) {
                  clearInterval(attackTrafficInterval)
                  return
                }
                
                // Пересчитываем граф и путь для актуальности
                const currentNodes = buildNodeGraph(currentState.devices, currentState.connections)
                const pathToOlt = findPath(currentNodes, attackerPcId, olt.id)
                
                if (!pathToOlt || pathToOlt.length < 2) {
                  return
                }
                
                // A) Создаем ATTACK REQUEST пакет (красный)
                const attackRequestPath = normalizePath(pathToOlt.map(node => node.id))
                const nextDeviceId = attackRequestPath.length > 1 ? attackRequestPath[1] : attackRequestPath[attackRequestPath.length - 1]
                
                const attackRequest: Packet = {
                  id: `spoof-attack-req-${Date.now()}-${Math.random()}`,
                  type: 'gpon',
                  source: attackerPcId,
                  destination: nextDeviceId,
                  current: attackerPcId,
                  direction: 'UPSTREAM',
                  targetOntId: null,
                  payloadType: 'ATTACK',
                  data: {
                    sourceIp: currentAttackerPC.ipAddress || '192.168.1.100',
                    destIp: olt.ipAddress || '10.0.0.1',
                    protocol: 'GPON',
                    packetColor: 'red',
                    direction: 'upstream',
                    attackSubType: 'SPOOF_REQ',
                    payload: 'SPOOF_ATTACK_REQUEST',
                  },
                  path: attackRequestPath,
                  currentPosition: 0,
                  timestamp: Date.now(),
                }
                
                get().addTransientPacket(attackRequest, getPathTravelMs(attackRequestPath.length, currentState.simulation.speed, 1500))
                
                set((state) => ({
                  activeAttacks: {
                    ...state.activeAttacks,
                    [type]: {
                      ...state.activeAttacks[type],
                      packetIds: [...state.activeAttacks[type].packetIds, attackRequest.id],
                    },
                  },
                }))
                
                get().addLog({
                  level: 'warning',
                  deviceId: attackerPcId,
                  message: '[ATTACK][ONT SPOOF] attacker PC -> OLT request',
                })
                
                // B) Через задержку создаем ATTACK RESPONSE пакет (красный)
                setTimeout(() => {
                  const responseState = get()
                  const responseAttack = responseState.activeAttacks[type]
                  
                  if (!responseAttack.isActive || !responseAttack.attackerPcId) {
                    return
                  }
                  
                  const responseNodes = buildNodeGraph(responseState.devices, responseState.connections)
                  const pathFromOlt = findPath(responseNodes, olt.id, attackerPcId)
                  
                  if (!pathFromOlt || pathFromOlt.length < 2) {
                    return
                  }
                  
                  const attackResponsePath = normalizePath(pathFromOlt.map(node => node.id))
                  const responseNextDeviceId = attackResponsePath.length > 1 ? attackResponsePath[1] : attackResponsePath[attackResponsePath.length - 1]
                  
                  const attackResponse: Packet = {
                    id: `spoof-attack-resp-${Date.now()}-${Math.random()}`,
                    type: 'gpon',
                    source: olt.id,
                    destination: responseNextDeviceId,
                    current: olt.id,
                    direction: 'DOWNSTREAM',
                    targetOntId: null,
                    payloadType: 'ATTACK',
                    data: {
                      sourceIp: olt.ipAddress || '10.0.0.1',
                      destIp: currentAttackerPC.ipAddress || '192.168.1.100',
                      protocol: 'GPON',
                      packetColor: 'red',
                      direction: 'downstream',
                      attackSubType: 'SPOOF_RESP',
                      payload: 'SPOOF_ATTACK_RESPONSE',
                    },
                    path: attackResponsePath,
                    currentPosition: 0,
                    timestamp: Date.now(),
                  }
                  
                  get().addTransientPacket(attackResponse, getPathTravelMs(attackResponsePath.length, responseState.simulation.speed, 1500))
                  
                  set((state) => ({
                    activeAttacks: {
                      ...state.activeAttacks,
                      [type]: {
                        ...state.activeAttacks[type],
                        packetIds: [...state.activeAttacks[type].packetIds, attackResponse.id],
                      },
                    },
                  }))
                  
                  get().addLog({
                    level: 'warning',
                    deviceId: olt.id,
                    message: '[ATTACK][ONT SPOOF] OLT -> attacker PC response',
                  })
                }, 400 + Math.random() * 300) // Задержка 400-700ms
              }, 3600 + Math.random() * 1800) // Интервал 3600-5400ms
              
              timers.push(attackTrafficInterval as any)
              
              // Сохраняем таймер в состоянии атаки
              set((state) => ({
                activeAttacks: {
                  ...state.activeAttacks,
                  [type]: {
                    ...state.activeAttacks[type],
                    timers: [...state.activeAttacks[type].timers, attackTrafficInterval as any],
                  },
                },
              }))
            }
          }
        }
        
        // Подбор двухзначного ID: циклический перебор 01-99 с шагом 250мс
        let currentKey = 1 // Начинаем с 01
        const maxKey = 99
        
        // Инициализируем состояние атаки с текущим ключом
        set((state) => ({
          activeAttacks: {
            ...state.activeAttacks,
            [type]: {
              ...state.activeAttacks[type],
              currentBruteKey: '01',
              forcedSuccess: false,
            },
          },
        }))
        
        const bruteforceInterval = setInterval(() => {
          const currentState = get()
          if (!currentState.activeAttacks[type].isActive) {
            clearInterval(bruteforceInterval)
            return
          }
          
          // Форматируем текущий ключ как двузначную строку
          const testId = String(currentKey).padStart(2, '0')
          
          // Обновляем текущий ключ в состоянии для отображения в UI
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                currentBruteKey: testId,
              },
            },
          }))
          
          // Обновляем SubstituteONT для отображения текущего ключа
          const substituteOntId = currentState.activeAttacks[type].substituteOntId
          if (substituteOntId) {
            const substituteOnt = currentState.devices.find(d => d.id === substituteOntId)
            if (substituteOnt) {
              get().updateDevice(substituteOntId, {
                config: {
                  ...substituteOnt.config,
                  idCode: testId, // Временно показываем текущий ключ
                },
              })
            }
          }
          
          // Строим путь от SubstituteONT до OLT
          const currentNodes = buildNodeGraph(currentState.devices, currentState.connections)
          const pathToOlt = findPath(currentNodes, attackerId, olt.id)
          if (!pathToOlt || pathToOlt.length < 2) {
            clearInterval(bruteforceInterval)
            return
          }
          
          // Создаем пакет с тестовым ID
          const packet: Packet = {
            id: `spoof-${Date.now()}-${currentKey}`,
            type: 'gpon',
            source: attackerId,
            destination: olt.id,
            current: attackerId,
            direction: 'UPSTREAM',
            targetOntId: testId,
            payloadType: 'ATTACK',
            data: {
              sourceIp: '0.0.0.0',
              destIp: olt.ipAddress || '10.0.0.1',
              protocol: 'GPON',
              packetColor: 'red',
              direction: 'upstream',
              gponFrame: {
                onuId: parseInt(testId),
                allocId: 1024 + Math.floor(Math.random() * 32),
                gemPort: 1280 + Math.floor(Math.random() * 32),
              },
            },
            path: normalizePath(pathToOlt.map(n => n.id)),
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          // Используем правильный TTL на основе длины пути (1500ms extra для атак)
          const spoofTtl = getPathTravelMs(packet.path.length, currentState.simulation.speed, 1500)
          get().addTransientPacket(packet, spoofTtl)
          
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                packetIds: [...state.activeAttacks[type].packetIds, packet.id],
              },
            },
          }))
          
          // Проверяем, найден ли правильный ID
          if (testId === targetId2) {
            clearInterval(bruteforceInterval)
            
            get().addLog({
              level: 'critical',
              deviceId: attackerId,
              message: `[ATTACK][ONT_SPOOF] ID найден: ${testId}`,
            })
            
            // Вызываем общую функцию финализации успеха
            finalizeSuccess(testId, false)
            return
          }
          
          // Затычка: если дошли до 99 и успех не наступил - принудительно считаем успешным
          if (currentKey >= maxKey) {
            clearInterval(bruteforceInterval)
            
            get().addLog({
              level: 'warning',
              deviceId: attackerId,
              message: `[ATTACK][ONT_SPOOF] Достигнут лимит подбора (99). Принудительное подключение (forced success).`,
            })
            
            // Вызываем общую функцию финализации успеха с флагом forced
            finalizeSuccess('99', true)
            return
          }
          
          // Увеличиваем ключ для следующей итерации
          currentKey++
          
          // Логируем каждую 10-ю попытку
          if (currentKey % 10 === 0 || currentKey === 1) {
            get().addLog({
              level: 'warning',
              deviceId: attackerId,
              message: `[ATTACK][ONT_SPOOF] попытка #${currentKey} id=${testId} -> REJECT`,
            })
          }
        }, 250) // Попытка каждые 250мс (четверть секунды)
        
        timers.push(bruteforceInterval as any)
        break
      }
        
      case 'DDOS':
        // DDoS / Upstream flood
        // Определяем узел перегруза (congestion point) - используем tapSplitterId из состояния атаки
        const ddosAttack = state.activeAttacks[type]
        const congestionNodeId = ddosAttack.tapSplitterId
        
        // Сохраняем congestionNodeId в состоянии атаки
        if (congestionNodeId) {
          set((state) => ({
            activeAttacks: {
              ...state.activeAttacks,
              [type]: {
                ...state.activeAttacks[type],
                congestionNodeId,
              },
            },
          }))
        }
        
        get().addLog({
          level: 'warning',
          deviceId: attackerId,
          message: `[ATTACK][DDOS] flood started pps=20, congestion node: ${congestionNodeId || 'unknown'}`,
        })
        
        let packetCounter = 0
        const ddosInterval = setInterval(() => {
          const currentState = get()
          if (!currentState.activeAttacks[type].isActive) {
            clearInterval(ddosInterval)
            return
          }
          
          packetCounter++
          // Пересчитываем граф и путь каждый раз для актуальности
          const currentNodes = buildNodeGraph(currentState.devices, currentState.connections)
          const pathToOltDdos = findPath(currentNodes, attackerId, olt.id)
          if (!pathToOltDdos || pathToOltDdos.length < 2) {
            get().addLog({
              level: 'warning',
              deviceId: attackerId,
              message: '[ATTACK][DDOS] Путь до OLT не найден, атака остановлена',
            })
            clearInterval(ddosInterval)
            return
          }
          
          // Генерируем 10-20 пакетов в секунду
          for (let i = 0; i < 2; i++) {
            const packet: Packet = {
              id: `ddos-${Date.now()}-${packetCounter}-${i}`,
              type: 'gpon',
              source: attackerId,
              destination: olt.id,
              current: attackerId,
              direction: 'UPSTREAM',
              targetOntId: null,
              payloadType: 'ATTACK',
              data: {
                sourceIp: '0.0.0.0',
                destIp: olt.ipAddress || '10.0.0.1',
                protocol: 'GPON',
                packetColor: 'red',
                direction: 'upstream',
                payload: `DDoS_SPAM_${packetCounter}_${i}`,
              },
              path: normalizePath(pathToOltDdos.map(n => n.id)),
              currentPosition: 0,
              timestamp: Date.now(),
            }
            
            // Используем правильный TTL на основе длины пути (1500ms extra для атак)
            const ddosTtl = getPathTravelMs(packet.path.length, currentState.simulation.speed, 1500)
            get().addTransientPacket(packet, ddosTtl)
            
            set((state) => ({
              activeAttacks: {
                ...state.activeAttacks,
                [type]: {
                  ...state.activeAttacks[type],
                  packetIds: [...state.activeAttacks[type].packetIds, packet.id],
                },
              },
            }))
          }
          
          // При достижении порога перегружаем OLT
          if (packetCounter >= 15 && olt.statusLevel !== 3) {
            get().updateDevice(olt.id, {
              status: 'error',
              statusLevel: 3,
            })
            get().addLog({
              level: 'critical',
              deviceId: olt.id,
              message: '[ATTACK][DDOS] packet loss detected, OLT overloaded',
            })
          }
        }, 100) // 10 пакетов в секунду (100ms * 2 пакета)
        
        timers.push(ddosInterval as any)
        break
    }
    
    // Сохраняем таймеры
    set((state) => ({
      activeAttacks: {
        ...state.activeAttacks,
        [type]: {
          ...state.activeAttacks[type],
          timers: [...state.activeAttacks[type].timers, ...timers],
        },
      },
    }))
  },
}))

