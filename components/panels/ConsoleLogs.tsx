'use client'

import { useEffect, useRef } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Info, AlertTriangle, AlertCircle, XCircle } from 'lucide-react'

export default function ConsoleLogs() {
  const { simulation } = useNetworkStore()
  const logsEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [simulation.logs])
  
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="w-3 h-3 text-blue-400" />
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-yellow-400" />
      case 'error':
        return <AlertCircle className="w-3 h-3 text-orange-400" />
      case 'critical':
        return <XCircle className="w-3 h-3 text-red-400" />
      default:
        return <Info className="w-3 h-3 text-gray-400" />
    }
  }
  
  return (
    <div className="h-full bg-black p-2 overflow-y-auto font-mono text-xs">
      {simulation.logs.length === 0 ? (
        <div className="text-gray-600 text-center py-8">
          Console ready. Waiting for events...
        </div>
      ) : (
        <div className="space-y-1">
          {simulation.logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2">
              {getLogIcon(log.level)}
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.deviceId && (
                <span className="text-cyan-400">
                  [{log.deviceId}]
                </span>
              )}
              <span className="text-gray-300 flex-1">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  )
}

