'use client'

import NetworkCanvas from '@/components/NetworkCanvas'
import Toolbar from '@/components/Toolbar'
import DevicePanel from '@/components/DevicePanel'
import BottomPanel from '@/components/BottomPanel'

export default function Home() {
  return (
    <main className="flex h-screen w-screen bg-gray-100 overflow-hidden flex-col">
      {/* Top Toolbar - Cisco PT style */}
      <Toolbar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Devices (Cisco PT style) */}
        <DevicePanel />
        
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col bg-white">
          <NetworkCanvas />
        </div>
      </div>
      
      {/* Bottom Panel - Device Config & Logs (Cisco PT style) */}
      <BottomPanel />
    </main>
  )
}


