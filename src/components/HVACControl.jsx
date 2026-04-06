import React from 'react'

export default function HVACControl({ value=50, onChange }){
  return (
    <div className="hvac-control">
      <div className="ctrl-title">HVAC</div>
      <div className="ctrl-row">
        <button onClick={()=>onChange(Math.max(0, value-5))}>-</button>
        <div className="ctrl-value">{value}%</div>
        <button onClick={()=>onChange(Math.min(100, value+5))}>+</button>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={e=>onChange(Number(e.target.value))} />
    </div>
  )
}
