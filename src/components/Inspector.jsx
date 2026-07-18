import { Trash2 } from 'lucide-react'

export function NumberField({ label, value, unit, min, max, step = 0.1, onChange }) {
  const displayedValue = String(Number(value.toFixed(4)))
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

export default function Inspector({ body, onUpdate, onRemove, canRemove, running }) {
  if (!body) return <p>Select a body to inspect it.</p>
  const disabledTitle = running ? 'Pause the experiment to edit body properties.' : undefined
  return (
    <section className="inspector" aria-labelledby="inspector-title">
      <div className="section-heading">
        <div><p className="eyebrow">Selected body</p><h2 id="inspector-title">{body.name}</h2></div>
        <button className="icon-button danger" type="button" onClick={onRemove} disabled={!canRemove || running} aria-label={`Remove ${body.name}`} title={disabledTitle}><Trash2 size={17} /></button>
      </div>
      <fieldset disabled={running} title={disabledTitle}>
        <label className="text-field"><span>Name</span><input value={body.name} onChange={(event) => onUpdate({ name: event.target.value })} /></label>
        <div className="field-grid">
          <NumberField label="Mass" value={body.mass} unit="kg" min={0.05} step={0.05} onChange={(mass) => onUpdate({ mass, inertia: 0.5 * mass * body.radius ** 2 })} />
          <NumberField label="Radius" value={body.radius} unit="m" min={0.1} max={2} step={0.05} onChange={(radius) => onUpdate({ radius, inertia: 0.5 * body.mass * radius ** 2 })} />
          <NumberField label="Position x" value={body.position.x} unit="m" step={0.1} onChange={(x) => onUpdate({ position: { ...body.position, x } })} />
          <NumberField label="Position y" value={body.position.y} unit="m" step={0.1} onChange={(y) => onUpdate({ position: { ...body.position, y } })} />
          <NumberField label="Velocity x" value={body.velocity.x} unit="m/s" step={0.1} onChange={(x) => onUpdate({ velocity: { ...body.velocity, x } })} />
          <NumberField label="Velocity y" value={body.velocity.y} unit="m/s" step={0.1} onChange={(y) => onUpdate({ velocity: { ...body.velocity, y } })} />
          <NumberField label="Restitution" value={body.restitution} unit="ratio" min={0} max={1} step={0.05} onChange={(restitution) => onUpdate({ restitution })} />
          <NumberField label="Angular speed" value={body.angularVelocity} unit="rad/s" step={0.1} onChange={(angularVelocity) => onUpdate({ angularVelocity })} />
        </div>
      </fieldset>
    </section>
  )
}
