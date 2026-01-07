import { Packet, NetworkDevice, Connection, PacketDirection, PayloadType, SimulationState, AttackType, ActiveAttack } from '@/types/network'
import { buildNodeGraph, findPath } from '@/utils/pathfinding'

/**
 * Система обработки пакетов для GPON сети
 * Реализует алгоритмы обработки для каждого типа устройств
 */

export interface PacketProcessingResult {
  outgoingPackets: Packet[]
  dropped: boolean
  reason?: string
}

/**
 * Получить все downstream подключения устройства
 * Downstream - это соединения, где устройство является источником и целевое устройство ниже по иерархии
 */
function getDownstreamConnections(
  deviceId: string,
  connections: Connection[],
  devices: NetworkDevice[]
): Connection[] {
  const device = devices.find(d => d.id === deviceId)
  if (!device) return []
  
  return connections.filter(conn => {
    if (conn.status !== 'active') return false
    
    // Устройство является источником соединения
    if (conn.sourceDeviceId === deviceId) {
      const targetDevice = devices.find(d => d.id === conn.targetDeviceId)
      if (!targetDevice) return false
      
      // Downstream - это соединения к устройствам "ниже" по иерархии
      return isDownstreamDevice(device, targetDevice)
    }
    
    return false
  })
}

/**
 * Получить все upstream подключения устройства
 * Upstream - это соединения, где устройство является целью и источник выше по иерархии
 */
function getUpstreamConnections(
  deviceId: string,
  connections: Connection[],
  devices: NetworkDevice[]
): Connection[] {
  const device = devices.find(d => d.id === deviceId)
  if (!device) return []
  
  const deviceLevel = getDeviceHierarchyLevel(device.type)
  
  return connections.filter(conn => {
    if (conn.status !== 'active') return false
    
    // Устройство является целью соединения (conn.source -> conn.target это "вниз")
    if (conn.targetDeviceId === deviceId) {
      const sourceDevice = devices.find(d => d.id === conn.sourceDeviceId)
      if (!sourceDevice) return false
      
      const sourceLevel = getDeviceHierarchyLevel(sourceDevice.type)
      
      // Upstream - это соединения от устройств "выше" по иерархии
      // Источник должен быть выше текущего устройства (меньший уровень)
      return sourceLevel < deviceLevel && sourceDevice.id !== device.id
    }
    
    return false
  })
}

/**
 * Получить уровень устройства в иерархии
 */
function getDeviceHierarchyLevel(deviceType: string): number {
  const hierarchy: Record<string, number> = {
    'OLT': 0,
    'SPLITTER': 1,
    'ONU': 2,
    'ONT': 2,
    'ROUTER': 3,
    'PC': 4,
    'SERVER': 4,
  }
  return hierarchy[deviceType] ?? 999
}

/**
 * Проверяет, является ли targetDevice "ниже" sourceDevice в иерархии
 */
function isDownstreamDevice(sourceDevice: NetworkDevice, targetDevice: NetworkDevice): boolean {
  const hierarchy: Record<string, number> = {
    'OLT': 0,
    'SPLITTER': 1,
    'ONU': 2,
    'ONT': 2,
    'ROUTER': 3,
    'PC': 4,
    'SERVER': 4,
  }
  
  const sourceLevel = hierarchy[sourceDevice.type] ?? 999
  const targetLevel = hierarchy[targetDevice.type] ?? 999
  
  return targetLevel > sourceLevel
}

/**
 * Нормализует путь, убирая дубликаты и пустые значения
 */
export function normalizePath(path: string[]): string[] {
  const normalized: string[] = []
  let last: string | undefined
  
  for (const id of path) {
    if (id && id !== last) {
      normalized.push(id)
      last = id
    }
  }
  
  return normalized
}

/**
 * Создать копию пакета с обновленными полями
 */
function createPacketCopy(
  packet: Packet,
  updates: Partial<Packet>
): Packet {
  // Если updates.path задан - используем его, иначе старый path
  const newPath = updates.path ? normalizePath(updates.path) : normalizePath(packet.path)
  
  return {
    ...packet,
    ...updates,
    path: newPath,
    currentPosition: updates.currentPosition !== undefined ? updates.currentPosition : packet.currentPosition,
  }
}

