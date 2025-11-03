import React, { useState, useEffect } from 'react'
import { Stop, PlayCircle } from 'lucide-react'
import { packetAnimation } from '../utils/packetAnimation'

export interface ActiveAttack {
  id: string
  scenarioId: string
  scenarioName: string
  startTime: Date
  progress: number
  parameters: Record<string, any>
  sources: string[]
  targets: string[]
}

interface ActiveAttacksPanelProps {
  attacks: ActiveAttack[]
  onStopAttack: (attackId: string) => void
}

export function ActiveAttacksPanel({ attacks, onStopAttack }: ActiveAttacksPanelProps) {
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null)

  const getProgressColor = (progress: number): string => {
    if (progress < 0.3) return 'bg-green-500'
    if (progress < 0.7) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const formatDuration = (startTime: Date): string => {
    const seconds = Math.floor((Date.now() - startTime.getTime()) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (attacks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <PlayCircle size={16} />
          <span>Нет активных атак</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-sm mb-3">Активные атаки</h3>
      <div className="space-y-3">
        {attacks.map(attack => (
          <div
            key={attack.id}
            className={`border rounded-lg p-3 transition-all ${
              highlightedPath === attack.id ? 'border-red-500 bg-red-50' : 'border-gray-200'
            }`}
            onMouseEnter={() => setHighlightedPath(attack.id)}
            onMouseLeave={() => setHighlightedPath(null)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{attack.scenarioName}</div>
                <div className="text-xs text-gray-500">
                  {attack.sources.length} sources → {attack.targets.length} targets
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Время: {formatDuration(attack.startTime)}
                </div>
              </div>
              <button
                onClick={() => onStopAttack(attack.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Остановить"
              >
                <Stop size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className={`${getProgressColor(attack.progress)} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${attack.progress * 100}%` }}
              />
            </div>

            {/* Parameters */}
            <div className="text-xs text-gray-600">
              Параметры:{' '}
              {Object.entries(attack.parameters)
                .map(([key, value]) => `${key}=${value}`)
                .join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

