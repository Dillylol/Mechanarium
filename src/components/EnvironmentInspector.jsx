import { ArrowDown, Minus, Orbit, Trash2 } from 'lucide-react'
import { NumberField } from './Inspector.jsx'

function RemoveButton({ label, onClick, disabled }) {
  return <button className="icon-button danger" type="button" onClick={onClick} disabled={disabled} aria-label={`Remove ${label}`}><Trash2 size={15} /></button>
}

export default function EnvironmentInspector({ world, running, onUpdateGravity, onUpdateForce, onRemoveForce, onUpdateConstraint, onRemoveConstraint, onPrepareOrbit }) {
  const attractors = world.forces.filter((force) => force.type === 'central')
  const grounds = world.constraints.filter((constraint) => constraint.type === 'ground')
  return (
    <section className="environment-inspector" aria-labelledby="environment-title">
      <div className="rail-section-heading"><span id="environment-title">World forces & surfaces</span><small>{1 + attractors.length + grounds.length}</small></div>
      <article className="environment-card">
        <div className="environment-card-heading"><span><ArrowDown size={15} /><strong>Master gravity</strong><small>{world.gravity.enabled ? 'on' : 'off'}</small></span></div>
        <fieldset disabled={running}>
          <label className="check-field"><input type="checkbox" checked={world.gravity.enabled} onChange={(event) => onUpdateGravity({ enabled: event.target.checked })} />Enable master gravity</label>
          <div className="field-grid">
            <NumberField label="Magnitude" value={world.gravity.g} unit="m/s²" min={0} max={50} onChange={(g) => onUpdateGravity({ g })} />
            <NumberField label="Direction x" value={world.gravity.direction.x} unit="" onChange={(x) => onUpdateGravity({ direction: { ...world.gravity.direction, x } })} />
            <NumberField label="Direction y" value={world.gravity.direction.y} unit="" onChange={(y) => onUpdateGravity({ direction: { ...world.gravity.direction, y } })} />
          </div>
          <p className="environment-help">Each object may independently opt out or multiply this acceleration.</p>
        </fieldset>
      </article>

      {attractors.map((force) => {
        const body = world.bodies.find((candidate) => candidate.id === force.bodyId)
        return <article className="environment-card" key={force.id}>
          <div className="environment-card-heading"><span><Orbit size={15} /><strong>Attractor</strong>{body && <small>{body.name}</small>}</span><RemoveButton label="Attractor" onClick={() => onRemoveForce(force.id)} disabled={running} /></div>
          <fieldset disabled={running}>
            <div className="field-grid">
              <NumberField label="Center x" value={force.center.x} unit="m" onChange={(x) => onUpdateForce(force.id, { center: { ...force.center, x } })} />
              <NumberField label="Center y" value={force.center.y} unit="m" onChange={(y) => onUpdateForce(force.id, { center: { ...force.center, y } })} />
              <NumberField label="Strength" value={force.strength} unit="m³/s²" min={0.01} onChange={(strength) => onUpdateForce(force.id, { strength })} />
              <NumberField label="Softening" value={force.softening ?? 0.05} unit="m" min={0.001} onChange={(softening) => onUpdateForce(force.id, { softening })} />
            </div>
            <button className="orbit-button" type="button" onClick={() => onPrepareOrbit(force.id)}>Prepare clean circular orbit</button>
          </fieldset>
        </article>
      })}

      {grounds.map((ground) => <article className="environment-card" key={ground.id}>
        <div className="environment-card-heading"><span><Minus size={15} /><strong>Ground</strong></span><RemoveButton label="Ground" onClick={() => onRemoveConstraint(ground.id)} disabled={running} /></div>
        <fieldset disabled={running}><div className="field-grid">
          <NumberField label="Height" value={ground.y} unit="m" onChange={(y) => onUpdateConstraint(ground.id, { y })} />
          <NumberField label="Restitution" value={ground.restitution ?? 0.35} unit="ratio" min={0} max={1} onChange={(restitution) => onUpdateConstraint(ground.id, { restitution })} />
          <NumberField label="Friction" value={ground.friction ?? 0.08} unit="ratio" min={0} max={1} onChange={(friction) => onUpdateConstraint(ground.id, { friction })} />
        </div></fieldset>
      </article>)}
    </section>
  )
}
