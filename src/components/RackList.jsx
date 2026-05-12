import React from 'react'

function rackStatus(rack){
  if(rack.status) return rack.status
  if(!rack.servers.length) return 'estable'

  const avgTemp = rack.servers.reduce((s,x)=>s+x.metrics.temp,0)/rack.servers.length
  const avgPower = rack.servers.reduce((s,x)=>s+x.metrics.power,0)/rack.servers.length
  if(avgTemp>80 || avgPower>90) return 'critico'
  if(avgTemp>60 || avgPower>75) return 'peligro'
  return 'estable'
}

function averageMetric(rack, key){
  if(!rack.servers.length) return '0.0'
  return (rack.servers.reduce((sum, server)=>sum+server.metrics[key],0)/rack.servers.length).toFixed(1)
}

function statusLabel(status){
  if(status === 'offline') return 'OFFLINE'
  if(status === 'critico') return 'critico'
  if(status === 'peligro') return 'peligro'
  return 'estable'
}

export default function RackList({ zone, onSelect }){
  return (
    <div className="rack-list">
      <h2>{zone.name} - Racks</h2>
      <div className="racks-grid">
        {zone.racks.map(r=>{
          const status = rackStatus(r)
          const colorClass = `status-${status}`
          const isOffline = status === 'offline'
          const avgTemp = averageMetric(r, 'temp')
          const avgHum = averageMetric(r, 'humidity')
          const avgPower = averageMetric(r, 'power')

          return (
            <div
              key={r.id}
              className={`rack-card ${isOffline ? 'rack-card-offline' : ''}`}
              onClick={()=>onSelect(r)}
            >
              <div className="rack-header">
                <div className={`status-dot ${colorClass}`}></div>
                <div className="rack-title-group">
                  <div className="rack-name">{r.name}</div>
                  <div className={`status-badge ${colorClass}`}>
                    {statusLabel(status)}
                  </div>
                </div>
              </div>
              <div className="rack-metrics">
                <div>
                  <span className="label">{isOffline ? 'Estado' : 'Temp'}</span>
                  <strong>{isOffline ? 'Sin telemetria' : `${avgTemp}°C`}</strong>
                </div>
                <div>
                  <span className="label">{isOffline ? 'Ultimo dato' : 'Humedad'}</span>
                  <strong>{isOffline ? 'Sin conexion' : `${avgHum}%`}</strong>
                </div>
                <div>
                  <span className="label">{isOffline ? 'Rack' : 'Potencia'}</span>
                  <strong>{isOffline ? 'OFFLINE' : `${avgPower}%`}</strong>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
