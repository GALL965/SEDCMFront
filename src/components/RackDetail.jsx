import React, { useEffect, useRef, useState } from 'react'
import LineChart from './LineChart'
import {
  getAggregatedRackStatus,
  getRackEnvironmentStatus,
  getWorstNodeStatus
} from '../services/inventoryAdapter'

const METRICS = [
  { key: 'cpu', label: 'CPU' },
  { key: 'ram', label: 'RAM' },
  { key: 'temp', label: 'Temp' },
  { key: 'humidity', label: 'Humedad' },
  { key: 'net', label: 'Red' },
  { key: 'power', label: 'Consumo' }
]

function formatRam(server){
  const unit = server.metricUnits && server.metricUnits.ram === 'MB' ? 'MB' : '%'
  return `${server.metrics.ram}${unit}`
}

function statusLabel(status){
  if(status === 'offline') return 'OFFLINE'
  if(status === 'critico') return 'CRITICO'
  if(status === 'peligro') return 'PELIGRO'
  return 'NORMAL'
}

export default function RackDetail({
  zoneCode,
  rack,
  onBack,
  canSendManualCommands = false,
  onSendNodeCommand,
  nodeActionStates = {}
}){
  const [metric, setMetric] = useState('cpu')
  const [expandedServerKey, setExpandedServerKey] = useState(null)
  const expandedPanelRef = useRef(null)
  const aggregatedRackStatus = getAggregatedRackStatus(rack)
  const environmentStatus = getRackEnvironmentStatus(rack)
  const worstNodeStatus = getWorstNodeStatus(rack)

  useEffect(()=>{
    setExpandedServerKey(null)
  }, [zoneCode, rack?.code, rack?.id])

  useEffect(()=>{
    if(!expandedServerKey || !expandedPanelRef.current) return
    expandedPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [expandedServerKey])

  function serverHistoryKey(server){
    return `${zoneCode || 'zone'}:${rack.code || rack.id}:${server.name}`
  }

  const expandedServerNodeId = expandedServerKey ? expandedServerKey.split(':').slice(-1)[0] : null
  const expandedServer = expandedServerNodeId
    ? rack.servers.find(server => server.name === expandedServerNodeId)
    : null

  return (
    <div className="rack-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>Volver</button>
        <div className="detail-title-group">
          <h2>{rack.name} - Detalle de servidores</h2>
          {aggregatedRackStatus && (
            <div className={`status-badge status-${aggregatedRackStatus}`}>
              {statusLabel(aggregatedRackStatus)}
            </div>
          )}
        </div>
      </div>

      <div className="rack-detail-summary">
        <div className="rack-status-line">
          <span className="label">Ambiente del rack</span>
          <strong className={`summary-status summary-status-${environmentStatus}`}>
            {statusLabel(environmentStatus)}
          </strong>
        </div>
        <div className="rack-status-line">
          <span className="label">Estado de nodos</span>
          <strong className={`summary-status summary-status-${worstNodeStatus}`}>
            {statusLabel(worstNodeStatus)}
          </strong>
        </div>
      </div>

      <div className={`servers-grid ${rack.servers.length === 1 ? 'servers-grid-single' : ''}`}>
        {rack.servers.map(server => {
          const isOffline = server.status === 'offline'
          const nodeActionState = nodeActionStates[server.name] || null

          return (
            <div
              key={server.id}
              className={`server-card ${isOffline ? 'server-card-offline' : ''} ${rack.servers.length === 1 ? 'server-card-single' : ''}`}
            >
              <div className="server-head">
                <div>
                  <div className="server-name-row">
                    <div className="server-name">{server.name}</div>
                    <div className={`status-badge status-${server.status || 'estable'}`}>
                      {statusLabel(server.status)}
                    </div>
                  </div>
                  <div className="server-host">{server.host}</div>
                  {isOffline && <div className="server-offline-note">Sin telemetria reciente</div>}
                  {!isOffline && nodeActionState?.label && (
                    <div className={`server-action-note server-action-note-${nodeActionState.kind || 'info'}`}>
                      {nodeActionState.label}
                    </div>
                  )}
                </div>

                <div className="server-actions">
                  <button
                    className="manual-btn"
                    onClick={()=>onSendNodeCommand && onSendNodeCommand(server, 'soft_reboot')}
                    disabled={!canSendManualCommands}
                    title={canSendManualCommands ? 'Enviar soft_reboot al nodo' : 'Disponible solo con backend real conectado'}
                  >
                    Reiniciar
                  </button>
                  <button
                    className="manual-btn manual-btn-danger"
                    onClick={()=>onSendNodeCommand && onSendNodeCommand(server, 'hard_shutdown')}
                    disabled={!canSendManualCommands}
                    title={canSendManualCommands ? 'Enviar hard_shutdown al nodo' : 'Disponible solo con backend real conectado'}
                  >
                    Apagar
                  </button>
                  <button
                    className="history-btn"
                    onClick={()=>{
                      setExpandedServerKey(serverHistoryKey(server))
                      setMetric('cpu')
                    }}
                  >
                    Ver historial
                  </button>
                </div>
              </div>

              <div className="server-metrics">
                <div><span className="label">CPU</span><strong>{server.metrics.cpu}%</strong></div>
                <div><span className="label">RAM</span><strong>{formatRam(server)}</strong></div>
                <div><span className="label">Temp</span><strong>{server.metrics.temp}°C</strong></div>
                <div><span className="label">Humedad</span><strong>{server.metrics.humidity}%</strong></div>
                <div><span className="label">Red</span><strong>{server.metrics.net} Mbps</strong></div>
                <div><span className="label">Consumo</span><strong>{server.metrics.power}%</strong></div>
              </div>
            </div>
          )
        })}
      </div>

      {expandedServerKey && (() => {
        const server = expandedServer
        if(!server) return null

        const history = server.metricsHistory || []
        const data = history.map(item => ({ t: item.t, v: item[metric] }))
        const hasHistoricalData = history.length > 1
        const isOffline = server.status === 'offline'

        return (
          <div className="expanded-panel" ref={expandedPanelRef}>
            <div className="expanded-header">
              <div>
                <div className="expanded-title">{server.name} - Historial expandido</div>
                <div className="expanded-sub">{server.host}</div>
                {isOffline && (
                  <div className="expanded-note expanded-note-offline">
                    Nodo offline: mostrando ultimo historial disponible
                  </div>
                )}
              </div>
              <div className="expanded-actions">
                <div className="metric-selector">
                  {METRICS.map(item => (
                    <button
                      key={item.key}
                      className={item.key === metric ? 'metric-btn active' : 'metric-btn'}
                      onClick={()=>setMetric(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button className="close-exp" onClick={()=>setExpandedServerKey(null)}>Cerrar</button>
              </div>
            </div>

            <div className="expanded-chart-wrap">
              {hasHistoricalData ? (
                <LineChart data={data} metric={metric} width={980} height={300} />
              ) : (
                <div className="no-history-message">
                  Sin datos historicos disponibles para este nodo
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
