'use client'

import NetworkCanvas from '@/components/NetworkCanvas'
import { ControlPanel } from '@/components/ControlPanel'
import { DeviceToolbar } from '@/components/DeviceToolbar'
import { DevicePanel } from '@/components/DevicePanel'
import { LogsPanel } from '@/components/LogsPanel'
import { AttackPanel } from '@/components/AttackPanel'
import { AttackConsole } from '@/components/AttackConsole'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Network } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Network className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">GPON Network Simulator</h1>
              <p className="text-xs text-muted-foreground">Professional Network Testing & Analysis</p>
            </div>
          </div>
        </div>
        <ControlPanel />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Device Toolbar */}
        <div className="w-48">
          <DeviceToolbar />
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 relative">
          <NetworkCanvas />
        </div>

        {/* Right Sidebar - Tabs */}
        <div className="w-80">
          <Tabs defaultValue="device" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-card border-b border-border rounded-none">
              <TabsTrigger value="device">Device</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="attacks">Security</TabsTrigger>
            </TabsList>
            <TabsContent value="device" className="flex-1 m-0 overflow-hidden">
              <DevicePanel />
            </TabsContent>
            <TabsContent value="logs" className="flex-1 m-0 overflow-hidden">
              <LogsPanel />
            </TabsContent>
            <TabsContent value="attacks" className="flex-1 m-0 overflow-hidden">
              <AttackPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Attack Console at bottom */}
      <AttackConsole />
    </div>
  )
}


