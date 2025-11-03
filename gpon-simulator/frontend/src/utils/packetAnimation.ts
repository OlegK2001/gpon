/**
 * Packet animation system
 */

import { Point, getDistance } from './geometry'
import { trafficLogger } from './trafficLog'

export interface PacketConfig {
  srcId: string
  dstId: string
  protocol: string
  bytes: number
  color?: string
  speed?: number
  onComplete?: () => void
}

export interface Packet extends PacketConfig {
  id: string
  position: Point
  startPos: Point
  endPos: Point
  progress: number
  lifeStart: number
  trail: Point[]
}

export class PacketAnimationManager {
  private packets: Map<string, Packet> = new Map()
  private animating = false
  private frameId: number | null = null

  addPacket(config: PacketConfig, startPos: Point, endPos: Point) {
    const packet: Packet = {
      ...config,
      id: `packet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: { ...startPos },
      startPos,
      endPos,
      progress: 0,
      lifeStart: Date.now(),
      trail: [{ ...startPos }]
    }

    this.packets.set(packet.id, packet)

    if (!this.animating) {
      this.start()
    }

    return packet.id
  }

  private start() {
    this.animating = true
    this.frameId = requestAnimationFrame(() => this.animate())
  }

  private animate() {
    const now = Date.now()
    const deltaTime = 16 // ~60fps

    for (const [id, packet] of this.packets.entries()) {
      const speed = packet.speed || 0.02
      
      // Update progress
      packet.progress += speed

      if (packet.progress >= 1) {
        // Animation complete
        this.removePacket(id)
        
        // Log the event
        trafficLogger.log(
          packet.srcId,
          packet.dstId,
          packet.protocol,
          packet.bytes,
          packet.note || 'Packet delivered'
        )

        if (packet.onComplete) {
          packet.onComplete()
        }
      } else {
        // Update position
        const x = packet.startPos.x + (packet.endPos.x - packet.startPos.x) * packet.progress
        const y = packet.startPos.y + (packet.endPos.y - packet.startPos.y) * packet.progress
        packet.position = { x, y }

        // Add trail point (keep last 5 points)
        packet.trail.push({ x, y })
        if (packet.trail.length > 5) {
          packet.trail.shift()
        }
      }
    }

    if (this.packets.size > 0) {
      this.frameId = requestAnimationFrame(() => this.animate())
    } else {
      this.animating = false
      this.frameId = null
    }
  }

  removePacket(id: string) {
    this.packets.delete(id)
  }

  getPackets(): Packet[] {
    return Array.from(this.packets.values())
  }

  clear() {
    this.packets.clear()
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    this.animating = false
  }
}

// Singleton instance
export const packetAnimation = new PacketAnimationManager()

