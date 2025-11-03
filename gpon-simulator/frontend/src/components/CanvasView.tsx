import React, { useState, useEffect } from 'react'
import { Device, Link } from '../App'
import { TopologyCanvas } from './TopologyCanvas'
import { packetAnimation } from '../utils/packetAnimation'
import { trafficLogger } from '../utils/trafficLog'
import { ProjectStorage } from '../utils/projectStorage'
import { Save, FolderOpen, Play, Square, Gauge } from 'lucide-react'

interface CanvasViewProps {
  topology: { nodes: Device[], links: Link[] }
  onTopologyChange: (topology: { nodes: Device[], links: Link[] }) => void
  selectedDevice: Device | null
  onDeviceSelect: (device: Device | null) => void
}

export function CanvasView({ topology, onTopologyChange, selectedDevice, onDeviceSelect }: CanvasViewProps) {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [logs, setLogs] = useState<any[]>([])
  const packetTimers = React.useRef<NodeJS.Timeout[]>([])

  // Load persistent logs
  useEffect(() => {
    const saved = ProjectStorage.load()
    if (saved?.logs) {
      setLogs(saved.logs)
    }
  }, [])

  // Save logs to localStorage
  useEffect(() => {
    if (logs.length > 0) {
      localStorage.setItem('gpon_logs', JSON.stringify(logs.slice(-5000)))
    }
  }, [logs])

  const pushLog = (entry: any) => {
    const ts = new Date().toLocaleTimeString()
    const obj = { t: ts, ...entry }
    setLogs(prev => [...prev, obj])
  }

  function startSimulation() {
    if (running) return
    setRunning(true)
    pushLog({ event: 'Simulation started' })

    topology.links.forEach(link => {
      const timer = setInterval(() => {
        const from = topology.nodes.find(n => n.id === link.from)
        const to = topology.nodes.find(n => n.id === link.to)
        if (from && to) {
          // Add animated packet
          const { start, end } = computeEdgePoints(from, to)
          packetAnimation.addPacket({
            srcId: from.id,
            dstId: to.id,
            protocol: 'TCP',
            bytes: 512,
            color: 'blue'
          }, start, end)

          // Log event
          pushLog({ event: 'packet_sent', src: from.id, dst: to.id, proto: 'TCP', bytes: 512 })
        }
      }, 2000 / speed)
      packetTimers.current.push(timer)
    })
  }

  function stopSimulation() {
    setRunning(false)
    pushLog({ event: 'Simulation stopped' })
    packetTimers.current.forEach(t => clearInterval(t))
    packetTimers.current = []
  }

  function setSpeedAndApply(s: number) {
    setSpeed(s)
    if (running) {
      stopSimulation()
      setTimeout(() => startSimulation(), 50)
    }
  }

  function computeEdgePoints(from: Device, to: Device) {
    const radius = 28
    const A = { x: from.x, y: from.y }
    const B = { x: to.x, y: to.y }
    const dx = B.x - A.x
    const dy = B.y - A.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    
    return {
      start: { x: A.x + ux * radius, y: A.y + uy * radius },
      end: { x: B.x - ux * radius, y: B.y - uy * radius }
    }
  }

  function saveProject() {
    const payload = { topology, logs, version: '1.0' }
    ProjectStorage.save({ topology, logs } as any)
    pushLog({ event: 'project_saved' })

    // Also export file
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gpon_project_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadProject(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.topology) {
          onTopologyChange(data.topology)
          setLogs(data.logs || [])
          pushLog({ event: 'project_loaded' })
        }
      } catch (err) {
        pushLog({ event: 'load_failed', reason: String(err) })
        alert('Ошибка чтения файла')
      }
    }
    reader.readAsText(file)
  }

  function clearLogs() {
    setLogs([])
    localStorage.removeItem('gpon_logs')
    pushLog({ event: 'logs_cleared' })
  }

  function addNode(type: string = 'PC') {
    const id = `${type.toLowerCase()}-${Date.now()}`
    const node: Device = {
      id,
      type,
      name: id,
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 300
    }
    onTopologyChange({ ...topology, nodes: [...topology.nodes, node] })
    pushLog({ event: 'node_added', node: id })
  }

  function handleLinkCreate(from: string, to: string) {
    const newLink: Link = {
      from,
      to,
      type: 'eth',
      style: 'solid' as any
    }
    onTopologyChange({ ...topology, links: [...topology.links, newLink] })
    pushLog({ event: 'link_created', from, to })
  }

  function startDemoAttack() {
    const src = topology.nodes[0]
    const dst = topology.nodes[topology.nodes.length - 1]
    if (!src || !dst) return

    pushLog({ event: 'attack_started', src: src.id, dst: dst.id })

    const t = setInterval(() => {
      const { start, end } = computeEdgePoints(src, dst)
      packetAnimation.addPacket({
        srcId: src.id,
        dstId: dst.id,
        protocol: 'TCP',
        bytes: 1024,
        color: 'red',
        speed: 0.03
      }, start, end)
      pushLog({ event: 'attack_packet', src: src.id, dst: dst.id, proto: 'TCP', bytes: 1024 })
    }, 500 / speed)

    setTimeout(() => {
      clearInterval(t)
      pushLog({ event: 'attack_finished', src: src.id, dst: dst.id })
    }, 6000 / speed)
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
        <div className="text-lg font-semibold text-white">GPON Simulator v2.0</div>
        
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={saveProject}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
          >
            <Save size={14} />
            Сохранить
          </button>
          <label className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer flex items-center gap-1">
            <FolderOpen size={14} />
            Загрузить
            <input type="file" accept="application/json" className="hidden" onChange={e => loadProject(e.target.files?.[0] || null)} />
          </label>

          <button
            onClick={() => running ? stopSimulation() : startSimulation()}
            className={`px-3 py-1 rounded flex items-center gap-1 ${running ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            {running ? <Square size={14} /> : <Play size={14} />}
            {running ? 'Stop' : 'Start'}
          </button>

          <div className="flex items-center gap-1 px-3 py-1 bg-gray-700 rounded">
            <Gauge size={14} className="text-gray-300" />
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={speed}
              onChange={e => setSpeedAndApply(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-gray-300">{speed}x</span>
          </div>

          <button onClick={() => addNode('PC')} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded">+PC</button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
          <TopologyCanvas
            topology={topology}
            selectedDevice={selectedDevice}
            onDeviceSelect={onDeviceSelect}
            onLinkCreate={handleLinkCreate}
          />
        </div>

        {/* Logs panel */}
        <div className="w-80 flex flex-col gap-3">
          {/* Logs */}
          <div className="bg-gray-800 rounded-lg p-3 flex flex-col h-96">
            <div className="font-semibold text-white mb-2">Logs ({logs.length})</div>
            <div className="flex-1 overflow-auto bg-black rounded p-2">
              {logs.map((l, idx) => (
                <div key={idx} className="text-xs text-green-400 mb-1 font-mono">
                  [{l.t}] {l.event} {l.src ? ` ${l.src}→${l.dst}` : ''} {l.reason ? ` (${l.reason})` : ''}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={clearLogs} className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs">
                Clear
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `gpon_logs_${Date.now()}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  pushLog({ event: 'logs_exported' })
                }}
                className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
              >
                Export
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="font-semibold text-white mb-2">Quick Actions</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => addNode('Router')} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">
                Add Router
              </button>
              <button onClick={startDemoAttack} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs">
                Demo Attack
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

