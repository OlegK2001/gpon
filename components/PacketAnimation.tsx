'use client'

import { useEffect, useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Packet } from '@/types/network'
import { PacketSimulator } from '@/utils/packetSimulation'
import { useReactFlow } from 'reactflow'

export default function PacketAnimation() {
  const reactFlowInstance = useReactFlow()
  const { simulation, devices, connections, addPacket, updatePacket, removePacket } = useNetworkStore()
  const [localPackets, setLocalPackets] = useState<Map<string, { x: number; y: number; progress: number }>>(new Map())
  
  // Generate test packets periodically when simulation is running
  useEffect(() => {
    if (!simulation.isRunning || devices.length < 2 || connections.length === 0) return
    
    const interval = setInterval(() => {
      // Find random connected devices
      const connection = connections[Math.floor(Math.random() * connections.length)]
      if (!connection) return
      
      const sourceDevice = devices.find(d => d.id === connection.sourceDeviceId)
      const targetDevice = devices.find(d => d.id === connection.targetDeviceId)
      
      if (!sourceDevice || !targetDevice) return
      
      // Calculate path through network
      const path = PacketSimulator.calculatePath(
        sourceDevice.id,
        targetDevice.id,
        devices,
        connections
      )
      
      if (path.length < 2) return
      
      // Determine if GPON packet
      const isGPON = sourceDevice.type === 'ONU' || sourceDevice.type === 'ONT' || 
                     targetDevice.type === 'ONU' || targetDevice.type === 'ONT' ||
                     sourceDevice.type === 'OLT' || targetDevice.type === 'OLT'
      
      // Create a packet
      const packet: Packet = {
        id: `packet-${Date.now()}-${Math.random()}`,
        type: 'ip',
        source: sourceDevice.id,
        destination: targetDevice.id,
        data: {
          sourceIp: sourceDevice.ipAddress || '0.0.0.0',
          destIp: targetDevice.ipAddress || '0.0.0.0',
          sourceMac: sourceDevice.macAddress || '00:00:00:00:00:00',
          destMac: targetDevice.macAddress || '00:00:00:00:00:00',
          protocol: isGPON ? 'GPON' : 'TCP',
          ttl: 64,
          sourcePort: Math.floor(Math.random() * 60000) + 1024,
          destPort: 80,
          payload: 'Test Data',
        },
        path,
        currentPosition: 0,
        timestamp: Date.now(),
      }
      
      // Add GPON frame data if applicable
      if (isGPON && sourceDevice.config.gponConfig?.onuId) {
        packet.data.gponFrame = {
          onuId: sourceDevice.config.gponConfig.onuId,
          allocId: sourceDevice.config.gponConfig.allocId || 1024,
          gemPort: sourceDevice.config.gponConfig.gemPort || 1280,
        }
      }
      
      addPacket(packet)
      
      // Remove packet after it completes journey (duration depends on speed and path length)
      const duration = (path.length * 1500) / simulation.speed // Slower: 1.5sec per segment
      setTimeout(() => {
        removePacket(packet.id)
      }, duration)
    }, (4000 / simulation.speed)) // Generate packets slower
    
    return () => clearInterval(interval)
  }, [simulation.isRunning, simulation.speed, devices, connections, addPacket, removePacket])
  
  const getDeviceName = (id: string) => {
    return devices.find(d => d.id === id)?.name || 'Unknown'
  }
  
  // Helper function to compute edge points (accounting for node radius)
  const computeEdgePoints = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }, radius: number = 28, strokeWidth: number = 3) => {
    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    
    // Account for strokeWidth in inset/outset calculation
    const inset = radius + strokeWidth / 2 + 2
    const outset = radius + strokeWidth / 2 + 2
    
    return {
      start: { x: sourcePos.x + ux * inset, y: sourcePos.y + uy * inset },
      end: { x: targetPos.x - ux * outset, y: targetPos.y - uy * outset }
    }
  }
  
  // Animate packets along edges using React Flow's edge positions
  useEffect(() => {
    if (!simulation.isRunning || !reactFlowInstance) return
    
    const interval = setInterval(() => {
      const newPositions = new Map<string, { x: number; y: number; progress: number }>()
      const edges = reactFlowInstance.getEdges()
      
      simulation.packets.forEach(packet => {
        // Calculate total elapsed time
        const elapsed = Date.now() - packet.timestamp
        const segmentDuration = 1500 / simulation.speed // 1.5 seconds per segment adjusted by speed
        
        // Determine which segment we're on
        const totalSegments = packet.path.length - 1
        const currentSegment = Math.floor(elapsed / segmentDuration)
        
        if (currentSegment >= totalSegments) {
          // Packet has reached destination - log it
          const { addLog, removePacket } = useNetworkStore.getState()
          const sourceName = getDeviceName(packet.source)
          const destName = getDeviceName(packet.destination)
          addLog({
            level: 'info',
            deviceId: packet.destination,
            message: `Packet arrived from ${sourceName} to ${destName}`,
            details: {
              protocol: packet.data.protocol,
              bytes: 512,
            }
          })
          removePacket(packet.id)
          return
        }
        
        // Progress within current segment (0 to 1)
        const segmentProgress = (elapsed % segmentDuration) / segmentDuration
        
        const sourceId = packet.path[currentSegment]
        const targetId = packet.path[currentSegment + 1]
        
        // Find the edge between these nodes
        const edge = edges.find(e => 
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
        )
        
        const sourceNode = reactFlowInstance.getNode(sourceId)
        const targetNode = reactFlowInstance.getNode(targetId)
        
        if (sourceNode && targetNode) {
          // Get actual positions from React Flow (includes zoom and pan)
          const sourcePos = {
            x: sourceNode.position.x + (sourceNode.width || 100) / 2,
            y: sourceNode.position.y + (sourceNode.height || 100) / 2
          }
          
          const targetPos = {
            x: targetNode.position.x + (targetNode.width || 100) / 2,
            y: targetNode.position.y + (targetNode.height || 100) / 2
          }
          
          // Use computeEdgePoints to get proper start/end positions
          const { start, end } = computeEdgePoints(sourcePos, targetPos, 28, 3)
          
          // Calculate position along the line with proper edge points
          const x = start.x + (end.x - start.x) * segmentProgress
          const y = start.y + (end.y - start.y) * segmentProgress
          
          newPositions.set(packet.id, { x, y, progress: segmentProgress })
          
          // Update packet position if moved to next segment
          if (currentSegment !== packet.currentPosition) {
            updatePacket(packet.id, { currentPosition: currentSegment })
          }
        }
      })
      
      setLocalPackets(newPositions)
    }, 16) // 60 FPS
    
    return () => clearInterval(interval)
  }, [simulation.isRunning, simulation.packets, simulation.speed, reactFlowInstance, updatePacket, devices])
  
  return (
    <>
      {simulation.packets.map(packet => {
        const position = localPackets.get(packet.id)
        if (!position) return null
        
        const isGPON = packet.data.gponFrame !== undefined
        
        return (
          <div key={packet.id} className="absolute pointer-events-none" style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}>
            {/* Packet dot - larger and more visible */}
            <div className={`w-5 h-5 rounded-full shadow-lg border-2 border-white ${
              isGPON ? 'bg-yellow-400' : 'bg-blue-500'
            } animate-pulse relative`}>
              {/* Glow effect - more visible */}
              <div className={`absolute inset-0 rounded-full ${
                isGPON ? 'bg-yellow-400' : 'bg-blue-500'
              } opacity-50 animate-ping`} style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              {/* Inner core */}
              <div className={`absolute inset-1 rounded-full ${
                isGPON ? 'bg-yellow-300' : 'bg-blue-400'
              }`} />
            </div>
            
            {/* Trail effect - show direction */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{
              boxShadow: isGPON 
                ? '0 0 10px rgba(251, 191, 36, 0.8), 0 0 20px rgba(251, 191, 36, 0.6)' 
                : '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.6)'
            }} />
            
            {/* Packet info tooltip - more visible */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-95 text-white px-2 py-1 rounded-md whitespace-nowrap pointer-events-none shadow-lg border border-white/20" style={{fontSize: '10px', minWidth: '140px'}}>
              {isGPON && <div className="text-yellow-400 font-bold text-xs mb-0.5">⚡ GPON</div>}
              <div className="font-medium">{getDeviceName(packet.source)} → {getDeviceName(packet.destination)}</div>
              {packet.data.gponFrame && (
                <div className="text-yellow-300 text-xs mt-0.5">
                  ONU ID: {packet.data.gponFrame.onuId}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
