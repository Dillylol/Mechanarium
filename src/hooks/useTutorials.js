import { useMemo, useState } from 'react'
import { getTutorial } from '../domain/tutorials.js'

const STORAGE_KEY = 'mechanarium:tutorial-progress:v1'
const readState = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return value && typeof value === 'object' ? value : { activeId: null, progress: {}, skipped: {} }
  } catch { return { activeId: null, progress: {}, skipped: {} } }
}

export function useTutorials({ world, notebook, history }) {
  const [state, setStateValue] = useState(readState)
  const setState = (update) => setStateValue((current) => {
    const next = typeof update === 'function' ? update(current) : update
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* optional storage */ }
    return next
  })
  const active = getTutorial(state.activeId)
  const stepIndex = active ? Math.min(state.progress[active.id] ?? 0, active.steps.length - 1) : 0
  const step = active?.steps[stepIndex] ?? null
  const canAdvance = useMemo(() => {
    if (!step) return false
    if (step.completion === 'preset') return world.scenarioId === active.presetId
    if (step.completion === 'ran') return world.time > 0 || history.length > 0
    if (step.completion === 'instrument') return world.instruments.length > 0
    if (step.completion === 'trial') return notebook.trials.length > 0
    return true
  }, [active?.presetId, history.length, notebook.trials.length, step, world.instruments.length, world.scenarioId, world.time])
  const start = (id) => setState((current) => ({ ...current, activeId: id, progress: { ...current.progress, [id]: 0 }, skipped: { ...current.skipped, [id]: false } }))
  const advance = () => {
    if (!active || !canAdvance) return
    if (stepIndex >= active.steps.length - 1) setState((current) => ({ ...current, activeId: null, progress: { ...current.progress, [active.id]: active.steps.length } }))
    else setState((current) => ({ ...current, progress: { ...current.progress, [active.id]: stepIndex + 1 } }))
  }
  const restart = () => active && setState((current) => ({ ...current, progress: { ...current.progress, [active.id]: 0 } }))
  const skip = () => active && setState((current) => ({ ...current, activeId: null, skipped: { ...current.skipped, [active.id]: true } }))
  return { state, active, step, stepIndex, canAdvance, start, advance, restart, skip, context: active ? { id: active.id, objective: active.objective, step: step.title, instruction: step.instruction, index: stepIndex + 1, total: active.steps.length } : null }
}
