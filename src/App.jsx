import React, { useEffect, useRef, useState } from 'react'
import ZoneSelector from './components/ZoneSelector'
import RackList from './components/RackList'
import RackDetail from './components/RackDetail'
import ZoneControls from './components/ZoneControls'
import LogsPanel from './components/LogsPanel'
import {
  getAuditCommands,
  getEnvironmentTelemetry,
  getHealth,
  getInventory,
  getNodeTelemetry
} from './services/api'
import { mapAuditCommandsToLogs } from './services/auditAdapter'
import { mapInventoryToZones, normalizeBackendStatus } from './services/inventoryAdapter'
import { connectRealtime } from './services/realtime'
import { mapTelemetryToMetricsHistory } from './services/telemetryAdapter'

function rand(min, max) { return Math.round(Math.random() * (max - min) + min) }
function randFloat(min, max, digits=1){ return Number((Math.random() * (max-min) + min).toFixed(digits)) }

function generateMetrics(){
  return {
    t: Date.now(),
    temp: randFloat(20, 95),
    humidity: randFloat(20, 95),
    power: randFloat(5, 100),
    cpu: randFloat(0, 100),
    ram: randFloat(0, 100),
    net: randFloat(0, 1000)
  }
}

function makeServer(index){
  const initial = generateMetrics()
  return {
    id: `srv-${index}`,
    name: `server-${index}`,
    host: `10.0.0.${index}`,
    metrics: initial,
    metricsHistory: [initial]
  }
}

function makeRack(zoneIndex, rackIndex){
  const servers = [1,2,3].map(i => makeServer(zoneIndex*10 + rackIndex*3 + i))
  return { id: `rack-${zoneIndex}-${rackIndex}`, name: `Rack ${rackIndex}`, servers }
}

function makeZone(i){
  const racks = [1,2,3].map(r => makeRack(i, r))
  return { id: `zone-${i}`, name: `Zona ${String.fromCharCode(65 + i)}`, racks, controls: { hvac: 50, extractor: 50 } }
}

