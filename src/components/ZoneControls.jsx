import React from 'react'
import HVACControl from './HVACControl'
import ExtractorControl from './ExtractorControl'

export default function ZoneControls({ zone, controls, onChange }){
  if(!zone) return (
    <div className="zone-controls empty">Selecciona una zona</div>
  )

  const handleHVAC = (v)=> onChange(zone.id, { ...controls, hvac: v })
  const handleExt = (v)=> onChange(zone.id, { ...controls, extractor: v })

  return (
    <div className="zone-controls">
      <h3>{zone.name} — Controles</h3>
      <div className="controls-stack">
        <HVACControl value={controls.hvac} onChange={handleHVAC} />
        <ExtractorControl value={controls.extractor} onChange={handleExt} />
      </div>
    </div>
  )
}
