import { NetworkDevice, Connection } from '@/types/network'

/**
 * Определяет уровень устройства по его типу и порядку появления
 * @param device - устройство
 * @param isFirstOLT - является ли это первым OLT
 * @returns уровень устройства (0-5)
 */
function getDeviceLevel(device: NetworkDevice, isFirstOLT: boolean): number {
  if (device.type === 'OLT') {
    return isFirstOLT ? 0 : 1
  } else if (device.type === 'SPLITTER') {
    return 2
  } else if (device.type === 'ONU' || device.type === 'ONT') {
    return 3
  } else if (device.type === 'ROUTER') {
    return 4
  } else if (device.type === 'PC' || device.type === 'SERVER') {
    return 5
  }
  return 999 // Неизвестный тип
}

/**
 * Проверяет, может ли устройство подключать к себе другое устройство
 * @param parentDevice - родительское устройство
 * @param childDevice - дочернее устройство
 * @param parentLevel - уровень родительского устройства
 * @param childLevel - уровень дочернего устройства
 * @returns true, если подключение разрешено
 */
function canConnect(parentDevice: NetworkDevice, childDevice: NetworkDevice, parentLevel: number, childLevel: number): boolean {
  // OLT (уровень 0 или 1) может подключать: OLT, Splitter, ONU, ONT
  if (parentDevice.type === 'OLT') {
    return childDevice.type === 'OLT' || 
           childDevice.type === 'SPLITTER' || 
           childDevice.type === 'ONU' || 
           childDevice.type === 'ONT'
  }
  
  // Splitter (уровень 2) может подключать: ONU, ONT, OLT
  if (parentDevice.type === 'SPLITTER') {
    return childDevice.type === 'ONU' || 
           childDevice.type === 'ONT' || 
           childDevice.type === 'OLT'
  }
  
  // ONU/ONT (уровень 3) может подключать: Router
  if (parentDevice.type === 'ONU' || parentDevice.type === 'ONT') {
    return childDevice.type === 'ROUTER'
  }
  
  // Router (уровень 4) может подключать: PC, Server
  if (parentDevice.type === 'ROUTER') {
    return childDevice.type === 'PC' || childDevice.type === 'SERVER'
  }
  
  return false
}

/**
 * Строит дерево соединений на основе уровней устройств
 * @param devices - массив устройств
 * @param connections - массив соединений
 * @returns объект с новой структурой:
 * - Первый OLT (уровень 0): {olt1: [children]}
 * - Остальные устройства: {deviceId: {parent: "parentId", дочери: [children]}}
 */
