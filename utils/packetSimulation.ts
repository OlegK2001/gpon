import { Packet, PacketData, NetworkDevice, Connection, OSILayer } from '@/types/network'

export class PacketSimulator {
  /**
   * Create a new packet with proper OSI layer encapsulation
   */
  static createPacket(
    source: NetworkDevice,
    destination: NetworkDevice,
    type: 'ping' | 'http' | 'https' | 'dns' | 'arp' | 'gpon',
    path: string[]
  ): Packet {
    const packetId = `packet-${Date.now()}-${Math.random()}`
    
    const data: PacketData = {
      // Layer 2 - Data Link
      sourceMac: source.macAddress,
      destMac: destination.macAddress,
      etherType: type === 'arp' ? '0x0806' : '0x0800',
      
      // Layer 3 - Network
      sourceIp: source.ipAddress,
      destIp: destination.ipAddress,
      protocol: type === 'ping' ? 'ICMP' : 'TCP',
      ttl: 64,
      
      // Layer 4 - Transport
      sourcePort: Math.floor(Math.random() * 60000) + 1024,
      destPort: type === 'http' ? 80 : type === 'https' ? 443 : type === 'dns' ? 53 : 0,
      flags: ['SYN'],
      
      // Layer 7 - Application
      payload: this.generatePayload(type),
    }
    
    // Add GPON specific data if applicable
    if (source.type === 'ONU' || source.type === 'ONT' || destination.type === 'ONU' || destination.type === 'ONT') {
      data.gponFrame = {
        gemPort: Math.floor(Math.random() * 4096),
        allocId: Math.floor(Math.random() * 256),
        onuId: Math.floor(Math.random() * 128),
      }
    }
    
    return {
      id: packetId,
      type: 'ip',
      source: source.id,
      destination: destination.id,
      data,
      path,
      currentPosition: 0,
      timestamp: Date.now(),
    }
  }
  
  /**
   * Generate payload based on packet type
   */
  private static generatePayload(type: string): string {
    switch (type) {
      case 'ping':
        return 'ICMP Echo Request'
      case 'http':
        return 'GET / HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n'
      case 'https':
        return 'TLS Handshake: Client Hello'
      case 'dns':
        return 'DNS Query: example.com'
      case 'arp':
        return 'ARP Request: Who has 192.168.1.1?'
      case 'gpon':
        return 'GPON Frame Data'
      default:
        return 'Generic Data Payload'
    }
  }
  
  /**
   * Calculate the path a packet should take through the network
   */
  static calculatePath(
    sourceId: string,
    destinationId: string,
    devices: NetworkDevice[],
    connections: Connection[]
  ): string[] {
    // Simple BFS pathfinding
    const queue: Array<{ deviceId: string; path: string[] }> = [
      { deviceId: sourceId, path: [sourceId] }
    ]
    const visited = new Set<string>([sourceId])
    
    while (queue.length > 0) {
      const current = queue.shift()!
      
      if (current.deviceId === destinationId) {
        return current.path
      }
      
      // Find all connected devices
      const connectedDevices = connections
        .filter(conn => 
          (conn.sourceDeviceId === current.deviceId || conn.targetDeviceId === current.deviceId) &&
          conn.status === 'active'
        )
        .map(conn => 
          conn.sourceDeviceId === current.deviceId ? conn.targetDeviceId : conn.sourceDeviceId
        )
        .filter(deviceId => !visited.has(deviceId))
      
      for (const deviceId of connectedDevices) {
        visited.add(deviceId)
        queue.push({
          deviceId,
          path: [...current.path, deviceId]
        })
      }
    }
    
    // No path found
    return [sourceId]
  }
  