/**
 * Находит все конечные устройства (PC, SERVER) в сети
 */
function findEndDevices(
  oltId: string,
  devices: NetworkDevice[],
  connections: Connection[]
): NetworkDevice[] {
  const nodes = buildNodeGraph(devices, connections)
  const endDevices: NetworkDevice[] = []
  
  devices.forEach(device => {
    if (device.type === 'PC' || device.type === 'SERVER') {
      // Проверяем, есть ли путь от OLT к этому устройству
      const path = findPath(nodes, oltId, device.id)
      if (path && path.length > 0) {
        endDevices.push(device)
      }
    }
  })
  
  return endDevices
}

/**
 * Обработка пакетов для главного OLT (OLT #1)
 */
export function processMainOLT(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[],
  tick: number,
  simulationState?: SimulationState
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  const flowDirection = simulationState?.flowDirection
  
  // Генерация downstream теперь делается через scheduler в useSimulationLoop
  // OLT только обрабатывает входящие пакеты
  
  // Обработка входящих пакетов (UPSTREAM) - только если идет обратный процесс
  if (flowDirection === 'UPSTREAM') {
    incomingPackets.forEach(packet => {
      if (packet.direction === 'UPSTREAM') {
        // OLT1 принимает все пакеты снизу без фильтрации
        // Пакет не передается дальше (выше "интернет", анимацию не рисуем)
      }
    })
  }
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Обработка пакетов для промежуточного OLT (номер > 1)
 */
export function processIntermediateOLT(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[]
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  
  // Получаем список известных ONT/ONU ID
  const knownOntIds = device.config.gponConfig?.knownOntIds || []
  
  // Получаем upstream и downstream подключения
  const upstreamConns = getUpstreamConnections(device.id, connections, devices)
  const downstreamConns = getDownstreamConnections(device.id, connections, devices)
  
  incomingPackets.forEach(packet => {
    // Пакет приходит сверху (DOWNSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'DOWNSTREAM' && packet.current === device.id) {
      // Передаем вниз все пакеты без фильтрации
      downstreamConns.forEach(conn => {
        const targetDevice = devices.find(d => d.id === conn.targetDeviceId)
        if (!targetDevice) return
        
        // Добавляем текущее устройство в path, если его там еще нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const forwardedPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        outgoingPackets.push(forwardedPacket)
      })
    }
    
    // Пакет приходит снизу (UPSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'UPSTREAM' && packet.current === device.id) {
      // Проверяем ID устройства
      const packetOntId = packet.data.gponFrame?.onuId
      const sourceOntId = packet.targetOntId
      
      // Проверяем, есть ли ID в knownOntIds
      const isValidId = packetOntId !== undefined && knownOntIds.includes(packetOntId) ||
                        sourceOntId !== undefined && sourceOntId !== null && 
                        typeof sourceOntId === 'number' && knownOntIds.includes(sourceOntId)
      
      if (isValidId && upstreamConns.length > 0) {
        // Пакет корректный, передаем вверх
        const upstreamConn = upstreamConns[0] // Один upstream порт
        const targetDevice = devices.find(d => d.id === upstreamConn.sourceDeviceId)
        if (!targetDevice) return
        
        // Добавляем текущее устройство в path, если его там еще нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const forwardedPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        outgoingPackets.push(forwardedPacket)
      } else {
        // Пакет с неправильным ID - отбрасываем или помечаем как атаку
        // В модели просто отбрасываем
      }
    }
  })
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Обработка пакетов для Splitter
 */
