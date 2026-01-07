'use client'

import { Play, Pause, RotateCcw, Save, FolderOpen, Gauge, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNetworkStore } from '@/store/networkStore'

export function ControlPanel() {
  const { simulation, startSimulation, stopSimulation, clearLogs, setSimulationSpeed, saveProject, loadProject, connectionMode, setConnectionMode } =
    useNetworkStore()

  const handleStart = () => {
    startSimulation()
  }

  const handlePause = () => {
    stopSimulation()
  }

  const handleReset = () => {
    stopSimulation()
    clearLogs()
  }

  const handleSave = () => {
    saveProject()
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        loadProject(file)
      }
    }
    input.click()
  }

  const speedOptions = [0.5, 1, 2, 4]
  const cycleSpeed = () => {
    const currentIndex = speedOptions.indexOf(simulation.speed)
    const nextIndex = (currentIndex + 1) % speedOptions.length
    setSimulationSpeed(speedOptions[nextIndex])
  }

  const handleToggleConnection = () => {
    setConnectionMode({
      active: !connectionMode.active,
      firstDeviceId: undefined
    })
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        {!simulation.isRunning ? (
          <Button onClick={handleStart} size="sm" className="gap-2">
            <Play className="w-4 h-4" />
            Пуск
          </Button>
        ) : (
          <Button onClick={handlePause} size="sm" variant="secondary" className="gap-2">
            <Pause className="w-4 h-4" />
            Пауза
          </Button>
        )}
        <Button onClick={handleReset} size="sm" variant="destructive" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Сброс
        </Button>
      </div>

      <div className="h-6 w-px bg-border mx-2" />

      <Button onClick={cycleSpeed} size="sm" variant="outline" className="gap-2">
        <Gauge className="w-4 h-4" />
        Скорость: {simulation.speed}x
      </Button>

      <div className="h-6 w-px bg-border mx-2" />

      <Button 
        onClick={handleToggleConnection} 
        size="sm" 
        variant={connectionMode.active ? "default" : "outline"} 
        className={`gap-2 ${connectionMode.active ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`}
        title="Режим соединения - Кликните на два устройства для соединения"
      >
        <Link className="w-4 h-4" />
        Соединить
      </Button>

      <div className="h-6 w-px bg-border mx-2" />

      <Button onClick={handleSave} size="sm" variant="outline" className="gap-2">
        <Save className="w-4 h-4" />
        Сохранить
      </Button>
      <Button onClick={handleLoad} size="sm" variant="outline" className="gap-2">
        <FolderOpen className="w-4 h-4" />
        Загрузить
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md">
          <div className={`w-2 h-2 rounded-full ${simulation.isRunning ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm font-medium">
            {simulation.isRunning ? 'Работает' : 'Остановлено'}
          </span>
        </div>
      </div>
    </div>
  )
}

