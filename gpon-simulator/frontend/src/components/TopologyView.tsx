import { useEffect, useRef, useState } from 'react'
import { Device, Link } from '../App'
import { getLineEndpoints } from '../utils/geometry'
import { packetAnimation, Packet } from '../utils/packetAnimation'
import { TrafficLogView } from './TrafficLogView'

interface TopologyViewProps {
  topology: { nodes: Device[], links: Link[] }
  onDeviceSelect: (device: Device | null) => void
  selectedDevice: Device | null
  showLabels?: boolean
  scale?: number
}

const NODE_RADIUS = 40 // Reduced from default
const NODE_CENTER_OFFSET = 50 // Offset from top-left to center

function TopologyView({ 
  topology, 
  onDeviceSelect, 
  selectedDevice,
  showLabels = true,
  scale = 1
}: TopologyViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [packets, setPackets] = useState<Packet[]>([])
  const [showLogs, setShowLogs] = useState(false)

  // Subscribe to packet animation updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPackets(packetAnimation.getPackets())
    }, 16) // ~60fps

    return () => clearInterval(interval)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      packetAnimation.clear()
    }
  }, [])

  const getDeviceColor = (device: Device) => {
    if (selectedDevice?.id === device.id) return 'border-primary-600 bg-primary-50'
    
    switch (device.type) {
      case 'OLT':
        return 'border-blue-500 bg-blue-50'
      case 'ONT':
        return device.authorized ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
      case 'Splitter':
        return 'border-gray-400 bg-gray-50'
      case 'Router':
        return 'border-purple-500 bg-purple-50'
      case 'Client':
        return 'border-yellow-500 bg-yellow-50'
      case 'Server':
        return 'border-indigo-500 bg-indigo-50'
      case 'Switch':
        return 'border-cyan-500 bg-cyan-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const getLinkColor = (link: Link) => {
    switch (link.type) {
      case 'pon':
        return 'stroke-blue-400'
      case 'pon_branch':
        return 'stroke-green-400'
      case 'eth':
        return 'stroke-gray-400'
      case 'mgmt':
        return 'stroke-purple-400'
      default:
        return 'stroke-gray-400'
    }
  }

  const getLinkStrokeDash = (link: Link): string => {
    // Add dashed line styles based on link type
    if (link.type === 'pon_branch') {
      return '5,5'
    }
    return '0'
  }

  // Click handler for sending test packet
  const handleSendPacket = (fromNode: Device, toNode: Device) => {
    const fromCenter = { x: fromNode.x + NODE_CENTER_OFFSET, y: fromNode.y + NODE_CENTER_OFFSET }
    const toCenter = { x: toNode.x + NODE_CENTER_OFFSET, y: toNode.y + NODE_CENTER_OFFSET }
    
    const { start, end } = getLineEndpoints(fromCenter, toCenter, NODE_RADIUS, NODE_RADIUS)
    
    packetAnimation.addPacket({
      srcId: fromNode.id,
      dstId: toNode.id,
      protocol: 'TCP',
      bytes: 512,
      color: 'blue',
      speed: 0.01
    }, start, end)
  }

  const renderArrow = (x: number, y: number, angle: number) => {
    const rad = (angle * Math.PI) / 180
    const size = 8
    const x1 = x - size * Math.cos(rad + 0.5)
    const y1 = y - size * Math.sin(rad + 0.5)
    const x2 = x - size * Math.cos(rad - 0.5)
    const y2 = y - size * Math.sin(rad - 0.5)

    return (
      <polygon
        points={`${x},${y} ${x1},${y1} ${x2},${y2}`}
        fill="currentColor"
      />
    )
  }

  return (
    <div className="h-full flex relative">
      <div className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden" ref={canvasRef}>
        {/* SVG for links with arrow markers */}
        <svg 
          ref={svgRef}
          className="absolute inset-0 pointer-events-none" 
          width="100%" 
          height="100%"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
            </marker>
          </defs>

          {/* Links/lines */}
          {topology.links.map((link, index) => {
            const fromNode = topology.nodes.find(n => n.id === link.from)
            const toNode = topology.nodes.find(n => n.id === link.to)
            
            if (!fromNode || !toNode) return null
            
            const fromCenter = { x: fromNode.x + NODE_CENTER_OFFSET, y: fromNode.y + NODE_CENTER_OFFSET }
            const toCenter = { x: toNode.x + NODE_CENTER_OFFSET, y: toNode.y + NODE_CENTER_OFFSET }
            
            const { start, end, angle } = getLineEndpoints(
              fromCenter, 
              toCenter, 
              NODE_RADIUS * scale, 
              NODE_RADIUS * scale
            )
            
            return (
              <g key={index}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  strokeWidth="2"
                  strokeDasharray={getLinkStrokeDash(link)}
                  className={getLinkColor(link)}
                  markerEnd="url(#arrowhead)"
                />
                {/* Link label */}
                {showLabels && (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#666"
                    className="pointer-events-auto"
                  >
                    {link.type}
                  </text>
                )}
              </g>
            )
          })}

          {/* Animated packets */}
          {packets.map(packet => (
            <g key={packet.id}>
              {/* Trail */}
              {packet.trail.map((point, i) => (
                <circle
                  key={`trail-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r={2}
                  fill={packet.color || 'blue'}
                  opacity={0.2}
                />
              ))}
              {/* Packet */}
              <circle
                cx={packet.position.x}
                cy={packet.position.y}
                r={4}
                fill={packet.color || 'blue'}
                className="pointer-events-auto"
              />
            </g>
          ))}
        </svg>

        {/* Nodes */}
        <div className="absolute inset-0">
          {topology.nodes.map((node) => (
            <div
              key={node.id}
              onClick={() => onDeviceSelect(node)}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
              }}
              className={`absolute cursor-pointer transform transition-all ${getDeviceColor(node)}`}
            >
              <div className="w-24 border-2 rounded-lg p-2 text-center shadow-md hover:shadow-lg transition-shadow">
                <div className="font-semibold text-xs text-gray-900 truncate">{node.name}</div>
                <div className="text-[10px] text-gray-600 mt-1">{node.type}</div>
                {showLabels && node.rx_level_dbm !== undefined && (
                  <div className="text-[10px] text-gray-500 mt-1">Rx: {node.rx_level_dbm} dBm</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm border border-gray-300 rounded-lg p-3 text-xs">
          <div className="font-semibold mb-2">Легенда</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-400"></div>
              <span>PON</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-400 border-dashed border-t-2"></div>
              <span>PON Branch</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gray-400"></div>
              <span>Ethernet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-purple-400"></div>
              <span>Management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device info panel */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">Информация об устройстве</h3>
        {selectedDevice ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-600">ID</div>
              <div className="font-mono text-sm">{selectedDevice.id}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Тип</div>
              <div className="text-sm font-medium">{selectedDevice.type}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Имя</div>
              <div className="text-sm">{selectedDevice.name}</div>
            </div>
            {selectedDevice.model && (
              <div>
                <div className="text-xs text-gray-600">Модель</div>
                <div className="text-sm">{selectedDevice.model}</div>
              </div>
            )}
            {selectedDevice.serial && (
              <div>
                <div className="text-xs text-gray-600">Серийный номер</div>
                <div className="font-mono text-sm">{selectedDevice.serial}</div>
              </div>
            )}
            {selectedDevice.rx_level_dbm !== undefined && (
              <div>
                <div className="text-xs text-gray-600">Уровень приёма</div>
                <div className="text-sm">{selectedDevice.rx_level_dbm} dBm</div>
              </div>
            )}
            {selectedDevice.authorized !== undefined && (
              <div>
                <div className="text-xs text-gray-600">Авторизован</div>
                <div className={`text-sm font-medium ${selectedDevice.authorized ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedDevice.authorized ? 'Да' : 'Нет'}
                </div>
              </div>
            )}
            
            <div className="border-t pt-3 mt-3">
              <div className="text-xs text-gray-600 mb-2">Быстрые действия</div>
              <div className="flex flex-col gap-2">
                <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors">
                  SSH
                </button>
                <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-sm rounded transition-colors"
                >
                  Логи
                </button>
                <button className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-sm rounded transition-colors">
                  Set as Attack Source
                </button>
                <button className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-sm rounded transition-colors">
                  Start Traffic
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Выберите устройство на карте</div>
        )}

        {/* Traffic logs */}
        {showLogs && (
          <div className="mt-4 border-t pt-4">
            <TrafficLogView />
          </div>
        )}
      </div>
    </div>
  )
}

export default TopologyView
