import { useState } from 'react'
import { ArrowDown, BookOpen, Box, Circle, CircleDot, Crosshair, Gauge, GitBranch, Link2, Minus, Orbit, Ruler, SlidersHorizontal, Sparkles, Triangle, Waves } from 'lucide-react'
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
  { id: 'photogate', label: 'Photogate', icon: Gauge },
  { id: 'ruler', label: 'Ruler', icon: Ruler },
]

export default function BuilderRail({ presets, activePreset, world, tutorials, onAddElement, onLoadPreset }) {
  const [tab, setTab] = useState('build')
  const gravityOn = world.gravity.enabled
  const groundOn = world.constraints.some((constraint) => constraint.type === 'ground')
  return (
    <aside className="builder-rail" aria-labelledby="builder-title">
      <div className="rail-tabs" role="tablist" aria-label="World builder sections">
        <button type="button" role="tab" aria-selected={tab === 'build'} onClick={() => setTab('build')}><SlidersHorizontal size={15} />Build</button>
        <button type="button" role="tab" aria-selected={tab === 'labs'} onClick={() => setTab('labs')}><Sparkles size={15} />Labs</button>
        <button type="button" role="tab" aria-selected={tab === 'learn'} onClick={() => setTab('learn')}><BookOpen size={15} />Learn</button>
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
      ) : <div className="rail-content"><LearnPanel tutorials={tutorials} onLoadPreset={onLoadPreset} /></div>}
    </aside>
  )
}
