import { Attack, AttackType, NetworkDevice, Packet } from '@/types/network'

export class AttackSimulator {
  /**
   * Simulate a DoS (Denial of Service) attack
   */
  static simulateDoS(attack: Attack, targetDevice: NetworkDevice): {
    packetsGenerated: number
    bandwidthConsumed: number
    impact: string[]
  } {
    const packetsPerSecond = 10000
    const packetSize = 1500 // bytes
    const bandwidthConsumed = (packetsPerSecond * packetSize * 8) / 1000000 // Mbps
    
    const impact = [
      `Generating ${packetsPerSecond} packets/second`,
      `Consuming ${bandwidthConsumed.toFixed(2)} Mbps bandwidth`,
      `Target device ${targetDevice.name} experiencing high CPU load`,
      'Legitimate traffic may be affected'
    ]
    
    return {
      packetsGenerated: packetsPerSecond,
      bandwidthConsumed,
      impact
    }
  }
  
  /**
   * Simulate a DDoS (Distributed Denial of Service) attack
   */
  static simulateDDoS(attack: Attack, targetDevice: NetworkDevice, botnetSize: number = 100): {
    totalPacketsGenerated: number
    totalBandwidthConsumed: number
    impact: string[]
  } {
    const packetsPerBot = 1000
    const packetSize = 1500
    const totalPackets = packetsPerBot * botnetSize
    const totalBandwidth = (totalPackets * packetSize * 8) / 1000000
    
    const impact = [
      `Botnet of ${botnetSize} devices attacking`,
      `Total ${totalPackets} packets/second`,
      `Total bandwidth: ${totalBandwidth.toFixed(2)} Mbps`,
      `Target ${targetDevice.name} likely offline`,
      'Network infrastructure may be overwhelmed'
    ]
    
    return {
      totalPacketsGenerated: totalPackets,
      totalBandwidthConsumed: totalBandwidth,
      impact
    }
  }
  
  /**
   * Simulate Man-in-the-Middle attack
   */
  static simulateMitM(attack: Attack, devices: NetworkDevice[]): {
    interceptedPackets: number
    compromisedData: string[]
    impact: string[]
  } {
    const interceptedPackets = 50
    const compromisedData = [
      'Unencrypted HTTP traffic captured',
      'Login credentials intercepted',
      'Session cookies stolen',
      'DNS queries monitored'
    ]
    
    const impact = [
      'Attacker can read all traffic between devices',
      'Sensitive data may be compromised',
      'Attacker can modify packets in transit',
      'SSL/TLS stripping possible'
    ]
    
    return {
      interceptedPackets,
      compromisedData,
      impact
    }
  }
  
  /**
   * Simulate ARP Poisoning attack
   */
  static simulateARPPoisoning(attack: Attack, sourceDevice: NetworkDevice, targetDevice: NetworkDevice): {
    poisonedEntries: number
    affectedDevices: string[]
    impact: string[]
  } {
    const impact = [
      `Attacker ${sourceDevice.name} sending forged ARP responses`,
      `Target ${targetDevice.name}'s ARP cache poisoned`,
      'Traffic being redirected through attacker',
      'Gateway impersonation in progress'
    ]
    
    return {
      poisonedEntries: 2,
      affectedDevices: [targetDevice.id],
      impact
    }
  }
  
  /**
   * Simulate Rogue ONU attack (GPON-specific)
   */
  static simulateRogueONU(attack: Attack): {
    unauthorized: boolean
    spoofedSerial: string
    impact: string[]
  } {
    const spoofedSerial = this.generateFakeSerial()
    
    const impact = [
      'Unauthorized ONU attempting to register',
      `Spoofed serial number: ${spoofedSerial}`,
      'Attempting to steal bandwidth allocation',
      'May cause service disruption for legitimate ONUs',
      'OLT authentication should detect and block'
    ]
    
    return {
      unauthorized: true,
      spoofedSerial,
      impact
    }
  }
  
  /**
   * Simulate MAC Flooding attack
   */
  static simulateMACFlooding(attack: Attack, targetDevice: NetworkDevice): {
    fakeMACs: number
    tableOverflow: boolean
    impact: string[]
  } {
    const fakeMACCount = 10000
    const tableOverflow = fakeMACCount > 8192 // Typical switch MAC table size
    
    const impact = [
      `Generating ${fakeMACCount} fake MAC addresses`,
      tableOverflow ? 'Switch MAC table overflowed!' : 'MAC table filling up',
      tableOverflow ? 'Switch now operating in hub mode' : 'Switch performance degrading',
      'Traffic may be broadcast to all ports',
      'Packet sniffing now possible'
    ]
    
    return {
      fakeMACs: fakeMACCount,
      tableOverflow,
      impact
    }
  }
  
  /**
   * Simulate Port Scan attack
   */
  static simulatePortScan(attack: Attack, targetDevice: NetworkDevice): {
    portsScanned: number[]
    openPorts: number[]
    scanType: string
    impact: string[]
  } {
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 3306, 3389, 8080]
    const openPorts = commonPorts.filter(() => Math.random() > 0.7)
    
