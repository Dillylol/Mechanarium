import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export function NumberField({ label, value, unit, min, max, step = 0.1, onChange }) {
  const displayedValue = String(Number((Number(value) || 0).toFixed(4)))
  const commit = (event) => {
    const parsed = Number(event.currentTarget.value)
    if (event.currentTarget.value !== '' && Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max)) onChange(parsed)
    else event.currentTarget.value = displayedValue
  }
  return <label className="number-field"><span>{label}</span><span className="input-with-unit"><input type="number" aria-label={`${label} (${unit})`} key={displayedValue} defaultValue={displayedValue} min={min} max={max} step={step} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /><small>{unit}</small></span></label>
}

function SplineFields({ track, onUpdate }) {
  const [selectedKnotId, setSelectedKnotId] = useState(track.knots[0]?.id)
  const selected = track.knots.find((knot) => knot.id === selectedKnotId) ?? track.knots[0]
  const updateKnot = (changes) => onUpdate({ knots: track.knots.map((knot) => knot.id === selected.id ? { ...knot, ...changes } : knot) })
  const addKnot = () => {
    if (track.knots.length >= 64) return
    const a = track.knots.at(-2)
    const b = track.knots.at(-1)
    const knot = {
      id: `knot-${crypto.randomUUID()}`,
      position: { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 },
      tangent: { x: (a.tangent.x + b.tangent.x) / 2, y: (a.tangent.y + b.tangent.y) / 2 },
      secondDerivative: { x: (a.secondDerivative.x + b.secondDerivative.x) / 2, y: (a.secondDerivative.y + b.secondDerivative.y) / 2 },
    }
    const knots = [...track.knots.slice(0, -1), knot, b]
    onUpdate({ knots }); setSelectedKnotId(knot.id)
  }
  const removeKnot = () => {
    if (track.knots.length <= 2) return
    const index = track.knots.findIndex((knot) => knot.id === selected.id)
    const knots = track.knots.filter((knot) => knot.id !== selected.id)
    onUpdate({ knots }); setSelectedKnotId(knots[Math.max(0, index - 1)].id)
  }
  return <div className="spline-fields">
    <div className="rail-section-heading"><span>Spline knots</span><small>{track.knots.length}/64</small></div>
    <label className="select-field"><span>Selected knot</span><select value={selected.id} onChange={(event) => setSelectedKnotId(event.target.value)}>{track.knots.map((knot, index) => <option value={knot.id} key={knot.id}>{index + 1} · {knot.id}</option>)}</select></label>
    <div className="field-grid">
      <NumberField label="Position x" value={selected.position.x} unit="m" onChange={(x) => updateKnot({ position: { ...selected.position, x } })} />
      <NumberField label="Position y" value={selected.position.y} unit="m" onChange={(y) => updateKnot({ position: { ...selected.position, y } })} />
      <NumberField label="Tangent x" value={selected.tangent.x} unit="m" onChange={(x) => updateKnot({ tangent: { ...selected.tangent, x } })} />
      <NumberField label="Tangent y" value={selected.tangent.y} unit="m" onChange={(y) => updateKnot({ tangent: { ...selected.tangent, y } })} />
      <NumberField label="Curvature x" value={selected.secondDerivative.x} unit="m" onChange={(x) => updateKnot({ secondDerivative: { ...selected.secondDerivative, x } })} />
      <NumberField label="Curvature y" value={selected.secondDerivative.y} unit="m" onChange={(y) => updateKnot({ secondDerivative: { ...selected.secondDerivative, y } })} />
    </div>
    <div className="connection-actions"><button type="button" onClick={addKnot} disabled={track.knots.length >= 64}><Plus size={14} />Insert before end</button><button type="button" onClick={removeKnot} disabled={track.knots.length <= 2}><Trash2 size={14} />Delete knot</button></div>
    <p className="environment-help">Yellow points move knots; green handles edit tangents. Shared derivatives keep adjacent spans C² continuous.</p>
  </div>
}

