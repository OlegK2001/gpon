import { Server, Wifi, Radio, Router, Network, Cloud as CloudIcon, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulatorStore } from '@/store/simulatorStore';
import { DeviceType } from '@/types/network';
import { toast } from 'sonner';

const deviceTypes: { type: DeviceType; icon: any; label: string }[] = [
  { type: 'OLT', icon: Server, label: 'OLT' },
  { type: 'ONT', icon: Wifi, label: 'ONT' },
  { type: 'CPE', icon: Radio, label: 'CPE' },
  { type: 'Router', icon: Router, label: 'Router' },
  { type: 'Switch', icon: Network, label: 'Switch' },
  { type: 'Cloud', icon: CloudIcon, label: 'Cloud' },
  { type: 'Core', icon: Boxes, label: 'Provider Core' },
  { type: 'DHCP', icon: Server, label: 'DHCP' },
];

export const DeviceToolbar = () => {
  const { addNode, nodes } = useSimulatorStore();

  const handleAddDevice = (type: DeviceType) => {
    const id = `${type}-${nodes.filter((n) => n.type === type).length + 1}`;
    const position = {
      x: 400 + Math.random() * 400,
      y: 200 + Math.random() * 400,
    };

    addNode({
      id,
      type,
      position,
      ip: `192.168.1.${nodes.length + 1}`,
      status: 'normal',
      radius: 30,
      label: id,
      metrics: {
        cpu: 0,
        memory: 0,
        uplinkUtil: 0,
        packetLoss: 0,
        delay: 0,
      },
      trafficIn: 0,
      trafficOut: 0,
    });

    toast.success(`${type} device added`);
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-card border-r border-border">
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
  );
};
