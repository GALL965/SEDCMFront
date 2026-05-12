import React from 'react'
import HVACControl from './HVACControl'
import ExtractorControl from './ExtractorControl'

export default function ZoneControls({
  zone,
  controls,
  onChange,
  activeRack = null,
  canSendManualCommands = false,
  onApplyCooling
}){
  if(!zone) return (
    <div className="zone-controls empty">Selecciona una zona</div>
  )

  const handleHVAC = (v)=> onChange(zone.id, { ...controls, hvac: v })
  const handleExt = (v)=> onChange(zone.id, { ...controls, extractor: v })

  return (
    <div className="zone-controls">
      <h3>{zone.name} - Controles</h3>
      <div className="controls-stack">
        <HVACControl value={controls.hvac} onChange={handleHVAC} />
        <div className="manual-control-card">
          <div className="manual-control-copy">
            <div className="manual-control-title">HVAC manual</div>
            <div className="manual-control-subtitle">
              {activeRack
                ? `Aplicar cooling a ${activeRack.name}`
                : 'Selecciona un rack para enviar cooling'}
            </div>
          </div>
          <button
            className="manual-btn manual-btn-accent"
            onClick={()=>onApplyCooling && onApplyCooling()}
            disabled={!canSendManualCommands || !activeRack}
            title={canSendManualCommands && activeRack
              ? 'Enviar set_hvac_mode cooling'
              : 'Disponible solo con backend real conectado y un rack seleccionado'}
          >
            Aplicar cooling
          </button>
        </div>
        <ExtractorControl value={controls.extractor} onChange={handleExt} />
      </div>
    </div>
  )
}
