import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Magnet, Pause, Play, Redo2, Rewind, RotateCcw, Save, SkipForward, Undo2, Upload, X } from 'lucide-react'
import AgentDock from './components/AgentDock.jsx'
import BuilderRail from './components/BuilderRail.jsx'
import DataRail from './components/DataRail.jsx'
import WorldScene3D from './components/WorldScene3D.jsx'
import { downloadText, notebookJson, notebookToCsv, scenarioJson, telemetryToCsv } from './domain/export.js'
import { listPresets } from './domain/presets.js'
import { deserializeScenario } from './domain/scenario.js'
import { useSimulation } from './hooks/useSimulation.js'
import { useTutorials } from './hooks/useTutorials.js'

const WORLD_SAVES_KEY = 'mechanarium:world-saves:v1'
const LAST_WORLD_KEY = 'mechanarium:last-scenario'
const GRID_SETTINGS_KEY = 'mechanarium:grid-settings:v1'

function loadInitialScenario() {
  try {
    const stored = localStorage.getItem(LAST_WORLD_KEY)
    return stored ? deserializeScenario(stored) : 'projectile-motion'
  } catch {
    return 'projectile-motion'
  }
}

function loadSavedWorlds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORLD_SAVES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadGridSettings() {
  try {
    const stored = localStorage.getItem(GRID_SETTINGS_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    if (parsed && typeof parsed.snap === 'boolean' && typeof parsed.step === 'number') return parsed
  } catch { /* use default */ }
  return { snap: true, step: 0.5, planeGrid: true, showFloorGrid: true }
}

export default function App() {
  const [gridSettings, setGridSettings] = useState(loadGridSettings)
  const [overlays, setOverlays] = useState({ grid: true, dimensions: true, height: true, net: true, components: true, torque: true, trails: false })

  const effectiveGridSettings = useMemo(() => ({
    ...gridSettings,
    snap: Boolean(gridSettings.snap && overlays.grid),
  }), [gridSettings, overlays.grid])

  const simulation = useSimulation(loadInitialScenario, effectiveGridSettings)
  const [notice, setNotice] = useState('World ready')
  const [savedWorlds, setSavedWorlds] = useState(loadSavedWorlds)
  const fileInputRef = useRef(null)
  const presets = listPresets()
  const { world, selectedBody, selectedEntity, running, selectedId, removeEntity } = simulation
  const tutorials = useTutorials({ world, notebook: simulation.notebook, history: simulation.history })

  const toggleOverlay = (name) => {
    setOverlays((current) => {
      const next = { ...current, [name]: !current[name] }
      if (name === 'grid' && !next.grid) {
        setGridSettings((prev) => ({ ...prev, snap: false }))
      }
      return next
    })
  }

  const toggleSnap = () => {
    setGridSettings((prev) => {
      const nextSnap = !prev.snap
      if (nextSnap && !overlays.grid) {
        setOverlays((current) => ({ ...current, grid: true }))
      }
      return { ...prev, snap: nextSnap }
    })
  }

  useEffect(() => {
    try { localStorage.setItem(GRID_SETTINGS_KEY, JSON.stringify(gridSettings)) } catch { /* persistence is optional */ }
  }, [gridSettings])

  useEffect(() => {
    try { localStorage.setItem(WORLD_SAVES_KEY, JSON.stringify(savedWorlds)) } catch { /* persistence is optional */ }
  }, [savedWorlds])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        if (simulation.canUndo) simulation.undo()
        return
      }

      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault()
        if (simulation.canRedo) simulation.redo()
        return
      }

      if (['Delete', 'Backspace'].includes(event.key) && !running && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        removeEntity(selectedId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removeEntity, running, selectedId, simulation])

  const updateBody = (changes) => simulation.updateBody(selectedBody.id, changes)
  const moveBody = (bodyId, position, snapRadius) => simulation.moveAssemblyPart(bodyId, position, snapRadius)
  const nudgeSelected = (dx, dy) => {
    if (selectedEntity.type === 'segment') simulation.updateTrack(selectedEntity.id, { center: { x: selectedEntity.center.x + dx, y: selectedEntity.center.y + dy } })
    else if (selectedEntity.type === 'spline') simulation.updateTrack(selectedEntity.id, { knots: selectedEntity.knots.map((knot) => ({ ...knot, position: { x: knot.position.x + dx, y: knot.position.y + dy } })) })
    else if (selectedEntity.position) simulation.updateBody(selectedEntity.id, { position: { x: selectedEntity.position.x + dx, y: selectedEntity.position.y + dy } })
  }

  const saveLocally = () => {
    localStorage.setItem(LAST_WORLD_KEY, scenarioJson(simulation.scenario))
    setNotice('Saved on this device')
  }

  const saveNamedWorld = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    const saved = { id: crypto.randomUUID(), name: trimmed, updatedAt: new Date().toISOString(), scenario: simulation.scenario }
    setSavedWorlds((current) => [saved, ...current.filter((entry) => entry.name !== trimmed)])
    setNotice(`Saved ${trimmed}`)
    return true
  }

  const loadNamedWorld = (id) => {
    const saved = savedWorlds.find((entry) => entry.id === id)
    if (!saved) return
    simulation.replaceScenario(saved.scenario)
    setNotice(`Loaded ${saved.name}`)
  }

  const deleteNamedWorld = (id) => {
    setSavedWorlds((current) => current.filter((entry) => entry.id !== id))
    setNotice('Deleted saved world')
  }

  const restartPreset = () => {
    if (presets.some((preset) => preset.id === world.scenarioId)) simulation.loadPreset(world.scenarioId)
    else simulation.reset()
    setNotice('World restarted')
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
  const exportNotebookJson = () => downloadText(`${world.scenarioId}-notebook.json`, notebookJson(simulation.notebook), 'application/json')
  const exportNotebookCsv = () => downloadText(`${world.scenarioId}-notebook.csv`, notebookToCsv(simulation.notebook), 'text/csv')

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

  const [easterEggOpen, setEasterEggOpen] = useState(false)

  const toggleRun = () => {
    const accepted = simulation.setRunning(!simulation.running)
    if (accepted === false) setNotice(world.diagnostics.join(' '))
  }

  return (
    <div className="mechanarium-app">
      <header className="app-bar">
        <div className="wordmark">
          <button
            type="button"
            className="wordmark-m-btn"
            onClick={() => setEasterEggOpen(true)}
            aria-label="Mechanarium Dedication Easter Egg"
          >
            M
          </button>
          <a href="#world" className="wordmark-title" aria-label="Mechanarium home">
            <strong>MECHANARIUM</strong>
          </a>
        </div>
        <div className="scenario-identity"><small>ACTIVE WORLD</small><strong>{world.name}</strong></div>
        <div className="run-controls" aria-label="Simulation controls">
          <button className="run-button" type="button" onClick={toggleRun}>{simulation.running ? <Pause size={16} /> : <Play size={16} />}<span>{simulation.running ? 'Pause' : 'Run'}</span></button>
          <button type="button" onClick={simulation.toggleReverse} disabled={!simulation.canReverse} className={simulation.reversing ? 'active-control' : ''} aria-label="Play simulation in reverse" title={simulation.reversing ? 'Pause reverse playback' : simulation.canReverse ? 'Play simulation in reverse' : 'Run simulation first to enable reverse playback'}><Rewind size={16} /></button>
          <button type="button" onClick={simulation.stepOnce} disabled={simulation.running || simulation.reversing} aria-label="Advance one fixed step"><SkipForward size={16} /></button>
          <button type="button" onClick={simulation.reset} aria-label="Reset world"><RotateCcw size={16} /></button>
          <button type="button" onClick={simulation.undo} disabled={!simulation.canUndo || simulation.running || simulation.reversing} aria-label="Undo edit (Ctrl+Z)" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
          <button type="button" onClick={simulation.redo} disabled={!simulation.canRedo || simulation.running || simulation.reversing} aria-label="Redo edit (Ctrl+Y)" title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
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
        <BuilderRail presets={presets} activePreset={world.scenarioId} world={world} tutorials={tutorials} savedWorlds={savedWorlds} onAddElement={simulation.addElement} onLoadPreset={simulation.loadPreset} onReset={simulation.reset} onRestart={restartPreset} onSaveWorld={saveNamedWorld} onLoadWorld={loadNamedWorld} onDeleteWorld={deleteNamedWorld} onImport={() => fileInputRef.current?.click()} onExport={exportScenario} />

        <section id="world" className="world-stage" aria-labelledby="world-title">
          <div className="stage-bar">
            <div><p className="micro-label">{presets.find((preset) => preset.id === world.scenarioId)?.category ?? 'Custom system'}</p><h2 id="world-title">{world.name}</h2></div>
            <div className="view-options" aria-label="World overlays & snap grid">
              <button
                type="button"
                className={`grid-snap-btn${effectiveGridSettings.snap ? ' active' : ''}`}
                onClick={toggleSnap}
                title={effectiveGridSettings.snap ? 'Grid Snap ON (Click to disable)' : 'Grid Snap OFF (Click to enable)'}
              >
                <Magnet size={12} />
                <span>SNAP</span>
              </button>
              <label className="grid-step-select-label" title="Grid snap density / step size">
                <select
                  className="grid-step-select"
                  value={gridSettings.step}
                  onChange={(event) => setGridSettings((prev) => ({ ...prev, step: Number(event.target.value) }))}
                >
                  <option value={0.1}>0.1m</option>
                  <option value={0.25}>0.25m</option>
                  <option value={0.5}>0.5m</option>
                  <option value={1.0}>1.0m</option>
                </select>
              </label>
              {Object.entries(overlays).map(([name, enabled]) => <label key={name}><input type="checkbox" checked={enabled} onChange={() => toggleOverlay(name)} /><span>{name === 'height' ? 'h indicator' : name}</span></label>)}
            </div>
          </div>
          <div className="scene-shell">
            <WorldScene3D
              world={world}
              selectedId={simulation.selectedId}
              gridSettings={effectiveGridSettings}
              onSelect={simulation.setSelectedId}
              onMove={moveBody}
              onRequestBodySnap={simulation.requestBodySnap}
              onClearBodySnap={simulation.clearBodySnap}
              onMoveConstraint={simulation.moveConstraint}
              onMoveForce={simulation.moveEntity}
              onMoveInstrument={simulation.updateInstrument}
              onAlignInstrument={simulation.alignInstrument}
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
              dragSnapCandidate={simulation.dragSnapCandidate}
            />
            {(overlays.net || overlays.components || overlays.torque) && <div className="force-legend" aria-label="Force and torque overlay legend"><span className="net">Net</span><span className="gravity">Gravity</span><span className="tension">Tension</span><span className="reaction">Axle</span><span className="normal">Normal</span><span className="friction">Friction</span><span className="torque">Torque</span></div>}
            {(simulation.snapProposal || simulation.dragSnapCandidate || simulation.connectionPortId || simulation.snapFeedback) && (
              <div className={`snap-confirmation${simulation.snapProposal ? ' pending' : simulation.dragSnapCandidate ? ' acquired' : simulation.connectionPortId ? ' armed' : ' confirmed'}`} role={simulation.snapProposal ? 'dialog' : 'status'} aria-label={simulation.snapProposal ? 'Snap placement' : undefined} aria-live="polite">
                <div className="snap-indicator" aria-hidden="true">{simulation.snapProposal ? '◎' : simulation.dragSnapCandidate ? '↳' : simulation.connectionPortId ? '1' : '✓'}</div>
                <div>
                  <strong>{simulation.snapProposal ? 'Snap candidate' : simulation.dragSnapCandidate ? 'Snap acquired' : simulation.connectionPortId ? 'First port armed' : 'Placement confirmed'}</strong>
                  <p>{simulation.snapProposal?.message ?? (simulation.dragSnapCandidate ? `${simulation.dragSnapCandidate.sourceLabel} → ${simulation.dragSnapCandidate.targetLabel}. Release to preview this mount.` : simulation.connectionPortId ? `${simulation.connectionPortLabel} is mounted and ready. Select a second port, then preview a rigid or pin snap.` : simulation.snapFeedback)}</p>
                </div>
                {simulation.snapProposal && <div className="snap-actions"><button type="button" onClick={simulation.confirmSnap}>Snap to place</button><button type="button" onClick={simulation.cancelSnap}>Keep free</button></div>}
              </div>
            )}
            <AgentDock scenario={simulation.scenario} world={world} selectedEntity={selectedEntity} selectedBody={selectedBody} notebook={simulation.notebook} tutorialContext={tutorials.context} onApply={simulation.applyActions} />
          </div>
        </section>

        <DataRail
          world={world}
          selectedId={simulation.selectedId}
          selectedBody={selectedBody}
          selectedEntity={selectedEntity}
          connectorState={simulation.selectedConnectorState}
          loadState={simulation.selectedLoadState}
          eligibleWheels={simulation.eligibleWheels}
          connectionPortId={simulation.connectionPortId}
          history={simulation.history}
          recordingStatus={simulation.recordingStatus}
          pendingTrial={simulation.pendingTrial}
          notebook={simulation.notebook}
          onArmTrial={simulation.armTrial}
          onDiscardTrial={simulation.discardTrial}
          onSaveTrial={simulation.savePendingTrial}
          onDeleteTrial={simulation.deleteTrial}
          onExportNotebookJson={exportNotebookJson}
          onExportNotebookCsv={exportNotebookCsv}
          onSelectEntity={simulation.setSelectedId}
          onUpdateBody={updateBody}
          onUpdateTrack={simulation.updateTrack}
          onUpdateConnector={simulation.updateConnector}
          onRouteConnector={simulation.routeConnector}
          onUpdateInstrument={simulation.updateInstrument}
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

      {easterEggOpen && (
        <div className="easter-egg-backdrop" onClick={() => setEasterEggOpen(false)} role="dialog" aria-modal="true" aria-label="Dedication Easter Egg">
          <div className="easter-egg-modal" onClick={(event) => event.stopPropagation()}>
            <button className="easter-egg-close" type="button" onClick={() => setEasterEggOpen(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <div className="easter-egg-badge">MECHANARIUM DEDICATION</div>
            <blockquote className="easter-egg-quote">
              <p className="easter-egg-salutation">Dedicated to Mr. Botello,</p>
              <p className="easter-egg-main">For teaching me real physics before any AI could vibecode it.</p>
            </blockquote>
            <div className="easter-egg-divider" />
            <p className="easter-egg-thanks">Special thanks to DoD for testing out my AI slop.</p>
          </div>
        </div>
      )}
    </div>
  )
}
