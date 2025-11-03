'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection as ReactFlowConnection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useNetworkStore } from '@/store/networkStore'
import { DeviceType, AttackType, NetworkDevice, Connection } from '@/types/network'
import DeviceNode from './nodes/DeviceNode'
import PacketAnimation from './PacketAnimation'

const nodeTypes: NodeTypes = {
  device: DeviceNode,
}

const attackTypes: { type: AttackType; name: string; description: string }[] = [
  { type: 'dos', name: 'DoS Attack', description: 'Denial of Service attack' },
  { type: 'ddos', name: 'DDoS Attack', description: 'Distributed Denial of Service' },
  { type: 'mitm', name: 'Man-in-the-Middle', description: 'Intercept communications' },
  { type: 'arp_poisoning', name: 'ARP Poisoning', description: 'Manipulate ARP tables' },
  { type: 'rogue_onu', name: 'Rogue ONU', description: 'Unauthorized ONU connection' },
  { type: 'mac_flooding', name: 'MAC Flooding', description: 'Overflow MAC address table' },
  { type: 'port_scan', name: 'Port Scan', description: 'Scan for open ports' },
  { type: 'packet_sniffing', name: 'Packet Sniffing', description: 'Capture network traffic' },
  { type: 'unauthorized_access', name: 'Unauthorized Access', description: 'Attempt to breach security' },
]

