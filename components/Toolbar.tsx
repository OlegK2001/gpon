'use client'

import { Play, Pause, RotateCcw, Save, FolderOpen, Network, FastForward, Rewind, Link } from 'lucide-react'
import { useNetworkStore } from '@/store/networkStore'

export default function Toolbar() {
  const { simulation, startSimulation, stopSimulation, clearLogs, setSimulationSpeed, connectionMode, setConnectionMode, saveProject, loadProject } = useNetworkStore()
  
  const handleToggleSimulation = () => {
    if (simulation.isRunning) {
      stopSimulation()
    } else {
      startSimulation()
    }
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
    input.accept = 'application/json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        loadProject(file)
      }
    }
    input.click()
  }
  
  return (
    <div className="h-12 bg-white border-b-2 border-gray-300 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Network className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-800">
            GPON Network Simulator
          </h1>
        </div>
        
        <div className="h-6 w-px bg-gray-300" />
        
        <div className="flex items-center space-x-1">
          <button className="cisco-btn" onClick={handleLoad} title="Load Project">
            <FolderOpen className="w-4 h-4" />
          </button>
          <button className="cisco-btn" onClick={handleSave} title="Save Project">
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Connection Mode Button */}
        <button
          onClick={() => setConnectionMode({ 
            active: !connectionMode.active,
            firstDeviceId: undefined 
          })}
          className={`cisco-btn flex items-center space-x-1 ${
            connectionMode.active ? 'bg-green-100 border-green-500 text-green-700' : ''
          }`}
          title="Connection Mode - Click two devices to connect"
        >
          <Link className="w-4 h-4" />
          <span className="text-xs">Connect</span>
        </button>
        
        <div className="h-6 w-px bg-gray-300" />
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setSimulationSpeed(0.5)}
            className={`cisco-btn ${simulation.speed === 0.5 ? 'bg-blue-100 border-blue-400' : ''}`}
            title="Slow (0.5x)"
          >
            <Rewind className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleToggleSimulation}
            className={simulation.isRunning ? 'cisco-btn-danger' : 'cisco-btn-primary'}
          >
            {simulation.isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                <span>Start</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => setSimulationSpeed(2)}
            className={`cisco-btn ${simulation.speed === 2 ? 'bg-blue-100 border-blue-400' : ''}`}
            title="Fast (2x)"
          >
            <FastForward className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleReset}
            className="cisco-btn"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            <span>Reset</span>
          </button>
        </div>
        
        {simulation.isRunning && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 border border-green-400 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-800">Running {simulation.speed}x</span>
          </div>
        )}
      </div>
    </div>
  )
}