export function processSplitter(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[],
  activeAttacks?: Record<AttackType, ActiveAttack>
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  
  const upstreamConns = getUpstreamConnections(device.id, connections, devices)
  const downstreamConns = getDownstreamConnections(device.id, connections, devices)
  
  // Проверяем, является ли это устройство узлом перегруза для DDoS
  const isCongestionNode = activeAttacks?.DDOS?.isActive && 
                           activeAttacks.DDOS.congestionNodeId === device.id
  
  incomingPackets.forEach(packet => {
    // Пакет приходит сверху (DOWNSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'DOWNSTREAM' && packet.current === device.id) {
      // Если это узел перегруза и пакет не является ATTACK пакетом - дропаем downstream
      if (isCongestionNode && packet.payloadType !== 'ATTACK') {
        // Не форвардим пакет дальше - он дропается на этом узле
        return
      }
      // Широковещательно размножаем на все downstream порты (асинхронно)
      downstreamConns.forEach((conn, index) => {
        const targetDevice = devices.find(d => d.id === conn.targetDeviceId)
        if (!targetDevice) return
        
        // Асинхронность: добавляем небольшую случайную задержку
        const asyncDelay = Math.random() * 100 // 0-100ms
        
        // Сохраняем полный путь, добавляя текущее устройство если его нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const broadcastPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        // В реальной модели задержка будет учтена через tick-систему
        outgoingPackets.push(broadcastPacket)
      })
    }
    
    // Пакет приходит снизу (UPSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'UPSTREAM' && packet.current === device.id) {
      // Передаем только на один upstream порт
      if (upstreamConns.length > 0) {
        const upstreamConn = upstreamConns[0]
        const targetDevice = devices.find(d => d.id === upstreamConn.sourceDeviceId)
        if (!targetDevice) return
        
        // Добавляем текущее устройство в path, если его там еще нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const forwardedPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        outgoingPackets.push(forwardedPacket)
      }
    }
  })
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Обработка пакетов для ONU/ONT
 */
export function processONUONT(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[],
  simulationState?: SimulationState
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  
  const ontId = device.config.gponConfig?.onuId
  const upstreamConns = getUpstreamConnections(device.id, connections, devices)
  const downstreamConns = getDownstreamConnections(device.id, connections, devices)
  
  incomingPackets.forEach(packet => {
    // Пакет приходит сверху (DOWNSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'DOWNSTREAM' && packet.current === device.id) {
      // Проверяем, к кому адресован пакет
      const isBroadcast = packet.targetOntId === null || packet.targetOntId === undefined
      const isForThisOnt = ontId !== undefined && ontId !== null && (
        packet.targetOntId === String(ontId) || 
        packet.data.gponFrame?.onuId === ontId
      )
      
      if (isBroadcast || isForThisOnt) {
        // Принимаем пакет и передаем вниз
        downstreamConns.forEach(conn => {
          const targetDevice = devices.find(d => d.id === conn.targetDeviceId)
          if (!targetDevice) return
          
          // Сохраняем полный путь, добавляя текущее устройство если его нет
          const newPath = packet.path.includes(device.id) 
            ? packet.path 
            : [...packet.path, device.id]
          
          const forwardedPacket = createPacketCopy(packet, {
            current: device.id,
            destination: targetDevice.id,
            path: newPath,
          })
          
          outgoingPackets.push(forwardedPacket)
        })
        
        // УБРАНО: ONT/ONU НЕ должны генерировать upstream ответ при получении downstream
        // Upstream должен генерироваться только от PC/SERVER через Router
      }
      // Если пакет не для этого ONT, игнорируем
    }
    
    // Пакет приходит снизу (UPSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'UPSTREAM' && packet.current === device.id) {
      // Добавляем/проставляем свой ontId
      // Сохраняем полный путь, добавляя текущее устройство если его нет
      const newPath = packet.path.includes(device.id) 
        ? packet.path 
        : [...packet.path, device.id]
      
      const updatedPacket = createPacketCopy(packet, {
        current: device.id,
        targetOntId: ontId !== undefined && ontId !== null ? String(ontId) : packet.targetOntId,
        path: newPath,
      })
      
      // Обновляем GPON frame с ontId
      if (updatedPacket.data.gponFrame) {
        updatedPacket.data.gponFrame.onuId = ontId
      }
      
      // Передаем вверх
      if (upstreamConns.length > 0) {
        const upstreamConn = upstreamConns[0]
        const targetDevice = devices.find(d => d.id === upstreamConn.sourceDeviceId)
        if (!targetDevice) return
        
        updatedPacket.destination = targetDevice.id
        outgoingPackets.push(updatedPacket)
      }
    }
  })
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Обработка пакетов для Router
 */
