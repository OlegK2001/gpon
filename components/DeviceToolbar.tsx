'use client'

import { Server, Wifi, Radio, Router, Split, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNetworkStore } from '@/store/networkStore'
import { DeviceType } from '@/types/network'
import { t } from '@/i18n/ru'

const deviceTypes: { type: DeviceType; icon: LucideIcon; label: string }[] = [
  { type: 'OLT', icon: Server, label: 'OLT' },
  { type: 'ONU', icon: Wifi, label: 'ONU' },
  { type: 'ONT', icon: Wifi, label: 'ONT' },
  { type: 'SPLITTER', icon: Split, label: t('devices.splitter') },
  { type: 'ROUTER', icon: Router, label: t('devices.router') },
  { type: 'PC', icon: Radio, label: t('devices.pc') },
  { type: 'SERVER', icon: Server, label: t('devices.server') },
]

export function DeviceToolbar() {
  const { devices, addDevice } = useNetworkStore()

  const handleAddDevice = (type: DeviceType) => {
    const deviceId = `${type.toLowerCase()}-${Date.now()}`
    const portCount = type === 'OLT' ? 16 : type === 'ROUTER' ? 8 : 4

    // Calculate grid position for new device
    const gridSize = 150
    const deviceCount = devices.length
    const cols = Math.ceil(Math.sqrt(deviceCount + 1))
    const row = Math.floor(deviceCount / cols)
    const col = deviceCount % cols
    
    const centerX = 500
    const centerY = 300
    const offsetX = (col - cols / 2) * gridSize
    const offsetY = (row - cols / 2) * gridSize

    const newDevice = {
      id: deviceId,
      type,
      position: {
        x: centerX + offsetX,
        y: centerY + offsetY,
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
      <h3 className="text-sm font-semibold mb-2">{t('panels.addDevices')}</h3>
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

