'use client'

import { Shield, Zap, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNetworkStore } from '@/store/networkStore'
import { AttackType } from '@/types/network'

const attackTypes = [
  { id: 'arp_poisoning', name: 'ARP Spoofing', severity: 'medium' as const },
  { id: 'dos', name: 'DoS Attack', severity: 'high' as const },
  { id: 'ddos', name: 'DDoS Attack', severity: 'critical' as const },
  { id: 'rogue_onu', name: 'Rogue ONU', severity: 'high' as const },
  { id: 'mac_flooding', name: 'MAC Flooding', severity: 'medium' as const },
  { id: 'mitm', name: 'Man-in-the-Middle', severity: 'high' as const },
  { id: 'packet_sniffing', name: 'Packet Sniffing', severity: 'medium' as const },
  { id: 'port_scan', name: 'Port Scan', severity: 'medium' as const },
  { id: 'unauthorized_access', name: 'Unauthorized Access', severity: 'critical' as const },
]

export function AttackPanel() {
  const { devices, simulation, launchAttack, addLog, applyImpactToNode, addPacket, connections } = useNetworkStore()

  const handleLaunchAttack = (attackType: typeof attackTypes[0]) => {
    if (devices.length < 2) {
      addLog({
        level: 'error',
        message: 'Need at least 2 devices to launch an attack',
      })
      return
    }

    const source = devices[0]
    const target = devices[devices.length - 1]

    const attackId = `attack-${Date.now()}`

    launchAttack({
      id: attackId,
      type: attackType.id as AttackType,
      name: attackType.name,
      description: attackType.name,
      sourceDeviceId: source.id,
      targetDeviceId: target.id,
      status: 'active',
      startTime: Date.now(),
      impact: {
        affectedDevices: [target.id],
        packetsDropped: 0,
        bandwidthConsumed: 0,
      },
    })

    addLog({
      level: 'warning',
      deviceId: target.id,
      message: `${attackType.name} attack initiated from ${source.name} to ${target.name}`,
    })

    applyImpactToNode(target.id, 1)

    // Generate attack packets
    const link = connections.find((l) => l.sourceDeviceId === source.id || l.targetDeviceId === target.id)
    if (link) {
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          const packetId = `packet-${Date.now()}-${i}`
          // Add packet to store - will be animated by PacketAnimation component
          addLog({
            level: 'warning',
            deviceId: source.id,
            message: `Attack packet ${i + 1}/20 sent to ${target.name}`,
          })
        }, i * 100)
      }
    }

    setTimeout(() => {
      applyImpactToNode(target.id, -1)
    }, 10000)

    addLog({
      level: 'error',
      message: `${attackType.name} launched!`,
      details: { source: source.name, target: target.name },
    })
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const activeAttacks = simulation.attacks.filter((a) => a.status === 'active')

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security & Attacks
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Launch network attacks for testing</p>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {attackTypes.map((attack) => (
          <Card key={attack.id} className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  {attack.name}
                </h4>
                <Badge variant={getSeverityColor(attack.severity)} className="mt-1 text-xs">
                  {attack.severity.toUpperCase()}
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => handleLaunchAttack(attack)}
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              disabled={devices.length < 2}
            >
              Launch Attack
            </Button>
          </Card>
        ))}

        {activeAttacks.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Active Attacks
            </h4>
            {activeAttacks.map((attack) => {
              const sourceDevice = devices.find((d) => d.id === attack.sourceDeviceId)
              const targetDevice = devices.find((d) => d.id === attack.targetDeviceId)

              return (
                <Card key={attack.id} className="p-3 mb-2 bg-destructive/10 border-destructive/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{attack.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sourceDevice?.name || attack.sourceDeviceId} → {targetDevice?.name || attack.targetDeviceId}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

