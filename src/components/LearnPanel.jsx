import { Check, Lightbulb, RotateCcw, SkipForward } from 'lucide-react'
import { TUTORIALS } from '../domain/tutorials.js'

export default function LearnPanel({ tutorials, onLoadPreset }) {
  if (!tutorials.active) return <div className="learn-panel">
    <div className="panel-intro"><p className="micro-label">Guided learning</p><h1 id="builder-title">Tutorials</h1><p>Learn the interface, then investigate a measurable physics question.</p></div>
    <nav className="experiment-list" aria-label="Mechanarium tutorials">{TUTORIALS.map((tutorial, index) => {
      const complete = (tutorials.state.progress[tutorial.id] ?? 0) >= tutorial.steps.length
      return <button key={tutorial.id} type="button" onClick={() => { tutorials.start(tutorial.id); if (tutorial.presetId) onLoadPreset(tutorial.presetId) }}><span>{complete ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><div><strong>{tutorial.name}</strong><small>{tutorial.category}</small></div></button>
    })}</nav>
  </div>
  const { active, step, stepIndex } = tutorials
  return <div className="learn-panel active-tutorial">
    <div className="panel-intro"><p className="micro-label">{active.category}</p><h1 id="builder-title">{active.name}</h1><p>{active.objective}</p></div>
    <div className="tutorial-progress" aria-label={`Step ${stepIndex + 1} of ${active.steps.length}`}><span style={{ width: `${(stepIndex + 1) / active.steps.length * 100}%` }} /></div>
    <article className="tutorial-step"><small>Step {stepIndex + 1} of {active.steps.length}</small><h2>{step.title}</h2><p>{step.instruction}</p>{step.hint && <aside><Lightbulb size={15} /><span>{step.hint}</span></aside>}{!tutorials.canAdvance && <p className="tutorial-requirement">Complete this step in the laboratory to continue.</p>}</article>
    <div className="tutorial-actions"><button type="button" onClick={tutorials.advance} disabled={!tutorials.canAdvance}>{stepIndex === active.steps.length - 1 ? 'Complete tutorial' : 'Next step'}</button><button type="button" onClick={tutorials.restart}><RotateCcw size={14} />Restart</button><button type="button" onClick={tutorials.skip}><SkipForward size={14} />Skip</button></div>
  </div>
}
