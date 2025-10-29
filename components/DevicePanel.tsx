'use client'

import { useState } from 'react'
import { Server, Radio, Split, Router, Monitor, HardDrive, Network, ChevronDown } from 'lucide-react'
import { DeviceType } from '@/types/network'

interface DeviceCategory {
  name: string
  devices: { type: DeviceType; icon: any; label: string; description: string; color: string }[]
}

const deviceCategories: DeviceCategory[] = [
  {
    name: 'GPON Devices',
    devices: [
      { type: 'OLT', icon: Server, label: 'OLT', description: 'Optical Line Terminal', color: 'bg-red-500' },
      { type: 'ONU', icon: Radio, label: 'ONU', description: 'Optical Network Unit', color: 'bg-blue-500' },
      { type: 'ONT', icon: Radio, label: 'ONT', description: 'Optical Network Terminal', color: 'bg-cyan-500' },
      { type: 'SPLITTER', icon: Split, label: 'Splitter', description: 'Optical Splitter', color: 'bg-yellow-500' },
    ]
  },
  {
    name: 'Network Devices',
    devices: [
      { type: 'ROUTER', icon: Router, label: 'Router', description: 'Network Router', color: 'bg-purple-500' },
      { type: 'SWITCH', icon: Network, label: 'Switch', description: 'Network Switch', color: 'bg-green-500' },
    ]
  },
  {
    name: 'End Devices',
    devices: [
      { type: 'PC', icon: Monitor, label: 'PC', description: 'Personal Computer', color: 'bg-pink-500' },
      { type: 'SERVER', icon: HardDrive, label: 'Server', description: 'Server', color: 'bg-orange-500' },
    ]
  }
]

export default function DevicePanel() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['GPON Devices', 'Network Devices', 'End Devices'])
  
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    )
  }
  
  const handleDragStart = (e: React.DragEvent, deviceType: DeviceType) => {
    e.dataTransfer.setData('deviceType', deviceType)
    e.dataTransfer.effectAllowed = 'copy'
  }
  
  return (
    <div className="w-72 bg-gray-100 border-r-2 border-gray-300 overflow-y-auto">
      <div className="p-3 bg-white border-b-2 border-gray-300">
        <h2 className="text-sm font-bold text-gray-800 uppercase">Device Selection</h2>
      </div>
      
      <div className="p-2">
        {deviceCategories.map((category) => (
          <div key={category.name} className="mb-2">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between p-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-700">{category.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                expandedCategories.includes(category.name) ? 'rotate-180' : ''
              }`} />
            </button>
            
            {expandedCategories.includes(category.name) && (
              <div className="mt-1 space-y-1 pl-2">
                {category.devices.map((device) => {
                  const Icon = device.icon
                  return (
                    <div
                      key={device.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, device.type)}
                      className="p-2 bg-white border border-gray-300 rounded cursor-move hover:border-blue-400 hover:shadow transition-all"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 ${device.color} rounded`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{device.label}</div>
                          <div className="text-xs text-gray-500 truncate">{device.description}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-3 mt-4 mx-2 bg-blue-50 border border-blue-200 rounded">
        <h3 className="text-xs font-bold text-blue-900 mb-2">Quick Guide:</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>→ Drag devices onto canvas</li>
          <li>→ Connect devices together</li>
          <li>→ Click device to configure</li>
          <li>→ Press Start to simulate</li>
        </ul>
      </div>
    </div>
  )
}


