'use client'

import { useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { 
  Settings, Terminal, Activity, Shield, X, 
  Info, AlertTriangle, AlertCircle, XCircle 
} from 'lucide-react'
import DeviceConfig from './panels/DeviceConfig'
import ConsoleLogs from './panels/ConsoleLogs'
import TrafficMonitor from './panels/TrafficMonitor'
import SecurityPanel from './panels/SecurityPanel'

type TabType = 'config' | 'console' | 'traffic' | 'security'

export default function BottomPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('config')
  const [isExpanded, setIsExpanded] = useState(true)
  const { selectedDeviceId } = useNetworkStore()
  
  if (!isExpanded) {
    return (
      <div className="h-8 bg-gray-800 border-t border-gray-700 flex items-center px-4 cursor-pointer hover:bg-gray-750"
        onClick={() => setIsExpanded(true)}
      >
        <span className="text-sm text-gray-400">▲ Show Panel</span>
      </div>
    )
  }
  
  return (
    <div className="h-80 bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 flex items-center space-x-2 border-r border-gray-700 ${
              activeTab === 'config' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Config</span>
          </button>
          
          <button
            onClick={() => setActiveTab('console')}
            className={`px-4 py-2 flex items-center space-x-2 border-r border-gray-700 ${
              activeTab === 'console' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Console</span>
          </button>
          
          <button
            onClick={() => setActiveTab('traffic')}
            className={`px-4 py-2 flex items-center space-x-2 border-r border-gray-700 ${
              activeTab === 'traffic' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Traffic Monitor</span>
          </button>
          
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 flex items-center space-x-2 ${
              activeTab === 'security' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security / Attacks</span>
          </button>
        </div>
        
        <button
          onClick={() => setIsExpanded(false)}
          className="px-4 py-2 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'config' && <DeviceConfig />}
        {activeTab === 'console' && <ConsoleLogs />}
        {activeTab === 'traffic' && <TrafficMonitor />}
        {activeTab === 'security' && <SecurityPanel />}
      </div>
    </div>
  )
}

