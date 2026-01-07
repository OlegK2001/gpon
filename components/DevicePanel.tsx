'use client'

import { useNetworkStore } from '@/store/networkStore'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Activity, Cpu, HardDrive, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DevicePanel() {
  const { 
    selectedDeviceId, 
    devices, 
    removeDevice, 
    selectDevice,
  } = useNetworkStore()
  
  const device = devices.find((d) => d.id === selectedDeviceId)

  if (!device) {
    return (
      <div className="flex items-center justify-center h-full bg-card border-l border-border">
        <p className="text-sm text-muted-foreground">Выберите устройство для просмотра деталей</p>
      </div>
    )
  }

  const handleDelete = () => {
    removeDevice(device.id)
    selectDevice(null)
  }

  const getStatusColor = () => {
    if (device.statusLevel !== undefined && device.statusLevel > 0) {
      switch (device.statusLevel) {
        case 1:
          return 'bg-warning'
        case 2:
          return 'bg-status-attack'
        case 3:
          return 'bg-destructive'
        default:
          return 'bg-success'
      }
    }
    
    switch (device.status) {
      case 'active':
        return 'bg-success'
      case 'error':
        return 'bg-destructive'
      default:
        return 'bg-muted'
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Детали устройства</h3>
          <Button onClick={handleDelete} variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline">{device.type}</Badge>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>
        <p className="text-xs text-muted-foreground">{device.name}</p>
        {device.serialNumber && (
          <p className="text-xs text-muted-foreground">Serial: {device.serialNumber}</p>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Сетевая информация
          </h4>
          <div className="space-y-1 text-xs">
            {device.ipAddress && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP-адрес:</span>
                <span className="font-mono">{device.ipAddress}</span>
              </div>
            )}
            {device.macAddress && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">MAC-адрес:</span>
                <span className="font-mono">{device.macAddress}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Статус:</span>
              <span className="capitalize">{device.status === 'active' ? 'Активно' : device.status === 'error' ? 'Ошибка' : 'Неактивно'}</span>
            </div>
            {device.statusLevel !== undefined && device.statusLevel > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Уровень статуса:</span>
                <span className={device.statusLevel === 3 ? 'text-destructive' : device.statusLevel === 2 ? 'text-status-attack' : 'text-warning'}>
                  {device.statusLevel === 3 ? 'Критический' : device.statusLevel === 2 ? 'Средний' : 'Предупреждение'}
                </span>
              </div>
            )}
          </div>
        </Card>

        {(device.type === 'OLT' || device.type === 'ONU' || device.type === 'ONT') && device.config.gponConfig && (
          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-2">Конфигурация GPON</h4>
            <div className="space-y-1 text-xs">
              {device.config.gponConfig.onuId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID ONU:</span>
                  <span className="font-mono">{device.config.gponConfig.onuId}</span>
                </div>
              )}
              {device.config.gponConfig.allocId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID выделения:</span>
                  <span className="font-mono">{device.config.gponConfig.allocId}</span>
                </div>
              )}
              {device.config.gponConfig.gemPort && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GEM порт:</span>
                  <span className="font-mono">{device.config.gponConfig.gemPort}</span>
                </div>
              )}
              {device.config.gponConfig.wavelengthDown && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Нисходящий λ:</span>
                  <span>{device.config.gponConfig.wavelengthDown} нм</span>
                </div>
              )}
              {device.config.gponConfig.wavelengthUp && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Восходящий λ:</span>
                  <span>{device.config.gponConfig.wavelengthUp} нм</span>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
            <HardDrive className="w-3 h-3" />
            Порты ({device.ports.length})
          </h4>
          <div className="space-y-2">
            {device.ports.map((port) => (
              <div key={port.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${port.status === 'up' ? 'bg-success' : 'bg-muted'}`} />
                  <span>Порт {port.number}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {port.type === 'optical' ? 'Оптический' : port.type === 'ethernet' ? 'Ethernet' : port.type}
                  </Badge>
                </div>
                {port.speed && <span className="text-muted-foreground">{port.speed}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
