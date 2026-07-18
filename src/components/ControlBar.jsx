import { Pause, Play, Plus, RotateCcw, SkipForward } from 'lucide-react'

export default function ControlBar({ running, onToggle, onReset, onStep, onAdd, speed, onSpeedChange }) {
  return (
    <div className="control-bar" aria-label="Simulation controls">
      <button className="primary-control" type="button" onClick={onToggle}>{running ? <Pause size={18} /> : <Play size={18} />}<span>{running ? 'Pause' : 'Run'}</span></button>
      <button type="button" onClick={onStep} disabled={running}><SkipForward size={17} /><span>Step</span></button>
      <button type="button" onClick={onReset}><RotateCcw size={17} /><span>Reset</span></button>
      <button type="button" onClick={onAdd} disabled={running}><Plus size={17} /><span>Add body</span></button>
      <label className="speed-control"><span>Playback</span><select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    </div>
  )
}
