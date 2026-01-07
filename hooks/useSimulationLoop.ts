import { useEffect, useRef } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Packet, TimerHandle } from '@/types/network'
import { processDevicePackets, normalizePath } from '@/utils/packetProcessing'
import { initializeKnownOntIds } from '@/utils/simulationEngine'
import { getSegmentDurationMs, getPathTravelMs } from '@/constants/packetAnimation'
import { buildNodeGraph, findPath } from '@/utils/pathfinding'

interface InTransitPacket {
  packet: Packet
  toDeviceId: string
  deliverAt: number
}

/**
 * Хук для запуска цикла симуляции
 * Автоматически обрабатывает пакеты на каждом тике
 */
export function useSimulationLoop() {
  const {
    simulation,
    updateDevice,
    addLog,
    setFlowDirection,
    setDownstreamPacketsCompleted,
    setUpstreamStartTime,
  } = useNetworkStore()

  const tickRef = useRef(0)
  const intervalRef = useRef<TimerHandle | null>(null)
  const packetBuffersRef = useRef<Map<string, Packet[]>>(new Map())
  const upstreamTimerRef = useRef<TimerHandle | null>(null)
  const inTransitRef = useRef<InTransitPacket[]>([])
  const packetRemovalTimersRef = useRef<Map<string, TimerHandle>>(new Map())
  const downstreamSchedulerRef = useRef<TimerHandle | null>(null)
  const upstreamSchedulerRef = useRef<TimerHandle | null>(null)
  const lastDownstreamGenRef = useRef<number>(0)
  const lastUpstreamGenRef = useRef<Map<string, number>>(new Map()) // Для каждого PC/SERVER отдельно

  // Инициализация knownOntIds для промежуточных OLT при запуске
  useEffect(() => {
    if (!simulation.isRunning) return
    
    const currentState = useNetworkStore.getState()
    const currentDevices = currentState.devices
    const currentConnections = currentState.connections
    
    if (currentDevices.length > 0) {
      currentDevices
        .filter(d => d.type === 'OLT' && d.config.gponConfig?.oltNumber && d.config.gponConfig.oltNumber > 1)
        .forEach(olt => {
          const knownIds = initializeKnownOntIds(olt, currentDevices, currentConnections)
          if (JSON.stringify(knownIds) !== JSON.stringify(olt.config.gponConfig?.knownOntIds)) {
            updateDevice(olt.id, {
              config: {
                ...olt.config,
                gponConfig: {
                  ...olt.config.gponConfig,
                  knownOntIds: knownIds,
                },
              },
            })
          }
        })
    }
  }, [simulation.isRunning, updateDevice])

  // Основной цикл симуляции
  useEffect(() => {
    if (!simulation.isRunning) {
      // Останавливаем цикл
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Очищаем все таймеры удаления
      packetRemovalTimersRef.current.forEach(timerId => {
        clearTimeout(timerId)
      })
      packetRemovalTimersRef.current.clear()
      inTransitRef.current = []
      return
    }

    // Запускаем цикл симуляции
    const tickInterval = Math.max(1000 / simulation.speed, 50) // Минимум 50ms между тиками

    intervalRef.current = setInterval(() => {
      const currentTick = tickRef.current
      const now = Date.now()
      
      // Получаем актуальное состояние через getState() (не через зависимости)
      const currentState = useNetworkStore.getState()
      const currentSimulation = currentState.simulation
      const currentDevices = currentState.devices
      const currentConnections = currentState.connections
      
      // Инициализация направления потока при первом тике (до обработки устройств)
      if (currentTick === 0 && currentSimulation.flowDirection === null) {
        setFlowDirection('DOWNSTREAM')
      }
      
      // Переключение на UPSTREAM после первого downstream цикла (но не блокируем генерацию)
      // Генерация downstream продолжается независимо через scheduler
      if (currentSimulation.flowDirection === 'DOWNSTREAM' && !currentSimulation.downstreamPacketsCompleted && currentTick > 20) {
        // Переключаемся на UPSTREAM после небольшой задержки
        // Это не блокирует генерацию downstream - она продолжается по scheduler
        setDownstreamPacketsCompleted(true)
        
        if (upstreamTimerRef.current) {
          clearTimeout(upstreamTimerRef.current)
        }
        
        upstreamTimerRef.current = setTimeout(() => {
          setUpstreamStartTime(Date.now())
          setFlowDirection('UPSTREAM')
          addLog({
            level: 'info',
            message: '🔄 Начало обратного процесса (UPSTREAM)',
          })
        }, 2000) // 2 секунды задержки
      }
      
      // Периодически переключаемся обратно на DOWNSTREAM для непрерывного потока
      if (currentSimulation.flowDirection === 'UPSTREAM' && 
          currentSimulation.upstreamStartTime && 
          Date.now() - currentSimulation.upstreamStartTime > 15000) {
        // Через 15 секунд UPSTREAM переключаемся обратно на DOWNSTREAM
        setFlowDirection('DOWNSTREAM')
        setDownstreamPacketsCompleted(false)
        setUpstreamStartTime(undefined)
        addLog({
          level: 'info',
          message: '🔄 Возврат к DOWNSTREAM для непрерывного потока',
        })
      }

      // Доставка in-transit пакетов (до Step 1)
      const delivered: InTransitPacket[] = []
      inTransitRef.current.forEach(inTransit => {
        if (inTransit.deliverAt <= now) {
          const buffer = packetBuffersRef.current.get(inTransit.toDeviceId) || []
          buffer.push(inTransit.packet)
          packetBuffersRef.current.set(inTransit.toDeviceId, buffer)
          delivered.push(inTransit)
          
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[PacketDelivery] Packet ${inTransit.packet.id} delivered to ${inTransit.toDeviceId}`)
          }
        }
      })
      // Убираем доставленные из in-transit
      inTransitRef.current = inTransitRef.current.filter(item => !delivered.includes(item))

      // Шаг 1: Для всех устройств формируем список входящих пакетов
      const deviceIncomingPackets = new Map<string, Packet[]>()
      
      currentDevices.forEach(device => {
        const buffer = packetBuffersRef.current.get(device.id) || []
        // Обновляем только current, НЕ трогаем currentPosition (для плавности анимации)
        const updatedBuffer = buffer.map(packet => {
          // Небольшой clamp только если очень близко к индексу устройства
          if (packet.path && packet.path.length > 0) {
            const deviceIndex = packet.path.indexOf(device.id)
            if (deviceIndex >= 0) {
              const diff = Math.abs(packet.currentPosition - deviceIndex)
              if (diff < 0.05) {
                return {
                  ...packet,
                  current: device.id,
                  currentPosition: deviceIndex,
                }
              }
            }
          }
          return {
            ...packet,
            current: device.id,
          }
        })
        deviceIncomingPackets.set(device.id, updatedBuffer)
        // Очищаем буфер после чтения
        packetBuffersRef.current.set(device.id, [])
      })

      // Шаг 2: Для каждого устройства применяем локальный алгоритм обработки
      currentDevices.forEach(device => {
        const incomingPackets = deviceIncomingPackets.get(device.id) || []
        
        // Пропускаем устройства без входящих пакетов (кроме OLT и PC/SERVER в UPSTREAM фазе)
        // PC/SERVER должны обрабатываться в UPSTREAM фазе даже если incomingPackets пустые
        const shouldProcess = 
          device.type === 'OLT' || 
          incomingPackets.length > 0 ||
          (currentSimulation.flowDirection === 'UPSTREAM' && (device.type === 'PC' || device.type === 'SERVER'))
        
        if (!shouldProcess) {
          return
        }

        try {
          // Получаем activeAttacks для проверки congestion
          const activeAttacks = currentState.activeAttacks
          
          // Проверяем, является ли это устройство узлом перегруза для DDoS
          const isCongestionNode = activeAttacks?.DDOS?.isActive && 
                                   activeAttacks.DDOS.congestionNodeId === device.id
          
          // Используем актуальное состояние simulation для передачи в processDevicePackets
          const result = processDevicePackets(
            device,
            incomingPackets,
            currentConnections,
            currentDevices,
            currentTick,
            currentSimulation,
            activeAttacks
          )

          // Шаг 3: Результат - набор исходящих пакетов на следующие устройства
          result.outgoingPackets.forEach(packet => {
            // Определяем следующее устройство по пути
            const nextDeviceId = packet.destination

            if (nextDeviceId && packet.path && packet.path.length > 0) {
              // Находим индекс текущего устройства в path
              const currentDeviceIndex = packet.path.indexOf(device.id)
              
              // Устанавливаем currentPosition на индекс текущего устройства
              // Пакет будет двигаться от текущего устройства к следующему
              if (currentDeviceIndex >= 0) {
                packet.currentPosition = currentDeviceIndex
              } else {
                // Если устройство не найдено в path, добавляем его в начало
                packet.path = [device.id, ...packet.path]
                packet.currentPosition = 0
              }

              // Добавляем пакет в store для визуализации (upsert по id)
              currentState.upsertPacket(packet)

              // Вычисляем время доставки на следующий сегмент
              const segmentDurationMs = getSegmentDurationMs(currentSimulation.speed)
              
              // Ставим пакет в in-transit (доставится через segmentDurationMs)
              inTransitRef.current.push({
                packet,
                toDeviceId: nextDeviceId,
                deliverAt: now + segmentDurationMs,
              })
              
              if (process.env.NODE_ENV === 'development') {
                console.debug(`[InTransit] Packet ${packet.id} in transit to ${nextDeviceId}, deliverAt: ${now + segmentDurationMs}`)
              }

              // Устанавливаем TTL для удаления пакета (только если еще не установлен)
              if (!packetRemovalTimersRef.current.has(packet.id)) {
                const ttlMs = getPathTravelMs(packet.path.length, currentSimulation.speed, 800)
                const timerId = setTimeout(() => {
                  currentState.removePacket(packet.id)
                  packetRemovalTimersRef.current.delete(packet.id)
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(`[PacketTTL] Packet ${packet.id} removed after TTL`)
                  }
                }, ttlMs)
                
                packetRemovalTimersRef.current.set(packet.id, timerId)
              }
            }
          })

          // Логирование отброшенных пакетов
          if (result.dropped && result.reason) {
            addLog({
              level: 'warning',
              deviceId: device.id,
              message: `[${device.name}] Пакет отброшен: ${result.reason}`,
            })
          }
          
          // Логирование дропа downstream пакетов при DDoS congestion
          if (isCongestionNode && incomingPackets.some(p => p.direction === 'DOWNSTREAM' && p.payloadType !== 'ATTACK')) {
            const droppedCount = incomingPackets.filter(p => p.direction === 'DOWNSTREAM' && p.payloadType !== 'ATTACK').length
            if (droppedCount > 0) {
              addLog({
                level: 'warning',
                deviceId: device.id,
                message: `[NET][CONGESTION] downstream dropped at ${device.name} due to DDOS (${droppedCount} packets)`,
              })
            }
          }
        } catch (error) {
          console.error(`Ошибка обработки пакетов для устройства ${device.id}:`, error)
          addLog({
            level: 'error',
            deviceId: device.id,
            message: `Ошибка обработки пакетов: ${error}`,
          })
        }
      })

      tickRef.current++
      
      // Диагностический лог каждые 5 секунд (примерно каждые 100 тиков при speed=20)
      if (currentTick % 500 === 0 && process.env.NODE_ENV === 'development') {
        const basePackets = currentSimulation.packets.filter(p => p.payloadType !== 'ATTACK')
        const attackPackets = currentSimulation.packets.filter(p => p.payloadType === 'ATTACK')
        console.debug(`[SimulationLoop] Tick: ${currentTick}, Base packets: ${basePackets.length}, Attack packets: ${attackPackets.length}, In-transit: ${inTransitRef.current.length}, Timers: ${packetRemovalTimersRef.current.size}`)
      }
    }, tickInterval)

    return () => {
      // Cleanup только очищает интервал при пересоздании (например, при изменении speed)
      // НЕ очищаем inTransitRef и packetRemovalTimersRef здесь - они очищаются только при остановке
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (upstreamTimerRef.current) {
        clearTimeout(upstreamTimerRef.current)
        upstreamTimerRef.current = null
      }
    }
  }, [simulation.isRunning, simulation.speed, addLog, setFlowDirection, setDownstreamPacketsCompleted, setUpstreamStartTime])

  // Scheduler для генерации downstream пакетов (независимо от завершения предыдущих)
  useEffect(() => {
    if (!simulation.isRunning) {
      if (downstreamSchedulerRef.current) {
        clearInterval(downstreamSchedulerRef.current)
        downstreamSchedulerRef.current = null
      }
      lastDownstreamGenRef.current = 0
      return
    }

    // Генерируем downstream каждые 1500-2000ms
    const generateDownstream = () => {
      const currentState = useNetworkStore.getState()
      const currentSimulation = currentState.simulation
      const currentDevices = currentState.devices
      const currentConnections = currentState.connections

      // Генерируем только если направление DOWNSTREAM или null
      if (currentSimulation.flowDirection === 'UPSTREAM') {
        return
      }

      const mainOLT = currentDevices.find(d => 
        d.type === 'OLT' && 
        (d.config.gponConfig?.oltNumber === 1 || !d.config.gponConfig?.oltNumber)
      )
      if (!mainOLT) return

      const nodes = buildNodeGraph(currentDevices, currentConnections)
      const endDevices = currentDevices.filter(d => 
        (d.type === 'PC' || d.type === 'SERVER')
        // Убираем фильтр isAttackDevice чтобы AttackerPC получал обычный трафик
      )

      endDevices.forEach(endDevice => {
        const path = findPath(nodes, mainOLT.id, endDevice.id)
        if (path && path.length > 0) {
          const pathIds = normalizePath(path.map(node => node.id))
          const nextDeviceId = pathIds.length > 1 ? pathIds[1] : pathIds[pathIds.length - 1]
          
          const broadcastPacket: Packet = {
            id: `packet-downstream-${Date.now()}-${Math.random()}-${endDevice.id}`,
            type: 'gpon' as const,
            source: mainOLT.id,
            destination: nextDeviceId,
            current: mainOLT.id,
            direction: 'DOWNSTREAM' as const,
            targetOntId: null,
            payloadType: 'BROADCAST' as const,
            data: {
              sourceIp: mainOLT.ipAddress || '10.0.0.1',
              destIp: endDevice.ipAddress || '255.255.255.255',
              protocol: 'GPON',
              direction: 'downstream',
              packetColor: 'blue',
              gponFrame: {
                onuId: undefined,
                allocId: 0,
                gemPort: 0,
              },
            },
            path: pathIds,
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          currentState.upsertPacket(broadcastPacket)
          
          // Устанавливаем TTL
          if (!packetRemovalTimersRef.current.has(broadcastPacket.id)) {
            const ttlMs = getPathTravelMs(broadcastPacket.path.length, currentSimulation.speed, 1600)
            const timerId = setTimeout(() => {
              currentState.removePacket(broadcastPacket.id)
              packetRemovalTimersRef.current.delete(broadcastPacket.id)
            }, ttlMs)
            packetRemovalTimersRef.current.set(broadcastPacket.id, timerId)
          }
        }
      })
    }

    // Первая генерация сразу
    generateDownstream()
    lastDownstreamGenRef.current = Date.now()

    // Затем каждые 4500-6000ms (увеличено в 3 раза: было 1500-2000ms)
    downstreamSchedulerRef.current = setInterval(() => {
      generateDownstream()
      lastDownstreamGenRef.current = Date.now()
    }, 4500 + Math.random() * 1500)

    return () => {
      if (downstreamSchedulerRef.current) {
        clearInterval(downstreamSchedulerRef.current)
        downstreamSchedulerRef.current = null
      }
    }
  }, [simulation.isRunning, simulation.speed])

  // Scheduler для генерации upstream пакетов от всех PC/SERVER
  useEffect(() => {
    if (!simulation.isRunning) {
      if (upstreamSchedulerRef.current) {
        clearInterval(upstreamSchedulerRef.current)
        upstreamSchedulerRef.current = null
      }
      lastUpstreamGenRef.current.clear()
      return
    }

    const generateUpstream = () => {
      const currentState = useNetworkStore.getState()
      const currentSimulation = currentState.simulation
      const currentDevices = currentState.devices
      const currentConnections = currentState.connections

      // Генерируем только если направление UPSTREAM
      if (currentSimulation.flowDirection !== 'UPSTREAM') {
        return
      }

      const mainOLT = currentDevices.find(d => 
        d.type === 'OLT' && 
        (d.config.gponConfig?.oltNumber === 1 || !d.config.gponConfig?.oltNumber)
      )
      if (!mainOLT) return

      const nodes = buildNodeGraph(currentDevices, currentConnections)
      const pcServers = currentDevices.filter(d => 
        (d.type === 'PC' || d.type === 'SERVER')
        // Убираем фильтр isAttackDevice чтобы AttackerPC генерировал обычный трафик
      )

      pcServers.forEach(device => {
        // Проверяем, не генерировали ли мы недавно для этого устройства (jitter)
        const lastGen = lastUpstreamGenRef.current.get(device.id) || 0
        const now = Date.now()
        if (now - lastGen < 4500) return // Минимум 4.5 секунды между пакетами (увеличено в 3 раза: было 1.5 секунды)

        const path = findPath(nodes, device.id, mainOLT.id)
        if (path && path.length > 0) {
          const pathIds = normalizePath(path.map(node => node.id))
          const nextDeviceId = pathIds.length > 1 ? pathIds[1] : pathIds[pathIds.length - 1]
          
          const responsePacket: Packet = {
            id: `packet-upstream-${Date.now()}-${Math.random()}-${device.id}`,
            type: 'ip' as const,
            source: device.id,
            destination: nextDeviceId,
            current: device.id,
            direction: 'UPSTREAM' as const,
            targetOntId: null,
            payloadType: 'RESPONSE' as const,
            data: {
              sourceIp: device.ipAddress || '192.168.1.100',
              destIp: mainOLT.ipAddress || '10.0.0.1',
              protocol: 'TCP',
              direction: 'upstream',
              packetColor: 'blue',
            },
            path: pathIds,
            currentPosition: 0,
            timestamp: Date.now(),
          }
          
          currentState.upsertPacket(responsePacket)
          lastUpstreamGenRef.current.set(device.id, now)
          
          // Устанавливаем TTL
          if (!packetRemovalTimersRef.current.has(responsePacket.id)) {
            const ttlMs = getPathTravelMs(responsePacket.path.length, currentSimulation.speed, 800)
            const timerId = setTimeout(() => {
              currentState.removePacket(responsePacket.id)
              packetRemovalTimersRef.current.delete(responsePacket.id)
            }, ttlMs)
            packetRemovalTimersRef.current.set(responsePacket.id, timerId)
          }
        }
      })
    }

    // Генерируем каждые 5400-7500ms с jitter (увеличено в 3 раза: было 1800-2500ms)
    upstreamSchedulerRef.current = setInterval(() => {
      generateUpstream()
    }, 5400 + Math.random() * 2100)

    return () => {
      if (upstreamSchedulerRef.current) {
        clearInterval(upstreamSchedulerRef.current)
        upstreamSchedulerRef.current = null
      }
    }
  }, [simulation.isRunning, simulation.speed])

  // Сброс при остановке симуляции
  useEffect(() => {
    if (!simulation.isRunning) {
      tickRef.current = 0
      packetBuffersRef.current.clear()
      inTransitRef.current = []
      packetRemovalTimersRef.current.forEach(timerId => {
        clearTimeout(timerId)
      })
      packetRemovalTimersRef.current.clear()
      if (upstreamTimerRef.current) {
        clearTimeout(upstreamTimerRef.current)
        upstreamTimerRef.current = null
      }
      if (downstreamSchedulerRef.current) {
        clearInterval(downstreamSchedulerRef.current)
        downstreamSchedulerRef.current = null
      }
      if (upstreamSchedulerRef.current) {
        clearInterval(upstreamSchedulerRef.current)
        upstreamSchedulerRef.current = null
      }
      lastDownstreamGenRef.current = 0
      lastUpstreamGenRef.current.clear()
    }
  }, [simulation.isRunning])
}
