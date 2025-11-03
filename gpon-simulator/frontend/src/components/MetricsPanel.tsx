import { Activity, Database, Shield, Clock } from 'lucide-react'

interface MetricsPanelProps {
  selectedDevice: any
}

function MetricsPanel({ selectedDevice }: MetricsPanelProps) {
  const metrics = [
    { label: 'DHCP leases', value: '12/50', icon: Database },
    { label: 'Uplink util', value: '22%', icon: Activity },
    { label: 'ONT online', value: '2/3', icon: Shield },
    { label: 'Alerts', value: '0', icon: Clock },
  ]

  const logs = [
    '[omci] 12:01:05: OMCI set VLAN on ont-3 -> success',
    '[dhcp] 12:01:10: DHCP discover flood detected from 30 hosts',
    '[netflow] 12:01:12: uplink spike -> 85% util',
    '[arp] 12:01:15: ARP poisoning detected',
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Логи и метрики</h3>
        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">Live</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <metric.icon size={16} className="text-gray-600" />
              <div className="text-xs text-gray-600">{metric.label}</div>
            </div>
            <div className="text-lg font-bold text-gray-900">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="font-medium text-sm mb-2">Последние события</h4>
        <div className="h-32 overflow-y-auto bg-gray-900 text-green-400 text-xs p-3 rounded font-mono">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MetricsPanel