    const impact = [
      `Scanning ${commonPorts.length} common ports on ${targetDevice.name}`,
      `Found ${openPorts.length} open ports: ${openPorts.join(', ')}`,
      'Gathering information about services',
      'Preparing for potential exploitation'
    ]
    
    return {
      portsScanned: commonPorts,
      openPorts,
      scanType: 'SYN Scan',
      impact
    }
  }
  
  /**
   * Simulate Packet Sniffing
   */
  static simulatePacketSniffing(attack: Attack, packets: Packet[]): {
    capturedPackets: number
    sensitiveData: string[]
    protocols: string[]
    impact: string[]
  } {
    const capturedPackets = Math.min(packets.length, 100)
    const protocols = ['HTTP', 'FTP', 'TELNET', 'DNS', 'SMTP']
    const sensitiveData = [
      'Unencrypted passwords captured',
      'Email content intercepted',
      'File transfers monitored',
      'DNS queries logged'
    ]
    
    const impact = [
      `Capturing ${capturedPackets} packets`,
      'Analyzing for sensitive information',
      'Unencrypted protocols detected',
      'Credentials may be compromised'
    ]
    
    return {
      capturedPackets,
      sensitiveData,
      protocols,
      impact
    }
  }
  
  /**
   * Simulate Unauthorized Access attempt
   */
  static simulateUnauthorizedAccess(attack: Attack, targetDevice: NetworkDevice): {
    attemptsMade: number
    methodsUsed: string[]
    success: boolean
    impact: string[]
  } {
    const methods = [
      'Brute force password attack',
      'Default credentials tried',
      'Exploiting known vulnerabilities',
      'Social engineering attempt'
    ]
    
    const success = Math.random() > 0.8 // 20% success rate for demonstration
    
    const impact = success ? [
      '⚠️ UNAUTHORIZED ACCESS GAINED!',
      `Attacker has control of ${targetDevice.name}`,
      'Configuration can be modified',
      'Device can be used for lateral movement',
      'Critical security breach!'
    ] : [
      'Unauthorized access attempts detected',
      'All attempts blocked',
      'Firewall rules preventing access',
      'Strong authentication in place'
    ]
    
    return {
      attemptsMade: Math.floor(Math.random() * 100) + 10,
      methodsUsed: methods,
      success,
      impact
    }
  }
  
  /**
   * Detect if an attack is occurring based on network patterns
   */
  static detectAttack(
    packets: Packet[],
    device: NetworkDevice
  ): {
    detected: boolean
    attackType?: AttackType
    confidence: number
    indicators: string[]
  } {
    const indicators: string[] = []
    let confidence = 0
    let attackType: AttackType | undefined
    
    // Check for DoS patterns
    const packetsToDevice = packets.filter(p => p.destination === device.id)
    if (packetsToDevice.length > 100) {
      indicators.push('Abnormally high packet rate detected')
      confidence += 0.3
      attackType = 'dos'
    }
    
    // Check for port scan patterns
    const uniquePorts = new Set(packetsToDevice.map(p => p.data.destPort))
    if (uniquePorts.size > 20) {
      indicators.push('Multiple ports being probed')
      confidence += 0.4
      attackType = 'port_scan'
    }
    
    // Check for ARP anomalies
    const arpPackets = packets.filter(p => p.data.etherType === '0x0806')
    if (arpPackets.length > 50) {
      indicators.push('Excessive ARP traffic detected')
      confidence += 0.5
      attackType = 'arp_poisoning'
    }
    
    return {
      detected: confidence > 0.5,
      attackType,
      confidence,
      indicators
    }
  }
  
  /**
   * Generate a fake serial number for rogue ONU
   */
  private static generateFakeSerial(): string {
    const vendor = ['HWTC', 'ZTEG', 'ALCL', 'GPON'][Math.floor(Math.random() * 4)]
    const serial = Math.random().toString(36).substring(2, 10).toUpperCase()
    return `${vendor}${serial}`
  }
  
  /**
   * Calculate attack severity score
   */
  static calculateSeverity(attackType: AttackType): {
    score: number
    level: 'low' | 'medium' | 'high' | 'critical'
    description: string
  } {
    const severityMap: Record<AttackType, { score: number; level: 'low' | 'medium' | 'high' | 'critical'; description: string }> = {
      dos: { score: 7, level: 'high', description: 'Can disrupt service availability' },
      ddos: { score: 9, level: 'critical', description: 'Severe service disruption likely' },
      mitm: { score: 8, level: 'high', description: 'Data confidentiality compromised' },
      arp_poisoning: { score: 7, level: 'high', description: 'Network traffic can be intercepted' },
      rogue_onu: { score: 8, level: 'high', description: 'Unauthorized network access' },
      mac_flooding: { score: 6, level: 'medium', description: 'Switch security weakened' },
      port_scan: { score: 4, level: 'medium', description: 'Reconnaissance activity' },
      packet_sniffing: { score: 7, level: 'high', description: 'Sensitive data exposure' },
      unauthorized_access: { score: 10, level: 'critical', description: 'Complete system compromise' }
    }
    
    return severityMap[attackType]
  }
}


