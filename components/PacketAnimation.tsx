'use client'

import { useEffect, useRef, useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { useReactFlow, Edge } from 'reactflow'
import { getEffectiveSpeed } from '@/constants/packetAnimation'
import type { DeviceNodeData } from './nodes/DeviceNode'

function PacketAnimation() {
  const { simulation } = useNetworkStore()
  const reactFlowInstance = useReactFlow<DeviceNodeData, unknown>()
  const { getEdges } = reactFlowInstance
  const animationFrameRef = useRef<number>()
  const packetElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const positionsRef = useRef<Map<string, number>>(new Map()) // Локальное хранение позиций
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null)
  const lastTsRef = useRef<number>(0)

  useEffect(() => {
    // Используем viewport - элементы будут трансформироваться вместе с графом
    const viewport = document.querySelector('.react-flow__viewport')
    if (viewport) {
      // Убеждаемся, что viewport имеет правильный z-index для слоев
      const viewportEl = viewport as HTMLElement
      if (!viewportEl.style.zIndex) {
        viewportEl.style.position = 'relative'
        viewportEl.style.zIndex = '2' // Выше пакетов (z-index: 1)
      }
      setContainerElement(viewportEl)
    }
  }, [])

  useEffect(() => {
    if (!simulation.isRunning || !containerElement) {
      packetElementsRef.current.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
      packetElementsRef.current.clear()
      positionsRef.current.clear()
      lastTsRef.current = 0
      return
    }

    const updatePackets = (timestamp: number) => {
      try {
        const edges = getEdges()
        // Получаем актуальные пакеты через getState() вместо зависимости от simulation.packets
        const packets = useNetworkStore.getState().simulation.packets
        const currentSpeed = useNetworkStore.getState().simulation.speed

        // Вычисляем deltaTime
        const lastTs = lastTsRef.current || timestamp
        const deltaSec = (timestamp - lastTs) / 1000
        lastTsRef.current = timestamp

        // Обновляем позиции пакетов с учетом deltaTime (локально, без записи в store)
        const effectiveSpeed = getEffectiveSpeed(currentSpeed)
        
        // Инициализируем позиции для новых пакетов
        packets.forEach((packet) => {
          if (!positionsRef.current.has(packet.id)) {
            positionsRef.current.set(packet.id, packet.currentPosition ?? 0)
          }
        })
        
        // Обновляем локальные позиции
        packets.forEach((packet) => {
          if (packet.path && packet.path.length > 0) {
            const maxPosition = packet.path.length - 1
            const currentPos = positionsRef.current.get(packet.id) ?? 0
            const newPosition = Math.min(
              currentPos + effectiveSpeed * deltaSec,
              maxPosition
            )
            positionsRef.current.set(packet.id, newPosition)
          }
        })

        // Создаем карту edges для определения типа соединения
        const edgeMap = new Map<string, Edge<unknown>>()
        edges.forEach((edge) => {
          const key = `${edge.source}-${edge.target}`
          edgeMap.set(key, edge)
          const reverseKey = `${edge.target}-${edge.source}`
          edgeMap.set(reverseKey, { ...edge, source: edge.target, target: edge.source })
        })

        packets.forEach((packet) => {
          let packetElement = packetElementsRef.current.get(packet.id)

          if (!packetElement) {
            packetElement = document.createElement('div')
            packetElement.className = 'packet-animation'
            packetElement.style.position = 'absolute'
            packetElement.style.width = '22px'
            packetElement.style.height = '22px'
            packetElement.style.borderRadius = '50%'
            packetElement.style.border = '2px solid #000'
            packetElement.style.pointerEvents = 'none'
            packetElement.style.zIndex = '1' // Ниже устройств (nodes имеют z-index выше)
            packetElement.style.transition = 'none'

            containerElement.appendChild(packetElement)
            packetElementsRef.current.set(packet.id, packetElement)
          }
          
          // Определяем цвет пакета на основе типа атаки и типа соединения
          const isAttack = packet.payloadType === 'ATTACK'
          
          // Получаем локальную позицию
          const localPosition = positionsRef.current.get(packet.id) ?? 0
          
          // Находим edge для определения типа соединения
          let edgeType: 'optical' | 'ethernet' = 'ethernet'
          if (packet.path && packet.path.length > 0) {
            const currentIndex = Math.floor(localPosition)
            const currentDeviceId = packet.path[Math.min(currentIndex, packet.path.length - 1)]
            const nextDeviceId = currentIndex < packet.path.length - 1 ? packet.path[currentIndex + 1] : null
            
            if (nextDeviceId) {
              const edgeKey = `${currentDeviceId}-${nextDeviceId}`
              const currentEdge = edgeMap.get(edgeKey)
              
              // Определяем тип соединения по цвету stroke (оранжевый = optical, синий = ethernet)
              if (currentEdge) {
                const strokeColor = currentEdge.style?.stroke
                edgeType = strokeColor === '#f59e0b' || strokeColor === '#f97316' ? 'optical' : 'ethernet'
              }
            }
          }
          
          // Выбираем цвет: красный для атаки (всегда), желтый для optical, синий для ethernet
          let fillColor: string
          if (isAttack) {
            fillColor = '#ef4444' // red - всегда для ATTACK
          } else if (edgeType === 'optical') {
            fillColor = '#eab308' // yellow
          } else {
            fillColor = '#3b82f6' // blue
          }
          
          packetElement.style.backgroundColor = fillColor
          // Убрали box-shadow чтобы не было артефактов "звездочек"

          // Вычисляем позицию пакета на основе пути (используем локальную позицию)
          if (packet.path && packet.path.length > 0) {
            const pathLength = packet.path.length
            const currentIndex = Math.floor(localPosition)
            const segmentProgress = localPosition - currentIndex

            // Определяем текущий и следующий сегмент пути
            const currentDeviceId = packet.path[Math.min(currentIndex, pathLength - 1)]
            const nextDeviceId = currentIndex < pathLength - 1 ? packet.path[currentIndex + 1] : null

            // Получаем реальные узлы
            const sourceNode = reactFlowInstance.getNode(currentDeviceId)
            const targetNode = nextDeviceId ? reactFlowInstance.getNode(nextDeviceId) : null
            
            // Анимируем между узлами даже если edge отсутствует
            if (sourceNode && targetNode) {
              // Используем positionAbsolute для корректного позиционирования
              const sourceAbs = sourceNode.positionAbsolute ?? sourceNode.position
              const targetAbs = targetNode.positionAbsolute ?? targetNode.position
              
              // Получаем размеры узлов (используем реальные или дефолтные)
              const sourceWidth = sourceNode.width ?? 120
              const sourceHeight = sourceNode.height ?? 64
              const targetWidth = targetNode.width ?? 120
              const targetHeight = targetNode.height ?? 64

              // Получаем центры узлов в flow координатах (используем positionAbsolute)
              const sourceCenter = {
                x: sourceAbs.x + sourceWidth / 2,
                y: sourceAbs.y + sourceHeight / 2,
              }

              const targetCenter = {
                x: targetAbs.x + targetWidth / 2,
                y: targetAbs.y + targetHeight / 2,
              }

              // Вычисляем позицию вдоль линии от центра к центру в flow-координатах
              const flowX = sourceCenter.x + (targetCenter.x - sourceCenter.x) * segmentProgress
              const flowY = sourceCenter.y + (targetCenter.y - sourceCenter.y) * segmentProgress

              // Смещаем на -11px чтобы центрировать пакет (размер 22px)
              packetElement.style.left = `${flowX - 11}px`
              packetElement.style.top = `${flowY - 11}px`
            } else if (sourceNode && !targetNode) {
              // Пакет достиг цели - используем центр конечного узла (с positionAbsolute)
              const sourceAbs = sourceNode.positionAbsolute ?? sourceNode.position
              const sourceWidth = sourceNode.width ?? 120
              const sourceHeight = sourceNode.height ?? 64
              const sourceCenter = {
                x: sourceAbs.x + sourceWidth / 2,
                y: sourceAbs.y + sourceHeight / 2,
              }
              
              // Смещаем на -11px чтобы центрировать пакет (размер 22px)
              packetElement.style.left = `${sourceCenter.x - 11}px`
              packetElement.style.top = `${sourceCenter.y - 11}px`
            }
          }
        })

        // Удаляем DOM-элементы и позиции для пакетов, которых больше нет в store
        const currentPacketIds = new Set(packets.map((p) => p.id))
        packetElementsRef.current.forEach((el, packetId) => {
          if (!currentPacketIds.has(packetId)) {
            if (el.parentNode) {
              el.parentNode.removeChild(el)
            }
            packetElementsRef.current.delete(packetId)
            positionsRef.current.delete(packetId)
          }
        })

        animationFrameRef.current = requestAnimationFrame(updatePackets)
      } catch (error) {
        console.error('Ошибка в PacketAnimation:', error)
      }
    }

    lastTsRef.current = performance.now()
    animationFrameRef.current = requestAnimationFrame(updatePackets)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      packetElementsRef.current.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
      packetElementsRef.current.clear()
      positionsRef.current.clear()
      lastTsRef.current = 0
    }
  }, [simulation.isRunning, simulation.speed, containerElement, reactFlowInstance])

  return null
}

export default PacketAnimation
