/**
 * Project storage and persistence utilities
 */

export interface ProjectState {
  version: string
  topology: {
    nodes: any[]
    links: any[]
  }
  deviceConfigs: Record<string, any>
  activeScenarios: any[]
  logs: any[]
  canvasPositions: Record<string, { x: number; y: number }>
  createdAt: string
  updatedAt: string
}

const STORAGE_VERSION = '1.0.0'
const STORAGE_KEY = 'gpon-simulator-project'

export class ProjectStorage {
  static save(state: Partial<ProjectState>): void {
    const fullState: ProjectState = {
      version: STORAGE_VERSION,
      topology: state.topology || { nodes: [], links: [] },
      deviceConfigs: state.deviceConfigs || {},
      activeScenarios: state.activeScenarios || [],
      logs: state.logs || [],
      canvasPositions: state.canvasPositions || {},
      createdAt: state.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState))
  }

  static load(): ProjectState | null {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null

    try {
      const state = JSON.parse(data)
      
      // Validate version
      if (state.version !== STORAGE_VERSION) {
        console.warn(`Version mismatch: expected ${STORAGE_VERSION}, got ${state.version}`)
        // Could implement migration logic here
      }

      return state
    } catch (error) {
      console.error('Failed to load project:', error)
      return null
    }
  }

  static clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  static exportToJSON(): string {
    const state = this.load()
    if (!state) return ''

    return JSON.stringify(state, null, 2)
  }

  static importFromJSON(json: string): boolean {
    try {
      const state = JSON.parse(json)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return true
    } catch (error) {
      console.error('Failed to import project:', error)
      return false
    }
  }

  static exportToFile(filename: string = 'gpon-simulator-project.json'): void {
    const json = this.exportToJSON()
    if (!json) return

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  static importFromFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const success = this.importFromJSON(text)
        resolve(success)
      }
      reader.onerror = () => resolve(false)
      reader.readAsText(file)
    })
  }
}

// Auto-save utility
export class AutoSaveManager {
  private intervalId: number | null = null
  private callback: () => void
  private interval: number

  constructor(callback: () => void, intervalMs: number = 30000) {
    this.callback = callback
    this.interval = intervalMs
  }

  start(): void {
    if (this.intervalId) return
    
    this.intervalId = window.setInterval(() => {
      try {
        this.callback()
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, this.interval)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  setInterval(intervalMs: number): void {
    this.interval = intervalMs
    if (this.intervalId) {
      this.stop()
      this.start()
    }
  }
}

