import { useState, useEffect } from 'react'
import TopologyView from './components/TopologyView'
import { CanvasView } from './components/CanvasView'
import Sidebar from './components/Sidebar'
import MetricsPanel from './components/MetricsPanel'
import { ActiveAttacksPanel, ActiveAttack } from './components/ActiveAttacksPanel'
import { ProjectStorage, AutoSaveManager } from './utils/projectStorage'
import { packetAnimation } from './utils/packetAnimation'
import { Save, FolderOpen, Download } from 'lucide-react'

export interface Device {
  id: string
  type: string
  name: string
  model?: string
  x: number
  y: number
  status?: string
  serial?: string
  rx_level_dbm?: number
  authorized?: boolean
}

export interface Link {
  from: string
  to: string
  type: string
  utilization?: number
}

export interface Scenario {
  id: string
  name: string
  description: string
  category: string
  steps?: any[]
}

function App() {
  const [useNewView, setUseNewView] = useState(true) // Use new CanvasView by default
  
  const [topology, setTopology] = useState<{ nodes: Device[], links: Link[] }>({
    nodes: [
      { id: 'olt-1', type: 'OLT', name: 'OLT-1', model: 'OLT-ACME-1000', x: 420, y: 60 },
      { id: 'fgs-1', type: 'Splitter', name: 'FGS-1', x: 420, y: 180 },
      { id: 'ont-1', type: 'ONT', name: 'ONT-1', serial: 'ONT-A-0001', rx_level_dbm: -26, authorized: true, x: 240, y: 320 },
      { id: 'ont-2', type: 'ONT', name: 'ONT-2', serial: 'ONT-A-0002', rx_level_dbm: -32, authorized: true, x: 420, y: 320 },
      { id: 'ont-3', type: 'ONT', name: 'ONT-3', serial: 'ONT-A-0003', rx_level_dbm: -20, authorized: false, x: 600, y: 320 },
      { id: 'router-1', type: 'Router', name: 'Router-1', x: 240, y: 420 },
      { id: 'pc-1', type: 'Client', name: 'PC-1', x: 240, y: 520 },
      { id: 'switch-1', type: 'Switch', name: 'Switch-1', x: 420, y: 420 },
      { id: 'dhcp-1', type: 'Server', name: 'DHCP-Server', x: 80, y: 60 },
      { id: 'bras-1', type: 'Server', name: 'BRAS-1', x: 80, y: 140 },
    ],
    links: [
      { from: 'olt-1', to: 'fgs-1', type: 'pon' },
      { from: 'fgs-1', to: 'ont-1', type: 'pon_branch' },
      { from: 'fgs-1', to: 'ont-2', type: 'pon_branch' },
      { from: 'fgs-1', to: 'ont-3', type: 'pon_branch' },
      { from: 'ont-1', to: 'router-1', type: 'eth' },
      { from: 'router-1', to: 'pc-1', type: 'eth' },
      { from: 'olt-1', to: 'switch-1', type: 'mgmt' },
      { from: 'switch-1', to: 'dhcp-1', type: 'mgmt' },
      { from: 'switch-1', to: 'bras-1', type: 'mgmt' },
    ]
  })

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [activeAttacks, setActiveAttacks] = useState<ActiveAttack[]>([])
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  
  const scenarios: Scenario[] = [
    { id: 'dhcp_starvation_001', name: 'DHCP Starvation', description: 'Flood DHCP server', category: 'dhcp' },
    { id: 'omci_unauth_001', name: 'OMCI Unauthorized', description: 'Unauthorized OMCI ops', category: 'omci' },
    { id: 'arp_mitm_001', name: 'ARP MITM', description: 'ARP poisoning', category: 'arp' },
  ]

  // Auto-save setup
  useEffect(() => {
    if (!autoSaveEnabled) return

    const autoSave = new AutoSaveManager(() => {
      ProjectStorage.save({
        topology,
        activeScenarios: activeAttacks,
        canvasPositions: Object.fromEntries(
          topology.nodes.map(node => [node.id, { x: node.x, y: node.y }])
        )
      })
    }, 30000) // 30 seconds

    autoSave.start()
    return () => autoSave.stop()
  }, [topology, activeAttacks, autoSaveEnabled])

  // Load project on mount
  useEffect(() => {
    const saved = ProjectStorage.load()
    if (saved) {
      console.log('Loading saved project...')
      setTopology(saved.topology)
    }
  }, [])

  const handleDeviceSelect = (device: Device | null) => {
    setSelectedDevice(device)
  }

  const handleRunScenario = async (scenario: Scenario) => {
    console.log('Running scenario:', scenario.name)

    // Create active attack
    const attack: ActiveAttack = {
      id: `attack-${Date.now()}`,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startTime: new Date(),
      progress: 0,
      parameters: {},
      sources: [],
      targets: []
    }

    // Simulate attack based on scenario
    switch (scenario.id) {
      case 'dhcp_starvation_001':
        // Simulate DHCP starvation attack
        attack.parameters = { count: 30, duration: 60 }
        attack.sources = topology.nodes.filter(n => n.type === 'Client').slice(0, 3).map(n => n.id)
        attack.targets = ['dhcp-1']
        
        // Start packet flooding
        const interval = setInterval(() => {
          attack.sources.forEach(srcId => {
            const srcNode = topology.nodes.find(n => n.id === srcId)
            const targetNode = topology.nodes.find(n => n.id === 'dhcp-1')
            if (srcNode && targetNode) {
              packetAnimation.addPacket({
                srcId,
                dstId: 'dhcp-1',
                protocol: 'DHCP',
                bytes: 128,
                color: 'red',
                speed: 0.02
              }, 
              { x: srcNode.x + 50, y: srcNode.y + 50 },
              { x: targetNode.x + 50, y: targetNode.y + 50 }
              )
            }
          })
        }, 100)

        setTimeout(() => clearInterval(interval), 10000)
        break

      case 'arp_mitm_001':
        attack.parameters = { target: '192.168.1.1' }
        attack.sources = ['router-1']
        attack.targets = ['pc-1']
        break

      case 'omci_unauth_001':
        attack.parameters = { ont: 'ont-3', command: 'set_vlan' }
        attack.sources = ['olt-1']
        attack.targets = ['ont-3']
        break
    }

    setActiveAttacks(prev => [...prev, attack])

    // Simulate progress
    const progressInterval = setInterval(() => {
      setActiveAttacks(prev => 
        prev.map(a => 
          a.id === attack.id 
            ? { ...a, progress: Math.min(1, a.progress + 0.05) }
            : a
        )
      )

      if (attack.progress >= 1) {
        clearInterval(progressInterval)
      }
    }, 500)
  }

  const handleStopAttack = (attackId: string) => {
    setActiveAttacks(prev => prev.filter(a => a.id !== attackId))
  }

  const handleSaveProject = () => {
    ProjectStorage.save({
      topology,
      activeScenarios: activeAttacks
    })
    alert('Проект сохранён!')
  }

  const handleLoadProject = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const success = await ProjectStorage.importFromFile(file)
        if (success) {
          const saved = ProjectStorage.load()
          if (saved) {
            setTopology(saved.topology)
            setActiveAttacks(saved.activeScenarios || [])
            alert('Проект загружен!')
          }
        } else {
          alert('Ошибка загрузки проекта')
        }
      }
    }
    input.click()
  }

  const handleExportProject = () => {
    ProjectStorage.exportToFile()
  }

  // Use new CanvasView with integrated controls
  if (useNewView) {
    return (
      <CanvasView
        topology={topology}
        onTopologyChange={setTopology}
        selectedDevice={selectedDevice}
        onDeviceSelect={handleDeviceSelect}
      />
    )
  }

  // Legacy view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col h-screen">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">GPON Network Simulator</h1>
                <p className="text-sm text-gray-600">Система моделирования GPON-сетей и атак</p>
              </div>
              <button onClick={() => setUseNewView(true)} className="px-3 py-2 bg-purple-600 text-white rounded">
                Switch to New View
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-12 gap-4 p-4">
          <div className="col-span-3 space-y-4">
            <Sidebar scenarios={scenarios} onRunScenario={handleRunScenario} />
            <ActiveAttacksPanel attacks={activeAttacks} onStopAttack={handleStopAttack} />
          </div>

          <div className="col-span-9 flex flex-col space-y-4">
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200">
              <TopologyView topology={topology} onDeviceSelect={handleDeviceSelect} selectedDevice={selectedDevice} />
            </div>
            <MetricsPanel selectedDevice={selectedDevice} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
