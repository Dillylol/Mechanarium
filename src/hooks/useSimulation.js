import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBody, validateScenario } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { createFixedStepClock } from '../physics/clock.js'
import { magnitude } from '../physics/vector.js'
import { createWorld, stepWorld, worldToScenario } from '../physics/world.js'

const HISTORY_LIMIT = 480

function sampleWorld(world, bodyId) {
  const body = world.bodies.find((candidate) => candidate.id === bodyId) ?? world.bodies[0]
  if (!body) return null
  return {
    time: world.time,
    body: body.name,
    bodyId: body.id,
    x: body.position.x,
    y: body.position.y,
    speed: magnitude(body.velocity),
    kinetic: world.metrics.translationalKinetic + world.metrics.rotationalKinetic,
    potential: world.metrics.potential,
    totalEnergy: world.metrics.total,
    energyError: world.energyError.percent,
  }
}

export function useSimulation(initialPreset = 'projectile-motion') {
  const [sourceScenario, setSourceScenario] = useState(() => getPreset(initialPreset))
  const [world, setWorld] = useState(() => createWorld(getPreset(initialPreset)))
  const [selectedId, setSelectedId] = useState(() => getPreset(initialPreset).bodies[0].id)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [history, setHistory] = useState([])
  const worldRef = useRef(world)
  const selectedRef = useRef(selectedId)
  const clockRef = useRef(createFixedStepClock({ fixedStep: world.fixedStep }))

  useEffect(() => { worldRef.current = world }, [world])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const record = useCallback((nextWorld) => {
    const sample = sampleWorld(nextWorld, selectedRef.current)
    if (sample) setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), sample])
  }, [])

  useEffect(() => {
    if (!running) return undefined
    let frameId
    let previous = performance.now()
    const frame = (now) => {
      const elapsed = Math.min((now - previous) / 1000, 0.1) * speed
      previous = now
      let next = worldRef.current
      clockRef.current.advance(elapsed, (dt) => { next = stepWorld(next, dt) })
      worldRef.current = next
      setWorld(next)
      record(next)
      if (next.time >= next.duration) setRunning(false)
      else frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [record, running, speed])

  const replaceScenario = useCallback((scenario) => {
    const result = validateScenario(scenario)
    if (!result.valid) throw new TypeError(result.errors.join(' '))
    const nextWorld = createWorld(scenario)
    setSourceScenario(structuredClone(scenario))
    setWorld(nextWorld)
    worldRef.current = nextWorld
    clockRef.current = createFixedStepClock({ fixedStep: nextWorld.fixedStep })
    setSelectedId(nextWorld.bodies[0].id)
    setHistory([])
    setRunning(false)
  }, [])

  const loadPreset = useCallback((id) => replaceScenario(getPreset(id)), [replaceScenario])
  const reset = useCallback(() => replaceScenario(sourceScenario), [replaceScenario, sourceScenario])

  const stepOnce = useCallback(() => {
    setRunning(false)
    const next = stepWorld(worldRef.current)
    worldRef.current = next
    setWorld(next)
    record(next)
  }, [record])

  const commitScenarioEdit = useCallback((edit) => {
    const scenario = worldToScenario(worldRef.current)
    edit(scenario)
    replaceScenario(scenario)
  }, [replaceScenario])

  const updateBody = useCallback((bodyId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.map((body) => body.id === bodyId ? { ...body, ...changes } : body)
    })
    setSelectedId(bodyId)
  }, [commitScenarioEdit])

  const addBody = useCallback(() => {
    const id = `body-${Date.now()}`
    commitScenarioEdit((scenario) => {
      scenario.bodies.push(createBody({ id, name: `Body ${scenario.bodies.length + 1}`, position: { x: 0, y: 2.5 }, color: '#78e6d5' }))
    })
    setSelectedId(id)
  }, [commitScenarioEdit])

  const removeBody = useCallback((bodyId) => {
    if (worldRef.current.bodies.length <= 1) return
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.filter((body) => body.id !== bodyId)
      scenario.forces = scenario.forces.filter((force) => force.bodyId !== bodyId)
      scenario.constraints = scenario.constraints.filter((constraint) => constraint.bodyId !== bodyId)
    })
  }, [commitScenarioEdit])

  const selectedBody = useMemo(
    () => world.bodies.find((body) => body.id === selectedId) ?? world.bodies[0],
    [selectedId, world.bodies],
  )

  return {
    world,
    scenario: worldToScenario(world),
    selectedBody,
    selectedId,
    setSelectedId,
    running,
    setRunning,
    speed,
    setSpeed,
    history,
    loadPreset,
    replaceScenario,
    reset,
    stepOnce,
    updateBody,
    addBody,
    removeBody,
  }
}
