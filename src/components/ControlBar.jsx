import { Pause, Play, Plus, Rewind, RotateCcw, SkipForward } from 'lucide-react'

export default function ControlBar({ running, reversing, canReverse, onToggle, onReverseToggle, onReset, onStep, onAdd, speed, onSpeedChange }) {
  return (
    <div className="control-bar" aria-label="Simulation controls">
      <button className="primary-control" type="button" onClick={onToggle}>{running ? <Pause size={18} /> : <Play size={18} />}<span>{running ? 'Pause' : 'Run'}</span></button>
      <button type="button" onClick={onReverseToggle} disabled={!canReverse} className={reversing ? 'active-control' : ''} title={reversing ? 'Pause reverse playback' : canReverse ? 'Play simulation in reverse' : 'Run simulation first to enable reverse playback'}><Rewind size={17} /><span>{reversing ? 'Pause Rev' : 'Reverse'}</span></button>
      <button type="button" onClick={onStep} disabled={running || reversing}><SkipForward size={17} /><span>Step</span></button>
      <button type="button" onClick={onReset}><RotateCcw size={17} /><span>Reset</span></button>
      <button type="button" onClick={onAdd} disabled={running || reversing}><Plus size={17} /><span>Add body</span></button>
      <label className="speed-control"><span>Playback</span><select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    </div>
  )
}
