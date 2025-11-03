'use client'

import { useNetworkStore } from '@/store/networkStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AttackConsole() {
  const { simulation, devices, connections, stopAttack } = useNetworkStore()
  const activeAttacks = simulation.attacks.filter(a => a.status === 'active')

  if (activeAttacks.length === 0) {
    return null
  }

  // Get attack steps for the first active attack
  const attack = activeAttacks[0]
  const sourceDevice = devices.find(d => d.id === attack.sourceDeviceId)
  const targetDevice = devices.find(d => d.id === attack.targetDeviceId)
  const attackerDevice = devices.find(d => d.id === `attacker-${attack.id}`)

  // Generate attack steps based on attack type
  const getAttackSteps = () => {
    const steps = []
    
    // Find connection path from attacker to target
    const attackerConnection = connections.find(c => 
      c.sourceDeviceId === `attacker-${attack.id}` || c.targetDeviceId === `attacker-${attack.id}`
    )
    
    const connectedDeviceId = attackerConnection?.sourceDeviceId === `attacker-${attack.id}` 
      ? attackerConnection.targetDeviceId 
      : attackerConnection?.sourceDeviceId
    const connectedDevice = devices.find(d => d.id === connectedDeviceId)
    
    steps.push({
      step: 1,
      time: '00:00',
      action: '🔴 Attacker connected to network',
      description: `Attacker device connected to ${connectedDevice?.name || targetDevice?.name || 'target device'}`
    })

    steps.push({
      step: 2,
      time: '00:01',
      action: `🎯 Scanning target: ${targetDevice?.name || 'target'}`,
      description: `Discovering ${targetDevice?.name || 'target device'} network configuration from ${connectedDevice?.name || 'network entry point'}`
    })

    switch (attack.type) {
      case 'dos':
      case 'ddos':
        steps.push({
          step: 3,
          time: '00:02',
          action: '💣 Sending flood packets',
          description: `Flooding ${targetDevice?.name || 'target'} with malicious packets (${attack.impact.packetsDropped || 0} sent)`
        })
        break
      case 'mitm':
        steps.push({
          step: 3,
          time: '00:02',
          action: '🔄 Intercepting traffic',
          description: `Redirecting traffic through attacker for ${targetDevice?.name || 'target'}`
        })
        break
      case 'arp_poisoning':
        steps.push({
          step: 3,
          time: '00:02',
          action: '☠️ Poisoning ARP table',
          description: `Sending fake ARP responses from ${connectedDevice?.name || attackerDevice?.name || 'attacker'} to ${targetDevice?.name || 'target'} to redirect traffic`
        })
        break
      case 'rogue_onu':
        steps.push({
          step: 3,
          time: '00:02',
          action: '👻 Unauthorized ONU detected',
          description: `Rogue ONU attempting to register with OLT`
        })
        break
      case 'mac_flooding':
        steps.push({
          step: 3,
          time: '00:02',
          action: '🌊 Flooding MAC table',
          description: `Overflowing switch MAC address table`
        })
        break
      case 'port_scan':
        steps.push({
          step: 3,
          time: '00:02',
          action: '🔍 Scanning ports',
          description: `Scanning ${targetDevice?.name || 'target'} for open ports`
        })
        break
      case 'packet_sniffing':
        steps.push({
          step: 3,
          time: '00:02',
          action: '👂 Capturing packets',
          description: `Listening to network traffic from ${targetDevice?.name || 'target'}`
        })
        break
      case 'unauthorized_access':
        steps.push({
          step: 3,
          time: '00:02',
          action: '🚪 Attempting access',
          description: `Trying to gain unauthorized access to ${targetDevice?.name || 'target'}`
        })
        break
    }

    steps.push({
      step: 4,
      time: '00:03',
      action: `⚠️ Impact: ${attack.impact.packetsDropped} packets dropped`,
      description: `${attack.impact.affectedDevices.length} device(s) affected`
    })

    return steps
  }

  const steps = getAttackSteps()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <Card className="border-0 rounded-none">
        <div className="flex items-center justify-between p-3 border-b border-border bg-destructive/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">
                🚨 Active Attack: {attack.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {attackerDevice?.name || 'Attacker'} → {targetDevice?.name || 'Target'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => stopAttack(attack.id)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-48">
          <div className="p-4 space-y-3">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex gap-3 p-2 rounded-md ${
                  idx === steps.length - 1 ? 'bg-destructive/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex-shrink-0 w-16 text-xs text-muted-foreground font-mono">
                  {step.time}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{step.action}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </div>
                </div>
                <div className="flex-shrink-0 w-6 text-xs text-muted-foreground">
                  #{step.step}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}

