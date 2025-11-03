import { useEffect, useState } from 'react';
import { Shield, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSimulatorStore } from '@/store/simulatorStore';
import { toast } from 'sonner';
import { NetworkLink, Packet } from '@/types/network';

const attackTypes = [
  { id: 'arp', name: 'ARP Spoofing', severity: 'medium' as const },
  { id: 'dhcp', name: 'DHCP Starvation', severity: 'high' as const },
  { id: 'omci', name: 'OMCI Spoof', severity: 'critical' as const },
  { id: 'ddos', name: 'DDoS Attack', severity: 'critical' as const },
  { id: 'rogue_onu', name: 'Rogue ONU', severity: 'high' as const },
  { id: 'mac_flood', name: 'MAC Flooding', severity: 'medium' as const },
];

const ATTACK_FLOWS: Record<string, { steps: { id: string; label: string; packetType?: Packet['type']; color?: string }[] }> = {
  arp: {
    steps: [
      { id: 'spoof', label: 'Send forged ARP replies to victim', packetType: 'attack', color: '#f97316' },
      { id: 'poison', label: 'Victim ARP table poisoned', packetType: 'attack', color: '#fb923c' },
      { id: 'mitm', label: 'Intercept and forward victim traffic', packetType: 'attack', color: '#ef4444' },
    ],
  },
  dhcp: {
    steps: [
      { id: 'discover', label: 'Flood DHCP DISCOVER messages', packetType: 'dhcp', color: '#22c55e' },
      { id: 'offer', label: 'Exhaust DHCP pool with fake clients', packetType: 'dhcp', color: '#4ade80' },
      { id: 'starvation', label: 'Legitimate clients cannot obtain lease', packetType: 'dhcp', color: '#16a34a' },
    ],
  },
  omci: {
    steps: [
      { id: 'craft', label: 'Craft malicious OMCI frames', packetType: 'omci', color: '#3b82f6' },
      { id: 'push', label: 'Push OMCI towards OLT', packetType: 'omci', color: '#60a5fa' },
      { id: 'effect', label: 'Attempt unauthorized configuration change', packetType: 'omci', color: '#1d4ed8' },
    ],
  },
  ddos: {
    steps: [
      { id: 'prep', label: 'Generate volumetric traffic from source', packetType: 'attack', color: '#dc2626' },
      { id: 'flood', label: 'Flood the target uplink', packetType: 'attack', color: '#ef4444' },
      { id: 'impact', label: 'Service degradation and packet drops', packetType: 'attack', color: '#f87171' },
    ],
  },
  rogue_onu: {
    steps: [
      { id: 'attach', label: 'Rogue ONU attaches to PON', packetType: 'omci', color: '#a855f7' },
      { id: 'register', label: 'Attempts registration to OLT', packetType: 'omci', color: '#8b5cf6' },
      { id: 'reject', label: 'OLT rejects unauthorized ONU', packetType: 'omci', color: '#7c3aed' },
    ],
  },
  mac_flood: {
    steps: [
      { id: 'spray', label: 'Send frames with random MACs', packetType: 'attack', color: '#eab308' },
      { id: 'table', label: 'Switch MAC table overflows', packetType: 'attack', color: '#facc15' },
      { id: 'fwd', label: 'Switch floods frames to all ports', packetType: 'attack', color: '#fde047' },
    ],
  },
};

