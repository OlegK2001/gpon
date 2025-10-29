'use client'

import { useNetworkStore } from '@/store/networkStore'
import { Monitor, Wifi, Network } from 'lucide-react'

export default function DeviceConfig() {
  const { devices, selectedDeviceId, updateDevice } = useNetworkStore()
  const device = devices.find(d => d.id === selectedDeviceId)
  
  if (!device) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a device to configure</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Device Header */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-600 rounded">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{device.name}</h3>
              <p className="text-sm text-gray-400">{device.type}</p>
            </div>
            <div className={`ml-auto px-3 py-1 rounded text-sm ${
              device.status === 'active' ? 'bg-green-600' :
              device.status === 'error' ? 'bg-red-600' : 'bg-gray-600'
            }`}>
              {device.status}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400">Device Name</label>
              <input
                type="text"
                value={device.name}
                onChange={(e) => updateDevice(device.id, { name: e.target.value })}
                className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Status</label>
              <select
                value={device.status}
                onChange={(e) => updateDevice(device.id, { status: e.target.value as any })}
                className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Network Configuration */}
        {(device.ipAddress !== undefined || device.macAddress) && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-semibold text-white mb-3">Network Configuration</h4>
            <div className="space-y-3">
              {device.ipAddress !== undefined && (
                <div>
                  <label className="text-xs text-gray-400">IP Address</label>
                  <input
                    type="text"
                    value={device.ipAddress || ''}
                    onChange={(e) => updateDevice(device.id, { ipAddress: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              )}
              
              {device.macAddress && (
                <div>
                  <label className="text-xs text-gray-400">MAC Address</label>
                  <input
                    type="text"
                    value={device.macAddress}
                    readOnly
                    className="w-full mt-1 bg-gray-700 text-gray-400 px-3 py-2 rounded border border-gray-600 font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* GPON Configuration for OLT */}
        {device.type === 'OLT' && device.config.gponConfig && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
              <Wifi className="w-4 h-4 mr-2" />
              GPON Configuration
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">Downstream Wavelength (nm)</label>
                <input
                  type="number"
                  value={device.config.gponConfig.wavelengthDown || 1490}
                  onChange={(e) => updateDevice(device.id, {
                    config: {
                      ...device.config,
                      gponConfig: {
                        ...device.config.gponConfig,
                        wavelengthDown: Number(e.target.value)
                      }
                    }
                  })}
                  className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400">Upstream Wavelength (nm)</label>
                <input
                  type="number"
                  value={device.config.gponConfig.wavelengthUp || 1310}
                  onChange={(e) => updateDevice(device.id, {
                    config: {
                      ...device.config,
                      gponConfig: {
                        ...device.config.gponConfig,
                        wavelengthUp: Number(e.target.value)
                      }
                    }
                  })}
                  className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400">Max Distance (km)</label>
                <input
                  type="number"
                  value={device.config.gponConfig.maxDistance || 20}
                  onChange={(e) => updateDevice(device.id, {
                    config: {
                      ...device.config,
                      gponConfig: {
                        ...device.config.gponConfig,
                        maxDistance: Number(e.target.value)
                      }
                    }
                  })}
                  className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400">Encryption</label>
                <select
                  value={device.config.gponConfig.encryptionEnabled ? 'enabled' : 'disabled'}
                  onChange={(e) => updateDevice(device.id, {
                    config: {
                      ...device.config,
                      gponConfig: {
                        ...device.config.gponConfig,
                        encryptionEnabled: e.target.value === 'enabled'
                      }
                    }
                  })}
                  className="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* ONU/ONT GPON Info */}
        {(device.type === 'ONU' || device.type === 'ONT') && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
              <Wifi className="w-4 h-4 mr-2" />
              GPON Registration
            </h4>
            {device.config.gponConfig?.onuId ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">ONU ID:</span>
                  <span className="text-green-400 font-mono">{device.config.gponConfig.onuId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Alloc ID:</span>
                  <span className="text-green-400 font-mono">{device.config.gponConfig.allocId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">GEM Port:</span>
                  <span className="text-green-400 font-mono">{device.config.gponConfig.gemPort}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Serial Number:</span>
                  <span className="text-white font-mono">{device.config.gponConfig.serialNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Registration Status:</span>
                  <span className="text-green-400">✓ Registered</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-yellow-400 text-sm">⚠ Not registered to OLT</p>
                <p className="text-gray-500 text-xs mt-1">Connect to OLT and start simulation</p>
              </div>
            )}
          </div>
        )}
        
        {/* Ports */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-semibold text-white mb-3">Ports ({device.ports.length})</h4>
          <div className="space-y-2">
            {device.ports.map(port => (
              <div key={port.id} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    port.status === 'up' ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                  <span className="text-white text-sm">Port {port.number}</span>
                  <span className="text-gray-400 text-xs capitalize">{port.type}</span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-400">
                  {port.speed && <span>{port.speed}</span>}
                  {port.duplex && <span className="capitalize">{port.duplex}</span>}
                  {port.connectedTo && <span className="text-green-400">Connected</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

