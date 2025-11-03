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
      <div className="w-12 bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-750 writing-vertical-rl"
        onClick={() => setIsExpanded(true)}
      >
        <span className="text-sm text-gray-400 rotate-180">◀ Show Panel</span>
      </div>
    )
  }
  
  return (
    <div className="flex-1 bg-gray-800 flex flex-col overflow-hidden">
      {/* Tabs - Vertical arrangement */}
      <div className="flex flex-col items-stretch border-b border-gray-700">
        <div className="flex items-center justify-between px-2 py-2 bg-gray-900">
          <span className="text-xs font-semibold text-gray-300">CONTROL PANEL</span>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        </div>
        
        <div className="flex flex-col">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2.5 flex items-center space-x-2 border-b border-gray-700 text-sm ${
              activeTab === 'config' 
                ? 'bg-gray-700 text-white border-l-4 border-l-blue-500' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Device Config</span>
          </button>
          
          <button
            onClick={() => setActiveTab('console')}
            className={`px-3 py-2.5 flex items-center space-x-2 border-b border-gray-700 text-sm ${
              activeTab === 'console' 
                ? 'bg-gray-700 text-white border-l-4 border-l-blue-500' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Console Logs</span>
          </button>
          
          <button
            onClick={() => setActiveTab('traffic')}
            className={`px-3 py-2.5 flex items-center space-x-2 border-b border-gray-700 text-sm ${
              activeTab === 'traffic' 
                ? 'bg-gray-700 text-white border-l-4 border-l-blue-500' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Traffic Monitor</span>
          </button>
          
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-2.5 flex items-center space-x-2 border-b border-gray-700 text-sm ${
              activeTab === 'security' 
                ? 'bg-gray-700 text-white border-l-4 border-l-blue-500' 
                : 'text-gray-400 hover:bg-gray-750'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>
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

