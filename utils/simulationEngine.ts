import { Packet, NetworkDevice, Connection } from '@/types/network'
import { processDevicePackets } from './packetProcessing'

/**
 * Движок симуляции GPON сети
 * Реализует цикл моделирования на основе тиков
 */

export interface SimulationEngine {
  tick: number
  packetBuffers: Map<string, Packet[]> // Буферы входящих пакетов для каждого устройства
  start: () => void
  stop: () => void
  step: (devices: NetworkDevice[], connections: Connection[]) => void
  reset: () => void
}

/**
 * Создать новый движок симуляции
 */
export function createSimulationEngine(
  onTick: (tick: number, newPackets: Packet[]) => void,
  onLog?: (message: string, level?: 'info' | 'warning' | 'error' | 'critical') => void
): SimulationEngine {
  let currentTick = 0
  let isRunning = false
  let intervalId: NodeJS.Timeout | null = null
  const packetBuffers = new Map<string, Packet[]>()
  
  const step = (devices: NetworkDevice[], connections: Connection[]) => {
    // Шаг 1: Для всех устройств формируем список входящих пакетов
    const deviceIncomingPackets = new Map<string, Packet[]>()
    
    devices.forEach(device => {
      const buffer = packetBuffers.get(device.id) || []
      deviceIncomingPackets.set(device.id, [...buffer])
      // Очищаем буфер после чтения
      packetBuffers.set(device.id, [])
    })
    
    // Шаг 2: Для каждого устройства применяем локальный алгоритм обработки
    const allNewPackets: Packet[] = []
    
    devices.forEach(device => {
      const incomingPackets = deviceIncomingPackets.get(device.id) || []
      
      if (incomingPackets.length === 0 && device.type !== 'OLT') {
        // Пропускаем устройства без входящих пакетов (кроме OLT, который генерирует пакеты)
        return
      }
      
      const result = processDevicePackets(
        device,
        incomingPackets,
        connections,
        devices,
        currentTick
      )
      
      // Шаг 3: Результат - набор исходящих пакетов на следующие устройства
      result.outgoingPackets.forEach(packet => {
        // Определяем следующее устройство по пути
        const nextDeviceId = packet.destination
        
        if (nextDeviceId) {
          // Добавляем пакет в буфер входящих следующего устройства
          const nextBuffer = packetBuffers.get(nextDeviceId) || []
          nextBuffer.push(packet)
          packetBuffers.set(nextDeviceId, nextBuffer)
          
          allNewPackets.push(packet)
        }
      })
      
      // Логирование отброшенных пакетов
      if (result.dropped && result.reason) {
        onLog?.(`[${device.name}] Пакет отброшен: ${result.reason}`, 'warning')
      }
    })
    
    // Уведомляем о новом тике и новых пакетах
    onTick(currentTick, allNewPackets)
    
    currentTick++
  }
  
  const start = () => {
    if (isRunning) return
    
    isRunning = true
    onLog?.('Симуляция запущена', 'info')
    
    // Запускаем цикл симуляции
    // В реальной реализации это может быть requestAnimationFrame или setInterval
    // Для демонстрации используем setInterval
    intervalId = setInterval(() => {
      // Получаем актуальные данные из store (будет передаваться через параметры)
      // Здесь нужно будет интегрироваться с store
    }, 100) // 100ms между тиками (можно настраивать)
  }
  
  const stop = () => {
    if (!isRunning) return
    
    isRunning = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    onLog?.('Симуляция остановлена', 'info')
  }
  
  const reset = () => {
    currentTick = 0
    packetBuffers.clear()
    onLog?.('Симуляция сброшена', 'info')
  }
  
  return {
    get tick() {
      return currentTick
    },
    get packetBuffers() {
      return packetBuffers
    },
    start,
    stop,
    step,
    reset,
  }
}

/**
 * Утилита для определения направления соединения
 */
export function getConnectionDirection(
  connection: Connection,
  fromDevice: NetworkDevice,
  toDevice: NetworkDevice
): 'UPSTREAM' | 'DOWNSTREAM' {
  const hierarchy: Record<string, number> = {
    'OLT': 0,
    'SPLITTER': 1,
    'ONU': 2,
    'ONT': 2,
    'ROUTER': 3,
    'PC': 4,
    'SERVER': 4,
  }
  
  const fromLevel = hierarchy[fromDevice.type] ?? 999
  const toLevel = hierarchy[toDevice.type] ?? 999
  
  return toLevel > fromLevel ? 'DOWNSTREAM' : 'UPSTREAM'
}

/**
 * Инициализация knownOntIds для промежуточных OLT
 * Собирает все ONT/ONU ID из устройств ниже данного OLT
 */
export function initializeKnownOntIds(
  olt: NetworkDevice,
  devices: NetworkDevice[],
  connections: Connection[]
): number[] {
  const knownIds: number[] = []
  const visited = new Set<string>()
  
  // BFS от OLT для поиска всех ONT/ONU ниже
  const queue: string[] = [olt.id]
  visited.add(olt.id)
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentDevice = devices.find(d => d.id === currentId)
    if (!currentDevice) continue
    
    // Если это ONT/ONU, добавляем его ID
    if ((currentDevice.type === 'ONT' || currentDevice.type === 'ONU') && 
        currentDevice.config.gponConfig?.onuId !== undefined) {
      knownIds.push(currentDevice.config.gponConfig.onuId)
    }
    
    // Находим все подключенные устройства ниже
    connections
      .filter(conn => 
        (conn.sourceDeviceId === currentId || conn.targetDeviceId === currentId) &&
        conn.status === 'active'
      )
      .forEach(conn => {
        const nextId = conn.sourceDeviceId === currentId 
          ? conn.targetDeviceId 
          : conn.sourceDeviceId
        
        if (!visited.has(nextId)) {
          const nextDevice = devices.find(d => d.id === nextId)
          if (nextDevice) {
            const currentLevel = getDeviceLevel(currentDevice)
            const nextLevel = getDeviceLevel(nextDevice)
            
            // Добавляем только если следующее устройство ниже по иерархии
            if (nextLevel > currentLevel) {
              visited.add(nextId)
              queue.push(nextId)
            }
          }
        }
      })
  }
  
  return knownIds
}

/**
 * Получить уровень устройства
 */
function getDeviceLevel(device: NetworkDevice): number {
  const hierarchy: Record<string, number> = {
    'OLT': 0,
    'SPLITTER': 1,
    'ONU': 2,
    'ONT': 2,
    'ROUTER': 3,
    'PC': 4,
    'SERVER': 4,
  }
  
  return hierarchy[device.type] ?? 999
}

