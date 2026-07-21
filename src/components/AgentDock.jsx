import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, Check, Image, LoaderCircle, MessageSquare, Trash2, X } from 'lucide-react'
import { askWorldAgent } from '../assistant/worldAgent.js'

function formatLatex(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/\\\(|\\\)/g, '')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="math-frac"><sup>$1</sup>&frasl;<sub>$2</sub></span>')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\infty/g, '∞')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\le(q)?/g, '≤')
    .replace(/\\ge(q)?/g, '≥')
    .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^([0-9a-zA-Z+-]+)/g, '<sup>$1</sup>')
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
    .replace(/_([0-9a-zA-Z]+)/g, '<sub>$1</sub>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function LatexText({ text }) {
  if (!text) return null
  const html = formatLatex(text)
  return <span className="latex-rendered" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function AgentDock({ scenario, world, selectedEntity, selectedBody, notebook, tutorialContext, onApply }) {
  const [input, setInput] = useState('')
  const [attachedImage, setAttachedImage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('Describe a world to build, paste a problem image (Ctrl+V), or ask what the data means.')
  const [source, setSource] = useState('ready')
  const [conversation, setConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('mechanarium_agent_conversation')
      const parsed = saved ? JSON.parse(saved) : []
      return parsed.flatMap((item) => {
        const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null
        if (!role) return []
        const content = typeof item?.content === 'string' ? item.content.trim().slice(0, 1_000) : ''
        return content ? [{ role, content, image: item?.image ?? null }] : []
      }).slice(-16)
    } catch {
      return []
    }
  })
  const [proposal, setProposal] = useState(null)
  const [tutor, setTutor] = useState(null)
  const [chatMounted, setChatMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const imageInputRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem('mechanarium_agent_conversation', JSON.stringify(conversation))
    } catch (e) {
      console.warn('Failed to save conversation', e)
    }
  }, [conversation])

  const clearConversation = () => {
    setConversation([])
    try {
      localStorage.removeItem('mechanarium_agent_conversation')
    } catch (e) {
      console.warn('Failed to clear conversation', e)
    }
  }

  const toggleChat = () => {
    if (chatOpen) {
      setChatOpen(false)
      setTimeout(() => setChatMounted(false), 260)
    } else {
      setChatMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setChatOpen(true)
        })
      })
    }
  }

  const closeChat = () => {
    if (chatOpen) {
      setChatOpen(false)
      setTimeout(() => setChatMounted(false), 260)
    }
  }

  const currentGuideStep = () => {
    const rulerCount = world.instruments.filter((instrument) => instrument.type === 'ruler').length
    const gateCount = world.instruments.filter((instrument) => instrument.type === 'photogate').length
    if (!world.tracks.length) return 'Build or load an incline'
    if (!rulerCount || gateCount < 2) return 'Place a ruler and two photogates'
    if (!notebook.trials.length) return 'Record a baseline trial'
    if (notebook.trials.length === 1) return 'Change one variable and record a comparison trial'
    return 'Interpret whether the evidence supports the prediction'
  }

  const handlePaste = (event) => {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => setAttachedImage(e.target.result)
          reader.readAsDataURL(file)
        }
        break
      }
    }
  }

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setAttachedImage(e.target.result)
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const submit = async (event) => {
    event.preventDefault()
    const message = input.trim()
    if ((!message && !attachedImage) || busy) return
    const sendingImage = attachedImage
    setBusy(true)
    setInput('')
    setAttachedImage(null)
    try {
      const result = await askWorldAgent({
        message: message || 'Examine this physics problem diagram/image, build the world, and guide me.',
        image: sendingImage,
        scenario,
        world,
        selectedEntity: selectedEntity ?? selectedBody,
        notebook,
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
          tutorial: tutorialContext ?? null,
        },
      })
      if (result.actions?.length) onApply(result.actions)
      setProposal(result.proposal ?? null)
      setTutor(result.tutorial ?? null)
      setReply(result.message)
      setSource(result.source)
      setConversation((current) => [
        ...current,
        { role: 'user', content: (message || '[Attached Diagram]').slice(0, 1_000), image: sendingImage },
        { role: 'assistant', content: result.message.slice(0, 1_000) },
      ].slice(-16))
    } catch (error) {
      setReply(`I could not apply that assembly: ${error.message}`)
      setSource('validation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="agent-dock" aria-label="Vector physics agent">
      {chatMounted && (
        <div className={`agent-chat-drawer ${chatOpen ? 'open' : 'closing'}`} role="dialog" aria-label="Vector AI Assistant Chat Window">
          <div className="agent-chat-header">
            <span><Bot size={14} style={{ display: 'inline', marginRight: 6 }} />Vector AI Assistant Chat ({conversation.length} messages)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {conversation.length > 0 && (
                <button type="button" className="agent-text-btn" onClick={clearConversation} title="Clear conversation history">
                  <Trash2 size={13} /> Clear
                </button>
              )}
              <button type="button" className="agent-text-btn" onClick={closeChat} title="Close chat window">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="agent-chat-thread">
            {conversation.length === 0 ? (
              <div className="chat-empty-state">
                <MessageSquare size={20} />
                <p>No chat history yet. Ask Vector to build a physics lab or paste an AP Physics FRQ problem diagram!</p>
              </div>
            ) : (
              conversation.map((msg, index) => (
                <div key={index} className={`chat-msg-bubble ${msg.role}`}>
                  <strong className="chat-role-label">{msg.role === 'user' ? 'Student' : 'Vector AI'}</strong>
                  {msg.image && <img src={msg.image} alt="Attached diagram" className="chat-attached-img" />}
                  <LatexText text={msg.content} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="agent-reply" role="status" aria-live="polite">
        <Bot size={15} />
        <span>
          <strong>Vector</strong>
          <LatexText text={reply} />
        </span>
      </div>

      {tutor && (
        <div className="agent-tutor" aria-label="Guided problem state">
          <strong>{tutor.stage === 'worked-solution' ? 'Worked approach' : 'Problem scaffold'}</strong>
          <span><LatexText text={tutor.principle} /></span>
          <small><LatexText text={tutor.nextPrompt} /></small>
        </div>
      )}

      {proposal && (
        <div className="agent-proposal" role="dialog" aria-label="Vector world proposal">
          <strong>Proposed world change</strong>
          <p><LatexText text={proposal.summary} /></p>
          <div>
            <button type="button" onClick={() => { onApply(proposal.actions); setProposal(null); setReply('Proposal applied. What measurement should we watch first?') }}>
              <Check size={14} />Apply
            </button>
            <button type="button" onClick={() => { setProposal(null); setReply('Proposal cancelled; the current world is unchanged.') }}>
              <X size={14} />Cancel
            </button>
          </div>
        </div>
      )}

      {attachedImage && (
        <div className="agent-image-preview" aria-label="Attached diagram preview">
          <img src={attachedImage} alt="Attached physics problem" />
          <span>Attached diagram</span>
          <button type="button" onClick={() => setAttachedImage(null)} aria-label="Remove image"><X size={13} /></button>
        </div>
      )}

      <form onSubmit={submit} onPaste={handlePaste}>
        <div className="agent-mark-wrapper">
          <button
            type="button"
            className={`agent-mark-btn ${chatOpen ? 'active' : ''}`}
            onClick={toggleChat}
            title="Click V icon to open Vector AI Chat Window"
            aria-label="Toggle Vector AI Chat Window"
          >
            V
          </button>
          <span className="agent-hint-tooltip">Click V to open Chat</span>
        </div>
        <label className="visually-hidden" htmlFor="agent-command">Ask Vector, the physics agent</label>
        <input id="agent-command" value={input} onChange={(event) => setInput(event.target.value)} placeholder={attachedImage ? "Ask Vector about this image..." : "Ask Vector to build or paste diagram (Ctrl+V)..."} autoComplete="off" />
        <button type="button" className="agent-attach-btn" onClick={() => imageInputRef.current?.click()} title="Upload or paste image (Ctrl+V)" aria-label="Attach problem image"><Image size={16} /></button>
        <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleImageSelect} aria-label="Upload image file" />
        <span className="agent-source">{source === 'openai' ? 'Vector / OpenAI' : source === 'local' ? 'Vector / Local' : 'Vector'}</span>
        <button type="submit" aria-label="Send request to Vector" disabled={busy || (!input.trim() && !attachedImage)}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={17} />}</button>
      </form>
    </section>
  )
}
