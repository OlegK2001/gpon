'use client'

import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useNetworkStore } from '@/store/networkStore'
import { DeviceType, AttackType } from '@/types/network'
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
    registerONUToOLT,
  } = useNetworkStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  
  // Sync devices to nodes
  useEffect(() => {
    const newNodes: Node[] = devices.map(device => {
      let className = ''
      let isHighlighted = false
      
      // Highlight logic for attack mode
      if (attackMode) {
        if (attackMode.step === 'select_source') {
          // All devices can be sources
          className = 'attack-source-candidate'
          isHighlighted = true
        } else if (attackMode.step === 'select_target' && attackMode.sourceDeviceId) {
          // Highlight potential targets (not the source)
          if (device.id !== attackMode.sourceDeviceId) {
            className = 'attack-target-candidate'
            isHighlighted = true
          } else {
            className = 'attack-source-selected'
          }
        }
      }
      
      return {
        id: device.id,
        type: 'device',
        position: device.position,
        className,
        data: {
          device,
          isHighlighted,
          attackMode: attackMode?.step === 'select_target' && device.id !== attackMode.sourceDeviceId ? 'target' : 
                      attackMode?.step === 'select_source' ? 'source' : undefined,
          onUpdate: (updates: any) => updateDevice(device.id, updates),
          onDelete: () => removeDevice(device.id),
        },
      }
    })
    setNodes(newNodes)
  }, [devices, attackMode, setNodes, updateDevice, removeDevice])
  
  // Sync connections to edges
  useEffect(() => {
    const newEdges: Edge[] = connections.map(conn => ({
      id: conn.id,
      source: conn.sourceDeviceId,
      target: conn.targetDeviceId,
      type: conn.type === 'optical' ? 'default' : 'smoothstep',
      animated: conn.status === 'active',
      style: {
        stroke: conn.type === 'optical' ? '#fbbf24' : '#3b82f6',
        strokeWidth: 2,
      },
      label: conn.type === 'optical' ? 'Optical' : 'Ethernet',
    }))
    setEdges(newEdges)
  }, [connections, setEdges])
  
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    
    const sourceDevice = devices.find(d => d.id === params.source)
    const targetDevice = devices.find(d => d.id === params.target)
    
    if (!sourceDevice || !targetDevice) return
    
    // Determine connection type based on devices
    const isOptical = 
      sourceDevice.type === 'OLT' || 
      sourceDevice.type === 'ONU' || 
      sourceDevice.type === 'ONT' || 
      sourceDevice.type === 'SPLITTER' ||
      targetDevice.type === 'OLT' || 
      targetDevice.type === 'ONU' || 
      targetDevice.type === 'ONT' ||
      targetDevice.type === 'SPLITTER'
    
    const connection = {
      id: `conn-${Date.now()}`,
      sourceDeviceId: params.source,
      sourcePortId: `port-${params.source}-1`,
      targetDeviceId: params.target,
      targetPortId: `port-${params.target}-1`,
      type: isOptical ? 'optical' as const : 'ethernet' as const,
      status: 'active' as const,
    }
    
    addConnection(connection)
    
    // GPON: Auto-register ONU/ONT to OLT when connected
    if (sourceDevice.type === 'OLT' && (targetDevice.type === 'ONU' || targetDevice.type === 'ONT')) {
      setTimeout(() => registerONUToOLT(targetDevice.id, sourceDevice.id), 100)
    } else if (targetDevice.type === 'OLT' && (sourceDevice.type === 'ONU' || sourceDevice.type === 'ONT')) {
      setTimeout(() => registerONUToOLT(sourceDevice.id, targetDevice.id), 100)
    }
  }, [devices, addConnection, registerONUToOLT])
  
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
    const store = useNetworkStore.getState()
    
    // Handle attack mode clicks
    if (store.attackMode) {
      if (store.attackMode.step === 'select_source') {
        // Set source and move to target selection
        store.setAttackMode({
          ...store.attackMode,
          step: 'select_target',
          sourceDeviceId: node.id
        })
        store.addLog({
          level: 'warning',
          message: `Attack source selected: ${devices.find(d => d.id === node.id)?.name}. Select target device.`
        })
      } else if (store.attackMode.step === 'select_target' && store.attackMode.sourceDeviceId) {
        // Launch attack
        const sourceDevice = devices.find(d => d.id === store.attackMode!.sourceDeviceId)
        const targetDevice = devices.find(d => d.id === node.id)
        
        if (sourceDevice && targetDevice && store.attackMode.sourceDeviceId !== node.id) {
          const attackType = attackTypes.find(a => a.type === store.attackMode!.type)
          
          const attack = {
            id: `attack-${Date.now()}`,
            type: store.attackMode.type,
            name: attackType?.name || 'Unknown Attack',
            description: attackType?.description || '',
            sourceDeviceId: store.attackMode.sourceDeviceId,
            targetDeviceId: node.id,
            status: 'active' as const,
            startTime: Date.now(),
            impact: {
              affectedDevices: [node.id],
              packetsDropped: 0,
              bandwidthConsumed: 0,
            },
          }
          
          store.launchAttack(attack)
          store.setAttackMode(null) // Exit attack mode
        }
      }
      return
    }
    
    // Normal selection
    selectDevice(node.id)
  }, [selectDevice, devices])
  
  const onPaneClick = useCallback(() => {
    selectDevice(null)
  }, [selectDevice])
  
  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-900"
      >
        <Background color="#374151" gap={16} />
        <Controls className="bg-gray-800 border border-gray-700" />
        <MiniMap
          className="bg-gray-800 border border-gray-700"
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
    </div>
  )
}