function toRealtimeTimestamp(value){
  const parsed = value ? new Date(value).getTime() : Date.now()
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function toMetricNumber(value, fallback = 0){
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bytesPerSecondToMbps(rx, tx){
  return Number((((toMetricNumber(rx) + toMetricNumber(tx)) * 8) / 1000000).toFixed(2))
}

export default function App(){
  const [zones, setZones] = useState([0,1,2].map(makeZone))
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedRack, setSelectedRack] = useState(null)
  const [zoneControls, setZoneControls] = useState(() => Object.fromEntries([0,1,2].map(i=>[`zone-${i}`, { hvac:50, extractor:50 }])) )
  const [logs, setLogs] = useState([])
  const [backendStatus, setBackendStatus] = useState('checking')
  const [inventorySource, setInventorySource] = useState('mock')
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected')
  const activeZone = selectedZone ? zones.find(z=>z.id===selectedZone.id) : null
  const activeRack = selectedRack && activeZone ? activeZone.racks.find(r=>r.id===selectedRack.id) : null
  const recentLogKeysRef = useRef([])

  useEffect(()=>{
    let cancelled = false

    async function loadBackendInventory(){
      try {
        await getHealth()
        if(cancelled) return

        setBackendStatus('connected')

        try {
          const inventory = await getInventory()
          if(cancelled) return

          setZones(mapInventoryToZones(inventory, generateMetrics))
          setInventorySource('backend')
        } catch {
          if(!cancelled) setInventorySource('mock')
        }
      } catch {
        if(!cancelled) {
          setBackendStatus('disconnected')
          setInventorySource('mock')
        }
      }
    }

    loadBackendInventory()

    return ()=>{
      cancelled = true
    }
  }, [])

  useEffect(()=>{
    const t = setInterval(()=>{
      setZones(prev => prev.map(z => ({
        ...z,
        racks: z.racks.map(r => ({
          ...r,
          servers: r.servers.map(s => {
            let m = generateMetrics()
            const ctrl = zoneControls[z.id] || { hvac:50, extractor:50 }
            if(inventorySource === 'backend' && s.telemetrySource === 'backend'){
              const current = s.metrics || m
              const power = Number(Math.max(0, Math.min(100, m.power + (ctrl.hvac - 50) * 0.18 + (ctrl.extractor - 50) * 0.12)).toFixed(1))
              return { ...s, metrics: { ...current, power } }
            }
            // HVAC reduces temp when increased; extractor reduces humidity
            m.temp = Number(Math.max(0, Math.min(120, m.temp - (ctrl.hvac - 50) * 0.25)).toFixed(1))
            m.humidity = Number(Math.max(0, Math.min(100, m.humidity - (ctrl.extractor - 50) * 0.35)).toFixed(1))
            // power influenced by controls
            m.power = Number(Math.max(0, Math.min(100, m.power + (ctrl.hvac - 50) * 0.18 + (ctrl.extractor - 50) * 0.12)).toFixed(1))
            const history = (s.metricsHistory || []).concat([m]).slice(-60)
            return { ...s, metrics: m, metricsHistory: history }
          })
        }))
      })))
    }, 2000)
    return ()=>clearInterval(t)
  }, [zoneControls, inventorySource])

  function updateZoneControls(zoneId, controls){
    setZoneControls(prev => ({ ...prev, [zoneId]: controls }))
  }

  // helper to push logs (keep last 80)
  function pushLog(entry){
    setLogs(prev => [entry, ...prev].slice(0,80))
  }

  function pushUniqueLog(entry, key){
    if(!key){
      pushLog(entry)
      return
    }

    if(recentLogKeysRef.current.includes(key)) return

    recentLogKeysRef.current = [key, ...recentLogKeysRef.current].slice(0, 40)
    pushLog(entry)
  }

  function mergeUniqueLogs(entries){
    entries.forEach(entry => {
      pushUniqueLog(
        { t: entry.t, level: entry.level, text: entry.text },
        entry.logKey || `log:${entry.t}:${entry.text}`
      )
    })
  }

  useEffect(()=>{
    if(selectedZone){
      setSelectedRack(null)
    }
  }, [selectedZone])

  useEffect(()=>{
    if(inventorySource !== 'backend' || !activeZone || !activeRack) return

    let cancelled = false
    const zoneCode = activeZone.code
    const rackCode = activeRack.code

    async function loadRackBackendData(){
      let environmentTelemetry = null

      try {
        environmentTelemetry = await getEnvironmentTelemetry({
          zone_code: zoneCode,
          rack_code: rackCode,
          limit: 50
        })
      } catch (error) {
        console.warn('No se pudo cargar telemetria ambiental real; se mantienen datos simulados.', error)
      }

      const nodeTelemetryResults = await Promise.all(activeRack.servers.map(async server => {
        try {
          const nodeTelemetry = await getNodeTelemetry({
            node_id: server.name,
            zone_code: zoneCode,
            rack_code: rackCode,
            limit: 50
          })

          return { serverId: server.id, nodeTelemetry }
        } catch (error) {
          console.warn(`No se pudo cargar telemetria real para ${server.name}; se mantienen datos simulados.`, error)
          return { serverId: server.id, nodeTelemetry: null }
        }
      }))

      if(cancelled) return

      setZones(prev => prev.map(zone => {
        if(zone.id !== activeZone.id) return zone

        return {
          ...zone,
          racks: zone.racks.map(rack => {
            if(rack.id !== activeRack.id) return rack

            return {
              ...rack,
              servers: rack.servers.map(server => {
                const telemetryResult = nodeTelemetryResults.find(result => result.serverId === server.id)
                const history = mapTelemetryToMetricsHistory({
                  nodeTelemetry: telemetryResult?.nodeTelemetry,
                  environmentTelemetry,
                  fallbackMetrics: server.metrics
                })

                if(history.length === 0) return server

                return {
                  ...server,
                  metrics: history[history.length - 1],
                  metricsHistory: history.slice(-60),
                  metricUnits: { ram: 'MB', net: 'Mbps' },
                  telemetrySource: 'backend'
                }
              })
            }
          })
        }
      }))

      try {
        const auditCommands = await getAuditCommands({
          zone_code: zoneCode,
          rack_code: rackCode,
          limit: 50
        })

        if(cancelled) return

        const auditLogs = mapAuditCommandsToLogs(auditCommands)
        if(auditLogs.length > 0){
          mergeUniqueLogs(auditLogs)
        }
      } catch (error) {
        console.warn('No se pudo cargar auditoria real; se mantienen logs locales.', error)
      }
    }

    loadRackBackendData()

    return ()=>{
      cancelled = true
    }
  }, [inventorySource, activeZone?.id, activeRack?.id])

  useEffect(()=>{
    if(backendStatus !== 'connected' || inventorySource !== 'backend'){
      setRealtimeStatus('disconnected')
      return
    }

    setRealtimeStatus('connecting')

    const connection = connectRealtime({
      onOpen: ()=>{
        setRealtimeStatus('connected')
      },
      onClose: ()=>{
        setRealtimeStatus(current => current === 'disconnected' ? current : 'disconnected')
      },
      onError: ()=>{
        setRealtimeStatus(current => current === 'connected' ? current : 'disconnected')
      },
      onEvent: event => {
        const eventTime = toRealtimeTimestamp(event.timestamp)
        const data = event.data || {}

        if(event.type === 'telemetry_node_received'){
          const metadata = data.metadata || {}
          const metrics = data.metrics || {}

          setZones(prev => prev.map(zone => {
            if(zone.code !== metadata.dc_zone) return zone

            return {
              ...zone,
              racks: zone.racks.map(rack => {
                if(rack.code !== metadata.dc_rack) return rack

                return {
                  ...rack,
                  servers: rack.servers.map(server => {
                    if(server.name !== metadata.node_id) return server

                    const nextMetrics = {
                      ...server.metrics,
                      t: eventTime,
                      cpu: toMetricNumber(metrics.cpu_usage_pct, server.metrics.cpu),
                      ram: toMetricNumber(metrics.ram_usage_mb, server.metrics.ram),
                      net: bytesPerSecondToMbps(metrics.net_rx_bytes_sec, metrics.net_tx_bytes_sec)
                    }

                    return {
                      ...server,
                      metrics: nextMetrics,
                      metricsHistory: [...(server.metricsHistory || []), nextMetrics].slice(-60),
                      metricUnits: { ram: 'MB', net: 'Mbps' },
                      telemetrySource: 'backend'
                    }
                  })
                }
              })
            }
          }))
          return
        }

        if(event.type === 'telemetry_environment_received'){
          const metadata = data.metadata || {}
          const environment = data.environment || {}

          setZones(prev => prev.map(zone => {
            if(zone.code !== metadata.dc_zone) return zone

            return {
              ...zone,
              racks: zone.racks.map(rack => {
                if(rack.code !== metadata.dc_rack) return rack

                return {
                  ...rack,
                  servers: rack.servers.map(server => {
                    const nextMetrics = {
                      ...server.metrics,
                      t: eventTime,
                      temp: toMetricNumber(environment.temperature_c, server.metrics.temp),
                      humidity: toMetricNumber(environment.humidity_pct, server.metrics.humidity)
                    }

                    return {
                      ...server,
                      metrics: nextMetrics,
                      metricsHistory: [...(server.metricsHistory || []), nextMetrics].slice(-60),
                      telemetrySource: 'backend'
                    }
                  })
                }
              })
            }
          }))
          return
        }

        if(event.type === 'node_status_changed'){
          setZones(prev => prev.map(zone => {
            if(zone.code !== data.zone_code) return zone

            return {
              ...zone,
              racks: zone.racks.map(rack => {
                if(rack.code !== data.rack_code) return rack

                return {
                  ...rack,
                  servers: rack.servers.map(server => server.name === data.node_id
                    ? { ...server, status: normalizeBackendStatus(data.new_status) }
                    : server)
                }
              })
            }
          }))
          return
        }

        if(event.type === 'rack_status_changed'){
          setZones(prev => prev.map(zone => {
            if(zone.code !== data.zone_code) return zone

            return {
              ...zone,
              racks: zone.racks.map(rack => rack.code === data.rack_code
                ? { ...rack, status: normalizeBackendStatus(data.new_status) }
                : rack)
            }
          }))
          return
        }

        if(event.type === 'command_published'){
          pushUniqueLog(
            {
              t: eventTime,
              level: 'info',
              text: `Comando ${data.action || 'desconocido'} publicado para ${data.node_id || data.target_id || 'rack'} en ${data.rack_code || 'sin rack'}: ${data.reason || 'sin razon'}`
            },
            `command_published:${data.command_id || event.timestamp}`
          )
          return
        }

        if(event.type === 'command_ack_received'){
          pushUniqueLog(
            {
              t: eventTime,
              level: String(data.status || '').toUpperCase() === 'ACKED' ? 'info' : 'warn',
              text: `ACK ${data.status || 'desconocido'} para comando ${data.command_id || 'sin id'} en ${data.rack_code || 'sin rack'}`
            },
            `command_ack_received:${data.command_id || event.timestamp}:${data.status || ''}`
          )
          return
        }

        if(event.type === 'escalation_event'){
          pushUniqueLog(
            {
              t: eventTime,
              level: data.stage === 'failed' ? 'critical' : 'warn',
              text: `Escalacion ${data.stage || 'desconocida'} para ${data.node_id || 'nodo'} en ${data.rack_code || 'sin rack'}`
            },
            `escalation_event:${data.stage || 'unknown'}:${data.node_id || ''}:${event.timestamp}`
          )
        }
      }
    })

    return ()=>{
      setRealtimeStatus('disconnected')
      connection.close()
    }
  }, [backendStatus, inventorySource])

  // initialize logs with a startup message and generate timed logs based on metrics
  useEffect(()=>{
    pushLog({ t: Date.now(), level: 'info', text: 'SEDCM frontend iniciado (datos simulados)' })

    const id = setInterval(()=>{
      // inspect metrics to generate warnings/criticals per zone
      zones.forEach(z=>{
        z.racks.forEach(r=>{
          r.servers.forEach(s=>{
            const m = s.metrics
            if(m.temp > 85 || m.humidity > 90 || m.power > 95){
              pushLog({ t: Date.now(), level: 'critical', text: `CRÍTICO: ${s.name} en ${z.name} presenta valores críticos (T:${m.temp}°C H:${m.humidity}% P:${m.power}%)` })
            } else if(m.temp > 70 || m.humidity > 75 || m.power > 85){
              pushLog({ t: Date.now(), level: 'warn', text: `Aviso: ${s.name} en ${z.name} valores altos (T:${m.temp}°C H:${m.humidity}% P:${m.power}%)` })
            }
          })
        })
      })

      // occasional informational/system events
      if(Math.random() < 0.25){
        const zone = zones[Math.floor(Math.random()*zones.length)]
        const infoMsgs = [`Extractores de ${zone.name} ajustados automáticamente`, `HVAC de ${zone.name} operando en modo normal`, `Sincronizando métricas para ${zone.name}`]
        pushLog({ t: Date.now(), level: 'info', text: infoMsgs[Math.floor(Math.random()*infoMsgs.length)] })
      }
    }, 2000)
    return ()=>clearInterval(id)
  }, [zones])

  return (
    <div className="app-root">
      <header className="topbar">
        <h1>SEDCM — Monitor Datacenter</h1>
        <div className="topbar-status">
          <div className={`backend-status backend-status-${backendStatus}`}>
            <span className="backend-status-dot" aria-hidden="true" />
            Backend: {backendStatus === 'connected' ? 'conectado' : backendStatus === 'disconnected' ? 'desconectado' : 'verificando'}
          </div>
          <div className={`data-status data-status-${inventorySource}`}>
            Datos: {inventorySource === 'backend' ? 'backend' : 'mock'}
          </div>
          <div className={`realtime-status realtime-status-${realtimeStatus}`}>
            Tiempo real: {realtimeStatus === 'connected' ? 'conectado' : realtimeStatus === 'connecting' ? 'conectando' : 'desconectado'}
          </div>
        </div>
      </header>
      <div className="container">
        <aside className="sidebar">
          <ZoneSelector zones={zones} onSelect={z=>setSelectedZone(z)} selected={selectedZone} />
          <LogsPanel logs={logs} />
        </aside>
        <main className="main">
          {!selectedZone && <div className="placeholder">Selecciona una zona para ver sus racks</div>}
          {activeZone && !activeRack && (
            <RackList zone={activeZone} onSelect={r=>setSelectedRack(r)} />
          )}
          {activeRack && (
            <RackDetail rack={activeRack} onBack={()=>setSelectedRack(null)} />
          )}
        </main>
        <aside className="rightpanel">
          <ZoneControls zone={activeZone} controls={activeZone ? (zoneControls[activeZone.id]||{hvac:50,extractor:50}) : {}} onChange={updateZoneControls} />
        </aside>
      </div>
      <footer className="footer">Mock datos aleatorios — Backend REST conexión futura</footer>
    </div>
  )
}
