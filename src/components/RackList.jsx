import React from 'react'
import {
  getAggregatedRackStatus,
  getRackEnvironmentStatus,
  getWorstNodeStatus
} from '../services/inventoryAdapter'

function averageMetric(rack, key){
  if(!rack.servers.length) return '0.0'
  return (rack.servers.reduce((sum, server)=>sum + server.metrics[key], 0) / rack.servers.length).toFixed(1)
}

function statusLabel(status){
  if(status === 'offline') return 'OFFLINE'
  if(status === 'critico') return 'CRITICO'
  if(status === 'peligro') return 'PELIGRO'
  return 'NORMAL'
}

export default function RackList({ zone, onSelect }){
  return (
    <div className="rack-list">
      <h2>{zone.name} - Racks</h2>
      <div className="racks-grid">
        {zone.racks.map(rack => {
          const aggregatedStatus = getAggregatedRackStatus(rack)
          const environmentStatus = getRackEnvironmentStatus(rack)
          const worstNodeStatus = getWorstNodeStatus(rack)
          const environmentOffline = environmentStatus === 'offline'

          return (
            <div
              key={rack.id}
              className={`rack-card ${aggregatedStatus === 'offline' ? 'rack-card-offline' : ''}`}
              onClick={()=>onSelect(rack)}
            >
              <div className="rack-header">
                <div className={`status-dot status-${aggregatedStatus}`}></div>
                <div className="rack-title-group">
                  <div className="rack-name">{rack.name}</div>
                  <div className={`status-badge status-${aggregatedStatus}`}>
                    {statusLabel(aggregatedStatus)}
                  </div>
                </div>
              </div>

              <div className="rack-status-summary">
                <div className="rack-status-line">
                  <span className="label">Ambiente</span>
                  <strong className={`summary-status summary-status-${environmentStatus}`}>
                    {statusLabel(environmentStatus)}
                  </strong>
                </div>
                <div className="rack-status-line">
                  <span className="label">Nodos</span>
                  <strong className={`summary-status summary-status-${worstNodeStatus}`}>
                    {statusLabel(worstNodeStatus)}
                  </strong>
                </div>
              </div>

              <div className="rack-metrics">
                <div>
                  <span className="label">Temp</span>
                  <strong>{environmentOffline ? 'Sin telemetria' : `${averageMetric(rack, 'temp')}°C`}</strong>
                </div>
                <div>
                  <span className="label">Humedad</span>
                  <strong>{environmentOffline ? 'Sin telemetria' : `${averageMetric(rack, 'humidity')}%`}</strong>
                </div>
                <div>
                  <span className="label">Potencia</span>
                  <strong>{environmentOffline ? 'Sin telemetria' : `${averageMetric(rack, 'power')}%`}</strong>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
