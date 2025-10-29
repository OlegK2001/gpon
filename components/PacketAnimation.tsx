'use client'

import { useEffect, useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Packet } from '@/types/network'

export default function PacketAnimation() {
  const { simulation, devices, connections, addPacket, updatePacket, removePacket } = useNetworkStore()
  const [localPackets, setLocalPackets] = useState<Map<string, { x: number; y: number }>>(new Map())
  
  // Generate test packets periodically when simulation is running
  useEffect(() => {
    if (!simulation.isRunning || devices.length < 2) return
    
    const interval = setInterval(() => {
      // Find a random source and destination
      const sourceDevice = devices[Math.floor(Math.random() * devices.length)]
      const possibleTargets = devices.filter(d => d.id !== sourceDevice.id)
      if (possibleTargets.length === 0) return
      
      const targetDevice = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
      
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
          protocol: 'TCP',
          ttl: 64,
          sourcePort: Math.floor(Math.random() * 65535),
          destPort: 80,
          payload: 'Test Data',
        },
        path: [sourceDevice.id, targetDevice.id],
        currentPosition: 0,
        timestamp: Date.now(),
      }
      
      addPacket(packet)
      
      // Remove packet after it completes journey
      setTimeout(() => {
        removePacket(packet.id)
      }, 3000 / simulation.speed)
    }, 2000 / simulation.speed)
    
    return () => clearInterval(interval)
  }, [simulation.isRunning, simulation.speed, devices, addPacket, removePacket])
  
  // Animate packets
  useEffect(() => {
    if (!simulation.isRunning) return
    
    const interval = setInterval(() => {
      const newPositions = new Map<string, { x: number; y: number }>()
      
      simulation.packets.forEach(packet => {
        if (packet.currentPosition >= packet.path.length - 1) {
          updatePacket(packet.id, { currentPosition: packet.path.length })
          return
        }
        
        const sourceId = packet.path[packet.currentPosition]
        const targetId = packet.path[packet.currentPosition + 1]
        
        const sourceDevice = devices.find(d => d.id === sourceId)
        const targetDevice = devices.find(d => d.id === targetId)
        
        if (sourceDevice && targetDevice) {
          // Calculate position between source and target
          const progress = ((Date.now() - packet.timestamp) % 3000) / 3000
          const x = sourceDevice.position.x + (targetDevice.position.x - sourceDevice.position.x) * progress
          const y = sourceDevice.position.y + (targetDevice.position.y - sourceDevice.position.y) * progress
          
          newPositions.set(packet.id, { x, y })
          
          if (progress > 0.9) {
            updatePacket(packet.id, { currentPosition: packet.currentPosition + 1 })
          }
        }
      })
      
      setLocalPackets(newPositions)
    }, 16) // 60 FPS
    
    return () => clearInterval(interval)
  }, [simulation.isRunning, simulation.packets, devices, updatePacket])
  
  const getDeviceName = (id: string) => {
    return devices.find(d => d.id === id)?.name || 'Unknown'
  }
  
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
            {/* Packet dot with trail effect */}
            <div className={`w-4 h-4 rounded-full shadow-lg ${
              isGPON ? 'bg-yellow-400' : 'bg-blue-500'
            } animate-pulse relative`}>
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-full ${
                isGPON ? 'bg-yellow-400' : 'bg-blue-500'
              } opacity-50 animate-ping`} />
            </div>
            
            {/* Packet info tooltip */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              {isGPON && <div className="text-yellow-400 font-bold">GPON Frame</div>}
              <div>{getDeviceName(packet.source)} → {getDeviceName(packet.destination)}</div>
              {packet.data.protocol && <div className="text-gray-300">{packet.data.protocol}</div>}
              {packet.data.gponFrame && (
                <div className="text-yellow-300 text-xs">
                  ONU:{packet.data.gponFrame.onuId} Alloc:{packet.data.gponFrame.allocId}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}


