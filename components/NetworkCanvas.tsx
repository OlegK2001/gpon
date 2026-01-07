'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  EdgeChange,
  Connection as ReactFlowConnection,
  NodeChange,
  ReactFlowInstance,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useNetworkStore } from '@/store/networkStore'
import { DeviceType, NetworkDevice } from '@/types/network'
import DeviceNode, { DeviceNodeData } from './nodes/DeviceNode'
import { t } from '@/i18n/ru'
import { useSimulationLoop } from '@/hooks/useSimulationLoop'
import PacketAnimationComponent from './PacketAnimation'

const nodeTypes: NodeTypes = {
  device: DeviceNode,
}

// Helper function to check if two devices can connect based on interface compatibility
function canDevicesConnect(source: NetworkDevice, target: NetworkDevice): { canConnect: boolean; connectionType?: 'optical' | 'ethernet'; reason?: string } {
  
  const opticalDevices = ['OLT', 'SPLITTER'] as DeviceType[]
  const ethernetDevices = ['ROUTER', 'PC', 'SERVER'] as DeviceType[]
  const converterDevices = ['ONU', 'ONT'] as DeviceType[]
  
  // Check if source has optical port
  const sourceHasOptical = source.ports.some(p => p.type === 'optical') || opticalDevices.includes(source.type) || 
    (converterDevices.includes(source.type) && (source.ports.some(p => p.type === 'optical') || true)) // ONU/ONT always have optical capability
  
  // Check if source has ethernet port
  const sourceHasEthernet = source.ports.some(p => p.type === 'ethernet') || ethernetDevices.includes(source.type) ||
    (converterDevices.includes(source.type) && (source.ports.some(p => p.type === 'ethernet') || true)) // ONU/ONT always have ethernet capability
  
  // Check if target has optical port
  const targetHasOptical = target.ports.some(p => p.type === 'optical') || opticalDevices.includes(target.type) ||
    (converterDevices.includes(target.type) && (target.ports.some(p => p.type === 'optical') || true)) // ONU/ONT always have optical capability
  
  // Check if target has ethernet port
  const targetHasEthernet = target.ports.some(p => p.type === 'ethernet') || ethernetDevices.includes(target.type) ||
    (converterDevices.includes(target.type) && (target.ports.some(p => p.type === 'ethernet') || true)) // ONU/ONT always have ethernet capability
  
  // ONU/ONT can connect to OLT (optical) or Switch/Router/PC/Server (ethernet)
  if (converterDevices.includes(source.type)) {
    // ONU/ONT → OLT/SPLITTER/ONU/ONT (optical)
    if (targetHasOptical && (target.type === 'OLT' || target.type === 'SPLITTER' || target.type === 'ONU' || target.type === 'ONT')) {
      return { canConnect: true, connectionType: 'optical' }
    }
    // ONU/ONT → Switch/Router/PC/Server (ethernet)
    if (targetHasEthernet && ethernetDevices.includes(target.type)) {
      return { canConnect: true, connectionType: 'ethernet' }
    }
  }
  
  if (converterDevices.includes(target.type)) {
    // OLT/SPLITTER/ONU/ONT → ONU/ONT (optical)
    if (sourceHasOptical && (source.type === 'OLT' || source.type === 'SPLITTER' || source.type === 'ONU' || source.type === 'ONT')) {
      return { canConnect: true, connectionType: 'optical' }
    }
    // Switch/Router/PC/Server → ONU/ONT (ethernet)
    if (sourceHasEthernet && ethernetDevices.includes(source.type)) {
      return { canConnect: true, connectionType: 'ethernet' }
    }
  }
  
  // Optical to Optical connection
  if (sourceHasOptical && targetHasOptical && opticalDevices.includes(source.type) && opticalDevices.includes(target.type)) {
    return { canConnect: true, connectionType: 'optical' }
  }
  
  // Ethernet to Ethernet connection
  if (sourceHasEthernet && targetHasEthernet && ethernetDevices.includes(source.type) && ethernetDevices.includes(target.type)) {
    return { canConnect: true, connectionType: 'ethernet' }
  }
  
  return { 
    canConnect: false, 
    reason: `${source.type} cannot connect to ${target.type}` 
  }
}

