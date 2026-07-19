import { useRef, useState } from 'react'
import { Download, Pause, Play, RotateCcw, Save, SkipForward, Upload } from 'lucide-react'
import AgentDock from './components/AgentDock.jsx'
import BuilderRail from './components/BuilderRail.jsx'
import DataRail from './components/DataRail.jsx'
import WorldScene3D from './components/WorldScene3D.jsx'
import { downloadText, scenarioJson, telemetryToCsv } from './domain/export.js'
import { listPresets } from './domain/presets.js'
import { deserializeScenario } from './domain/scenario.js'
import { useSimulation } from './hooks/useSimulation.js'

export default function App() {
  const simulation = useSimulation()
  const [overlays, setOverlays] = useState({ grid: true, vectors: true, trails: false })
  const [notice, setNotice] = useState('World ready')
  const fileInputRef = useRef(null)
  const presets = listPresets()
  const { world, selectedBody, selectedEntity } = simulation

  const updateBody = (changes) => simulation.updateBody(selectedBody.id, changes)
  const moveBody = (bodyId, position) => simulation.moveEntity(bodyId, position)
  const nudgeSelected = (dx, dy) => {
    if (selectedEntity.type === 'segment') simulation.updateTrack(selectedEntity.id, { center: { x: selectedEntity.center.x + dx, y: selectedEntity.center.y + dy } })
    else if (selectedEntity.position) simulation.updateBody(selectedEntity.id, { position: { x: selectedEntity.position.x + dx, y: selectedEntity.position.y + dy } })
  }

  const saveLocally = () => {
    localStorage.setItem('mechanarium:last-scenario', scenarioJson(simulation.scenario))
    setNotice('Saved on this device')
  }

  const exportScenario = () => {
    downloadText(`${world.scenarioId}.mechanarium.json`, scenarioJson(simulation.scenario), 'application/json')
    setNotice('Scenario exported')
  }

  const exportData = () => {
    if (!simulation.history.length) {
      setNotice('Run or step before exporting data')
      return
    }
    downloadText(`${world.scenarioId}-telemetry.csv`, telemetryToCsv(simulation.history), 'text/csv')
    setNotice('Telemetry exported')
  }

  const importScenario = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      simulation.replaceScenario(deserializeScenario(await file.text()))
      setNotice(`Loaded ${file.name}`)
    } catch (error) {
      setNotice(`Import failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const toggleOverlay = (name) => setOverlays((current) => ({ ...current, [name]: !current[name] }))
  const toggleRun = () => {
    const accepted = simulation.setRunning(!simulation.running)
    if (accepted === false) setNotice(world.diagnostics.join(' '))
  }

  return (
    <div className="mechanarium-app">
      <header className="app-bar">
        <a className="wordmark" href="#world" aria-label="Mechanarium home"><span>M</span><strong>MECHANARIUM</strong></a>
        <div className="scenario-identity"><small>ACTIVE WORLD</small><strong>{world.name}</strong></div>
        <div className="run-controls" aria-label="Simulation controls">
          <button className="run-button" type="button" onClick={toggleRun}>{simulation.running ? <Pause size={16} /> : <Play size={16} />}<span>{simulation.running ? 'Pause' : 'Run'}</span></button>
          <button type="button" onClick={simulation.stepOnce} disabled={simulation.running} aria-label="Advance one fixed step"><SkipForward size={16} /></button>
          <button type="button" onClick={simulation.reset} aria-label="Reset world"><RotateCcw size={16} /></button>
          <label className="speed-select"><span className="visually-hidden">Playback speed</span><select value={simulation.speed} onChange={(event) => simulation.setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
        </div>
        <div className="file-actions">
          <button type="button" onClick={saveLocally} aria-label="Save world locally"><Save size={15} /></button>
          <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Import world"><Upload size={15} /></button>
          <button type="button" onClick={exportScenario} aria-label="Export world"><Download size={15} /></button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importScenario} aria-label="Import scenario JSON" />
        </div>
      </header>

      <main className="studio-layout">
        <BuilderRail presets={presets} activePreset={world.scenarioId} world={world} onAddElement={simulation.addElement} onLoadPreset={simulation.loadPreset} />

        <section id="world" className="world-stage" aria-labelledby="world-title">
          <div className="stage-bar">
            <div><p className="micro-label">{presets.find((preset) => preset.id === world.scenarioId)?.category ?? 'Custom system'}</p><h2 id="world-title">{world.name}</h2></div>
            <div className="view-options" aria-label="World overlays">
              {Object.entries(overlays).map(([name, enabled]) => <label key={name}><input type="checkbox" checked={enabled} onChange={() => toggleOverlay(name)} /><span>{name}</span></label>)}
            </div>
          </div>
          <div className="scene-shell">
            <WorldScene3D
              world={world}
              selectedId={simulation.selectedId}
              onSelect={simulation.setSelectedId}
              onMove={moveBody}
              onMoveConstraint={simulation.moveConstraint}
              onRequestTrackSnap={simulation.requestTrackSnap}
              onTransform={(id, changes) => world.tracks.some((track) => track.id === id) ? simulation.updateTrack(id, changes) : simulation.updateBody(id, changes)}
              onMoveConnectorEndpoint={simulation.moveConnectorEndpoint}
              onRequestConnectorSnap={simulation.requestConnectorSnap}
              onDisconnect={() => simulation.disconnectConnector(simulation.selectedId)}
              onNudge={nudgeSelected}
              onDelete={() => simulation.removeEntity(simulation.selectedId)}
              onToggle={toggleRun}
              running={simulation.running}
              history={simulation.history}
              overlays={overlays}
              snapProposal={simulation.snapProposal}
            />
            {(simulation.snapProposal || simulation.snapFeedback) && (
              <div className={`snap-confirmation${simulation.snapProposal ? ' pending' : ' confirmed'}`} role={simulation.snapProposal ? 'dialog' : 'status'} aria-label={simulation.snapProposal ? 'Snap placement' : undefined} aria-live="polite">
                <div className="snap-indicator" aria-hidden="true">{simulation.snapProposal ? '◎' : '✓'}</div>
                <div>
                  <strong>{simulation.snapProposal ? 'Snap candidate' : 'Placement confirmed'}</strong>
                  <p>{simulation.snapProposal?.message ?? simulation.snapFeedback}</p>
                </div>
                {simulation.snapProposal && <div className="snap-actions"><button type="button" onClick={simulation.confirmSnap}>Snap to place</button><button type="button" onClick={simulation.cancelSnap}>Keep free</button></div>}
              </div>
            )}
            <AgentDock scenario={simulation.scenario} world={world} onApply={simulation.applyActions} />
          </div>
        </section>

        <DataRail
          world={world}
          selectedBody={selectedBody}
          selectedEntity={selectedEntity}
          connectorState={simulation.selectedConnectorState}
          connectionPortId={simulation.connectionPortId}
          history={simulation.history}
          onSelectEntity={simulation.setSelectedId}
          onUpdateBody={updateBody}
          onUpdateTrack={simulation.updateTrack}
          onUpdateConnector={simulation.updateConnector}
          onUpdatePort={simulation.updatePort}
          onPinToWorld={simulation.pinPortToWorld}
          onConnectPort={simulation.connectPort}
          onUpdateGravity={simulation.updateGravity}
          onRemoveEntity={simulation.removeEntity}
          onUpdateForce={simulation.updateForce}
          onRemoveForce={simulation.removeForce}
          onUpdateConstraint={simulation.updateConstraint}
          onRemoveConstraint={simulation.removeConstraint}
          onPrepareOrbit={simulation.prepareOrbit}
          onPlaceAtStart={simulation.placeBodyAtStart}
          onExport={exportData}
          running={simulation.running}
        />
      </main>
      <div className="app-notice" role="status" aria-live="polite">{notice}</div>
    </div>
  )
}
