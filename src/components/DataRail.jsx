import { Activity, Database, Download } from 'lucide-react'
import Inspector from './Inspector.jsx'
import TelemetryChart from './TelemetryChart.jsx'

const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export default function DataRail({ world, selectedBody, history, onUpdateBody, onRemoveBody, onExport, running }) {
  const kinetic = world.metrics.translationalKinetic + world.metrics.rotationalKinetic
  const momentum = Math.hypot(world.metrics.linearMomentum.x, world.metrics.linearMomentum.y)
  return (
    <aside className="data-rail" aria-label="World data and selected object">
      <div className="data-rail-title"><div><p className="micro-label">Live laboratory</p><h2>Data</h2></div><span><Activity size={15} />120 Hz</span></div>
      <section className="metric-stack" aria-labelledby="measurements-title">
        <h3 id="measurements-title" className="visually-hidden">System measurements</h3>
        <article className="primary-metric"><small>Total energy</small><strong>{format(world.metrics.total)} <em>J</em></strong><span className={Math.abs(world.energyError.percent) < 0.1 ? 'stable' : ''}>Δ {format(world.energyError.percent, 3)}%</span></article>
        <div className="metric-row"><article><small>Kinetic</small><strong>{format(kinetic)} J</strong></article><article><small>Potential</small><strong>{format(world.metrics.potential)} J</strong></article></div>
        <div className="metric-row"><article><small>Momentum</small><strong>{format(momentum)} kg·m/s</strong></article><article><small>Time</small><strong>{format(world.time, 3)} s</strong></article></div>
      </section>

      <section className="data-chart" aria-labelledby="energy-chart-title">
        <div className="rail-section-heading"><span id="energy-chart-title">Energy history</span><Database size={15} /></div>
        <TelemetryChart history={history} />
        <button className="data-export" type="button" onClick={onExport}><Download size={15} />Export CSV</button>
      </section>

      <Inspector body={selectedBody} onUpdate={onUpdateBody} onRemove={onRemoveBody} canRemove={world.bodies.length > 1} running={running} />

      <section className="parallel-data" aria-labelledby="parallel-data-title">
        <div className="rail-section-heading"><span id="parallel-data-title">Objects</span><small>{world.bodies.length}</small></div>
        <table><thead><tr><th>Name</th><th>x</th><th>y</th><th>|v|</th></tr></thead><tbody>{world.bodies.map((body) => <tr key={body.id}><th>{body.name}</th><td>{format(body.position.x, 1)}</td><td>{format(body.position.y, 1)}</td><td>{format(Math.hypot(body.velocity.x, body.velocity.y), 1)}</td></tr>)}</tbody></table>
      </section>
    </aside>
  )
}