export function buildConnectionTree(
  devices: NetworkDevice[],
  connections: Connection[]
): any {
  // Находим все OLT устройства
  const oltDevices = devices.filter(d => d.type === 'OLT')
  if (oltDevices.length === 0) return {}
  
  // Первый OLT - первый в массиве (первый появившийся)
  const firstOLT = oltDevices[0]
  const firstOLTId = firstOLT.id
  
  const tree: any = {}
  const deviceMap = new Map<string, NetworkDevice>()
  const deviceLevels = new Map<string, number>()
  const visited = new Set<string>()
  
  // Создаем карту устройств и определяем уровни
  devices.forEach(device => {
    deviceMap.set(device.id, device)
    const isFirstOLT = device.id === firstOLTId
    deviceLevels.set(device.id, getDeviceLevel(device, isFirstOLT))
  })
  
  // Строим дерево от первого OLT используя BFS
  const queue: Array<{ deviceId: string; parentId: string | null }> = [
    { deviceId: firstOLTId, parentId: null }
  ]
  
  while (queue.length > 0) {
    const { deviceId, parentId } = queue.shift()!
    
    // Пропускаем, если устройство уже было обработано
    if (visited.has(deviceId)) continue
    
    // Помечаем устройство как посещенное
    visited.add(deviceId)
    
    const device = deviceMap.get(deviceId)
    if (!device) continue
    
    const deviceLevel = deviceLevels.get(deviceId) || 999
    
    // Находим все соединения с этим устройством
    const connectedDevices: Array<{ id: string; device: NetworkDevice; level: number }> = []
    
    connections.forEach(connection => {
      const { sourceDeviceId, targetDeviceId, status } = connection
      
      // Пропускаем неактивные соединения
      if (status !== 'active') return
      
      let connectedId: string | null = null
      let connectedDevice: NetworkDevice | undefined
      
      // Определяем связанное устройство
      if (sourceDeviceId === deviceId) {
        connectedId = targetDeviceId
        connectedDevice = deviceMap.get(targetDeviceId)
      } else if (targetDeviceId === deviceId) {
        connectedId = sourceDeviceId
        connectedDevice = deviceMap.get(sourceDeviceId)
      }
      
      // Если нашли связанное устройство
      if (connectedId && connectedDevice && !visited.has(connectedId)) {
        const connectedLevel = deviceLevels.get(connectedId) || 999
        
        // Проверяем правила подключения
        // Разрешаем подключение, если оно соответствует правилам canConnect
        // и устройство еще не было посещено
        if (canConnect(device, connectedDevice, deviceLevel, connectedLevel)) {
          connectedDevices.push({ id: connectedId, device: connectedDevice, level: connectedLevel })
        }
      }
    })
    
    // Сортируем по уровню (сначала более низкие уровни), затем по Y-координате
    connectedDevices.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level
      }
      // Если уровни одинаковые, сортируем по Y-координате
      const aY = a.device.position.y + 32
      const bY = b.device.position.y + 32
      return aY - bY
    })
    
    // Собираем дочерние элементы
    const children: string[] = []
    connectedDevices.forEach(({ id }) => {
      // Дополнительная проверка на случай, если устройство было добавлено в visited между проверками
      if (!visited.has(id)) {
        children.push(id)
        // Добавляем в очередь для дальнейшей обработки
        queue.push({ deviceId: id, parentId: deviceId })
      }
    })
    
    // Сохраняем структуру дерева
    if (deviceId === firstOLTId) {
      // Первый OLT (уровень 0) - простой массив дочерних элементов
      tree[deviceId] = children
    } else {
      // Остальные устройства - объект с родителем и дочерними элементами
      tree[deviceId] = {
        родитель: parentId,
        дочери: children
      }
    }
  }
  
  return tree
}

/**
 * Находит путь от одного устройства к другому используя дерево соединений
 * @param tree - дерево соединений
 * @param fromId - ID исходного устройства
 * @param toId - ID целевого устройства
 * @returns массив ID устройств в пути или пустой массив, если путь не найден
 */
export function findPathInTree(
  tree: Record<string, string[]>,
  fromId: string,
  toId: string
): string[] {
  if (fromId === toId) {
    return [fromId]
  }
  
  const visited = new Set<string>()
  const queue: Array<{ deviceId: string; path: string[] }> = [
    { deviceId: fromId, path: [fromId] }
  ]
  
  while (queue.length > 0) {
    const current = queue.shift()!
    
    if (current.deviceId === toId) {
      return current.path
    }
    
    if (visited.has(current.deviceId)) {
      continue
    }
    
    visited.add(current.deviceId)
    
    const connectedDevices = tree[current.deviceId] || []
    
    for (const deviceId of connectedDevices) {
      if (!visited.has(deviceId)) {
        queue.push({
          deviceId,
          path: [...current.path, deviceId]
        })
      }
    }
  }
  
  return []
}

/**
 * Получает все устройства, достижимые от указанного устройства
 * @param tree - дерево соединений
 * @param deviceId - ID исходного устройства
 * @returns массив ID достижимых устройств
 */
export function getReachableDevices(
  tree: Record<string, string[]>,
  deviceId: string
): string[] {
  const visited = new Set<string>()
  const queue: string[] = [deviceId]
  
  while (queue.length > 0) {
    const current = queue.shift()!
    
    if (visited.has(current)) {
      continue
    }
    
    visited.add(current)
    
    const connectedDevices = tree[current] || []
    
    for (const connectedId of connectedDevices) {
      if (!visited.has(connectedId)) {
        queue.push(connectedId)
      }
    }
  }
  
  // Удаляем исходное устройство из результата
  visited.delete(deviceId)
  
  return Array.from(visited)
}

