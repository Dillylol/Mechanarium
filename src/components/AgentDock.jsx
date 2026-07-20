import { useState } from 'react'
import { ArrowUp, Bot, LoaderCircle } from 'lucide-react'
import { askWorldAgent } from '../assistant/worldAgent.js'

export default function AgentDock({ scenario, world, selectedBody, notebook, onApply }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('Describe a world to build, or ask what the current data means.')
  const [source, setSource] = useState('ready')
  const [conversation, setConversation] = useState([])

  const currentGuideStep = () => {
    const rulerCount = world.instruments.filter((instrument) => instrument.type === 'ruler').length
    const gateCount = world.instruments.filter((instrument) => instrument.type === 'photogate').length
    if (!world.tracks.length) return 'Build or load an incline'
    if (!rulerCount || gateCount < 2) return 'Place a ruler and two photogates'
    if (!notebook.trials.length) return 'Record a baseline trial'
    if (notebook.trials.length === 1) return 'Change one variable and record a comparison trial'
    return 'Interpret whether the evidence supports the prediction'
  }

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
        history: conversation.slice(-6),
        telemetry: {
          time: world.time,
          energy: world.metrics.total,
          energy_error_percent: world.energyError.percent,
          momentum: world.metrics.linearMomentum,
          selected_body: selectedBody ?? world.bodies[0],
          lab: {
            guide_step: currentGuideStep(),
            instruments: world.instruments.map((instrument) => ({ id: instrument.id, name: instrument.name, type: instrument.type })),
            trials: notebook.trials.slice(-4).map((trial) => ({ id: trial.id, name: trial.name, independent_variable: trial.independentVariable, independent_value: trial.independentValue, sample_count: trial.samples.length, gate_event_count: trial.gateEvents.length, gate_results: trial.gateResults.slice(-2) })),
          },
        },
      })
      if (result.actions?.length) onApply(result.actions)
      setReply(result.message)
      setSource(result.source)
      setConversation((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: result.message }].slice(-8))
    } catch (error) {
      setReply(`I could not apply that assembly: ${error.message}`)
      setSource('validation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="agent-dock" aria-label="Vector physics agent">
      <div className="agent-reply" role="status" aria-live="polite"><Bot size={15} /><span><strong>Vector</strong>{reply}</span></div>
      <form onSubmit={submit}>
        <span className="agent-mark" aria-hidden="true">V</span>
        <label className="visually-hidden" htmlFor="agent-command">Ask Vector, the physics agent</label>
        <input id="agent-command" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Vector to build or explain..." autoComplete="off" />
        <span className="agent-source">{source === 'openai' ? 'Vector / OpenAI' : source === 'local' ? 'Vector / Local' : 'Vector'}</span>
        <button type="submit" aria-label="Send request to Vector" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={17} />}</button>
      </form>
    </section>
  )
}
