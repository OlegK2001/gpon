import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Link as LinkIcon, X } from 'lucide-react';
import { toast } from 'sonner';

export const ConnectionTool = () => {
  const { nodes, addLink, links } = useSimulatorStore();
  const [connectMode, setConnectMode] = useState(false);
  const [firstNode, setFirstNode] = useState<string | null>(null);

  const handleNodeClick = (nodeId: string) => {
    if (!connectMode) return;

    if (!firstNode) {
      setFirstNode(nodeId);
      toast.info(`First node selected: ${nodeId}`);
    } else {
      if (firstNode === nodeId) {
        toast.error('Cannot connect a node to itself');
        setFirstNode(null);
        return;
      }

      const existingLink = links.find(
        (l) => (l.source === firstNode && l.target === nodeId) || (l.source === nodeId && l.target === firstNode)
      );

      if (existingLink) {
        toast.error('Link already exists between these nodes');
        setFirstNode(null);
        return;
      }

      addLink({
        id: `link-${firstNode}-${nodeId}`,
        source: firstNode,
        target: nodeId,
        type: 'data',
        bandwidth: 1000,
        utilization: 0,
        status: 'active',
      });

      toast.success(`Connected ${firstNode} to ${nodeId}`);
      setFirstNode(null);
      setConnectMode(false);
    }
  };

  return (
    <div className="absolute top-20 left-4 z-10">
      <Button
        onClick={() => {
          setConnectMode(!connectMode);
          setFirstNode(null);
        }}
        variant={connectMode ? 'destructive' : 'default'}
        size="sm"
        className="gap-2"
      >
        {connectMode ? (
          <>
            <X className="w-4 h-4" />
            Cancel Connection
          </>
        ) : (
          <>
            <LinkIcon className="w-4 h-4" />
            Connect Devices
          </>
        )}
      </Button>

      {connectMode && (
        <div className="mt-2 p-3 bg-card border border-border rounded-md text-sm">
          {firstNode ? (
            <p>
              Selected: <span className="font-semibold">{firstNode}</span>
              <br />
              Click another device to connect
            </p>
          ) : (
            <p>Click a device to start</p>
          )}
        </div>
      )}

      {connectMode && (
        <div
          className="fixed inset-0 z-0"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const nodeElement = target.closest('[data-node-id]');
            if (nodeElement) {
              const nodeId = nodeElement.getAttribute('data-node-id');
              if (nodeId) handleNodeClick(nodeId);
            }
          }}
        />
      )}
    </div>
  );
};
