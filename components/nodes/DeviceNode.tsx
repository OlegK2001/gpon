'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Server, Radio, Split, Router, Monitor, HardDrive, Network, Activity } from 'lucide-react'
import { NetworkDevice } from '@/types/network'

interface DeviceNodeData {
  device: NetworkDevice
  isHighlighted?: boolean
  attackMode?: 'source' | 'target'
  onUpdate: (updates: Partial<NetworkDevice>) => void
  onDelete: () => void
}

const DeviceNode = memo(({ data }: NodeProps<DeviceNodeData>) => {
  const { device, isHighlighted, attackMode } = data
  
  const getIcon = () => {
    switch (device.type) {
      case 'OLT':
        return <Server className="w-8 h-8" />
      case 'ONU':
      case 'ONT':
        return <Radio className="w-8 h-8" />
      case 'SPLITTER':
        return <Split className="w-8 h-8" />
      case 'ROUTER':
        return <Router className="w-8 h-8" />
      case 'SWITCH':
        return <Network className="w-8 h-8" />
      case 'PC':
        return <Monitor className="w-8 h-8" />
      case 'SERVER':
        return <HardDrive className="w-8 h-8" />
      default:
        return <Activity className="w-8 h-8" />
    }
  }
  
  const getColor = () => {
    switch (device.type) {
      case 'OLT':
        return 'bg-red-500'
      case 'ONU':
      case 'ONT':
        return 'bg-blue-500'
      case 'SPLITTER':
        return 'bg-yellow-500'
      case 'ROUTER':
        return 'bg-purple-500'
      case 'SWITCH':
        return 'bg-green-500'
      case 'PC':
        return 'bg-pink-500'
      case 'SERVER':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }
  
  const getStatusColor = () => {
    switch (device.status) {
      case 'active':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }
  
  const getBorderStyle = () => {
    if (attackMode === 'target') {
      return 'border-red-500 border-4 shadow-lg shadow-red-500/50'
    }
    if (attackMode === 'source') {
      return 'border-green-500 border-4 shadow-lg shadow-green-500/50'
    }
    return 'border-gray-300 border-2'
  }
  
  return (
    <div className="relative">
      {/* Attack Mode Indicator */}
      {attackMode && (
        <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs font-bold z-50 ${
          attackMode === 'target' ? 'bg-red-500' : 'bg-green-500'
        } text-white shadow-lg whitespace-nowrap`}>
          {attackMode === 'target' ? '🎯 Click to Attack' : '✓ Attack Source'}
        </div>
      )}
      
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      
      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      
      {/* Device Body */}
      <div className={`bg-white rounded-lg shadow-lg ${getBorderStyle()} hover:shadow-xl transition-all min-w-[140px]`}>
        <div className={`${getColor()} text-white p-3 rounded-t-md flex items-center justify-center relative`}>
          {getIcon()}
          {/* GPON ID Badge for ONU/ONT */}
          {(device.type === 'ONU' || device.type === 'ONT') && device.config.gponConfig?.onuId && (
            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
              {device.config.gponConfig.onuId}
            </div>
          )}
        </div>
        
        <div className="p-3 bg-gradient-to-b from-white to-gray-50">
          <div className="text-sm font-bold text-gray-800 text-center mb-1">
            {device.name}
          </div>
          
          <div className="text-xs text-gray-500 text-center mb-2">
            {device.type}
          </div>
          
          {device.ipAddress && (
            <div className="text-xs text-blue-600 text-center font-mono mb-1">
              {device.ipAddress}
            </div>
          )}
          
          {/* GPON Registration Status */}
          {(device.type === 'ONU' || device.type === 'ONT') && (
            <div className="text-xs text-center mb-2">
              {device.config.gponConfig?.onuId ? (
                <span className="text-green-600 font-semibold">
                  ✓ Registered (ID: {device.config.gponConfig.onuId})
                </span>
              ) : (
                <span className="text-yellow-600">
                  ⚠ Not Registered
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-center mt-2 space-x-1">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-xs text-gray-600 capitalize">{device.status}</span>
          </div>
          
          {device.ports.filter(p => p.status === 'up').length > 0 && (
            <div className="text-xs text-center text-gray-500 mt-1">
              Ports: {device.ports.filter(p => p.status === 'up').length}/{device.ports.length}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      
      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
    </div>
  )
})

DeviceNode.displayName = 'DeviceNode'

export default DeviceNode


