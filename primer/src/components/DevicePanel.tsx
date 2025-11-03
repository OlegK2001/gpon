import { useSimulatorStore } from '@/store/simulatorStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Cpu, HardDrive, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const DevicePanel = () => {
  const { selectedNode, nodes, removeNode, setSelectedNode } = useSimulatorStore();

  const node = nodes.find((n) => n.id === selectedNode);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full bg-card border-l border-border">
        <p className="text-sm text-muted-foreground">Select a device to view details</p>
      </div>
    );
  }

  const handleDelete = () => {
    removeNode(node.id);
    setSelectedNode(null);
  };

  const getStatusColor = () => {
    switch (node.status) {
      case 'normal':
        return 'bg-success';
      case 'degraded':
        return 'bg-warning';
      case 'under_attack':
        return 'bg-status-attack';
      case 'failed':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Device Details</h3>
          <Button onClick={handleDelete} variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline">{node.type}</Badge>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>
        <p className="text-xs text-muted-foreground">{node.label}</p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Network Info
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP Address:</span>
              <span className="font-mono">{node.ip}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{node.status}</span>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Cpu className="w-3 h-3" />
            Performance
          </h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">CPU</span>
                <span>{node.metrics.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={node.metrics.cpu} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Memory</span>
                <span>{node.metrics.memory.toFixed(1)}%</span>
              </div>
              <Progress value={node.metrics.memory} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Uplink Util</span>
                <span>{node.metrics.uplinkUtil.toFixed(1)}%</span>
              </div>
              <Progress value={node.metrics.uplinkUtil} className="h-1.5" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <HardDrive className="w-3 h-3" />
            Traffic
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Incoming:</span>
              <span className="font-mono">{(node.trafficIn / 1024).toFixed(2)} KB/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outgoing:</span>
              <span className="font-mono">{(node.trafficOut / 1024).toFixed(2)} KB/s</span>
            </div>
          </div>
        </Card>

        {node.metrics.packetLoss > 0 && (
          <Card className="p-3 bg-destructive/10 border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-destructive mb-1">Network Issues</h4>
                <p className="text-xs text-muted-foreground">
                  Packet Loss: {node.metrics.packetLoss.toFixed(1)}%
                  <br />
                  Delay: {node.metrics.delay.toFixed(0)}ms
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
