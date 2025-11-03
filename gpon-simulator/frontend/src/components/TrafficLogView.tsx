import React, { useState, useEffect } from 'react'
import { trafficLogger, TrafficFilter } from '../utils/trafficLog'
import { Download } from 'lucide-react'

export function TrafficLogView() {
  const [logs, setLogs] = useState(trafficLogger.getEvents())
  const [filter, setFilter] = useState<TrafficFilter>({})
  const [searchKeyword, setSearchKeyword] = useState('')

  useEffect(() => {
    const unsubscribe = trafficLogger.subscribe(() => {
      setLogs(trafficLogger.getEvents(filter))
    })

    return unsubscribe
  }, [filter])

  useEffect(() => {
    setLogs(trafficLogger.getEvents(filter))
  }, [filter])

  const handleExport = (format: 'json' | 'csv') => {
    const data = trafficLogger.export(format)
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traffic-logs.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    trafficLogger.clear()
    setLogs([])
  }

  const filteredLogs = searchKeyword
    ? logs.filter(log =>
        log.note.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        log.srcId.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        log.dstId.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        log.protocol.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : logs

  const stats = trafficLogger.getStats()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Логи трафика</h4>
        <div className="text-xs text-gray-600">
          {filteredLogs.length} / {stats.totalEvents} событий
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Поиск в логах..."
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
      />

      {/* Stats */}
      <div className="text-xs text-gray-600">
        Всего: {stats.totalBytes} байт | Протоколы: {Object.keys(stats.protocols).join(', ')}
      </div>

      {/* Logs */}
      <div className="h-64 overflow-y-auto bg-gray-900 text-green-400 text-xs p-3 rounded font-mono">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center">Нет событий</div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="mb-1 hover:bg-gray-800 transition-colors px-2 py-1 rounded">
              <span className="text-gray-500">[{log.timestamp}]</span>{' '}
              <span className="text-blue-400">{log.srcId}</span>
              <span className="text-gray-600"> -&gt; </span>
              <span className="text-blue-400">{log.dstId}</span>
              <span className="text-gray-500"> | proto={log.protocol}</span>
              <span className="text-gray-500"> | bytes={log.bytes}</span>
              {log.note && <span className="text-yellow-400"> | note={log.note}</span>}
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => handleExport('json')}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
        >
          <Download size={14} />
          JSON
        </button>
        <button
          onClick={() => handleExport('csv')}
          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
        >
          <Download size={14} />
          CSV
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
        >
          Очистить
        </button>
      </div>
    </div>
  )
}

