/**
 * Traffic logging system for network simulation
 */

export interface TrafficEvent {
  id: string
  timestamp: string
  srcId: string
  dstId: string
  protocol: string
  bytes: number
  note: string
}

export interface TrafficFilter {
  srcId?: string
  dstId?: string
  protocol?: string
  startTime?: string
  endTime?: string
  keyword?: string
}

class TrafficLogger {
  private events: TrafficEvent[] = []
  private subscribers: Array<(event: TrafficEvent) => void> = []

  log(srcId: string, dstId: string, protocol: string, bytes: number, note: string = '') {
    const event: TrafficEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour12: false }),
      srcId,
      dstId,
      protocol,
      bytes,
      note
    }
    
    this.events.push(event)
    
    // Notify subscribers
    this.subscribers.forEach(sub => sub(event))
    
    return event
  }

  getEvents(filter?: TrafficFilter): TrafficEvent[] {
    let filtered = [...this.events]

    if (filter) {
      if (filter.srcId) {
        filtered = filtered.filter(e => e.srcId === filter.srcId)
      }
      if (filter.dstId) {
        filtered = filtered.filter(e => e.dstId === filter.dstId)
      }
      if (filter.protocol) {
        filtered = filtered.filter(e => e.protocol === filter.protocol)
      }
      if (filter.keyword) {
        const keyword = filter.keyword.toLowerCase()
        filtered = filtered.filter(
          e =>
            e.note.toLowerCase().includes(keyword) ||
            e.srcId.toLowerCase().includes(keyword) ||
            e.dstId.toLowerCase().includes(keyword)
        )
      }
    }

    return filtered
  }

  clear() {
    this.events = []
  }

  getStats(): { totalEvents: number; totalBytes: number; protocols: Record<string, number> } {
    const protocols: Record<string, number> = {}
    let totalBytes = 0

    this.events.forEach(e => {
      protocols[e.protocol] = (protocols[e.protocol] || 0) + 1
      totalBytes += e.bytes
    })

    return {
      totalEvents: this.events.length,
      totalBytes,
      protocols
    }
  }

  subscribe(callback: (event: TrafficEvent) => void) {
    this.subscribers.push(callback)
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback)
    }
  }

  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2)
    }

    // CSV format
    const headers = ['timestamp', 'srcId', 'dstId', 'protocol', 'bytes', 'note']
    const rows = this.events.map(e => [
      e.timestamp,
      e.srcId,
      e.dstId,
      e.protocol,
      e.bytes.toString(),
      e.note
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }
}

// Singleton instance
export const trafficLogger = new TrafficLogger()

