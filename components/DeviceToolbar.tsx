'use client'

import { Server, Wifi, Radio, Router, Network, Split } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNetworkStore } from '@/store/networkStore'
import { DeviceType } from '@/types/network'

const deviceTypes: { type: DeviceType; icon: any; label: string }[] = [
  { type: 'OLT', icon: Server, label: 'OLT' },
  { type: 'ONU', icon: Wifi, label: 'ONU' },
  { type: 'ONT', icon: Wifi, label: 'ONT' },
  { type: 'SPLITTER', icon: Split, label: 'Splitter' },
  { type: 'ROUTER', icon: Router, label: 'Router' },
  { type: 'SWITCH', icon: Network, label: 'Switch' },
  { type: 'PC', icon: Radio, label: 'PC' },
  { type: 'SERVER', icon: Server, label: 'Server' },
]

export function DeviceToolbar() {
  const { devices, addDevice } = useNetworkStore()

  const handleAddDevice = (type: DeviceType) => {
    const deviceId = `${type.toLowerCase()}-${Date.now()}`
    const portCount = type === 'OLT' ? 16 : type === 'ROUTER' || type === 'SWITCH' ? 8 : 4

    const newDevice = {
      id: deviceId,
      type,
      position: {
        x: 400 + Math.random() * 400,
        y: 200 + Math.random() * 400,
      },
      name: `${type}-${devices.filter((d) => d.type === type).length + 1}`,
      status: 'active' as const,
      ports: Array.from({ length: portCount }, (_, i) => ({
        id: `port-${deviceId}-${i + 1}`,
        number: i + 1,
        type:
          type === 'OLT' || type === 'ONU' || type === 'ONT' || type === 'SPLITTER'
            ? ('optical' as const)
            : ('ethernet' as const),
        status: 'down' as const,
        speed: '1Gbps',
        duplex: 'full' as const,
      })),
      config: {
        ...(type === 'OLT' && {
          gponConfig: {
            wavelengthDown: 1490,
            wavelengthUp: 1310,
            maxDistance: 20,
            encryptionEnabled: true,
          },
        }),
        ...(type === 'SPLITTER' && {
          gponConfig: {
            splitterRatio: '1:32',
          },
        }),
      },
      ipAddress: type === 'PC' || type === 'SERVER' || type === 'ROUTER' 
        ? `192.168.1.${Math.floor(Math.random() * 254) + 1}` 
        : undefined,
      macAddress: `${Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join(':')}`,
    }

    addDevice(newDevice)
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-card border-r border-border h-full">
      <h3 className="text-sm font-semibold mb-2">Add Devices</h3>
      {deviceTypes.map(({ type, icon: Icon, label }) => (
        <Button
          key={type}
          onClick={() => handleAddDevice(type)}
          variant="outline"
          size="sm"
          className="justify-start gap-2 w-full"
        >
          <Icon className="w-4 h-4" />
          {label}
        </Button>
      ))}
    </div>
  )
}

