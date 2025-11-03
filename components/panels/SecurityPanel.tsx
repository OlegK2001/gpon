'use client'

import { useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Skull, Target, Play, Shield, AlertTriangle, X } from 'lucide-react'
import { AttackType } from '@/types/network'

const attackTypes: { type: AttackType; name: string; description: string; severity: string }[] = [
  { type: 'dos', name: 'DoS Attack', description: 'Flood target with packets', severity: 'high' },
  { type: 'ddos', name: 'DDoS Attack', description: 'Distributed denial of service', severity: 'critical' },
  { type: 'mitm', name: 'Man-in-the-Middle', description: 'Intercept communications', severity: 'high' },
  { type: 'arp_poisoning', name: 'ARP Poisoning', description: 'Poison ARP tables', severity: 'high' },
  { type: 'rogue_onu', name: 'Rogue ONU', description: 'Unauthorized GPON device', severity: 'high' },
  { type: 'mac_flooding', name: 'MAC Flooding', description: 'Overflow MAC table', severity: 'medium' },
  { type: 'port_scan', name: 'Port Scan', description: 'Scan for vulnerabilities', severity: 'medium' },
  { type: 'packet_sniffing', name: 'Packet Sniffing', description: 'Capture network traffic', severity: 'high' },
  { type: 'unauthorized_access', name: 'Unauthorized Access', description: 'Breach security', severity: 'critical' },
]

export default function SecurityPanel() {
  const { devices, simulation, launchAttack, stopAttack, setAttackMode, attackMode, addLog } = useNetworkStore()
  const [selectedAttackType, setSelectedAttackType] = useState<AttackType>('dos')
  
  const selectedAttack = attackTypes.find(a => a.type === selectedAttackType)
  
  const handleEnterAttackMode = () => {
    setAttackMode({
      type: selectedAttackType,
      step: 'select_source'
    })
    addLog({
      level: 'warning',
      message: `Entering attack mode: ${selectedAttack?.name}. Click on a device to select attack source.`
    })
  }
  
  const handleExitAttackMode = () => {
    setAttackMode(null)
    addLog({
      level: 'info',
      message: 'Attack mode cancelled'
    })
  }
  
  const handleLaunchAttack = (sourceId: string, targetId: string) => {
    if (!selectedAttack) return
    
    const attack = {
      id: `attack-${Date.now()}`,
      type: selectedAttackType,
      name: selectedAttack.name,
      description: selectedAttack.description,
      sourceDeviceId: sourceId,
      targetDeviceId: targetId,
      status: 'active' as const,
      startTime: Date.now(),
      impact: {
        affectedDevices: [targetId],
        packetsDropped: 0,
        bandwidthConsumed: 0,
      },
    }
    
    launchAttack(attack)
    setAttackMode(null) // Exit attack mode after launching
  }
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Attack Selection */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-white font-semibold mb-3 flex items-center">
            <Skull className="w-5 h-5 mr-2 text-red-400" />
            Attack Simulation
          </h3>
          
          <div className="space-y-2">
            {attackTypes.map(attack => (
              <div
                key={attack.type}
                onClick={() => setSelectedAttackType(attack.type)}
                className={`p-3 rounded cursor-pointer transition-all ${
                  selectedAttackType === attack.type
                    ? 'bg-red-900 border-2 border-red-500'
                    : 'bg-gray-700 border-2 border-transparent hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-white font-medium">{attack.name}</div>
                    <div className="text-xs text-gray-400">{attack.description}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs uppercase ${getSeverityColor(attack.severity)}`}>
                      {attack.severity}
                    </span>
                    {selectedAttackType === attack.type && (
                      <Target className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Attack Mode Instructions */}
        {selectedAttack && !attackMode && (
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 border border-blue-700">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="text-white font-semibold mb-2">How to Launch Attack:</h4>
                <ol className="text-sm text-gray-200 space-y-1 list-decimal list-inside">
                  <li>Selected: <strong>{selectedAttack.name}</strong></li>
                  <li>Click "Enter Attack Mode" button below</li>
                  <li>All devices will glow <span className="text-green-400">GREEN 🟢</span></li>
                  <li>Click on a device to select as attack source</li>
                  <li>Other devices will glow <span className="text-red-400">RED 🔴</span></li>
                  <li>Click on target device to launch attack</li>
                </ol>
                <button
                  onClick={handleEnterAttackMode}
                  className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors font-semibold"
                >
                  <Play className="w-4 h-4" />
                  <span>Enter Attack Mode</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Attack Mode Status */}
        {attackMode && (
          <div className="bg-yellow-900 rounded-lg p-4 border-2 border-yellow-500 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                <span className="text-white font-bold text-lg">⚠️ Attack Mode Active</span>
              </div>
              <button
                onClick={handleExitAttackMode}
                className="p-1.5 hover:bg-yellow-800 rounded bg-yellow-700"
                title="Exit Attack Mode"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="space-y-2">
              {attackMode.step === 'select_source' && (
                <div className="bg-yellow-800 p-3 rounded">
                  <p className="text-sm text-yellow-100 font-semibold mb-1">
                    STEP 1: Select Attack Source
                  </p>
                  <p className="text-xs text-yellow-200">
                    👉 All devices should be glowing <span className="text-green-400 font-bold">GREEN 🟢</span>
                  </p>
                  <p className="text-xs text-yellow-200">
                    👉 Click on any device to use as attack source
                  </p>
                </div>
              )}
              {attackMode.step === 'select_target' && attackMode.sourceDeviceId && (
                <div className="bg-yellow-800 p-3 rounded">
                  <p className="text-sm text-yellow-100 font-semibold mb-1">
                    STEP 2: Select Attack Target
                  </p>
                  <p className="text-xs text-yellow-200 mb-1">
                    ✓ Source: <span className="font-bold">{devices.find(d => d.id === attackMode.sourceDeviceId)?.name}</span>
                  </p>
                  <p className="text-xs text-yellow-200">
                    👉 Other devices should be glowing <span className="text-red-400 font-bold">RED 🔴</span>
                  </p>
                  <p className="text-xs text-yellow-200">
                    👉 Click on target device to launch attack
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Active Attacks */}
        {simulation.attacks.filter(a => a.status === 'active').length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 border border-red-700">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-400" />
              Active Attacks ({simulation.attacks.filter(a => a.status === 'active').length})
            </h3>
            <div className="space-y-2">
              {simulation.attacks
                .filter(a => a.status === 'active')
                .map(attack => {
                  const sourceDevice = devices.find(d => d.id === attack.sourceDeviceId)
                  const targetDevice = devices.find(d => d.id === attack.targetDeviceId)
                  
                  return (
                    <div key={attack.id} className="bg-red-900 bg-opacity-50 p-3 rounded border border-red-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-white font-semibold">{attack.name}</span>
                        </div>
                        <button
                          onClick={() => stopAttack(attack.id)}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                        >
                          Stop Attack
                        </button>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">Source:</span>
                          <span className="text-green-400">{sourceDevice?.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">Target:</span>
                          <span className="text-red-400">{targetDevice?.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white">
                            {Math.floor((Date.now() - attack.startTime) / 1000)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

