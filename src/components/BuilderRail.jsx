import { useState } from 'react'
import { ArrowDown, BookOpen, Box, Circle, CircleDot, Crosshair, Download, Gauge, GitBranch, HardDrive, Link2, Minus, Orbit, RotateCcw, Ruler, Save, SlidersHorizontal, Sparkles, Trash2, Triangle, Upload, Waves } from 'lucide-react'
import LearnPanel from './LearnPanel.jsx'

const elements = [
  { id: 'sphere', label: 'Sphere', icon: Circle },
  { id: 'box', label: 'Block', icon: Box },
  { id: 'ramp', label: 'Ramp', icon: Triangle },
  { id: 'spline', label: 'Spline', icon: GitBranch },
  { id: 'loop', label: 'Loop', icon: CircleDot },
  { id: 'hill', label: 'Hill', icon: GitBranch },
  { id: 'valley', label: 'Valley', icon: GitBranch },
  { id: 'floor', label: 'Floor', icon: Minus },
  { id: 'spring', label: 'Spring', icon: Waves },
  { id: 'rope', label: 'Rope', icon: Link2 },
  { id: 'beam', label: 'Beam', icon: Minus },
  { id: 'wheel', label: 'Wheel', icon: CircleDot },
  { id: 'attachment', label: 'Attachment Point', icon: Crosshair },
  { id: 'gravity', label: 'Gravity', icon: ArrowDown },
  { id: 'attractor', label: 'Attractor', icon: Orbit },
]

const instruments = [
  { id: 'photogateAssembly', label: 'Photogate Assembly', icon: Gauge },
  { id: 'photogate', label: 'Photogate', icon: Gauge },
  { id: 'ruler', label: 'Ruler', icon: Ruler },
]

export default function BuilderRail({ presets, activePreset, world, tutorials, savedWorlds = [], onAddElement, onLoadPreset, onReset, onRestart, onSaveWorld, onLoadWorld, onDeleteWorld, onImport, onExport }) {
  const [tab, setTab] = useState('build')
  const [saveName, setSaveName] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const gravityOn = world.gravity.enabled
  const groundOn = world.constraints.some((constraint) => constraint.type === 'ground')
  return (
    <aside className="builder-rail" aria-labelledby="builder-title">
      <div className="rail-tabs" role="tablist" aria-label="World builder sections">
        <button type="button" role="tab" aria-selected={tab === 'build'} onClick={() => setTab('build')}><SlidersHorizontal size={15} />Build</button>
        <button type="button" role="tab" aria-selected={tab === 'labs'} onClick={() => setTab('labs')}><Sparkles size={15} />Labs</button>
        <button type="button" role="tab" aria-selected={tab === 'learn'} onClick={() => setTab('learn')}><BookOpen size={15} />Learn</button>
        <button type="button" role="tab" aria-selected={tab === 'world'} onClick={() => setTab('world')}><HardDrive size={15} />World</button>
      </div>

      {tab === 'build' ? (
        <div className="rail-content">
          <div className="panel-intro"><p className="micro-label">World builder</p><h1 id="builder-title">Elements</h1><p>Place a component, then position it directly in the world.</p></div>
          <div className="element-grid">
            {elements.map(({ id, label, icon: Icon }) => {
              const isToggle = id === 'gravity' || id === 'floor'
              const active = id === 'gravity' ? gravityOn : id === 'floor' ? groundOn : false
              const ariaLabel = isToggle ? `Turn ${label} ${active ? 'Off' : 'On'}` : `Add ${label}`
              return <button key={id} type="button" className={active ? 'active' : ''} onClick={() => onAddElement(id)} aria-label={ariaLabel}><Icon size={22} strokeWidth={1.6} /><span>{label}</span><small>{isToggle ? (active ? 'on' : 'off') : '+'}</small></button>
            })}
          </div>
          <div className="rail-section-heading"><span>Lab instruments</span><small>measure</small></div>
          <div className="instrument-list">
            {instruments.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onAddElement(id)} aria-label={`Add ${label}`}><Icon size={17} /><span>{label}</span><small>+</small></button>)}
          </div>
          <div className="builder-note"><strong>Assembly mode</strong><p>Pick up a part to reveal every compatible green mount. Yellow source nodes magnetically align nearby; release, then confirm Snap to place. Run locks the topology.</p></div>
        </div>
      ) : tab === 'labs' ? (
        <div className="rail-content">
          <div className="panel-intro"><p className="micro-label">Prepared systems</p><h1 id="builder-title">Experiments</h1><p>Start with a known phenomenon, then alter its assumptions.</p></div>
          <nav className="experiment-list" aria-label="Prepared physics experiments">
            {presets.map((preset, index) => (
              <button key={preset.id} type="button" className={activePreset === preset.id ? 'active' : ''} onClick={() => onLoadPreset(preset.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{preset.name}</strong><small>{preset.category}</small></div>
              </button>
            ))}
          </nav>
        </div>
      ) : tab === 'learn' ? <div className="rail-content"><LearnPanel tutorials={tutorials} onLoadPreset={onLoadPreset} /></div> : (
        <div className="rail-content world-menu">
          <div className="panel-intro"><p className="micro-label">World management</p><h1 id="builder-title">World</h1><p>Restart experiments, preserve named snapshots, or move worlds between devices.</p></div>
          <div className="world-action-grid">
            <button type="button" onClick={onReset}><RotateCcw size={17} /><span>Reset run</span><small>Restore the current starting state</small></button>
            <button type="button" onClick={onRestart}><RotateCcw size={17} /><span>Restart preset</span><small>Reload the prepared experiment</small></button>
            <button type="button" onClick={onImport}><Upload size={17} /><span>Import</span><small>Open scenario JSON</small></button>
            <button type="button" onClick={onExport}><Download size={17} /><span>Export</span><small>Download scenario JSON</small></button>
          </div>
          <div className="rail-section-heading"><span>Named saves</span><small>{savedWorlds.length}</small></div>
          <form className="world-save-form" onSubmit={(event) => { event.preventDefault(); if (onSaveWorld(saveName)) setSaveName('') }}>
            <label><span>Save name</span><input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder={world.name} /></label>
            <button type="submit" disabled={!saveName.trim()}><Save size={15} />Save snapshot</button>
          </form>
          <div className="world-save-list">
            {savedWorlds.length === 0 && <p className="environment-help">No named worlds saved yet. The current valid world is restored automatically on startup.</p>}
            {savedWorlds.map((saved) => <article key={saved.id} className="trial-row"><button type="button" className="saved-world-load" onClick={() => onLoadWorld(saved.id)}><strong>{saved.name}</strong><small>{new Date(saved.updatedAt).toLocaleString()}</small></button><button type="button" className={deleteCandidate === saved.id ? 'danger' : ''} onClick={() => { if (deleteCandidate === saved.id) { onDeleteWorld(saved.id); setDeleteCandidate(null) } else setDeleteCandidate(saved.id) }} aria-label={deleteCandidate === saved.id ? `Confirm delete ${saved.name}` : `Delete ${saved.name}`} title={deleteCandidate === saved.id ? 'Click again to confirm deletion' : 'Delete saved world'}><Trash2 size={13} /></button></article>)}
          </div>
        </div>
      )}
    </aside>
  )
}
