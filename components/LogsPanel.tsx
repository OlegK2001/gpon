'use client'

import { useNetworkStore } from '@/store/networkStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

export function LogsPanel() {
  const { simulation } = useNetworkStore()
  const { logs } = simulation

  const getLogBadgeVariant = (level: string) => {
    switch (level) {
      case 'error':
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'secondary'
      default:
        return 'default'
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Журнал консоли</h3>
        <p className="text-xs text-muted-foreground mt-1">{logs.length} записей</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Пока нет записей. Запустите симуляцию, чтобы увидеть события.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-md bg-secondary/50 border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant={getLogBadgeVariant(log.level)} className="text-xs">
                    {log.level === 'info' ? 'Инфо' : log.level === 'warning' ? 'Предупреждение' : log.level === 'error' ? 'Ошибка' : log.level === 'critical' ? 'Критично' : log.level}
                  </Badge>
                </div>
                {log.deviceId && (
                  <div className="text-xs text-cyan-400 mb-1">[{log.deviceId}]</div>
                )}
                <div className="text-sm font-medium mb-1">{log.message}</div>
                {log.details && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

