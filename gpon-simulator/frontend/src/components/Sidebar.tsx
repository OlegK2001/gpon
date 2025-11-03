import { useState } from 'react'
import { Play, Plus, Download, Upload, Settings } from 'lucide-react'

interface Scenario {
  id: string
  name: string
  description: string
  category: string
}

interface SidebarProps {
  scenarios: Scenario[]
  onRunScenario: (scenario: Scenario) => void
}

function Sidebar({ scenarios, onRunScenario }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'tools'>('scenarios')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
            activeTab === 'scenarios'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          Сценарии
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
            activeTab === 'tools'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          Инструменты
        </button>
      </div>

      {/* Content */}
      {activeTab === 'scenarios' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-lg mb-4">Сценарии атак</h2>
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="border border-gray-200 rounded-lg p-3 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-gray-900">{scenario.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{scenario.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {scenario.category}
                  </span>
                  <button
                    onClick={() => onRunScenario(scenario)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    <Play size={14} />
                    Запустить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-lg mb-4">Инструменты</h2>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 text-sm">
              <Plus size={16} />
              Добавить устройство
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 text-sm">
              <Upload size={16} />
              Импорт топологии
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 text-sm">
              <Download size={16} />
              Экспорт отчёта
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 text-sm">
              <Settings size={16} />
              Настройки
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar

