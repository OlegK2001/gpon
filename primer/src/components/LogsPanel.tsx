import { useSimulatorStore } from '@/store/simulatorStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { LogEntry } from '@/types/network';

export const LogsPanel = () => {
  const { logs } = useSimulatorStore();

  const getLogBadgeVariant = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
      case 'attack':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Console Logs</h3>
        <p className="text-xs text-muted-foreground mt-1">{logs.length} entries</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No logs yet. Start the simulation to see events.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-md bg-secondary/50 border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{log.timestamp}</span>
                  <Badge variant={getLogBadgeVariant(log.type)} className="text-xs">
                    {log.type}
                  </Badge>
                </div>
                <div className="text-sm font-medium mb-1">
                  {log.source} → {log.target}
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.protocol} | {log.bytes} bytes | {log.result}
                </div>
                {log.message && <div className="text-xs mt-1 text-foreground/80">{log.message}</div>}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
