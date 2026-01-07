'use client'

import { useState } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { Shield, Play, Square, AlertTriangle } from 'lucide-react'
import { AttackType } from '@/types/network'

interface AttackCard {
  type: AttackType
  name: string
  description: string
  icon: string
  level: 'low' | 'medium' | 'high' | 'critical'
  requiresTarget?: boolean
}

const attackCards: AttackCard[] = [
  {
    type: 'EAVESDROP',
    name: 'Прослушивание нисходящего канала',
    description: 'Перехват и анализ нисходящего трафика от OLT',
    icon: '👂',
    level: 'high',
    requiresTarget: true,
  },
  // BRUTEFORCE_ID и UNAUTHORIZED_ONT объединены в ONT_SPOOF - скрыты
  {
    type: 'ONT_SPOOF',
    name: 'Подмена ONT',
    description: 'Вставка сплиттера в линию, подключение вредоносного ONT и подбор двухзначного ID целевого ONT/ONU',
    icon: '🎭',
    level: 'critical',
    requiresTarget: true,
  },
  {
    type: 'DDOS',
    name: 'DDoS / Upstream flood',
    description: 'Спам сообщениями для зашумления канала и перегрузки OLT',
    icon: '💥',
    level: 'critical',
    requiresTarget: true,
  },
]

export default function AttacksPanel() {
  const { devices, activeAttacks, startAttack, stopAttack, addLog } = useNetworkStore()
  const [selectedTargets, setSelectedTargets] = useState<Record<AttackType, string>>({
    EAVESDROP: '',
    BRUTEFORCE_ID: '',
    UNAUTHORIZED_ONT: '',
    ONT_SPOOF: '',
    DDOS: '',
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-400/10'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10'
      case 'high': return 'text-orange-400 bg-orange-400/10'
      case 'critical': return 'text-red-400 bg-red-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const handleStart = async (type: AttackType) => {
    try {
      if (attackCards.find(c => c.type === type)?.requiresTarget && !selectedTargets[type]) {
        addLog({
          level: 'error',
          message: 'Выберите жертву для атаки',
        })
        return
      }

      await startAttack(type, {
        targetDeviceId: selectedTargets[type] || undefined,
      })
    } catch (error) {
      addLog({
        level: 'error',
        message: `Ошибка при запуске атаки: ${error}`,
      })
    }
  }

  const handleStop = (type: AttackType) => {
    stopAttack(type)
  }

  // Получаем список легитимных ONT/ONU для выбора жертвы
  const getLegitimateOnts = () => {
    return devices.filter(
      d => (d.type === 'ONT' || d.type === 'ONU') && 
           !d.id.startsWith('attacker-') &&
           !d.id.startsWith('ont-rogue-') &&
           !d.id.startsWith('malicious-ont-') &&
           !d.id.startsWith('tap-splitter-') &&
           !d.id.startsWith('sniffer-ont-') &&
           !d.id.startsWith('ddos-ont-') &&
           !d.config?.isAttackDevice
    )
  }
  
  // Получаем список устройств для выбора точки атаки (ONT/ONU/SPLITTER)
  const getTargetDevices = () => {
    return devices.filter(
      d => (d.type === 'ONT' || d.type === 'ONU' || d.type === 'SPLITTER') &&
           !d.id.startsWith('attacker-') &&
           !d.id.startsWith('ont-rogue-') &&
           !d.id.startsWith('malicious-ont-') &&
           !d.id.startsWith('tap-splitter-') &&
           !d.id.startsWith('sniffer-ont-') &&
           !d.id.startsWith('ddos-ont-') &&
           !d.config?.isAttackDevice
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold">Сценарии атак</h2>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Выберите и запустите сценарий атаки для тестирования
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {attackCards.map((attack) => {
          const isActive = activeAttacks[attack.type].isActive
          const statusText = isActive ? 'ACTIVE' : 'STOPPED'
          const statusColor = isActive ? 'text-green-400' : 'text-gray-400'

          return (
            <div
              key={attack.type}
              className={`border rounded-lg p-4 transition-all ${
                isActive
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{attack.icon}</span>
                    <h3 className="font-semibold text-sm text-white">
                      {attack.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(attack.level)}`}>
                      {attack.level.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    {attack.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${statusColor}`}>
                      Статус: {statusText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Выбор цели для атак */}
              {attack.requiresTarget && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1">
                    {attack.type === 'ONT_SPOOF' 
                      ? 'Выберите ONT/ONU для подмены:'
                      : attack.type === 'EAVESDROP' || attack.type === 'DDOS'
                      ? 'Выберите точку подключения (ONT/ONU/SPLITTER):'
                      : 'Выберите жертву (ONT/ONU):'}
                  </label>
                  <select
                    value={selectedTargets[attack.type]}
                    onChange={(e) => {
                      setSelectedTargets(prev => ({
                        ...prev,
                        [attack.type]: e.target.value,
                      }))
                    }}
                    disabled={isActive}
                    className="w-full px-3 py-2 rounded text-sm bg-gray-700 border border-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Выберите устройство --</option>
                    {(attack.type === 'EAVESDROP' || attack.type === 'DDOS')
                      ? getTargetDevices().map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} ({device.type})
                          </option>
                        ))
                      : getLegitimateOnts().map(ont => (
                          <option key={ont.id} value={ont.id}>
                            {ont.name} ({ont.type})
                          </option>
                        ))}
                  </select>
                </div>
              )}

              {/* Кнопки управления */}
              <div className="flex gap-2 mt-3">
                {!isActive ? (
                  <button
                    onClick={() => handleStart(attack.type)}
                    disabled={attack.requiresTarget && !selectedTargets[attack.type]}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    Запустить
                  </button>
                ) : (
                  <button
                    onClick={() => handleStop(attack.type)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Square className="w-4 h-4" />
                    Остановить
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