export default function Inspector({ entity: body, ownerName, onSelectOwner, onUpdate, onRemove, canRemove, running, connectorState, loadState, eligibleWheels = [], onRouteConnector, onPlaceAtStart, onPinToWorld, connectionPortId, onConnectPort }) {
  if (!body) return <p>Select an assembly entity to inspect it.</p>
  const disabledTitle = running ? 'Pause the experiment to edit body properties.' : undefined
  const isTrack = body.type === 'segment' || body.type === 'spline'
  const isSpline = body.type === 'spline'
  const isConnector = body.type === 'spring' || body.type === 'rope'
  const isBeam = body.shape === 'beam'
  const isWheel = body.shape === 'wheel'
  const isPort = Boolean(body.ownerId && body.localPosition)
  const title = isTrack ? 'Selected track' : isConnector ? 'Selected connector' : isPort ? 'Selected attachment point' : isWheel ? 'Selected wheel' : 'Selected body'
  return <section className="inspector" aria-labelledby="inspector-title">
    <div className="section-heading"><div><p className="eyebrow">{title}</p><h2 id="inspector-title">{body.name}</h2></div><button className="icon-button danger" type="button" onClick={onRemove} disabled={!canRemove || running} aria-label={`Remove ${body.name}`} title={disabledTitle}><Trash2 size={17} /></button></div>
    <fieldset disabled={running} title={disabledTitle}>
      <label className="text-field"><span>Name</span><input value={body.name} onChange={(event) => onUpdate({ name: event.target.value })} /></label>
      {isPort ? <>
        <div className="mounted-port-badge"><span aria-hidden="true">●</span><strong>Mounted to {ownerName}</strong><small>Follows position and rotation</small><button type="button" onClick={onSelectOwner}>Select {ownerName}</button></div>
        <div className="field-grid"><NumberField label="Local x" value={body.localPosition.x} unit="m" onChange={(x) => onUpdate({ localPosition: { ...body.localPosition, x } })} /><NumberField label="Local y" value={body.localPosition.y} unit="m" onChange={(y) => onUpdate({ localPosition: { ...body.localPosition, y } })} /></div>
        <button className="orbit-button" type="button" onClick={onPinToWorld}>Pin this port to world</button>
        {!connectionPortId ? <button className="orbit-button" type="button" onClick={() => onConnectPort()}>Use as first structural port</button> : connectionPortId === body.id ? <button className="orbit-button" type="button" onClick={() => onConnectPort()}>Cancel connection</button> : <div className="connection-actions"><button type="button" onClick={() => onConnectPort('rigid')}>Preview rigid snap</button><button type="button" onClick={() => onConnectPort('pin')}>Preview pin snap</button></div>}
      </> : isConnector ? <>
        <div className="field-grid">
          {!body.route && <NumberField label={body.type === 'rope' ? 'Maximum length' : 'Rest length'} value={body.type === 'rope' ? body.length : body.restLength} unit="m" min={0.05} onChange={(value) => onUpdate(body.type === 'rope' ? { length: value } : { restLength: value })} />}
          {body.type === 'spring' && <NumberField label="Stiffness" value={body.stiffness} unit="N/m" min={0.01} onChange={(stiffness) => onUpdate({ stiffness })} />}
          {body.type === 'spring' && <NumberField label="Damping" value={body.damping} unit="N·s/m" min={0} onChange={(damping) => onUpdate({ damping })} />}
          <NumberField label="Current length" value={connectorState?.length ?? 0} unit="m" onChange={() => {}} /><NumberField label="Tension" value={connectorState?.tension ?? 0} unit="N" onChange={() => {}} /><NumberField label="Extension" value={connectorState?.extension ?? 0} unit="m" onChange={() => {}} />
          {body.route && <><NumberField label="Tension A" value={connectorState?.tensionA ?? 0} unit="N" onChange={() => {}} /><NumberField label="Tension B" value={connectorState?.tensionB ?? 0} unit="N" onChange={() => {}} /><NumberField label="Wrap length" value={connectorState?.wrapLength ?? 0} unit="m" onChange={() => {}} /></>}
        </div>
        {body.type === 'spring' && <label className="select-field"><span>Attachment</span><select value={body.unattached ? 'push' : 'attached'} onChange={(event) => onUpdate({ unattached: event.target.value === 'push' })}><option value="attached">Attached (Two-way pull &amp; push)</option><option value="push">Push-only / Unattached (Separate at rest length)</option></select></label>}
        {body.type === 'rope' && <label className="select-field"><span>Pulley route</span><select value={body.route?.wheelId ?? ''} onChange={(event) => onRouteConnector?.(body.id, event.target.value)}><option value="">Unrouted rope</option>{eligibleWheels.map((wheel) => <option key={wheel.id} value={wheel.id}>{wheel.name}</option>)}</select></label>}
        <p className="environment-help">{body.route ? `Calibrated taut path ${(connectorState?.length ?? body.length).toFixed(3)} m.` : 'Drag either endpoint near a port, then confirm the snap.'}</p>
      </> : <>
        <div className="field-grid">
          {!isTrack && <NumberField label="Mass" value={body.mass} unit="kg" min={0.05} step={0.05} onChange={(mass) => onUpdate({ mass })} />}
          {!isTrack && !isBeam && <NumberField label="Radius" value={body.radius} unit="m" min={0.1} max={2} step={0.05} onChange={(radius) => onUpdate({ radius })} />}
          {!isSpline && <><NumberField label="Center x" value={(body.center ?? body.position).x} unit="m" onChange={(x) => onUpdate(isTrack ? { center: { ...body.center, x } } : { position: { ...body.position, x } })} /><NumberField label="Center y" value={(body.center ?? body.position).y} unit="m" onChange={(y) => onUpdate(isTrack ? { center: { ...body.center, y } } : { position: { ...body.position, y } })} /></>}
          {(!isSpline && (isTrack || isBeam || isWheel)) && <NumberField label="Angle" value={body.angle * 180 / Math.PI} unit="deg" step={1} onChange={(degrees) => onUpdate({ angle: degrees * Math.PI / 180 })} />}
          {(!isSpline && (isTrack || isBeam)) && <NumberField label="Length" value={body.length} unit="m" min={0.2} onChange={(length) => onUpdate({ length })} />}
          {(isTrack || isBeam) && <NumberField label="Thickness" value={body.thickness} unit="m" min={0.05} onChange={(thickness) => onUpdate({ thickness })} />}
          {!isTrack && <><NumberField label="Velocity x" value={body.velocity.x} unit="m/s" onChange={(x) => onUpdate({ velocity: { ...body.velocity, x } })} /><NumberField label="Velocity y" value={body.velocity.y} unit="m/s" onChange={(y) => onUpdate({ velocity: { ...body.velocity, y } })} /></>}
          {isWheel && <><NumberField label="Axial depth" value={body.depth} unit="m" min={0.05} onChange={(depth) => onUpdate({ depth })} /><NumberField label="Angular velocity" value={body.angularVelocity} unit="rad/s" onChange={(angularVelocity) => onUpdate({ angularVelocity })} /></>}
          <NumberField label="Restitution" value={body.restitution} unit="ratio" min={0} max={1} onChange={(restitution) => onUpdate({ restitution })} /><NumberField label="Friction" value={body.friction} unit="ratio" min={0} max={1} onChange={(friction) => onUpdate({ friction })} />
        </div>
        {!isTrack && <div className="toggle-stack"><label className="check-field"><input type="checkbox" checked={body.gravityEnabled} onChange={(event) => onUpdate({ gravityEnabled: event.target.checked })} />Gravity for this object</label><NumberField label="Gravity multiplier" value={body.gravityMultiplier} unit="×" step={0.1} onChange={(gravityMultiplier) => onUpdate({ gravityMultiplier })} /></div>}
        {isBeam && <><label className="select-field"><span>Beam mode</span><select value={body.mode} onChange={(event) => onUpdate({ mode: event.target.value })}><option value="dynamic">Dynamic</option><option value="pinned">Pinned</option><option value="track">Track</option></select></label><label className="check-field"><input type="checkbox" checked={body.autoLength} onChange={(event) => onUpdate({ autoLength: event.target.checked })} />Auto-length between connected ends</label></>}
        {isWheel && <><label className="select-field"><span>Inertia distribution</span><select value={body.inertiaModel} onChange={(event) => onUpdate({ inertiaModel: event.target.value })}><option value="disk">Solid disk · I = ½mR²</option><option value="hoop">Hoop · I = mR²</option></select></label><label className="select-field"><span>Rotation</span><select value={body.rotationMode} onChange={(event) => onUpdate({ rotationMode: event.target.value })}><option value="free">Rolling · friction can create torque</option><option value="sliding">Sliding · no rolling torque</option><option value="fixed">Fixed rotation / ideal pulley</option></select></label></>}
        {isSpline && <><label className="select-field"><span>Support side</span><select value={body.supportSide} onChange={(event) => onUpdate({ supportSide: event.target.value })}><option value="left">Left of path</option><option value="right">Right of path</option></select></label><SplineFields track={body} onUpdate={onUpdate} /></>}
        {(isTrack || isBeam && body.mode === 'track') && <><label className="check-field"><input type="checkbox" checked={Boolean(body.ideal)} onChange={(event) => onUpdate({ ideal: event.target.checked })} />Ideal energy-conserving rail</label><p className="environment-help">Ideal rails preserve mechanical energy. Wheel friction controls rolling torque; set wheel friction to zero or choose Sliding to disable rolling.</p></>}
        {isTrack && <><label className="select-field"><span>Release port</span><select value={body.startEnd} onChange={(event) => onUpdate({ startEnd: event.target.value })}><option value="start">Start</option><option value="end">End</option></select></label><button className="orbit-button" type="button" onClick={onPlaceAtStart}>Place selected body at start</button></>}
      </>}
    </fieldset>
    {isWheel && <div className="wheel-dynamics-card" aria-label="Live wheel dynamics"><strong>Live wheel dynamics</strong><span>I = {body.inertia.toFixed(4)} kg·m²</span><span>|ΣF| = {(loadState?.forceMagnitude ?? 0).toFixed(3)} N</span><span>Στ = {(loadState?.netTorque ?? 0).toFixed(3)} N·m</span><span>α = {(body.angularAcceleration ?? 0).toFixed(3)} rad/s²</span><small>Στ = Iα · τrope = (TB − TA)R</small></div>}
  </section>
}
