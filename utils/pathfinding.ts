import { NetworkDevice, Connection } from '@/types/network'

/**
 * Узел для поиска пути
 */
export interface PathNode {
  id: string
  type: string
  position: { x: number; y: number }
  neighbors: string[]
  device: NetworkDevice
}

/**
 * Строит граф узлов из устройств и соединений
 */
export function buildNodeGraph(
  devices: NetworkDevice[],
  connections: Connection[]
): Map<string, PathNode> {
  const nodes = new Map<string, PathNode>()

  // Создаем узлы для всех устройств
  devices.forEach(device => {
    nodes.set(device.id, {
      id: device.id,
      type: device.type,
      position: device.position,
      neighbors: [],
      device
    })
  })

  // Добавляем соседей на основе соединений
  connections.forEach(connection => {
    if (connection.status === 'active') {
      const sourceNode = nodes.get(connection.sourceDeviceId)
      const targetNode = nodes.get(connection.targetDeviceId)

      if (sourceNode && targetNode) {
        if (!sourceNode.neighbors.includes(targetNode.id)) {
          sourceNode.neighbors.push(targetNode.id)
        }
        if (!targetNode.neighbors.includes(sourceNode.id)) {
          targetNode.neighbors.push(sourceNode.id)
        }
      }
    }
  })

  return nodes
}

/**
 * Находит путь между двумя узлами используя BFS
 */
export function findPath(
  nodes: Map<string, PathNode>,
  fromId: string,
  toId: string
): PathNode[] | null {
  if (fromId === toId) {
    const node = nodes.get(fromId)
    return node ? [node] : null
  }

  const visited = new Set<string>()
  const queue: Array<{ node: PathNode; path: PathNode[] }> = []

  const startNode = nodes.get(fromId)
  if (!startNode) return null

  queue.push({ node: startNode, path: [startNode] })
  visited.add(fromId)

  while (queue.length > 0) {
    const { node, path } = queue.shift()!

    if (node.id === toId) {
      return path
    }

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        const neighbor = nodes.get(neighborId)
        if (neighbor) {
          queue.push({ node: neighbor, path: [...path, neighbor] })
        }
      }
    }
  }

  return null
}

/**
 * Находит ближайший OLT от указанного устройства
 */
export function findNearestOLT(
  nodes: Map<string, PathNode>,
  deviceId: string
): PathNode | null {
  const deviceNode = nodes.get(deviceId)
  if (!deviceNode) return null

  // Ищем все OLT в графе
  const olts: PathNode[] = []
  nodes.forEach(node => {
    if (node.type === 'OLT') {
      olts.push(node)
    }
  })

  if (olts.length === 0) return null

  // Находим ближайший OLT по пути
  for (const olt of olts) {
    const path = findPath(nodes, deviceId, olt.id)
    if (path && path.length > 0) {
      return olt
    }
  }

  return olts[0] // Возвращаем первый OLT, если путь не найден
}

