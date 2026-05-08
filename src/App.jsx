import React, { useEffect, useState } from 'react'
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
import { mapInventoryToZones } from './services/inventoryAdapter'
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

export default function App(){
  const [zones, setZones] = useState([0,1,2].map(makeZone))
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedRack, setSelectedRack] = useState(null)
  const [zoneControls, setZoneControls] = useState(() => Object.fromEntries([0,1,2].map(i=>[`zone-${i}`, { hvac:50, extractor:50 }])) )
  const [logs, setLogs] = useState([])
  const [backendStatus, setBackendStatus] = useState('checking')
  const [inventorySource, setInventorySource] = useState('mock')
  const activeZone = selectedZone ? zones.find(z=>z.id===selectedZone.id) : null
  const activeRack = selectedRack && activeZone ? activeZone.racks.find(r=>r.id===selectedRack.id) : null

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
          setLogs(prev => [...auditLogs, ...prev].slice(0, 80))
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