export const AttackPanel = () => {
  const { nodes, addAttack, attacks, addLog, updateNode, addPacket, links, updateAttack } = useSimulatorStore();

  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedAttack, setSelectedAttack] = useState<typeof attackTypes[0] | null>(null);

  useEffect(() => {
    if (!sourceId && nodes[0]) setSourceId(nodes[0].id);
    if (!targetId && nodes[1]) setTargetId(nodes[1].id);
  }, [nodes, sourceId, targetId]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const findPath = (src: string, dst: string): { linkPath: NetworkLink[]; nodePath: string[] } | null => {
    const adj = new Map<string, { next: string; link: NetworkLink }[]>();
    links.forEach((l) => {
      if (!adj.has(l.source)) adj.set(l.source, []);
      if (!adj.has(l.target)) adj.set(l.target, []);
      adj.get(l.source)!.push({ next: l.target, link: l });
      adj.get(l.target)!.push({ next: l.source, link: l });
    });
    const queue: { n: string; path: string[]; lks: NetworkLink[] }[] = [{ n: src, path: [src], lks: [] }];
    const seen = new Set<string>([src]);
    while (queue.length) {
      const { n, path, lks } = queue.shift()!;
      if (n === dst) return { linkPath: lks, nodePath: path };
      const edges = adj.get(n) || [];
      for (const { next, link } of edges) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push({ n: next, path: [...path, next], lks: [...lks, link] });
        }
      }
    }
    return null;
  };

  const emitPacketsAlongPath = (linkPath: NetworkLink[], color: string, type: Packet['type'], totalBursts = 12, stepDelay = 90) => {
    let delay = 0;
    linkPath.forEach((lk) => {
      for (let i = 0; i < totalBursts; i++) {
        setTimeout(() => {
          addPacket({
            id: `packet-${lk.id}-${Date.now()}-${i}`,
            linkId: lk.id,
            color,
            startTime: Date.now(),
            duration: 800,
            size: 512,
            type,
          });
        }, delay + i * stepDelay);
      }
      delay += totalBursts * stepDelay + 120;
    });
    return delay;
  };

  const handleLaunchAttack = (attackType: typeof attackTypes[0]) => {
    if (!sourceId || !targetId) {
      toast.error('Select source and target devices');
      return;
    }
    if (sourceId === targetId) {
      toast.error('Source and target must be different');
      return;
    }
    const path = findPath(sourceId, targetId);
    if (!path || path.linkPath.length === 0) {
      toast.error('No path between selected devices');
      return;
    }

    const steps = ATTACK_FLOWS[attackType.id]?.steps || [];
    const attackId = `attack-${Date.now()}`;
    addAttack({
      id: attackId,
      name: attackType.name,
      type: attackType.id as any,
      source: sourceId,
      target: targetId,
      startTime: Date.now(),
      duration: Math.max(8000, steps.length * 2000),
      severity: attackType.severity,
      progress: 0,
      active: true,
    });

    updateNode(targetId, { status: 'under_attack' });
    addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      source: sourceId,
      target: targetId,
      protocol: attackType.id.toUpperCase(),
      bytes: 0,
      result: 'success',
      message: `${attackType.name} initiated (${steps.length} steps)`,
      type: 'attack',
    });

    // visualize steps
    let t = 0;
    steps.forEach((s, idx) => {
      setTimeout(() => {
        addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().split('T')[1].split('.')[0],
          source: sourceId,
          target: targetId,
          protocol: (s.packetType || 'attack').toUpperCase(),
          bytes: 1024,
          result: 'success',
          message: `Step ${idx + 1}/${steps.length}: ${s.label}`,
          type: 'attack',
        });
        emitPacketsAlongPath(path.linkPath, s.color || '#ff6b6b', s.packetType || 'attack');
        const progress = Math.round(((idx + 1) / Math.max(steps.length, 1)) * 100);
        updateAttack(attackId, { progress });
      }, t);
      t += 1800 + path.linkPath.length * 120;
    });

    setTimeout(() => {
      updateNode(targetId, { status: 'normal' });
      updateAttack(attackId, { active: false, progress: 100 });
      toast.error(`${attackType.name} completed`, { description: `${sourceId} → ${targetId}` });
    }, Math.max(3000, t + 500));
  };

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
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Source</label>
              <select
                className="w-full text-sm mt-1 bg-background border border-border rounded px-2 py-1"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">Select source</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target</label>
              <select
                className="w-full text-sm mt-1 bg-background border border-border rounded px-2 py-1"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">Select target</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.id}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedAttack && (
            <div className="mt-3">
              <div className="text-xs font-medium mb-2">Sequence: {selectedAttack.name}</div>
              <ol className="text-xs space-y-1">
                {(ATTACK_FLOWS[selectedAttack.id]?.steps || []).map((s, idx) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="inline-block w-5 h-5 rounded-full text-center text-[10px] bg-secondary">{idx + 1}</span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>

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
              onClick={() => { setSelectedAttack(attack); handleLaunchAttack(attack); }}
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              disabled={nodes.length < 2}
            >
              Launch
            </Button>
            {ATTACK_FLOWS[attack.id] && (
              <div className="mt-2 text-xs text-muted-foreground">
                {ATTACK_FLOWS[attack.id].steps.length} steps visualized
              </div>
            )}
          </Card>
        ))}

        {attacks.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Active Attacks
            </h4>
            {attacks.map((attack) => (
              <Card key={attack.id} className="p-3 mb-2 bg-destructive/10 border-destructive/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{attack.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {attack.source} → {attack.target}
                    </p>
                  </div>
                  <div className="text-xs">{attack.progress}%</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

