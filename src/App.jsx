import { useRef, useState } from 'react'
import { Activity, BookOpen, Download, FlaskConical, Gauge, Save, Upload } from 'lucide-react'
import ControlBar from './components/ControlBar.jsx'
import Inspector from './components/Inspector.jsx'
import TelemetryChart from './components/TelemetryChart.jsx'
import WorldCanvas from './components/WorldCanvas.jsx'
import { downloadText, scenarioJson, telemetryToCsv } from './domain/export.js'
import { listPresets } from './domain/presets.js'
import { deserializeScenario } from './domain/scenario.js'
import { useSimulation } from './hooks/useSimulation.js'

const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export default function App() {
  const simulation = useSimulation()
  const [overlays, setOverlays] = useState({ grid: true, vectors: true, trails: true })
  const [notice, setNotice] = useState('Ready to experiment.')
  const fileInputRef = useRef(null)
  const presets = listPresets()
  const { world, selectedBody } = simulation

  const toggleOverlay = (name) => setOverlays((current) => ({ ...current, [name]: !current[name] }))

  const updateBody = (changes) => simulation.updateBody(selectedBody.id, changes)
  const moveBody = (bodyId, position) => simulation.updateBody(bodyId, { position, velocity: { x: 0, y: 0 } })
  const nudgeSelected = (dx, dy) => updateBody({ position: { x: selectedBody.position.x + dx, y: selectedBody.position.y + dy } })

  const saveLocally = () => {
    localStorage.setItem('mechanarium:last-scenario', scenarioJson(simulation.scenario))
    setNotice('Experiment saved on this device.')
  }

  const exportScenario = () => {
    downloadText(`${world.scenarioId}.mechanarium.json`, scenarioJson(simulation.scenario), 'application/json')
    setNotice('Scenario JSON exported.')
  }

  const exportData = () => {
    if (simulation.history.length === 0) {
      setNotice('Run or step the experiment before exporting data.')
      return
    }
    downloadText(`${world.scenarioId}-telemetry.csv`, telemetryToCsv(simulation.history), 'text/csv')
    setNotice('Telemetry CSV exported.')
  }

  const importScenario = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      simulation.replaceScenario(deserializeScenario(await file.text()))
      setNotice(`Loaded ${file.name}.`)
    } catch (error) {
      setNotice(`Could not load scenario: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const loadPreset = (id) => {
    simulation.loadPreset(id)
    setNotice(`Loaded ${presets.find((preset) => preset.id === id)?.name}.`)
  }

  const kinetic = world.metrics.translationalKinetic + world.metrics.rotationalKinetic
  const momentum = Math.hypot(world.metrics.linearMomentum.x, world.metrics.linearMomentum.y)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#laboratory" aria-label="Mechanarium home">
          <span className="brand-mark"><FlaskConical size={22} /></span>
          <span><strong>Mechanarium</strong><small>Interactive mechanics laboratory</small></span>
        </a>
        <div className="top-actions">
          <button type="button" onClick={saveLocally}><Save size={16} />Save</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={16} />Import</button>
          <button type="button" onClick={exportScenario}><Download size={16} />Scenario</button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importScenario} aria-label="Import scenario JSON" />
        </div>
      </header>

      <main id="laboratory" className="laboratory-layout">
        <aside className="preset-rail" aria-labelledby="presets-title">
          <div className="rail-intro"><p className="eyebrow">Experiment library</p><h1 id="presets-title">Choose a phenomenon</h1><p>Start with a prepared system, then change its conditions and observe what survives.</p></div>
          <nav aria-label="Physics experiment presets">
            {presets.map((preset) => (
              <button key={preset.id} className={`preset-card ${world.scenarioId === preset.id ? 'active' : ''}`} type="button" onClick={() => loadPreset(preset.id)} aria-current={world.scenarioId === preset.id ? 'page' : undefined}>
                <span>{preset.category}</span><strong>{preset.name}</strong><small>{preset.description}</small>
              </button>
            ))}
          </nav>
          <div className="keyboard-note"><strong>Canvas shortcuts</strong><span>Space: run/pause</span><span>Arrows: move selected body</span><span>Delete: remove selected body</span></div>
        </aside>

        <section className="workspace" aria-labelledby="world-title">
          <div className="workspace-heading">
            <div><p className="eyebrow">{presets.find((preset) => preset.id === world.scenarioId)?.category ?? 'Custom experiment'}</p><h2 id="world-title">{world.name}</h2><p>{world.description}</p></div>
            <div className="time-readout"><small>Simulation time</small><strong>{format(world.time, 3)} s</strong></div>
          </div>

          <div className="world-frame">
            <WorldCanvas
              world={world}
              selectedId={simulation.selectedId}
              onSelect={simulation.setSelectedId}
              onMove={moveBody}
              onNudge={nudgeSelected}
              onDelete={() => simulation.removeBody(simulation.selectedId)}
              onToggle={() => simulation.setRunning(!simulation.running)}
              running={simulation.running}
              history={simulation.history}
              overlays={overlays}
            />
            <div className="overlay-controls" aria-label="Canvas overlays">
              {Object.entries(overlays).map(([name, enabled]) => (
                <label key={name}><input type="checkbox" checked={enabled} onChange={() => toggleOverlay(name)} /><span>{name}</span></label>
              ))}
            </div>
          </div>

          <ControlBar
            running={simulation.running}
            onToggle={() => simulation.setRunning(!simulation.running)}
            onReset={simulation.reset}
            onStep={simulation.stepOnce}
            onAdd={simulation.addBody}
            speed={simulation.speed}
            onSpeedChange={simulation.setSpeed}
          />

          <div className="lesson-strip">
            <BookOpen size={20} />
            <div><strong>Observation prompt</strong><p>{world.lesson}</p></div>
          </div>
        </section>

        <aside className="analysis-rail">
          <Inspector body={selectedBody} onUpdate={updateBody} onRemove={() => simulation.removeBody(selectedBody.id)} canRemove={world.bodies.length > 1} running={simulation.running} />

          <section className="telemetry" aria-labelledby="telemetry-title">
            <div className="section-heading"><div><p className="eyebrow">Live measurements</p><h2 id="telemetry-title">System telemetry</h2></div><Activity size={20} /></div>
            <div className="metric-grid">
              <article><small>Total energy</small><strong>{format(world.metrics.total)} J</strong><span>Δ {format(world.energyError.percent, 3)}%</span></article>
              <article><small>Kinetic</small><strong>{format(kinetic)} J</strong><span>translation + rotation</span></article>
              <article><small>Potential</small><strong>{format(world.metrics.potential)} J</strong><span>force fields</span></article>
              <article><small>Momentum</small><strong>{format(momentum)} kg·m/s</strong><span>system magnitude</span></article>
            </div>
            <TelemetryChart history={simulation.history} />
            <button className="export-data" type="button" onClick={exportData}><Download size={16} />Export collected data</button>
          </section>

          <section className="body-table-wrap" aria-labelledby="body-table-title">
            <div className="section-heading"><div><p className="eyebrow">Accessible data view</p><h2 id="body-table-title">Bodies</h2></div><Gauge size={20} /></div>
            <div className="table-scroll"><table><thead><tr><th>Name</th><th>x (m)</th><th>y (m)</th><th>Speed (m/s)</th></tr></thead><tbody>{world.bodies.map((body) => <tr key={body.id} className={body.id === simulation.selectedId ? 'selected' : ''}><th><button type="button" onClick={() => simulation.setSelectedId(body.id)}>{body.name}</button></th><td>{format(body.position.x)}</td><td>{format(body.position.y)}</td><td>{format(Math.hypot(body.velocity.x, body.velocity.y))}</td></tr>)}</tbody></table></div>
          </section>
        </aside>
      </main>
      <div className="notice" role="status" aria-live="polite">{notice}</div>
    </div>
  )
}
