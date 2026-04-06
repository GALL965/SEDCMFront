import React from 'react'

function rackStatus(rack){
  const avgTemp = rack.servers.reduce((s,x)=>s+x.metrics.temp,0)/rack.servers.length
  const avgPower = rack.servers.reduce((s,x)=>s+x.metrics.power,0)/rack.servers.length
  if(avgTemp>80 || avgPower>90) return 'critico'
  if(avgTemp>60 || avgPower>75) return 'peligro'
  return 'estable'
}

export default function RackList({ zone, onSelect }){
  return (
    <div className="rack-list">
      <h2>{zone.name} — Racks</h2>
      <div className="racks-grid">
        {zone.racks.map(r=>{
          const status = rackStatus(r)
          const colorClass = `status-${status}`
          const avgTemp = (r.servers.reduce((s,x)=>s+x.metrics.temp,0)/r.servers.length).toFixed(1)
          const avgHum = (r.servers.reduce((s,x)=>s+x.metrics.humidity,0)/r.servers.length).toFixed(1)
          const avgPower = (r.servers.reduce((s,x)=>s+x.metrics.power,0)/r.servers.length).toFixed(1)
          return (
            <div key={r.id} className="rack-card" onClick={()=>onSelect(r)}>
              <div className="rack-header">
                <div className={`status-dot ${colorClass}`}></div>
                <div className="rack-name">{r.name}</div>
              </div>
              <div className="rack-metrics">
                <div><span className="label">Temp</span><strong>{avgTemp}°C</strong></div>
                <div><span className="label">Humedad</span><strong>{avgHum}%</strong></div>
                <div><span className="label">Potencia</span><strong>{avgPower}%</strong></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
