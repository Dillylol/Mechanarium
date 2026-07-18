import { ArrowDown, Minus, Orbit, Trash2, Triangle, Waves } from 'lucide-react'
import { NumberField } from './Inspector.jsx'

const forceTitle = (force) => {
  if (force.type === 'gravity') return 'Gravity'
  if (force.type === 'central') return 'Attractor'
  if (force.type === 'spring') return 'Spring'
  return force.type
}

const forceIcon = (type) => {
  if (type === 'gravity') return ArrowDown
  if (type === 'central') return Orbit
  return Waves
}

function RemoveButton({ label, onClick, disabled }) {
  return <button className="icon-button danger" type="button" onClick={onClick} disabled={disabled} aria-label={`Remove ${label}`}><Trash2 size={15} /></button>
}

export default function EnvironmentInspector({ world, running, onUpdateForce, onRemoveForce, onUpdateConstraint, onRemoveConstraint, onPrepareOrbit }) {
  const editableForces = world.forces.filter((force) => ['gravity', 'central', 'spring'].includes(force.type))
  const editableConstraints = world.constraints.filter((constraint) => ['ground', 'incline'].includes(constraint.type))
  const empty = editableForces.length === 0 && editableConstraints.length === 0

  return (
    <section className="environment-inspector" aria-labelledby="environment-title">
      <div className="rail-section-heading"><span id="environment-title">World forces & surfaces</span><small>{editableForces.length + editableConstraints.length}</small></div>
      {empty && <p className="environment-empty">This is a force-free world. Add gravity, a floor, ramp, spring, or attractor from the builder.</p>}

      {editableForces.map((force) => {
        const Icon = forceIcon(force.type)
        const title = forceTitle(force)
        const body = world.bodies.find((candidate) => candidate.id === force.bodyId)
        return (
          <article className="environment-card" key={force.id}>
            <div className="environment-card-heading"><span><Icon size={15} /><strong>{title}</strong>{body && <small>{body.name}</small>}</span><RemoveButton label={title} onClick={() => onRemoveForce(force.id)} disabled={running} /></div>
            <fieldset disabled={running}>
              {force.type === 'gravity' && <NumberField label="Acceleration" value={force.g} unit="m/s²" min={0} max={50} step={0.1} onChange={(g) => onUpdateForce(force.id, { g })} />}
              {force.type === 'central' && (
                <>
                  <div className="field-grid">
                    <NumberField label="Center x" value={force.center.x} unit="m" onChange={(x) => onUpdateForce(force.id, { center: { ...force.center, x } })} />
                    <NumberField label="Center y" value={force.center.y} unit="m" onChange={(y) => onUpdateForce(force.id, { center: { ...force.center, y } })} />
                    <NumberField label="Strength" value={force.strength} unit="m³/s²" min={0.01} step={0.1} onChange={(strength) => onUpdateForce(force.id, { strength })} />
                    <NumberField label="Softening" value={force.softening ?? 0.05} unit="m" min={0.001} step={0.01} onChange={(softening) => onUpdateForce(force.id, { softening })} />
                  </div>
                  <button className="orbit-button" type="button" onClick={() => onPrepareOrbit(force.id)}>Prepare clean circular orbit</button>
                  <p className="environment-help">Sets the linked body’s tangent velocity and turns off uniform gravity and the ground.</p>
                </>
              )}
              {force.type === 'spring' && (
                <div className="field-grid">
                  <NumberField label="Anchor x" value={force.anchor.x} unit="m" onChange={(x) => onUpdateForce(force.id, { anchor: { ...force.anchor, x } })} />
                  <NumberField label="Anchor y" value={force.anchor.y} unit="m" onChange={(y) => onUpdateForce(force.id, { anchor: { ...force.anchor, y } })} />
                  <NumberField label="Stiffness" value={force.stiffness} unit="N/m" min={0.01} step={0.1} onChange={(stiffness) => onUpdateForce(force.id, { stiffness })} />
                  <NumberField label="Rest length" value={force.restLength} unit="m" min={0.01} step={0.1} onChange={(restLength) => onUpdateForce(force.id, { restLength })} />
                  <NumberField label="Damping" value={force.damping ?? 0} unit="N·s/m" min={0} step={0.01} onChange={(damping) => onUpdateForce(force.id, { damping })} />
                </div>
              )}
            </fieldset>
          </article>
        )
      })}

      {editableConstraints.map((constraint) => {
        const isRamp = constraint.type === 'incline'
        const Icon = isRamp ? Triangle : Minus
        const title = isRamp ? 'Ramp' : 'Ground'
        return (
          <article className="environment-card" key={constraint.id}>
            <div className="environment-card-heading"><span><Icon size={15} /><strong>{title}</strong></span><RemoveButton label={title} onClick={() => onRemoveConstraint(constraint.id)} disabled={running} /></div>
            <fieldset disabled={running}>
              {isRamp ? (
                <>
                  <div className="field-grid">
                    <NumberField label="Start x" value={constraint.start.x} unit="m" onChange={(x) => onUpdateConstraint(constraint.id, { start: { ...constraint.start, x } })} />
                    <NumberField label="Start y" value={constraint.start.y} unit="m" onChange={(y) => onUpdateConstraint(constraint.id, { start: { ...constraint.start, y } })} />
                    <NumberField label="End x" value={constraint.end.x} unit="m" onChange={(x) => onUpdateConstraint(constraint.id, { end: { ...constraint.end, x } })} />
                    <NumberField label="End y" value={constraint.end.y} unit="m" onChange={(y) => onUpdateConstraint(constraint.id, { end: { ...constraint.end, y } })} />
                  </div>
                  <label className="check-field"><input type="checkbox" checked={Boolean(constraint.rolling)} onChange={(event) => onUpdateConstraint(constraint.id, { rolling: event.target.checked })} />Rolling without slipping</label>
                </>
              ) : (
                <div className="field-grid">
                  <NumberField label="Height" value={constraint.y} unit="m" step={0.1} onChange={(y) => onUpdateConstraint(constraint.id, { y })} />
                  <NumberField label="Restitution" value={constraint.restitution ?? 0.72} unit="ratio" min={0} max={1} step={0.05} onChange={(restitution) => onUpdateConstraint(constraint.id, { restitution })} />
                  <NumberField label="Friction" value={constraint.friction ?? 0.04} unit="ratio" min={0} max={1} step={0.01} onChange={(friction) => onUpdateConstraint(constraint.id, { friction })} />
                </div>
              )}
            </fieldset>
          </article>
        )
      })}
    </section>
  )
}
