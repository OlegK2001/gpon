'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { NetworkDevice } from '@/types/network'
import { getDeviceIcon } from './DeviceIcons'

interface DeviceNodeData {
  device: NetworkDevice
  isHighlighted?: boolean
  attackMode?: 'source' | 'target' | 'connection-first'
  onUpdate: (updates: Partial<NetworkDevice>) => void
  onDelete: () => void
}

const DeviceNode = memo(({ data }: NodeProps<DeviceNodeData>) => {
  const { device, isHighlighted, attackMode } = data
  
  const getIcon = () => getDeviceIcon(device.type)
  
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
      case 'ATTACKER':
        return 'bg-red-600'
      default:
        return 'bg-gray-500'
    }
  }
  
  const getStatusColor = () => {
    // Status level from attacks (0 = normal, 1 = yellow, 2 = orange, 3 = red)
    if (device.statusLevel !== undefined && device.statusLevel > 0) {
      switch (device.statusLevel) {
        case 1:
          return 'bg-yellow-500'
        case 2:
          return 'bg-orange-500'
        case 3:
          return 'bg-red-500'
        default:
          return 'bg-green-500'
      }
    }
    
    // Fallback to normal status
    switch (device.status) {
      case 'active':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }
  
  const getStatusLevelBorder = () => {
    if (device.statusLevel === undefined || device.statusLevel === 0) {
      return ''
    }
    
    switch (device.statusLevel) {
      case 1:
        return 'ring-2 ring-yellow-400 ring-opacity-75'
      case 2:
        return 'ring-2 ring-orange-400 ring-opacity-75'
      case 3:
        return 'ring-2 ring-red-400 ring-opacity-75 animate-pulse'
      default:
        return ''
    }
  }
  
  const getBorderStyle = () => {
    if (attackMode === 'target') {
      return 'border-red-500 border-[3px] shadow-lg shadow-red-500/50'
    }
    if (attackMode === 'connection-first') {
      return 'border-blue-500 border-[3px] shadow-lg shadow-blue-500/50'
    }
    if (attackMode === 'source') {
      return 'border-green-500 border-[3px] shadow-lg shadow-green-500/50'
    }
    return 'border-gray-300 border-2'
  }
  
  return (
    <div className="relative">
      {/* Mode Indicator */}
      {attackMode && (
        <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs font-bold z-50 ${
          attackMode === 'target' ? 'bg-red-500' : 
          attackMode === 'connection-first' ? 'bg-blue-500' : 'bg-green-500'
        } text-white shadow-lg whitespace-nowrap`}>
          {attackMode === 'target' ? '🎯 Click to Attack' : 
           attackMode === 'connection-first' ? '✓ First Device' : 
           '✓ Attack Source'}
        </div>
      )}
      
      {/* Invisible handles for ReactFlow edge rendering */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!opacity-0 !w-1 !h-1"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!opacity-0 !w-1 !h-1"
      />
      
      {/* Device Body - Circular Icon with Text Outside */}
      <div className="flex flex-col items-center w-[120px]">
        {/* Circular Icon Container */}
        <div className={`relative rounded-full ${getBorderStyle()} ${getStatusLevelBorder()} bg-white shadow-lg hover:shadow-xl transition-all p-3 w-16 h-16 flex items-center justify-center`}>
          <div className="transform scale-[0.5]">
            {getIcon()}
          </div>
          {/* GPON ID Badge for ONU/ONT */}
          {(device.type === 'ONU' || device.type === 'ONT') && device.config.gponConfig?.onuId && (
            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
              {device.config.gponConfig.onuId}
            </div>
          )}
          {/* Status Indicator */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor()} border-2 border-white`} />
        </div>
        
        {/* Text Info Below Icon */}
        <div className="mt-2 w-full">
          <div className="text-[11px] font-semibold text-gray-900 text-center truncate px-1" title={`ID: ${device.id}`}>
            {device.name}
          </div>
          <div className="text-[9px] text-gray-600 text-center truncate px-1">
            {device.type}{device.serialNumber ? ` • ${device.serialNumber}` : ''}
          </div>
          {device.ipAddress && (
            <div className="text-[9px] text-blue-600 text-center font-mono truncate px-1">
              {device.ipAddress}
            </div>
          )}
        </div>
      </div>
      
    </div>
  )
})

DeviceNode.displayName = 'DeviceNode'

export default DeviceNode


