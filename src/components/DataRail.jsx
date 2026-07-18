import { useState } from 'react'
import { Activity, Database, Download } from 'lucide-react'
import { constrainAcceleration } from '../physics/constraints.js'
import { netForceOnBody } from '../physics/forces.js'
import EnvironmentInspector from './EnvironmentInspector.jsx'
import Inspector from './Inspector.jsx'
import TelemetryChart from './TelemetryChart.jsx'

const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export default function DataRail({ world, selectedBody, history, onUpdateBody, onRemoveBody, onUpdateForce, onRemoveForce, onUpdateConstraint, onRemoveConstraint, onPrepareOrbit, onExport, running }) {
  const [mode, setMode] = useState('energy')
  const kinetic = world.metrics.translationalKinetic + world.metrics.rotationalKinetic
  const momentum = Math.hypot(world.metrics.linearMomentum.x, world.metrics.linearMomentum.y)
  const rawAcceleration = netForceOnBody(world.forces, selectedBody)
  const acceleration = constrainAcceleration(selectedBody, { x: rawAcceleration.x / selectedBody.mass, y: rawAcceleration.y / selectedBody.mass }, world.constraints)
  const speed = Math.hypot(selectedBody.velocity.x, selectedBody.velocity.y)

  return (
    <aside className="data-rail" aria-label="World data and selected object">
      <div className="data-rail-title"><div><p className="micro-label">Live laboratory</p><h2>Data</h2></div><span><Activity size={15} />120 Hz</span></div>
      <div className="data-mode-switch" role="tablist" aria-label="Measurement family">
        <button type="button" role="tab" aria-selected={mode === 'energy'} onClick={() => setMode('energy')}>Energy</button>
        <button type="button" role="tab" aria-selected={mode === 'kinematics'} onClick={() => setMode('kinematics')}>Kinematics</button>
      </div>

      {mode === 'energy' ? (
        <section className="metric-stack" aria-labelledby="measurements-title">
          <h3 id="measurements-title" className="visually-hidden">Energy measurements</h3>
          <article className="primary-metric"><small>Total energy</small><strong>{format(world.metrics.total)} <em>J</em></strong><span className={Math.abs(world.energyError.percent) < 0.1 ? 'stable' : ''}>Δ {format(world.energyError.percent, 3)}%</span></article>
          <div className="metric-row"><article><small>Kinetic</small><strong>{format(kinetic)} J</strong></article><article><small>Potential</small><strong>{format(world.metrics.potential)} J</strong></article></div>
          <div className="metric-row"><article><small>Momentum</small><strong>{format(momentum)} kg·m/s</strong></article><article><small>Time</small><strong>{format(world.time, 3)} s</strong></article></div>
        </section>
      ) : (
        <section className="metric-stack" aria-labelledby="kinematics-title">
          <h3 id="kinematics-title" className="visually-hidden">Kinematics measurements for {selectedBody.name}</h3>
          <article className="primary-metric"><small>Speed · {selectedBody.name}</small><strong>{format(speed)} <em>m/s</em></strong></article>
          <div className="metric-row"><article><small>Position x</small><strong>{format(selectedBody.position.x)} m</strong></article><article><small>Position y</small><strong>{format(selectedBody.position.y)} m</strong></article></div>
          <div className="metric-row"><article><small>Velocity x</small><strong>{format(selectedBody.velocity.x)} m/s</strong></article><article><small>Velocity y</small><strong>{format(selectedBody.velocity.y)} m/s</strong></article></div>
          <div className="metric-row"><article><small>Acceleration x</small><strong>{format(acceleration.x)} m/s²</strong></article><article><small>Acceleration y</small><strong>{format(acceleration.y)} m/s²</strong></article></div>
          <div className="metric-row"><article><small>Displacement</small><strong>{format(Math.hypot(selectedBody.position.x, selectedBody.position.y))} m</strong></article><article><small>Time</small><strong>{format(world.time, 3)} s</strong></article></div>
        </section>
      )}

      <section className="data-chart" aria-labelledby="history-chart-title">
        <div className="rail-section-heading"><span id="history-chart-title">{mode === 'energy' ? 'Energy history' : 'Kinematics history'}</span><Database size={15} /></div>
        <TelemetryChart history={history} mode={mode} />
        <button className="data-export" type="button" onClick={onExport}><Download size={15} />Export CSV</button>
      </section>

      <Inspector body={selectedBody} onUpdate={onUpdateBody} onRemove={onRemoveBody} canRemove={world.bodies.length > 1} running={running} />

      <EnvironmentInspector
        world={world}
        running={running}
        onUpdateForce={onUpdateForce}
        onRemoveForce={onRemoveForce}
        onUpdateConstraint={onUpdateConstraint}
        onRemoveConstraint={onRemoveConstraint}
        onPrepareOrbit={onPrepareOrbit}
      />

      <section className="parallel-data" aria-labelledby="parallel-data-title">
        <div className="rail-section-heading"><span id="parallel-data-title">Objects</span><small>{world.bodies.length}</small></div>
        <table><thead><tr><th>Name</th><th>x</th><th>y</th><th>|v|</th></tr></thead><tbody>{world.bodies.map((body) => <tr key={body.id}><th>{body.name}</th><td>{format(body.position.x, 1)}</td><td>{format(body.position.y, 1)}</td><td>{format(Math.hypot(body.velocity.x, body.velocity.y), 1)}</td></tr>)}</tbody></table>
      </section>
    </aside>
  )
}
