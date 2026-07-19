import { useState } from 'react'
import { ArrowUp, Bot, LoaderCircle } from 'lucide-react'
import { askWorldAgent } from '../assistant/worldAgent.js'

export default function AgentDock({ scenario, world, onApply }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('Describe a world to build, or ask what the current data means.')
  const [source, setSource] = useState('ready')

  const submit = async (event) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || busy) return
    setBusy(true)
    setInput('')
    try {
      const result = await askWorldAgent({
        message,
        scenario,
        telemetry: {
          time: world.time,
          energy: world.metrics.total,
          energy_error_percent: world.energyError.percent,
          momentum: world.metrics.linearMomentum,
          selected_body: world.bodies[0],
        },
      })
      if (result.actions?.length) onApply(result.actions)
      setReply(result.message)
      setSource(result.source)
    } catch (error) {
      setReply(`I could not apply that assembly: ${error.message}`)
      setSource('validation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="agent-dock" aria-label="Mechanarium world agent">
      <div className="agent-reply" role="status" aria-live="polite"><Bot size={15} /><span>{reply}</span></div>
      <form onSubmit={submit}>
        <span className="agent-mark">M</span>
        <label className="visually-hidden" htmlFor="agent-command">Ask the world-building agent</label>
        <input id="agent-command" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Build a ramp with a sphere and gravity…" autoComplete="off" />
        <span className="agent-source">{source === 'openai' ? 'GPT‑5.6' : source === 'local' ? 'Local planner' : 'World agent'}</span>
        <button type="submit" aria-label="Send world-building request" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={17} />}</button>
      </form>
    </section>
  )
}