  /**
   * Process packet at each OSI layer
   */
  static processAtLayer(packet: Packet, layer: OSILayer, device: NetworkDevice): {
    modified: boolean
    dropped: boolean
    reason?: string
  } {
    let modified = false
    let dropped = false
    let reason: string | undefined
    
    switch (layer) {
      case 'physical':
        // Check if physical connection exists
        if (device.status !== 'active') {
          dropped = true
          reason = 'Device is not active'
        }
        break
        
      case 'datalink':
        // Check MAC address filtering
        if (device.config.firewall?.enabled) {
          const blockedMacs = device.config.firewall.rules
            .filter(r => r.action === 'deny')
            .map(r => r.source)
          
          if (packet.data.sourceMac && blockedMacs.includes(packet.data.sourceMac)) {
            dropped = true
            reason = 'Source MAC blocked by firewall'
          }
        }
        
        // VLAN processing
        if (device.config.vlan && packet.data.vlan) {
          if (!device.config.vlan.includes(packet.data.vlan)) {
            dropped = true
            reason = 'VLAN not allowed on this device'
          }
        }
        break
        
      case 'network':
        // TTL decrement
        if (packet.data.ttl) {
          packet.data.ttl -= 1
          modified = true
          
          if (packet.data.ttl <= 0) {
            dropped = true
            reason = 'TTL expired'
          }
        }
        
        // Routing decisions
        if (device.type === 'ROUTER' && device.config.routing?.enabled) {
          // Check routing table
          const route = device.config.routing.routes.find(r => 
            packet.data.destIp?.startsWith(r.destination.split('/')[0])
          )
          
          if (!route) {
            dropped = true
            reason = 'No route to destination'
          }
        }
        break
        
      case 'transport':
        // Port filtering
        if (device.config.firewall?.enabled && packet.data.destPort) {
          const blocked = device.config.firewall.rules.some(rule => 
            rule.action === 'deny' && 
            rule.port === packet.data.destPort
          )
          
          if (blocked) {
            dropped = true
            reason = 'Destination port blocked by firewall'
          }
        }
        break
        
      case 'application':
        // Application-level processing
        // This is where protocols like HTTP, DNS, etc. are processed
        break
    }
    
    return { modified, dropped, reason }
  }
  
  /**
   * Get information about an OSI layer
   */
  static getLayerInfo(layer: OSILayer): {
    number: number
    name: string
    protocols: string[]
    description: string
  } {
    const layerMap = {
      physical: {
        number: 1,
        name: 'Physical Layer',
        protocols: ['Ethernet Physical', '1000BASE-T', 'GPON Physical'],
        description: 'Handles the physical transmission of raw bits over the network medium'
      },
      datalink: {
        number: 2,
        name: 'Data Link Layer',
        protocols: ['Ethernet', 'MAC', 'VLAN', 'PPP', 'GPON TC'],
        description: 'Provides node-to-node data transfer and handles error correction from physical layer'
      },
      network: {
        number: 3,
        name: 'Network Layer',
        protocols: ['IP', 'ICMP', 'ARP', 'IGMP'],
        description: 'Handles packet forwarding and routing through intermediate routers'
      },
      transport: {
        number: 4,
        name: 'Transport Layer',
        protocols: ['TCP', 'UDP', 'SCTP'],
        description: 'Provides reliable data transfer services to upper layers'
      },
      session: {
        number: 5,
        name: 'Session Layer',
        protocols: ['NetBIOS', 'RPC', 'PPTP'],
        description: 'Manages sessions between applications'
      },
      presentation: {
        number: 6,
        name: 'Presentation Layer',
        protocols: ['SSL/TLS', 'MIME', 'XDR'],
        description: 'Translates data between application and network format'
      },
      application: {
        number: 7,
        name: 'Application Layer',
        protocols: ['HTTP', 'HTTPS', 'DNS', 'FTP', 'SSH', 'SMTP'],
        description: 'Provides network services directly to end-user applications'
      }
    }
    
    return layerMap[layer]
  }
}

/**
 * GPON-specific simulation utilities
 */
export class GPONSimulator {
  /**
   * Calculate optical power budget
   */
  static calculatePowerBudget(
    oltPower: number, // in dBm
    distance: number, // in km
    splitterLoss: number, // in dB
    fiberLoss: number = 0.3 // dB/km
  ): number {
    const totalLoss = (distance * fiberLoss) + splitterLoss
    return oltPower - totalLoss
  }
  
  /**
   * Validate GPON connection
   */
  static validateConnection(
    olt: NetworkDevice,
    onu: NetworkDevice,
    distance: number
  ): { valid: boolean; reason?: string } {
    const maxDistance = olt.config.gponConfig?.maxDistance || 20
    
    if (distance > maxDistance) {
      return {
        valid: false,
        reason: `Distance ${distance}km exceeds maximum ${maxDistance}km`
      }
    }
    
    // Check power budget
    const receivedPower = this.calculatePowerBudget(5, distance, 16) // Typical 1:32 splitter
    if (receivedPower < -28) {
      return {
        valid: false,
        reason: `Insufficient optical power: ${receivedPower.toFixed(2)} dBm`
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Generate GPON frame
   */
  static generateGPONFrame(onuId: number, allocId: number, data: string) {
    return {
      preamble: '0x55555555',
      delimiter: '0xD5',
      onuId,
      allocId,
      payload: data,
      fcs: this.calculateFCS(data),
    }
  }
  
  /**
   * Calculate Frame Check Sequence (simplified)
   */
  private static calculateFCS(data: string): string {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data.charCodeAt(i)
    }
    return `0x${(sum & 0xFFFFFFFF).toString(16).toUpperCase()}`
  }
}


