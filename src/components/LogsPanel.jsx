import React, { useEffect, useRef } from 'react'

export default function LogsPanel({ logs = [] }){
  const listRef = useRef()

  // auto-scroll to top (newest first) when logs change
  useEffect(()=>{
    const el = listRef.current
    if(!el) return
    // scroll to top smoothly so new entries are visible
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }, [logs])

  return (
    <div className="logs-panel">
      <h3>Logs</h3>
      <div className="logs-list" ref={listRef}>
        {logs.map((l,i)=>(
          <div key={i} className={`log-item log-${l.level}`}>
            <div className="log-time">{new Date(l.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
            <div className="log-text">{l.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
