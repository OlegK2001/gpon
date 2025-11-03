import React, { useRef, useState, useEffect } from 'react'
import { Device, Link } from '../App'
import { getLineEndpoints } from '../utils/geometry'
import { packetAnimation, Packet } from '../utils/packetAnimation'
import { trafficLogger } from '../utils/trafficLog'

interface TopologyCanvasProps {
  topology: { nodes: Device[], links: Link[] }
  onDeviceSelect: (device: Device | null) => void
  onLinkCreate?: (from: string, to: string) => void
  selectedDevice: Device | null
  scale?: number
  onPackets?: (packets: Packet[]) => void
}

const DEFAULT_NODE_RADIUS = 28
const MIN_CLICKABLE = 36

function vec(a: { x: number, y: number }, b: { x: number, y: number }) {
  return { x: b.x - a.x, y: b.y - a.y }
}

function len(v: { x: number, y: number }) {
  return Math.sqrt(v.x * v.x + v.y * v.y) || 1
}

function norm(v: { x: number, y: number }) {
  const L = len(v)
  return { x: v.x / L, y: v.y / L }
}

function add(a: { x: number, y: number }, b: { x: number, y: number }) {
  return { x: a.x + b.x, y: a.y + b.y }
}

function mul(v: { x: number, y: number }, s: number) {
  return { x: v.x * s, y: v.y * s }
}

function computeEdgePoints(a: { x: number, y: number, radius?: number }, b: { x: number, y: number, radius?: number }) {
  const A = { x: a.x, y: a.y }
  const B = { x: b.x, y: b.y }
  const v = vec(A, B)
  const u = norm(v)
  const rA = a.radius ?? DEFAULT_NODE_RADIUS
  const rB = b.radius ?? DEFAULT_NODE_RADIUS
  const P = add(A, mul(u, rA + 2))
  const Q = add(B, mul(u, -(rB + 2)))
  return { P, Q }
}

export function TopologyCanvas({
  topology,
  onDeviceSelect,
  onLinkCreate,
  selectedDevice,
  scale = 1,
  onPackets
}: TopologyCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [packets, setPackets] = useState<Packet[]>([])
  const [firstSelection, setFirstSelection] = useState<string | null>(null)

  // Subscribe to packet animation
  useEffect(() => {
    const interval = setInterval(() => {
      const activePackets = packetAnimation.getPackets()
      setPackets(activePackets)
      if (onPackets) onPackets(activePackets)
    }, 16)
    return () => clearInterval(interval)
  }, [onPackets])

  const nodeById = (id: string) => topology.nodes.find(n => n.id === id)

  function renderLinks() {
    return topology.links.map(link => {
      const A = nodeById(link.from)
      const B = nodeById(link.to)
      if (!A || !B) return null

      const { P, Q } = computeEdgePoints(
        { x: A.x, y: A.y, radius: DEFAULT_NODE_RADIUS * scale },
        { x: B.x, y: B.y, radius: DEFAULT_NODE_RADIUS * scale }
      )

      const dx = Q.x - P.x
      const dy = Q.y - P.y
      const angle = Math.atan2(dy, dx) * 180 / Math.PI

      const dash = link.style === 'dashed' ? '6 6' : '0'
      const color = link.type === 'pon' ? '#f6a21a' : 
                    link.type === 'mgmt' ? '#8b5cf6' :
                    link.type === 'eth' ? '#64748b' : '#2b8fff'

      return (
        <g key={link.from + '-' + link.to} className="link-group">
          <line
            x1={P.x} y1={P.y} x2={Q.x} y2={Q.y}
            stroke={color}
            strokeWidth={3}
            strokeDasharray={dash}
            strokeLinecap="round"
            pointerEvents="none"
          />
          <g transform={`translate(${Q.x},${Q.y}) rotate(${angle})`}>
            <path d="M0,0 L-10,-5 L-10,5 Z" fill={color} />
          </g>
          <text x={(P.x + Q.x) / 2} y={(P.y + Q.y) / 2 - 8} fontSize="11" fill="#cbd5e1" textAnchor="middle">
            {link.type}
          </text>
        </g>
      )
    })
  }

  function handleNodeClick(node: Device) {
    onDeviceSelect(node)
    
    if (!firstSelection) {
      setFirstSelection(node.id)
      return
    }

    if (firstSelection === node.id) {
      setFirstSelection(null)
      return
    }

    if (onLinkCreate) {
      onLinkCreate(firstSelection, node.id)
    }
    
    setFirstSelection(null)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      {/* SVG layer for links */}
      <svg ref={svgRef} width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        {renderLinks()}
        
        {/* Animated packets */}
        {packets.map(packet => (
          <g key={packet.id}>
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

      {/* Nodes (HTML) */}
      {topology.nodes.map(node => (
        <div
          key={node.id}
          onClick={() => handleNodeClick(node)}
          style={{
            position: 'absolute',
            left: node.x - DEFAULT_NODE_RADIUS * scale,
            top: node.y - DEFAULT_NODE_RADIUS * scale,
            width: DEFAULT_NODE_RADIUS * scale * 2,
            height: DEFAULT_NODE_RADIUS * scale * 2,
            cursor: 'pointer',
          }}
          title={`${node.name} (${node.type})`}
        >
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: DEFAULT_NODE_RADIUS * scale * 2 - 6,
              height: DEFAULT_NODE_RADIUS * scale * 2 - 6,
              borderRadius: '50%',
              background: selectedDevice?.id === node.id ? '#3b82f6' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              border: firstSelection === node.id ? '3px solid #f59e0b' : '2px solid #334155'
            }}>
              <div style={{ width: 22, height: 12, background: '#2b8fff', borderRadius: 3 }} />
            </div>
          </div>

          {/* Status dot */}
          <div style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: node.authorized ? '#10b981' : '#ef4444',
            border: '2px solid #0b1220'
          }} />

          {/* Label under node */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: DEFAULT_NODE_RADIUS * scale * 2 + 6,
            fontSize: 12,
            color: '#cbd5e1',
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
          }}>
            <div>{node.name}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>
              {node.type}{node.serial ? ` • ${node.serial}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

