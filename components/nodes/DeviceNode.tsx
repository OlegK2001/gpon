'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { NetworkDevice } from '@/types/network'
import { getDeviceIcon } from './DeviceIcons'
import { useNetworkStore } from '@/store/networkStore'

interface DeviceNodeData {
  device: NetworkDevice
  isHighlighted?: boolean
  attackMode?: 'source' | 'target' | 'connection-first'
  onUpdate: (updates: Partial<NetworkDevice>) => void
  onDelete: () => void
}

const DeviceNode = memo(({ data }: NodeProps<DeviceNodeData>) => {
  const { device, isHighlighted, attackMode } = data
  const activeAttacks = useNetworkStore(state => state.activeAttacks)
  
  // Получаем crackedCodes для SnifferONT
  const isSnifferOnt = device.config.attackKind === 'EAVESDROP' && device.config.isAttackDevice
  const crackedCodes = isSnifferOnt ? activeAttacks.EAVESDROP.crackedCodes : undefined
  
  // Получаем текущий ключ подбора для SubstituteONT во время ONT_SPOOF атаки
  const isSubstituteOnt = device.config.attackKind === 'ONT_SPOOF_SUBSTITUTE' && device.config.isAttackDevice
  const currentBruteKey = isSubstituteOnt && activeAttacks.ONT_SPOOF.isActive 
    ? activeAttacks.ONT_SPOOF.currentBruteKey 
    : undefined
  
  const getIcon = () => getDeviceIcon(device.type)
  
  const getColor = () => {
    // Несанкционированный ONT (красный)
    if ((device.type === 'ONU' || device.type === 'ONT') && device.id.startsWith('ont-rogue-')) {
      return 'bg-red-600'
    }
    
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
    // Подсветка для выбора места подключения вредоносного ONT
    if (isHighlighted) {
      return 'border-yellow-400 border-[3px] shadow-lg shadow-yellow-400/50 animate-pulse'
    }
    return 'border-gray-300 border-2'
  }
  
  return (
    <div className="relative">
      {/* Compromised Indicator (красный кружок в углу) */}
      {device.config?.compromised && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg z-50" 
             title="Устройство скомпрометировано" />
      )}
      
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
      

      
      {/* Device Body - Circular Icon with Text Outside */}
      <div className="relative w-[120px]" style={{ height: '64px' }}>
        {/* Central Handle for ReactFlow - positioned at center of circle (32px from top = center of 64px height) */}
        <Handle
          type="source"
          position={Position.Top}
          id="center"
          className="!opacity-0 !w-0 !h-0 !pointer-events-none"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        <Handle
          type="target"
          position={Position.Top}
          id="center"
          className="!opacity-0 !w-0 !h-0 !pointer-events-none"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        
        {/* Circular Icon Container - centered in 64px height */}
        <div className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full ${getBorderStyle()} ${getStatusLevelBorder()} bg-white shadow-lg hover:shadow-xl transition-all p-2 w-16 h-16 flex items-center justify-center`}>
          <div className="transform scale-[0.85]">
            {getIcon()}
          </div>
          {/* GPON ID Badge for ONU/ONT */}
          {(device.type === 'ONU' || device.type === 'ONT') && device.config.gponConfig?.onuId && (
            <div className={`absolute -top-1 -right-1 ${device.config.compromised ? 'bg-red-500' : 'bg-green-500'} text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md`}>
              {device.config.gponConfig.onuId}
            </div>
          )}
          {/* Two-digit ID Badge for ONU/ONT */}
          {(device.type === 'ONU' || device.type === 'ONT') && (device.config.gponConfig?.gponId2 || device.config.idCode || currentBruteKey) && (
            <div className={`absolute -bottom-1 -left-1 ${
              currentBruteKey 
                ? 'bg-orange-500 animate-pulse' // Оранжевый пульсирующий во время подбора
                : device.config.compromised 
                  ? 'bg-red-500' 
                  : 'bg-green-500'
            } text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-md ${
              currentBruteKey 
                ? 'text-white' // Белый текст во время подбора
                : device.config.idCracked 
                  ? 'text-black' 
                  : 'text-white'
            }`}>
              {currentBruteKey || device.config.idCode || device.config.gponConfig?.gponId2}
            </div>
          )}
          {/* Status Indicator */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor()} border-2 border-white`} />
        </div>
        
        {/* Text Info Below Icon - positioned absolutely so it doesn't affect node size */}
        <div className="absolute top-full left-0 right-0 mt-1">
          <div className="text-[11px] font-semibold text-center truncate px-1" style={{ color: '#f3f4f6', textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5)' }} title={`ID: ${device.id}`}>
            {device.name}
          </div>
          <div className="text-[9px] text-center truncate px-1" style={{ color: '#e5e7eb', textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5)' }}>
            {device.type}{device.serialNumber ? ` • ${device.serialNumber}` : ''}
          </div>
          {device.ipAddress && (
            <div className="text-[13px] text-center font-mono truncate px-1" style={{ color: '#000', textShadow: '0 1px 3px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.5)' }}>
              {device.ipAddress}
            </div>
          )}
        </div>
      </div>
      
      {/* Cracked Codes Badges for SnifferONT */}
      {isSnifferOnt && crackedCodes && crackedCodes.length > 0 && (
        <div className="absolute -right-2 top-0 flex flex-col gap-1 z-50">
          {crackedCodes.map((item, idx) => (
            <div
              key={`${item.deviceId}-${idx}`}
              className="bg-red-500 text-black text-[7px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md"
              title={`Найден код устройства: ${item.code}`}
            >
              {item.code}
            </div>
          ))}
        </div>
      )}
      
    </div>
  )
})

DeviceNode.displayName = 'DeviceNode'

export default DeviceNode