// Helper function to check if two devices can connect based on interface compatibility
function canDevicesConnect(source: NetworkDevice, target: NetworkDevice): { canConnect: boolean; connectionType?: 'optical' | 'ethernet'; reason?: string } {
  // Attacker can connect to any device using appropriate interface
  if (source.type === 'ATTACKER' || target.type === 'ATTACKER') {
    const nonAttacker = source.type === 'ATTACKER' ? target : source
    
    // Determine connection type based on target device
    if (nonAttacker.type === 'OLT' || nonAttacker.type === 'ONU' || nonAttacker.type === 'ONT' || nonAttacker.type === 'SPLITTER') {
      return { canConnect: true, connectionType: 'optical' }
    } else {
      return { canConnect: true, connectionType: 'ethernet' }
    }
  }
  
  const opticalDevices = ['OLT', 'SPLITTER'] as DeviceType[]
  const ethernetDevices = ['ROUTER', 'SWITCH', 'PC', 'SERVER'] as DeviceType[]
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
    attackMode,
    connectionMode,
    registerONUToOLT,
  } = useNetworkStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const nodesRef = useRef<Node[]>([]) // Keep track of nodes to preserve positions
  
  // Sync devices to nodes - preserve existing node positions
  useEffect(() => {
    const newNodes: Node[] = devices.map(device => {
      // Find existing node to preserve its position during drag
      const existingNode = nodesRef.current.find(n => n.id === device.id)
      
      // Use existing position if available (preserves drag position), otherwise use device position
      const nodePosition = existingNode?.position || device.position
      
      let className = ''
      let isHighlighted = false
      let mode: 'source' | 'target' | 'connection-first' | undefined
      
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
      // Highlight logic for attack mode
      else if (attackMode) {
        if (attackMode.step === 'select_source') {
          className = 'attack-source-candidate'
          isHighlighted = true
          mode = 'source'
        } else if (attackMode.step === 'select_target' && attackMode.sourceDeviceId) {
          if (device.id !== attackMode.sourceDeviceId) {
            className = 'attack-target-candidate'
            isHighlighted = true
            mode = 'target'
          } else {
            className = 'attack-source-selected'
          }
        }
      }
      
      return {
        id: device.id,
        type: 'device',
        position: nodePosition,
        className,
        data: {
          device,
          isHighlighted,
          attackMode: mode,
          onUpdate: (updates: any) => updateDevice(device.id, updates),
          onDelete: () => removeDevice(device.id),
        },
      }
    })
    nodesRef.current = newNodes // Update ref
    setNodes(newNodes)
  }, [devices, attackMode, connectionMode, updateDevice, removeDevice])
  
  // Sync connections to edges with better styling (no arrows, center-to-center)
  // Also highlight attack paths in red
  useEffect(() => {
    const activeAttacks = simulation.attacks.filter(a => a.status === 'active')
    const attackPaths = new Set<string>()
    
    // Mark attack paths as red
    activeAttacks.forEach(attack => {
      // Find path from attacker to target
      const attackerId = `attacker-${attack.id}`
      const devicePath = findPath(attackerId, attack.targetDeviceId, connections, devices)
      
      // Convert device path to connection IDs
      for (let i = 0; i < devicePath.length - 1; i++) {
        const fromDeviceId = devicePath[i]
        const toDeviceId = devicePath[i + 1]
        
        // Find connection between these devices
        const conn = connections.find(c =>
          (c.sourceDeviceId === fromDeviceId && c.targetDeviceId === toDeviceId) ||
          (c.sourceDeviceId === toDeviceId && c.targetDeviceId === fromDeviceId)
        )
        
        if (conn) {
          attackPaths.add(conn.id)
        }
      }
    })
    
    const newEdges: Edge[] = connections.map(conn => {
      const isAttackPath = conn.id.startsWith('conn-attacker-') || attackPaths.has(conn.id)
      
      return {
        id: conn.id,
        source: conn.sourceDeviceId,
        target: conn.targetDeviceId,
        type: 'straight', // Always straight lines to center
        animated: conn.status === 'active' && simulation.isRunning,
        style: {
          stroke: isAttackPath ? '#dc2626' : (conn.type === 'optical' ? '#f59e0b' : '#3b82f6'), // Red for attack paths, orange for optical, blue for ethernet
          strokeWidth: isAttackPath ? 5 : (conn.type === 'optical' ? 3 : 2), // Thicker red line for attack paths
          strokeDasharray: isAttackPath ? '8 4' : (conn.type === 'optical' ? '8 4' : '0'), // Dashed for attack paths and optical
          opacity: isAttackPath ? 0.9 : 1,
        },
        // No arrows - lines connect center to center
      }
    })
    setEdges(newEdges)
  }, [connections, simulation.isRunning, simulation.attacks, setEdges, devices])
  
  // Helper function to find path between two devices (returns device IDs in path order)
  function findPath(from: string, to: string, connections: Connection[], devices: NetworkDevice[]): string[] {
    if (from === to) return [from]
    
    const visited = new Set<string>()
    const queue: { deviceId: string; path: string[] }[] = [{ deviceId: from, path: [from] }]
    
    while (queue.length > 0) {
      const { deviceId, path } = queue.shift()!
      
      if (deviceId === to) {
        return path // Return device IDs in path
      }
      
      if (visited.has(deviceId)) continue
      visited.add(deviceId)
      
      // Find all connections from this device
      const relatedConnections = connections.filter(
        c => c.sourceDeviceId === deviceId || c.targetDeviceId === deviceId
      )
      
      for (const conn of relatedConnections) {
        const nextDeviceId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId
        if (!visited.has(nextDeviceId)) {
          queue.push({ deviceId: nextDeviceId, path: [...path, nextDeviceId] })
        }
      }
    }
    
    return []
  }
  
  // Disable default drag-to-connect behavior
  const onConnect = useCallback((params: ReactFlowConnection) => {
    // Do nothing - connections are made via Connection Mode button only
    return
  }, [])
  
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
    const portCount = deviceType === 'OLT' ? 16 : deviceType === 'ROUTER' || deviceType === 'SWITCH' ? 8 : 4
    
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
  
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const { attackMode, setAttackMode, addLog, launchAttack, connectionMode, setConnectionMode, addConnection } = useNetworkStore.getState()
    
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
          message: `First device selected: ${devices.find(d => d.id === node.id)?.name}. Click on second device to connect.`
        })
      } else {
        // Second device selected - create connection
        if (connectionMode.firstDeviceId === node.id) {
          addLog({
            level: 'error',
            message: 'Cannot connect device to itself! Select a different device.'
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
              message: `❌ Cannot connect: ${canConnect.reason || 'Incompatible interfaces'}`,
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
            type: canConnect.connectionType || 'ethernet', // Default to ethernet if not specified
            status: 'active' as const,
          }
          
          addConnection(connection)
          
          // Register ONU if connecting to OLT
          if (sourceDevice.type === 'OLT' && (targetDevice.type === 'ONU' || targetDevice.type === 'ONT')) {
            setTimeout(() => registerONUToOLT(targetDevice.id, sourceDevice.id), 100)
          } else if (targetDevice.type === 'OLT' && (sourceDevice.type === 'ONU' || sourceDevice.type === 'ONT')) {
            setTimeout(() => registerONUToOLT(sourceDevice.id, targetDevice.id), 100)
          }
          
          addLog({
            level: 'info',
            message: `✓ Connected ${sourceDevice.name} → ${targetDevice.name}`
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
    
    // Handle attack mode clicks
    if (attackMode) {
      event.stopPropagation()
      
      if (attackMode.step === 'select_source') {
        setAttackMode({
          ...attackMode,
          step: 'select_target',
          sourceDeviceId: node.id
        })
        addLog({
          level: 'warning',
          message: `Attack source selected: ${devices.find(d => d.id === node.id)?.name}. Now select target device.`
        })
      } else if (attackMode.step === 'select_target' && attackMode.sourceDeviceId) {
        if (attackMode.sourceDeviceId === node.id) {
          addLog({
            level: 'error',
            message: 'Cannot attack the same device! Select a different target.'
          })
          return
        }
        
        const sourceDevice = devices.find(d => d.id === attackMode.sourceDeviceId)
        const targetDevice = devices.find(d => d.id === node.id)
        
        if (sourceDevice && targetDevice) {
          const attackType = attackTypes.find(a => a.type === attackMode.type)
          
          const attack = {
            id: `attack-${Date.now()}`,
            type: attackMode.type,
            name: attackType?.name || 'Unknown Attack',
            description: attackType?.description || '',
            sourceDeviceId: attackMode.sourceDeviceId,
            targetDeviceId: node.id,
            status: 'active' as const,
            startTime: Date.now(),
            impact: {
              affectedDevices: [node.id],
              packetsDropped: 0,
              bandwidthConsumed: 0,
            },
          }
          
          launchAttack(attack)
          setAttackMode(null)
          
          addLog({
            level: 'critical',
            message: `🚨 ${attackType?.name} launched from ${sourceDevice.name} to ${targetDevice.name}!`
          })
        }
      }
      return
    }
    
    // Normal selection
    selectDevice(node.id)
  }, [devices, selectDevice, registerONUToOLT])
  
  const onPaneClick = useCallback(() => {
    const { attackMode, setAttackMode } = useNetworkStore.getState()
    
    // Exit attack mode if clicking on empty space
    if (attackMode) {
      setAttackMode(null)
      useNetworkStore.getState().addLog({
        level: 'info',
        message: 'Attack mode cancelled'
      })
      return
    }
    
    selectDevice(null)
  }, [selectDevice])
  
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes)
            // Update device positions in store when drag ends
            changes.forEach((change: any) => {
              if (change.type === 'position' && change.position) {
                // Update ref immediately for position preservation
                nodesRef.current = nodesRef.current.map((n) =>
                  n.id === change.id ? { ...n, position: change.position } : n
                )
                
                // Update store only when drag ends (dragging === false)
                if (change.dragging === false) {
                  updateDevice(change.id, { position: change.position })
                }
              }
            })
          }}
          onEdgesChange={onEdgesChange}
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
        >
          <Background color="hsl(var(--muted))" gap={16} />
          <Controls className="bg-card border border-border" />
          <MiniMap
            className="bg-card border border-border"
            nodeColor={(node) => {
              const device = devices.find(d => d.id === node.id)
              if (!device) return '#6b7280'
              switch (device.type) {
                case 'OLT': return '#ef4444'
                case 'ONU':
                case 'ONT': return '#3b82f6'
                case 'SPLITTER': return '#fbbf24'
                case 'ROUTER': return '#8b5cf6'
                case 'SWITCH': return '#10b981'
                case 'PC': return '#ec4899'
                case 'SERVER': return '#f97316'
                default: return '#6b7280'
              }
            }}
          />
          {simulation.isRunning && <PacketAnimation />}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}