export function processRouter(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[]
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  
  const upstreamConns = getUpstreamConnections(device.id, connections, devices)
  const downstreamConns = getDownstreamConnections(device.id, connections, devices)
  
  incomingPackets.forEach(packet => {
    // Пакет приходит сверху (DOWNSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'DOWNSTREAM' && packet.current === device.id) {
      // Разослать всем подключенным PC/устройствам (как сплиттер)
      downstreamConns.forEach(conn => {
        const targetDevice = devices.find(d => d.id === conn.targetDeviceId)
        if (!targetDevice) return
        
        // Добавляем текущее устройство в path, если его там еще нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const forwardedPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        outgoingPackets.push(forwardedPacket)
      })
    }
    
    // Пакет приходит снизу (UPSTREAM) - проверяем, что пакет сейчас на этом устройстве
    if (packet.direction === 'UPSTREAM' && packet.current === device.id) {
      // Передаем вверх на единственный upstream порт
      if (upstreamConns.length > 0) {
        const upstreamConn = upstreamConns[0]
        const targetDevice = devices.find(d => d.id === upstreamConn.sourceDeviceId)
        if (!targetDevice) return
        
        // Добавляем текущее устройство в path, если его там еще нет
        const newPath = packet.path.includes(device.id) 
          ? packet.path 
          : [...packet.path, device.id]
        
        const forwardedPacket = createPacketCopy(packet, {
          current: device.id,
          destination: targetDevice.id,
          path: newPath,
        })
        
        outgoingPackets.push(forwardedPacket)
      }
    }
  })
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Обработка пакетов для PC
 */
export function processPC(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[],
  simulationState?: SimulationState
): PacketProcessingResult {
  const outgoingPackets: Packet[] = []
  
  const upstreamConns = getUpstreamConnections(device.id, connections, devices)
  const flowDirection = simulationState?.flowDirection
  
  // Обработка входящих пакетов (DOWNSTREAM)
  incomingPackets.forEach(packet => {
    if (packet.direction === 'DOWNSTREAM') {
      // Пакет принят - отмечаем как доставленный
      // В модели можно просто логировать
    }
  })
  
  // Генерация upstream теперь делается через scheduler в useSimulationLoop
  // PC/SERVER только обрабатывают входящие пакеты (если есть)
  
  return {
    outgoingPackets,
    dropped: false,
  }
}

/**
 * Главная функция обработки пакетов для устройства
 */
export function processDevicePackets(
  device: NetworkDevice,
  incomingPackets: Packet[],
  connections: Connection[],
  devices: NetworkDevice[],
  tick: number,
  simulationState?: SimulationState,
  activeAttacks?: Record<AttackType, ActiveAttack>
): PacketProcessingResult {
  // Определяем, является ли это главным OLT (номер 1)
  const isMainOLT = device.type === 'OLT' && 
                    (device.config.gponConfig?.oltNumber === 1 || 
                     !device.config.gponConfig?.oltNumber)
  
  // Определяем, является ли это промежуточным OLT (номер > 1)
  const isIntermediateOLT = device.type === 'OLT' && 
                             device.config.gponConfig?.oltNumber !== undefined &&
                             device.config.gponConfig.oltNumber > 1
  
  if (isMainOLT) {
    return processMainOLT(device, incomingPackets, connections, devices, tick, simulationState)
  } else if (isIntermediateOLT) {
    return processIntermediateOLT(device, incomingPackets, connections, devices)
  } else if (device.type === 'SPLITTER') {
    return processSplitter(device, incomingPackets, connections, devices, activeAttacks)
  } else if (device.type === 'ONU' || device.type === 'ONT') {
    return processONUONT(device, incomingPackets, connections, devices, simulationState)
  } else if (device.type === 'ROUTER') {
    return processRouter(device, incomingPackets, connections, devices)
  } else if (device.type === 'PC' || device.type === 'SERVER') {
    return processPC(device, incomingPackets, connections, devices, simulationState)
  }
  
  // Для неизвестных типов устройств просто пропускаем пакеты
  return {
    outgoingPackets: [],
    dropped: false,
  }
}

