import { Trash2 } from 'lucide-react'

export function NumberField({ label, value, unit, min, max, step = 0.1, onChange }) {
  const displayedValue = String(Number((Number(value) || 0).toFixed(4)))
  const commit = (event) => {
    const parsed = Number(event.currentTarget.value)
    if (event.currentTarget.value !== '' && Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max)) {
      onChange(parsed)
    } else {
      event.currentTarget.value = displayedValue
    }
  }

  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="input-with-unit">
        <input
          type="number"
          aria-label={`${label} (${unit})`}
          key={displayedValue}
          defaultValue={displayedValue}
          min={min}
          max={max}
          step={step}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        <small>{unit}</small>
      </span>
    </label>
  )
}

export default function Inspector({ entity: body, ownerName, onSelectOwner, onUpdate, onRemove, canRemove, running, connectorState, onPlaceAtStart, onPinToWorld, connectionPortId, onConnectPort }) {
  if (!body) return <p>Select an assembly entity to inspect it.</p>
  const disabledTitle = running ? 'Pause the experiment to edit body properties.' : undefined
  const isTrack = body.type === 'segment'
  const isConnector = body.type === 'spring' || body.type === 'rope'
  const isBeam = body.shape === 'beam'
  const isPort = Boolean(body.ownerId && body.localPosition)
  const title = isTrack ? 'Selected track' : isConnector ? 'Selected connector' : isPort ? 'Selected attachment point' : 'Selected body'
  return (
    <section className="inspector" aria-labelledby="inspector-title">
      <div className="section-heading">
        <div><p className="eyebrow">{title}</p><h2 id="inspector-title">{body.name}</h2></div>
        <button className="icon-button danger" type="button" onClick={onRemove} disabled={!canRemove || running} aria-label={`Remove ${body.name}`} title={disabledTitle}><Trash2 size={17} /></button>
      </div>
      <fieldset disabled={running} title={disabledTitle}>
        <label className="text-field"><span>Name</span><input value={body.name} onChange={(event) => onUpdate({ name: event.target.value })} /></label>
        {isPort ? (
          <>
            <div className="mounted-port-badge"><span aria-hidden="true">●</span><strong>Mounted to {ownerName}</strong><small>Follows position and rotation</small><button type="button" onClick={onSelectOwner}>Select {ownerName}</button></div>
            <div className="field-grid"><NumberField label="Local x" value={body.localPosition.x} unit="m" onChange={(x) => onUpdate({ localPosition: { ...body.localPosition, x } })} /><NumberField label="Local y" value={body.localPosition.y} unit="m" onChange={(y) => onUpdate({ localPosition: { ...body.localPosition, y } })} /></div>
            <button className="orbit-button" type="button" onClick={onPinToWorld}>Pin this port to world</button>
            {!connectionPortId ? <button className="orbit-button" type="button" onClick={() => onConnectPort()}>Use as first structural port</button> : connectionPortId === body.id ? <button className="orbit-button" type="button" onClick={() => onConnectPort()}>Cancel connection</button> : <div className="connection-actions"><button type="button" onClick={() => onConnectPort('rigid')}>Preview rigid snap</button><button type="button" onClick={() => onConnectPort('pin')}>Preview pin snap</button></div>}
            <p className="environment-help">Choose two ports, preview their alignment, then confirm Snap to place. Connector endpoints attach without welding.</p>
          </>
        ) : isConnector ? (
          <>
            <div className="field-grid">
              <NumberField label={body.type === 'rope' ? 'Maximum length' : 'Rest length'} value={body.type === 'rope' ? body.length : body.restLength} unit="m" min={0.05} onChange={(value) => onUpdate(body.type === 'rope' ? { length: value } : { restLength: value })} />
              {body.type === 'spring' && <NumberField label="Stiffness" value={body.stiffness} unit="N/m" min={0.01} onChange={(stiffness) => onUpdate({ stiffness })} />}
              {body.type === 'spring' && <NumberField label="Damping" value={body.damping} unit="N·s/m" min={0} onChange={(damping) => onUpdate({ damping })} />}
              <NumberField label="Current length" value={connectorState?.length ?? 0} unit="m" onChange={() => {}} />
              <NumberField label="Tension" value={connectorState?.tension ?? 0} unit="N" onChange={() => {}} />
              <NumberField label="Extension" value={connectorState?.extension ?? 0} unit="m" onChange={() => {}} />
            </div>
            <p className="environment-help">Drag either endpoint near a port. A green target and confirmation card appear; attachment occurs only after Snap to place.</p>
          </>
        ) : (
          <>
            <div className="field-grid">
              {!isTrack && <NumberField label="Mass" value={body.mass} unit="kg" min={0.05} step={0.05} onChange={(mass) => onUpdate({ mass })} />}
              {!isTrack && !isBeam && <NumberField label="Radius" value={body.radius} unit="m" min={0.1} max={2} step={0.05} onChange={(radius) => onUpdate({ radius })} />}
              <NumberField label="Center x" value={(body.center ?? body.position).x} unit="m" onChange={(x) => onUpdate(isTrack ? { center: { ...body.center, x } } : { position: { ...body.position, x } })} />
              <NumberField label="Center y" value={(body.center ?? body.position).y} unit="m" onChange={(y) => onUpdate(isTrack ? { center: { ...body.center, y } } : { position: { ...body.position, y } })} />
              {(isTrack || isBeam) && <NumberField label="Angle" value={body.angle * 180 / Math.PI} unit="deg" step={1} onChange={(degrees) => onUpdate({ angle: degrees * Math.PI / 180 })} />}
              {(isTrack || isBeam) && <NumberField label="Length" value={body.length} unit="m" min={0.2} onChange={(length) => onUpdate({ length })} />}
              {(isTrack || isBeam) && <NumberField label="Thickness" value={body.thickness} unit="m" min={0.05} onChange={(thickness) => onUpdate({ thickness })} />}
              {!isTrack && <NumberField label="Velocity x" value={body.velocity.x} unit="m/s" onChange={(x) => onUpdate({ velocity: { ...body.velocity, x } })} />}
              {!isTrack && <NumberField label="Velocity y" value={body.velocity.y} unit="m/s" onChange={(y) => onUpdate({ velocity: { ...body.velocity, y } })} />}
              <NumberField label="Restitution" value={body.restitution} unit="ratio" min={0} max={1} onChange={(restitution) => onUpdate({ restitution })} />
              <NumberField label="Friction" value={body.friction} unit="ratio" min={0} max={1} onChange={(friction) => onUpdate({ friction })} />
            </div>
            {!isTrack && <div className="toggle-stack"><label className="check-field"><input type="checkbox" checked={body.gravityEnabled} onChange={(event) => onUpdate({ gravityEnabled: event.target.checked })} />Gravity for this object</label><NumberField label="Gravity multiplier" value={body.gravityMultiplier} unit="×" step={0.1} onChange={(gravityMultiplier) => onUpdate({ gravityMultiplier })} /></div>}
            {isBeam && <><label className="select-field"><span>Beam mode</span><select value={body.mode} onChange={(event) => onUpdate({ mode: event.target.value })}><option value="dynamic">Dynamic</option><option value="pinned">Pinned</option><option value="track">Track</option></select></label><label className="check-field"><input type="checkbox" checked={body.autoLength} onChange={(event) => onUpdate({ autoLength: event.target.checked })} />Auto-length between connected ends</label><p className="environment-help">Intrinsic inertia {body.inertia.toFixed(3)} kg·m² · Assembly inertia {(body.assemblyInertia ?? body.inertia).toFixed(3)} kg·m²</p></>}
            {isTrack && <><label className="select-field"><span>Release port</span><select value={body.startEnd} onChange={(event) => onUpdate({ startEnd: event.target.value })}><option value="start">Start</option><option value="end">End</option></select></label><button className="orbit-button" type="button" onClick={onPlaceAtStart}>Place selected body at start</button></>}
          </>
        )}
      </fieldset>
    </section>
  )
}