export default function NetworkCanvas() {
  const {
    devices,
    connections,
    addDevice,
    removeDevice,
    updateDevice,
    addConnection,
    removeConnection,
    selectDevice,
    simulation,
    connectionMode,
    registerONUToOLT,
    updateDeviceAnimationCoords,
    syncNodePositions,
    highlightedDevices,
  } = useNetworkStore()

  // Запускаем цикл симуляции
  useSimulationLoop()
  
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<DeviceNodeData> | null>(null)
  const nodesRef = useRef<Node<DeviceNodeData>[]>([]) // Keep track of nodes to preserve positions
  const lastNodesRef = useRef<Node<DeviceNodeData>[]>([]) // Track last nodes state to get current positions
  
  // Sync devices to nodes - preserve existing node positions
  useEffect(() => {
    const deviceIds = new Set(devices.map(d => d.id))
    
    // Очищаем lastNodesRef от удаленных устройств
    lastNodesRef.current = lastNodesRef.current.filter(n => deviceIds.has(n.id))
    
    // Создаем карту текущих позиций из последнего известного состояния ReactFlow nodes
    const currentPositions = new Map<string, { x: number; y: number }>()
    lastNodesRef.current.forEach(node => {
      if (deviceIds.has(node.id)) {
        currentPositions.set(node.id, node.position)
      }
    })
    
    const newNodes: Node<DeviceNodeData>[] = devices.map(device => {
      // Приоритет позиций:
      // 1. Если узел уже существует в ReactFlow - ВСЕГДА используем его текущую позицию
      // 2. Для новых узлов используем device.position из store
      let nodePosition = device.position
      
      const existingPosition = currentPositions.get(device.id)
      if (existingPosition) {
        nodePosition = existingPosition
      }
      
      // Calculate animation coordinates (center of node)
      const animationCoords = {
        x: nodePosition.x + 120 / 2, // width / 2 = 60
        y: nodePosition.y + 64 / 2,   // height / 2 = 32
      }
      
      // Update animation coordinates in store
      updateDeviceAnimationCoords(device.id, animationCoords)
      
      let className = ''
      let isHighlighted = false
      let mode: 'connection-first' | undefined
      
      // Highlight logic for connection mode
      if (connectionMode.active) {
        if (connectionMode.firstDeviceId === device.id) {
          className = 'connection-first-selected'
          mode = 'connection-first'
        } else if (connectionMode.firstDeviceId) {
          className = 'connection-target-candidate'
          isHighlighted = true
        } else {
          className = 'connection-source-candidate'
          isHighlighted = true
        }
      }
      
      // Подсветка для выбора места подключения вредоносного ONT
      if (highlightedDevices && highlightedDevices.includes(device.id)) {
        isHighlighted = true
      }
      
      return {
        id: device.id,
        type: 'device',
        position: nodePosition,
        width: 120,
        height: 64,
        className,
        data: {
          device,
          isHighlighted,
          onUpdate: (updates: Partial<NetworkDevice>) => updateDevice(device.id, updates),
          onDelete: () => removeDevice(device.id),
        },
      }
    })
    
    // Update refs with new nodes to preserve positions for next render
    nodesRef.current = newNodes
    lastNodesRef.current = newNodes
    setNodes(newNodes)
    
    // Sync node positions to store for saving
    const positionsMap: Record<string, { x: number; y: number }> = {}
    newNodes.forEach(node => {
      positionsMap[node.id] = node.position
    })
    syncNodePositions(positionsMap)
  }, [devices, connectionMode, updateDevice, removeDevice, updateDeviceAnimationCoords, syncNodePositions, highlightedDevices])
  
  // Sync connections to edges with better styling (no arrows, center-to-center)
  useEffect(() => {
    // Filter edges to only include connections between existing devices
    const deviceIds = new Set(devices.map(d => d.id))
    const validConnections = connections.filter(conn => 
      deviceIds.has(conn.sourceDeviceId) && deviceIds.has(conn.targetDeviceId)
    )
    
    const newEdges: Edge[] = validConnections.map(conn => {
      return {
        id: conn.id,
        source: conn.sourceDeviceId,
        target: conn.targetDeviceId,
        sourceHandle: 'center',
        targetHandle: 'center',
        type: 'straight',
        animated: conn.status === 'active' && simulation.isRunning,
        style: {
          stroke: conn.type === 'optical' ? '#f59e0b' : '#3b82f6',
          strokeWidth: conn.type === 'optical' ? 5 : 4,
          strokeDasharray: conn.type === 'optical' ? '10 5' : '0',
          opacity: 1,
        },
      }
    })
    setEdges(newEdges)
  }, [connections, simulation.isRunning, setEdges, devices])
  
  // Disable default drag-to-connect behavior
  const onConnect = useCallback((params: ReactFlowConnection) => {
    // Do nothing - connections are made via Connection Mode button only
    return
  }, [])
  
  // Handle edge deletion - sync with store
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
    
    // When an edge is removed, remove the connection from store
    changes.forEach((change) => {
      if (change.type === 'remove') {
        removeConnection(change.id)
      }
    })
  }, [onEdgesChange, removeConnection])
  
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])
  
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    
    if (!reactFlowInstance) return
    
    const deviceType = event.dataTransfer.getData('deviceType') as DeviceType
    if (!deviceType) return
    
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    
    const deviceId = `${deviceType.toLowerCase()}-${Date.now()}`
    const portCount = deviceType === 'OLT' ? 16 : deviceType === 'ROUTER' ? 8 : 4
    
    const newDevice = {
      id: deviceId,
      type: deviceType,
      position,
      name: `${deviceType}-${devices.filter(d => d.type === deviceType).length + 1}`,
      status: 'active' as const,
      ports: Array.from({ length: portCount }, (_, i) => ({
        id: `port-${deviceId}-${i + 1}`,
        number: i + 1,
        type: deviceType === 'OLT' || deviceType === 'ONU' || deviceType === 'ONT' || deviceType === 'SPLITTER' 
          ? 'optical' as const 
          : 'ethernet' as const,
        status: 'down' as const,
        speed: '1Gbps',
        duplex: 'full' as const,
      })),
      config: {
        ...(deviceType === 'OLT' && {
          gponConfig: {
            wavelengthDown: 1490,
            wavelengthUp: 1310,
            maxDistance: 20,
            encryptionEnabled: true,
          },
        }),
        ...(deviceType === 'SPLITTER' && {
          gponConfig: {
            splitterRatio: '1:32',
          },
        }),
      },
      ipAddress: deviceType === 'PC' || deviceType === 'SERVER' || deviceType === 'ROUTER' 
        ? `192.168.1.${Math.floor(Math.random() * 254) + 1}` 
        : undefined,
      macAddress: `${Array.from({ length: 6 }, () => 
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join(':')}`,
    }
    
    addDevice(newDevice)
  }, [reactFlowInstance, devices, addDevice])
  
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node<DeviceNodeData>) => {
    const { addLog, connectionMode, setConnectionMode, addConnection } = useNetworkStore.getState()
    
    // Handle connection mode clicks
    if (connectionMode.active) {
      event.stopPropagation()
      
      if (!connectionMode.firstDeviceId) {
        // First device selected
        setConnectionMode({
          active: true,
          firstDeviceId: node.id
        })
        addLog({
          level: 'info',
          message: `Первое устройство выбрано: ${devices.find(d => d.id === node.id)?.name}. Кликните на второе устройство для соединения.`
        })
      } else {
        // Second device selected - create connection
        if (connectionMode.firstDeviceId === node.id) {
          addLog({
            level: 'error',
            message: t('messages.cannotConnectToSelf')
          })
          return
        }
        
        const sourceDevice = devices.find(d => d.id === connectionMode.firstDeviceId)
        const targetDevice = devices.find(d => d.id === node.id)
        
        if (sourceDevice && targetDevice) {
          // Check interface compatibility
          const canConnect = canDevicesConnect(sourceDevice, targetDevice)
          
          if (!canConnect.canConnect) {
            addLog({
              level: 'error',
              message: `❌ ${canConnect.reason || 'Несовместимые интерфейсы'}`,
            })
            // Reset connection mode
            setConnectionMode({
              active: true,
              firstDeviceId: undefined
            })
            return
          }
          
          const connection = {
            id: `conn-${Date.now()}`,
            sourceDeviceId: connectionMode.firstDeviceId,
            sourcePortId: `port-${connectionMode.firstDeviceId}-1`,
            targetDeviceId: node.id,
            targetPortId: `port-${node.id}-1`,
            type: canConnect.connectionType || 'ethernet',
            status: 'active' as const,
          }
          
          addConnection(connection)
          
          // Register ONU if connecting to OLT
          if (sourceDevice.type === 'OLT' && (targetDevice.type === 'ONU' || targetDevice.type === 'ONT')) {
            setTimeout(() => registerONUToOLT(targetDevice.id, sourceDevice.id), 1200)
          } else if (targetDevice.type === 'OLT' && (sourceDevice.type === 'ONU' || sourceDevice.type === 'ONT')) {
            setTimeout(() => registerONUToOLT(sourceDevice.id, targetDevice.id), 1200)
          }
          
          addLog({
            level: 'info',
            message: `✓ ${t('messages.connected')} ${sourceDevice.name} → ${targetDevice.name}`
          })
          
          // Reset connection mode
          setConnectionMode({
            active: true,
            firstDeviceId: undefined
          })
        }
      }
      return
    }
    
    // Normal selection
    selectDevice(node.id)
  }, [devices, selectDevice, registerONUToOLT])
  
  const onPaneClick = useCallback(() => {
    selectDevice(null)
  }, [selectDevice])
  
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes: NodeChange[]) => {
            // Обрабатываем удаление nodes
            changes.forEach((change) => {
              if (change.type === 'remove') {
                removeDevice(change.id)
              }
            })
            onNodesChange(changes)
            // Update device positions in store when drag ends
            changes.forEach((change: NodeChange) => {
              if (change.type === 'position' && change.position) {
                const position = change.position
                // Update refs immediately for position preservation
                nodesRef.current = nodesRef.current.map((n) =>
                  n.id === change.id ? { ...n, position } : n
                )
                lastNodesRef.current = lastNodesRef.current.map((n) =>
                  n.id === change.id ? { ...n, position } : n
                )
                
                // Update animation coordinates immediately
                const animationCoords = {
                  x: change.position.x + 120 / 2,
                  y: change.position.y + 64 / 2,
                }
                updateDeviceAnimationCoords(change.id, animationCoords)
                
                // Update store only when drag ends
                if (change.dragging === false) {
                  updateDevice(change.id, { position: change.position })
                }
                
                // Sync all node positions to store for saving
                const positionsMap: Record<string, { x: number; y: number }> = {}
                nodesRef.current.forEach(node => {
                  positionsMap[node.id] = node.position
                })
                syncNodePositions(positionsMap)
              }
            })
          }}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView={false}
          className="bg-gradient-background"
          minZoom={0.5}
          maxZoom={2}
          connectionLineType={ConnectionLineType.Straight}
          defaultEdgeOptions={{
            type: 'straight',
            animated: false,
            style: { strokeWidth: 4, stroke: '#3b82f6' },
          }}
        >
          <Background color="#f5f5f5" variant={BackgroundVariant.Dots} gap={16} />
          <Controls className="bg-card border border-border" />
          {simulation.isRunning && <PacketAnimationComponent />}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
