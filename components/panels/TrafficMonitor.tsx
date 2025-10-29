'use client'

import { useNetworkStore } from '@/store/networkStore'
import { ArrowRight, Package } from 'lucide-react'

export default function TrafficMonitor() {
  const { simulation, devices } = useNetworkStore()
  
  const getDeviceName = (id: string) => {
    return devices.find(d => d.id === id)?.name || id
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-white font-semibold">Active Packets</h3>
        <div className="text-sm text-gray-400">
          {simulation.packets.length} packet(s) in transit
        </div>
      </div>
      
      {simulation.packets.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No active packets</p>
          <p className="text-xs mt-1">Start simulation to see traffic</p>
        </div>
      ) : (
        <div className="space-y-2">
          {simulation.packets.map((packet) => (
            <div key={packet.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-mono text-xs">{packet.id.slice(-8)}</span>
                </div>
                <span className="text-xs text-gray-400 uppercase">{packet.type}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm mb-2">
                <span className="text-green-400">{getDeviceName(packet.source)}</span>
                <ArrowRight className="w-4 h-4 text-gray-500" />
                <span className="text-blue-400">{getDeviceName(packet.destination)}</span>
              </div>
              
              {/* Path visualization */}
              <div className="flex items-center space-x-1 mb-2">
                {packet.path.map((deviceId, idx) => (
                  <div key={idx} className="flex items-center">
                    <div className={`px-2 py-1 rounded text-xs ${
                      idx === packet.currentPosition 
                        ? 'bg-blue-600 text-white animate-pulse' 
                        : idx < packet.currentPosition
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {getDeviceName(deviceId)}
                    </div>
                    {idx < packet.path.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-gray-600 mx-1" />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Packet details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {packet.data.sourceIp && (
                  <div>
                    <span className="text-gray-500">Src IP: </span>
                    <span className="text-white font-mono">{packet.data.sourceIp}</span>
                  </div>
                )}
                {packet.data.destIp && (
                  <div>
                    <span className="text-gray-500">Dst IP: </span>
                    <span className="text-white font-mono">{packet.data.destIp}</span>
                  </div>
                )}
                {packet.data.protocol && (
                  <div>
                    <span className="text-gray-500">Protocol: </span>
                    <span className="text-cyan-400">{packet.data.protocol}</span>
                  </div>
                )}
                {packet.data.ttl && (
                  <div>
                    <span className="text-gray-500">TTL: </span>
                    <span className="text-white">{packet.data.ttl}</span>
                  </div>
                )}
              </div>
              
              {/* GPON specific data */}
              {packet.data.gponFrame && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="text-xs text-yellow-400 mb-1">GPON Frame:</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">ONU ID: </span>
                      <span className="text-white">{packet.data.gponFrame.onuId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Alloc ID: </span>
                      <span className="text-white">{packet.data.gponFrame.allocId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">GEM Port: </span>
                      <span className="text-white">{packet.data.gponFrame.gemPort}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

