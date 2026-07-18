import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBody, validateScenario } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { createFixedStepClock } from '../physics/clock.js'
import { magnitude } from '../physics/vector.js'
import { createWorld, stepWorld, worldToScenario } from '../physics/world.js'

const HISTORY_LIMIT = 480
const UI_PUBLISH_INTERVAL_MS = 1000 / 30

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
    let previous
    let lastPublished
    const frame = (now) => {
      if (previous === undefined) {
        previous = now
        lastPublished = now
        frameId = requestAnimationFrame(frame)
        return
      }
      const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1) * speed
      previous = now
      let next = worldRef.current
      clockRef.current.advance(elapsed, (dt) => { next = stepWorld(next, dt) })
      worldRef.current = next
      if (now - lastPublished >= UI_PUBLISH_INTERVAL_MS || next.time >= next.duration) {
        lastPublished = now
        setWorld(next)
        record(next)
      }
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

  const applyActions = useCallback((actions) => {
    const presetAction = actions.find((action) => action.type === 'load_preset')
    if (presetAction?.target) {
      loadPreset(presetAction.target)
      return
    }

    const generatedIds = actions.map((_, index) => `builder-${Date.now()}-${index}`)
    commitScenarioEdit((scenario) => {
      actions.forEach((action, index) => {
        if (action.type === 'add_body') {
          const isBox = action.target === 'box'
          scenario.bodies.push(createBody({
            id: generatedIds[index],
            name: action.name || (isBox ? 'Block' : 'Sphere'),
            shape: isBox ? 'box' : 'circle',
            radius: isBox ? 0.55 : 0.42,
            width: isBox ? 1.1 : 0.84,
            height: isBox ? 1.1 : 0.84,
            position: { x: action.x ?? 0, y: action.y ?? 2.5 },
            color: isBox ? '#111111' : '#f2cf00',
          }))
        }

        if (action.type === 'add_constraint' && action.target === 'ramp') {
          scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'incline')
          scenario.constraints.push({ id: generatedIds[index], type: 'incline', start: { x: -4.5, y: 2.8 }, end: { x: 4.5, y: -2.2 }, rolling: true })
        }

        if (action.type === 'add_constraint' && action.target === 'floor') {
          scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground')
          scenario.constraints.push({ id: generatedIds[index], type: 'ground', y: -3.6, restitution: 0.72, friction: 0.04 })
        }

        if (action.type === 'add_force' && action.target === 'gravity') {
          const gravity = scenario.forces.find((force) => force.type === 'gravity' && !force.bodyId)
          if (gravity) gravity.g = action.value ?? 9.80665
          else scenario.forces.push({ id: generatedIds[index], type: 'gravity', g: action.value ?? 9.80665 })
        }

        if (action.type === 'add_force' && action.target === 'spring') {
          const bodyId = selectedRef.current ?? scenario.bodies[0]?.id
          const body = scenario.bodies.find((candidate) => candidate.id === bodyId)
          if (body) scenario.forces.push({
            id: generatedIds[index],
            type: 'spring',
            bodyId,
            anchor: { x: body.position.x - 2.5, y: body.position.y },
            stiffness: 5,
            restLength: 1.4,
            damping: 0.05,
          })
        }
      })
    })
    const addedBodyIndex = actions.findIndex((action) => action.type === 'add_body')
    if (addedBodyIndex >= 0) setSelectedId(generatedIds[addedBodyIndex])
  }, [commitScenarioEdit, loadPreset])

  const addElement = useCallback((target) => {
    const type = target === 'sphere' || target === 'box'
      ? 'add_body'
      : target === 'ramp' || target === 'floor'
        ? 'add_constraint'
        : 'add_force'
    applyActions([{ type, target }])
  }, [applyActions])

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
    addElement,
    applyActions,
    removeBody,
  }
}
