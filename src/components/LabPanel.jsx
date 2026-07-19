import { useMemo, useState } from 'react'
import { Download, Gauge, Ruler, Trash2 } from 'lucide-react'
import { rulerReading } from '../domain/instruments.js'
import { NumberField } from './Inspector.jsx'
import TrialPlot from './TrialPlot.jsx'

const format = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export default function LabPanel({ world, selectedId, recordingStatus, pendingTrial, notebook, onSelect, onUpdate, onRemove, onArm, onDiscard, onSave, onDeleteTrial, onExportJson, onExportCsv, running }) {
  const [metadata, setMetadata] = useState({ name: '', independentVariable: 'Incline angle', independentValue: '', notes: '' })
  const instruments = world.instruments
  const lastTrial = pendingTrial ?? notebook.trials.at(-1)
  const guideSteps = useMemo(() => [
    ['State a prediction', Boolean(metadata.notes.trim())],
    ['Build or load an incline', world.tracks.length > 0],
    ['Place a ruler and two photogates', instruments.some((instrument) => instrument.type === 'ruler') && instruments.filter((instrument) => instrument.type === 'photogate').length >= 2],
    ['Record a baseline trial', notebook.trials.length >= 1],
    ['Change one variable', notebook.trials.length >= 1 && metadata.independentValue !== ''],
    ['Record a comparison trial', notebook.trials.length >= 2],
    ['Interpret the evidence', notebook.trials.length >= 2 && notebook.trials.some((trial) => trial.notes?.trim())],
  ], [instruments, metadata.independentValue, metadata.notes, notebook.trials, world.tracks.length])

  return <section className="lab-panel" aria-labelledby="lab-panel-title">
    <div className="rail-section-heading"><span id="lab-panel-title">Motion timing laboratory</span><small>{recordingStatus}</small></div>
    <ol className="guide-steps">{guideSteps.map(([label, complete], index) => <li key={label} className={complete ? 'complete' : ''}><span>{complete ? '✓' : index + 1}</span>{label}</li>)}</ol>

    <div className="trial-metadata">
      <label>Trial name<input value={metadata.name} onChange={(event) => setMetadata((current) => ({ ...current, name: event.target.value }))} placeholder={`Trial ${notebook.trials.length + 1}`} /></label>
      <label>Independent variable<input value={metadata.independentVariable} onChange={(event) => setMetadata((current) => ({ ...current, independentVariable: event.target.value }))} /></label>
      <label>Value<input value={metadata.independentValue} onChange={(event) => setMetadata((current) => ({ ...current, independentValue: event.target.value }))} placeholder="e.g. 20 deg" /></label>
      <label>Prediction / notes<textarea value={metadata.notes} onChange={(event) => setMetadata((current) => ({ ...current, notes: event.target.value }))} /></label>
    </div>
    <div className="trial-actions">
      {recordingStatus === 'idle' && <button type="button" className="record-button" onClick={() => onArm(metadata)} disabled={running}>Record trial</button>}
      {recordingStatus === 'armed' && <><strong>Armed — press Run</strong><button type="button" onClick={onDiscard}>Cancel</button></>}
      {recordingStatus === 'recording' && <strong>Recording at 120 Hz — Pause to review</strong>}
      {recordingStatus === 'review' && <><button type="button" className="record-button" onClick={onSave}>Save trial</button><button type="button" onClick={onDiscard}>Discard</button></>}
    </div>

    <div className="rail-section-heading"><span>Instruments</span><small>{instruments.length}</small></div>
    {instruments.length === 0 && <p className="environment-help">Add a ruler and two photogates from the Build panel.</p>}
    {instruments.map((instrument) => <article key={instrument.id} className={`instrument-card${instrument.id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(instrument.id)}>
      <div className="environment-card-heading"><span>{instrument.type === 'ruler' ? <Ruler size={15} /> : <Gauge size={15} />}<strong>{instrument.name}</strong></span><button type="button" className="icon-button danger" onClick={(event) => { event.stopPropagation(); onRemove(instrument.id) }} disabled={running} aria-label={`Remove ${instrument.name}`}><Trash2 size={15} /></button></div>
      <fieldset disabled={running}><div className="field-grid">
        {instrument.type === 'ruler' ? <>
          <NumberField label="Start x" value={instrument.a.x} unit="m" onChange={(x) => onUpdate(instrument.id, { a: { ...instrument.a, x } })} />
          <NumberField label="Start y" value={instrument.a.y} unit="m" onChange={(y) => onUpdate(instrument.id, { a: { ...instrument.a, y } })} />
          <NumberField label="End x" value={instrument.b.x} unit="m" onChange={(x) => onUpdate(instrument.id, { b: { ...instrument.b, x } })} />
          <NumberField label="End y" value={instrument.b.y} unit="m" onChange={(y) => onUpdate(instrument.id, { b: { ...instrument.b, y } })} />
        </> : <>
          <NumberField label="Center x" value={instrument.center.x} unit="m" onChange={(x) => onUpdate(instrument.id, { center: { ...instrument.center, x } })} />
          <NumberField label="Center y" value={instrument.center.y} unit="m" onChange={(y) => onUpdate(instrument.id, { center: { ...instrument.center, y } })} />
          <NumberField label="Angle" value={instrument.angle * 180 / Math.PI} unit="deg" onChange={(angle) => onUpdate(instrument.id, { angle: angle * Math.PI / 180 })} />
          <NumberField label="Aperture" value={instrument.length} unit="m" min={0.1} onChange={(length) => onUpdate(instrument.id, { length })} />
          <label className="instrument-target">Target body<select value={instrument.targetBodyId ?? ''} onChange={(event) => onUpdate(instrument.id, { targetBodyId: event.target.value || null })}>
            <option value="">Any body</option>
            {world.bodies.map((body) => <option value={body.id} key={body.id}>{body.name}</option>)}
          </select></label>
        </>}
        <NumberField label="Resolution" value={instrument.resolution} unit={instrument.type === 'ruler' ? 'm' : 's'} min={0.000001} onChange={(resolution) => onUpdate(instrument.id, { resolution })} />
        <NumberField label="Uncertainty" value={instrument.noiseSigma} unit={instrument.type === 'ruler' ? 'm' : 's'} min={0} onChange={(noiseSigma) => onUpdate(instrument.id, { noiseSigma })} />
      </div><label className="check-field"><input type="checkbox" checked={instrument.noiseEnabled} onChange={(event) => onUpdate(instrument.id, { noiseEnabled: event.target.checked })} />Apply seeded measurement noise</label></fieldset>
      {instrument.type === 'ruler' && <p className="instrument-reading">Distance {format(rulerReading(instrument).distance)} m · Δx {format(rulerReading(instrument).dx)} m · Δy {format(rulerReading(instrument).dy)} m</p>}
    </article>)}

    {lastTrial?.gateEvents?.length > 0 && <section className="gate-readings" aria-label="Photogate readings"><div className="rail-section-heading"><span>Gate readings</span><small>{lastTrial.gateEvents.length}</small></div>{lastTrial.gateEvents.slice(-6).map((event) => <p key={event.id}><strong>{event.gateName}</strong><span>{event.bodyName} · {format(event.time, 4)} s · {format(event.speed)} m/s</span></p>)}</section>}
    {lastTrial?.gateResults?.length > 0 && <section className="gate-results" aria-label="Derived gate results">{lastTrial.gateResults.map((result, index) => <p key={`${result.bodyId}-${index}`}><strong>{result.bodyName}</strong><span>Δt {format(result.interval, 4)} s · v̄ {format(result.averageSpeed)} m/s · a {format(result.acceleration)} m/s²</span></p>)}</section>}

    <div className="rail-section-heading"><span>Saved trials</span><small>{notebook.trials.length}</small></div>
    {notebook.trials.map((trial) => <article className="trial-row" key={trial.id}><div><strong>{trial.name}</strong><small>{trial.independentVariable}{trial.independentValue ? ` · ${trial.independentValue}` : ''}</small></div><span>{format(trial.duration)} s</span><button type="button" onClick={() => onDeleteTrial(trial.id)} aria-label={`Delete ${trial.name}`}><Trash2 size={13} /></button></article>)}
    <TrialPlot trials={notebook.trials} />
    <div className="notebook-actions"><button type="button" onClick={onExportJson} disabled={!notebook.trials.length}><Download size={14} />Notebook JSON</button><button type="button" onClick={onExportCsv} disabled={!notebook.trials.length}><Download size={14} />Notebook CSV</button></div>
  </section>
}
