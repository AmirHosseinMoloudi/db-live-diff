import React, { useState, useRef } from 'react'
import { Play, Square, Database, AlertTriangle, FileCode2, History } from 'lucide-react'

interface DiffLog {
  diff: string
  timestamp: string
  schema: string
}

export default function App() {
  const [dbUrl, setDbUrl] = useState('sqlite://dev.db')
  const [intervalMs, setIntervalMs] = useState(3000)
  const [isWatching, setIsWatching] = useState(false)
  const [status, setStatus] = useState<'idle' | 'watching' | 'error'>('idle')
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [diffLogs, setDiffLogs] = useState<DiffLog[]>([])
  const [currentSchema, setCurrentSchema] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'diffs' | 'schema'>('diffs')
  const wsRef = useRef<WebSocket | null>(null)

  const startWatching = () => {
    if (!dbUrl) return
    setIsWatching(true)
    setStatus('watching')
    setErrorDetails(null)

    const ws = new WebSocket('ws://localhost:3001/ws')
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'START_WATCH', dbUrl, intervalMs }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'INITIAL') {
        setCurrentSchema(data.schema)
      } else if (data.type === 'DIFF') {
        setDiffLogs((prev) => [
          { diff: data.diff, timestamp: data.timestamp, schema: data.schema },
          ...prev,
        ])
        setCurrentSchema(data.schema)
      } else if (data.type === 'ERROR') {
        setStatus('error')
        setErrorDetails(data.error + '\n' + (data.details || ''))
        setIsWatching(false)
        ws.close()
      }
    }

    ws.onclose = () => {
      setIsWatching(false)
      // Uses functional update to capture fresh state and prevent resetting errors
      setStatus((currentStatus) => currentStatus === 'error' ? 'error' : 'idle')
    }
  }

  const stopWatching = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setIsWatching(false)
    setStatus('idle')
  }

  const renderFormattedDiff = (diffText: string) => {
    return diffText.split('\n').map((line, idx) => {
      let className = 'text-slate-300'
      if (line.startsWith('+') && !line.startsWith('+++')) {
        className = 'text-emerald-400 bg-emerald-950/20 font-semibold'
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        className = 'text-rose-400 bg-rose-950/20 font-semibold'
      } else if (line.startsWith('--') || line.startsWith('/*')) {
        className = 'text-slate-500 italic'
      }
      return (
        <div key={idx} className={`px-2 py-0.5 rounded font-mono text-sm whitespace-pre-wrap ${className}`}>
          {line}
        </div>
      )
    })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-850 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Database size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">db-live-diff</h1>
            <p className="text-xs text-slate-400">Live Database Migration & Schema Watcher</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            status === 'watching' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' :
            status === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            'bg-slate-500/10 text-slate-400 border-slate-500/20'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 p-4 border-b border-slate-900 bg-slate-900/30">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database Connection URL</label>
          <input
            type="text"
            value={dbUrl}
            onChange={(e) => setDbUrl(e.target.value)}
            disabled={isWatching}
            placeholder="postgresql://user:password@localhost:5432/mydb"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 text-sm font-mono disabled:opacity-50"
          />
        </div>
        
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5 w-32">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Poll Rate (ms)</label>
            <input
              type="number"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              disabled={isWatching}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 text-sm font-mono disabled:opacity-50"
            />
          </div>

          {!isWatching ? (
            <button
              onClick={startWatching}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-lg transition"
            >
              <Play size={16} /> Start Watcher
            </button>
          ) : (
            <button
              onClick={stopWatching}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-sm rounded-lg transition"
            >
              <Square size={16} /> Stop Watcher
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-slate-900 bg-slate-900/10 flex flex-col p-4 gap-2">
          <button
            onClick={() => setActiveTab('diffs')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'diffs' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <History size={16} /> Schema Diffs ({diffLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'schema' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 size={16} /> Active Schema
          </button>

          {status === 'error' && errorDetails && (
            <div className="mt-auto p-3 bg-rose-950/10 border border-rose-900/25 rounded-lg text-rose-400 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <AlertTriangle size={14} /> Execution Error
              </div>
              <pre className="text-[10px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {errorDetails}
              </pre>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {activeTab === 'diffs' ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {diffLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-900 rounded-xl m-4">
                  <History size={40} className="mb-2 text-slate-600" />
                  <p className="text-sm">No schema changes evaluated yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Execute a database migration or schema modification to update.</p>
                </div>
              ) : (
                diffLogs.map((log, index) => (
                  <div key={index} className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-900 bg-slate-900/30 text-xs text-slate-400">
                      <span className="font-mono">UPDATE #{diffLogs.length - index}</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <div className="p-4 bg-slate-950/50 leading-relaxed font-mono">
                      {renderFormattedDiff(log.diff)}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-900 bg-slate-900/10 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-mono">schema.prisma</span>
                {currentSchema && (
                  <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">
                    Introspected State
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-950/80 font-mono text-sm leading-relaxed text-slate-300">
                {currentSchema ? (
                  <pre className="whitespace-pre-wrap">{currentSchema}</pre>
                ) : (
                  <p className="text-slate-500 italic text-center py-20">Initialize the watcher to populate database schema structures.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}